
import { GoogleGenAI, Modality, Type } from "@google/genai";
import { CAMERA_ANGLES } from "../constants";
import type { SeedImage, IdentifiedProduct, DimensionFile } from "../types";

const ai = new GoogleGenAI({ apiKey: "AIzaSyDWKvyVx1vGQzppM0IMCnbzTWrkn4ZSSqo" });

const handleGeminiError = (error: any, context: string): Error => {
  console.error(`Error during ${context} with Gemini API:`, error);

  let errorMessage = `An unknown error occurred during ${context}. Please try again.`;
  let rawMessage = '';

  if (error instanceof Error) {
    rawMessage = error.message;
  } else {
    try {
      rawMessage = JSON.stringify(error);
    } catch {
      rawMessage = String(error);
    }
  }

  if (rawMessage.includes('RESOURCE_EXHAUSTED') || rawMessage.includes('429')) {
      errorMessage = 'You have exceeded your API request quota. Please check your plan and billing details, or try again later.';
  } else if (rawMessage.toLowerCase().includes('api key not valid')) {
      errorMessage = 'Your API key is not valid. Please ensure it is configured correctly.';
  } else {
      errorMessage = `Failed to complete ${context}. The API returned an error.`;
  }

  return new Error(errorMessage);
};


export const identifyProductsInScene = async (roomImage: SeedImage): Promise<IdentifiedProduct[]> => {
  try {
    const response = await ai.models.generateContent({
      model: "gemini-2.5-flash",
      contents: {
        parts: [
          {
            inlineData: {
              data: roomImage.base64,
              mimeType: roomImage.mimeType,
            },
          },
          { 
            text: `Analyze this image of a room. Identify the main, distinct products in the scene (e.g., bathtub, sink, faucet, toilet, vanity). For each product, provide a short, simple name and a descriptive type that includes its installation style (e.g., "Built-in Tub", "Freestanding Sink", "Wall-mounted Faucet"). Provide the output as a JSON array.`,
          },
        ],
      },
      config: {
        responseMimeType: "application/json",
        responseSchema: {
          type: Type.ARRAY,
          items: {
            type: Type.OBJECT,
            properties: {
              id: { type: Type.STRING, description: 'A unique identifier, e.g., "product-1"' },
              name: { type: Type.STRING, description: 'A simple name, e.g., "Bathtub"' },
              type: { type: Type.STRING, description: 'A descriptive type, e.g., "Freestanding Acrylic Tub"' },
            },
            required: ["id", "name", "type"],
          },
        },
      },
    });

    const jsonText = response.text.trim();
    const result = JSON.parse(jsonText);
    
    // Add a unique ID if the model doesn't provide one reliably
    return result.map((item: any, index: number) => ({...item, id: `product-${index + 1}`}));

  } catch (error) {
    throw handleGeminiError(error, "product identification");
  }
};

const getBaseGenerationParts = (
  roomScene: SeedImage | null,
  selectedProductsWithData: { product: IdentifiedProduct; images: SeedImage[]; dimensionFile: DimensionFile | null }[]
) => {
  const roomScenePart = roomScene 
    ? { inlineData: { data: roomScene.base64, mimeType: roomScene.mimeType } }
    : null;

  const detailedProductParts = selectedProductsWithData.flatMap(p => 
    p.images.map(img => ({
      inlineData: { data: img.base64, mimeType: img.mimeType },
    }))
  );
  
  const dimensionFileParts = selectedProductsWithData
    .filter(p => p.dimensionFile)
    .map(p => ({
        inlineData: { data: p.dimensionFile!.base64, mimeType: p.dimensionFile!.mimeType }
    }));


  const productInstructions = selectedProductsWithData
    .map(p => {
      const hasDetailShots = p.images && p.images.length > 0;
      const hasDimensionFile = !!p.dimensionFile;
      
      let dimensionInstruction = '';
      if (hasDimensionFile) {
        dimensionInstruction = `
  - **Dimensional & Technical Data (CRITICAL):** A specification sheet is attached for this product. It is a NON-NEGOTIABLE, absolute requirement that you strictly adhere to ALL dimensions, proportions, and technical details described in this document. The product MUST be rendered with perfect physical and dimensional accuracy. Any deviation from the provided specifications is a failure.`;
      }

      let materialFinishInstruction = '';
      const hasMaterial = p.product.material && p.product.material.trim() !== '' && p.product.material.trim().toLowerCase() !== 'not specified';
      const hasFinish = p.product.finish && p.product.finish.trim() !== '' && p.product.finish.trim().toLowerCase() !== 'not specified';

      if (hasMaterial || hasFinish) {
          materialFinishInstruction = `\n  - **Material & Finish (CRITICAL):** The product MUST be rendered with the following user-specified characteristics. This is a non-negotiable rule.`;
          if (hasMaterial) {
              materialFinishInstruction += `\n    - **Material:** ${p.product.material}`;
          }
          if (hasFinish) {
              materialFinishInstruction += `\n    - **Finish:** ${p.product.finish}`;
          }
      }

      if (roomScene) { // Scene-based workflow
        if (hasDetailShots) {
          return `
- **Product to Showcase (from images):** ${p.product.name}
  - **Visual Source & Reproduction Mandate (NON-NEGOTIABLE CORE DIRECTIVE):** The provided "Detailed Product Shots" are the absolute, inviolable source of truth for this product's appearance. Your single most important task is to create an identical, photorealistic digital twin. You are not an artist here; you are a precision replicator. You must carefully analyze the object's shape and form from the provided images, including its contours, silhouette, and three-dimensional structure. You MUST replicate its exact shape, precise dimensions, specific color values, surface texture, material properties, and every single design detail with zero deviation. Any artistic license, interpretation, or modification—no matter how small—is a complete failure of the task.${dimensionInstruction}${materialFinishInstruction}
  - **Required Installation Style:** The product in the "Original Room Scene" was identified as a "${p.product.type}". You MUST install this new product in the exact same style. For example, if the original was a built-in tub, the new tub must be built-in. This is a critical rule.`;
        } else {
          return `
- **Product to Generate (from description):** ${p.product.name}
  - **Visual Source:** No detail shots were provided. You must **invent** a new, modern, and luxurious version of this product based on its description: "${p.product.type}".${dimensionInstruction}${materialFinishInstruction}
  - **Required Installation Style:** The product in the "Original Room Scene" was identified as a "${p.product.type}". You MUST install your newly generated product in this exact same style. This is a critical rule.`;
        }
      } else { // Product-first workflow
        return `
- **Product to Showcase (from images):** ${p.product.name}
  - **Visual Source & Reproduction Mandate (NON-NEGOTIABLE CORE DIRECTIVE):** The provided "Detailed Product Shots" are the absolute, inviolable source of truth for this product's appearance. Your single most important task is to create an identical, photorealistic digital twin. You are not an artist here; you are a precision replicator. You must carefully analyze the object's shape and form from the provided images, including its contours, silhouette, and three-dimensional structure. You MUST replicate its exact shape, precise dimensions, specific color values, surface texture, material properties, and every single design detail with zero deviation. Any artistic license, interpretation, or modification—no matter how small—is a complete failure of the task.${dimensionInstruction}${materialFinishInstruction}
  - **Required Installation Style:** You must install this product based on its description: "${p.product.type}". For example, if it's a "Wall-mounted Faucet", it must be attached to a wall. Use a logical and aesthetically pleasing installation for the new room you are creating. This is a critical rule.`;
      }
    }).join('');

  return { roomScenePart, detailedProductParts, dimensionFileParts, productInstructions };
};

export const generateMasterScene = async (
  roomScene: SeedImage | null,
  selectedProductsWithData: { product: IdentifiedProduct; images: SeedImage[], dimensionFile: DimensionFile | null }[],
  sceneStyle: string
): Promise<string> => {
    const { roomScenePart, detailedProductParts, dimensionFileParts, productInstructions } = getBaseGenerationParts(roomScene, selectedProductsWithData);
    const productNames = selectedProductsWithData.map(p => p.product.name).join(', ');

    const fullPrompt = roomScene
      ? `**Objective:** Design a brand new, luxurious, and photorealistic bathroom scene in a specific style to showcase new products. A product's appearance is either defined by "Detailed Product Shots" if they are provided, or generated by you based on a description if they are not. The installation method for all products is dictated by the "Original Room Scene."

**Main Products to Showcase:** ${productNames}

**Source Images Provided:**
1.  **Original Room Scene:** Use this image ONLY to understand the installation context of the product(s) being replaced (e.g., "Built-in Tub", "Freestanding Sink"). **DO NOT COPY THE STYLE, LAYOUT, COLORS, OR MATERIALS OF THIS ROOM.** The final images should look nothing like this room.
2.  **Detailed Product Shots (Optional):** If provided for a specific product, these are multiple, high-resolution images of that product. They are the absolute source of truth for that product's appearance.
3.  **Dimension/Spec Sheet (Optional):** If provided, this document contains precise technical data about the product.

**Product & Installation Rules:**
${productInstructions}

**CRITICAL RULES:**

1.  **Product Reproduction Accuracy (ABSOLUTE HIGHEST PRIORITY):** Your primary, non-negotiable directive is the flawless, 100% accurate reproduction of the user-provided products.
    - **Visuals (The Unbreakable Rule):** When "Detailed Product Shots" are provided, your output must be an identical digital copy. Study the images meticulously, performing a deep analysis of the product's form. Pay close attention to its overall silhouette, the curvature of surfaces, the sharpness of edges, and the precise geometry of all components. The final rendered product's shape, scale, proportions, color, texture, material sheen, and every single design feature (curves, edges, handles, etc.) MUST be a perfect, 1:1 match to the source images. There is zero room for creative interpretation. Do not 'improve' or 'adapt' the design. Replicate it exactly.
    - **Dimensions:** When a "Dimension/Spec Sheet" is provided, you MUST strictly and precisely adhere to ALL its specifications. This is non-negotiable.
    - **Functional Details:** All functional elements like drain openings, faucet holes, and handles must be rendered with perfect physical accuracy as seen in the source materials.
2.  **Invent a New Room in a Specific Style:** You must create a completely new, modern, and aesthetically pleasing bathroom environment from your imagination based on the requested style.
    - **Requested Style:** ${sceneStyle}
    - This room should be designed to make the new product look its absolute best, like a professional photograph from an architecture magazine. The final scene must be original and should not resemble the "Original Room Scene" in any way.
3.  **Contextual Installation:** While the room is new, the product installation MUST follow the style derived from the "Original Room Scene" as specified above. The product must connect to the new room's architecture (walls, floor, plumbing) in a logical and physically believable way based on its type.
4.  **Aspect Ratio:** The final output image MUST have a 16:9 landscape aspect ratio. This is a strict rendering requirement.

**Your Task:**
1.  Analyze any "Detailed Product Shots" and "Dimension/Spec Sheets" to create perfect, photorealistic digital twins of those new products.
2.  For products without detail shots, invent a new, luxurious product based on its description.
3.  Analyze the "Original Room Scene" ONLY to determine the required installation style for each product.
4.  Design and render a single, final version of a completely new, luxurious bathroom scene in the **"${sceneStyle}"** style.
5.  Install the new products into this new scene, following the installation rules.
6.  Render a final image of this scene from the specific camera angle defined below.

**Camera Angle:** "Master Establishing Shot"
A wide, eye-level establishing shot of the entire room, showing the product in its context. This should be a clean, clear, well-lit photograph that defines the overall style and layout of the new scene. The main product(s) being showcased must be in sharp focus.`
      : `**Objective:** Design a brand new, luxurious, and photorealistic bathroom scene from scratch in a specific style to showcase one or more user-provided products.

**Main Products to Showcase:** ${productNames}

**Source Images Provided:**
1.  **Detailed Product Shots:** These are multiple, high-resolution images of the product(s) to be featured. They are the absolute source of truth for the product's appearance.
2.  **Dimension/Spec Sheet (Optional):** If provided, this document contains precise technical data about the product.

**Product & Installation Rules:**
${productInstructions}

**CRITICAL RULES:**

1.  **Product Reproduction Accuracy (ABSOLUTE HIGHEST PRIORITY):** Your primary, non-negotiable directive is the flawless, 100% accurate reproduction of the user-provided products.
    - **Visuals (The Unbreakable Rule):** When "Detailed Product Shots" are provided, your output must be an identical digital copy. Study the images meticulously, performing a deep analysis of the product's form. Pay close attention to its overall silhouette, the curvature of surfaces, the sharpness of edges, and the precise geometry of all components. The final rendered product's shape, scale, proportions, color, texture, material sheen, and every single design feature (curves, edges, handles, etc.) MUST be a perfect, 1:1 match to the source images. There is zero room for creative interpretation. Do not 'improve' or 'adapt' the design. Replicate it exactly.
    - **Dimensions:** When a "Dimension/Spec Sheet" is provided, you MUST strictly and precisely adhere to ALL its specifications. This is non-negotiable.
    - **Functional Details:** All functional elements like drain openings, faucet holes, and handles must be rendered with perfect physical accuracy as seen in the source materials.
2.  **Invent a New Room in a Specific Style:** You must create a completely new, modern, and aesthetically pleasing bathroom environment from your imagination based on the requested style.
    - **Requested Style:** ${sceneStyle}
    - This room should be designed to make the new product(s) look their absolute best, like a professional photograph from an architecture magazine.
3.  **Contextual Installation:** The product installation MUST follow the description provided for it (e.g., "Freestanding Tub," "Wall-mounted Faucet"). The product must connect to the new room's architecture (walls, floor, plumbing) in a logical and physically believable way.
4.  **Aspect Ratio:** The final output image MUST have a 16:9 landscape aspect ratio. This is a strict rendering requirement.

**Your Task:**
1.  Analyze the "Detailed Product Shots" and "Dimension/Spec Sheets" to create perfect, photorealistic digital twins of the new products.
2.  Design and render a single, final version of a completely new, luxurious bathroom scene in the **"${sceneStyle}"** style that complements the products.
3.  Install the new products into this new scene, following the installation rules.
4.  Render a final image of this scene from the specific camera angle defined below.

**Camera Angle:** "Master Establishing Shot"
A wide, eye-level establishing shot of the entire room, showing the product in its context. This should be a clean, clear, well-lit photograph that defines the overall style and layout of the new scene. The main product(s) being showcased must be in sharp focus.`;

    try {
        const allParts = [
            { text: fullPrompt },
            ...(roomScenePart ? [roomScenePart] : []),
            ...detailedProductParts,
            ...dimensionFileParts
        ];

        const response = await ai.models.generateContent({
            model: 'gemini-2.5-flash-image-preview',
            contents: { parts: allParts },
            config: { responseModalities: [Modality.IMAGE, Modality.TEXT] },
        });

        if (response.candidates?.[0]?.content?.parts) {
            for (const part of response.candidates[0].content.parts) {
                if (part.inlineData) {
                    return `data:${part.inlineData.mimeType};base64,${part.inlineData.data}`;
                }
            }
        }
        throw new Error("API did not return an image for the master scene.");
    } catch (error) {
        throw handleGeminiError(error, "master scene generation");
    }
};

const generateSingleVariationFromMaster = async (
  masterScenePart: { inlineData: { data: string; mimeType: string; } },
  angle: { title: string; prompt: string; },
  productNames: string
): Promise<string> => {
  const fullPrompt = `**Objective:** Re-shoot an established scene from a specific new camera angle while maintaining perfect continuity.

**Source Image Provided:**
1.  **Master Scene Image:** This is the single, perfect, wide-shot photograph of the final room. This image is the **absolute and non-negotiable source of truth** for the room's architecture, materials, colors, lighting, style, and the product's appearance and placement within it.

**The Main Object(s) of Focus:** The primary subject(s) for this new shot are: **${productNames}**. Ensure the camera angle and composition highlight this/these product(s) as the hero element(s) of the image.

**CRITICAL RULES:**

1.  **Perfect Continuity (Highest Priority):** You MUST render the new image from *within the exact same room* depicted in the "Master Scene Image". Every single detail—the walls, floor, window, view, lighting, textures, and the product itself—must be perfectly and identically consistent. The new image must look like it was taken seconds after the master shot, just from a different camera position. Any deviation is a failure. Pay special attention to the main product(s): their form, proportions, color, texture, and functional details (like drain location, handles, etc.) MUST be rendered with absolute, unwavering consistency between this shot and the master scene. It must be the exact same object, just viewed from a different angle.
2.  **Camera Angle Execution:** You must precisely follow the new camera angle instructions provided below. Do not change the scene; only change the camera's position and framing as instructed.
3.  **Aspect Ratio:** The final output image MUST have a 16:9 landscape aspect ratio. This is a strict rendering requirement.

**Your Task:**
1.  Analyze the "Master Scene Image" to perfectly understand the entire scene.
2.  Recreate this scene with 100% fidelity in your internal 3D space.
3.  Position your virtual camera according to the specified "Camera Angle."
4.  Render a new, photorealistic image from that perspective. This is your only output.

**Camera Angle:** "${angle.title}"
${angle.prompt}
`;
  
  try {
    const response = await ai.models.generateContent({
      model: 'gemini-2.5-flash-image-preview',
      contents: { parts: [{ text: fullPrompt }, masterScenePart] },
      config: { responseModalities: [Modality.IMAGE, Modality.TEXT] },
    });

    if (response.candidates?.[0]?.content?.parts) {
      for (const part of response.candidates[0].content.parts) {
        if (part.inlineData) {
          return `data:${part.inlineData.mimeType};base64,${part.inlineData.data}`;
        }
      }
    }
    throw new Error(`API did not return an image for angle: ${angle.title}`);
  } catch (error) {
    throw handleGeminiError(error, `scene variation generation for "${angle.title}"`);
  }
};


export const generateSceneVariations = async (
  masterScene: SeedImage,
  productNames: string
): Promise<(string | null)[]> => {
  const masterScenePart = {
    inlineData: { data: masterScene.base64, mimeType: masterScene.mimeType },
  };

  const generationPromises = CAMERA_ANGLES.map(angle => 
    generateSingleVariationFromMaster(masterScenePart, angle, productNames)
  );

  try {
      const results = await Promise.allSettled(generationPromises);
      const imageUrls = results.map(result => {
        if (result.status === 'fulfilled') {
          return result.value;
        }
        console.error("A single scene variation failed to generate:", result.reason);
        return null;
      });
      return imageUrls;
  } catch (error) {
      console.error("Error generating scene variations with Gemini API:", error);
      if (error instanceof Error) {
          throw new Error(`Failed to generate scene variations: ${error.message}`);
      }
      throw new Error("An unknown error occurred during scene variation generation.");
  }
};

export const regenerateSingleSceneVariation = async (
  masterScene: SeedImage,
  angleIndex: number,
  productNames: string
): Promise<string> => {
  const masterScenePart = {
    inlineData: { data: masterScene.base64, mimeType: masterScene.mimeType },
  };
  const angle = CAMERA_ANGLES[angleIndex];
  if (!angle) {
    throw new Error(`Invalid angle index provided: ${angleIndex}.`);
  }

  try {
    return await generateSingleVariationFromMaster(masterScenePart, angle, productNames);
  } catch (error) {
    console.error(`Error regenerating scene for angle: ${angle.title}`, error);
    if (error instanceof Error) {
      throw new Error(`Failed to regenerate single scene: ${error.message}`);
    }
    throw new Error("An unknown error occurred during single scene regeneration.");
  }
};
