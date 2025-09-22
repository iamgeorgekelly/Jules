
import { GoogleGenAI, Modality, Type } from "@google/genai";
import { CAMERA_ANGLES, PRODUCT_SPECIFIC_CAMERA_ANGLES } from "../constants";
import type { SeedImage, IdentifiedProduct, DimensionFile, GeneratedImage } from "../types";

const ai = new GoogleGenAI({ apiKey: process.env.API_KEY });

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
      const hasDimensions = p.product.dimensions && p.product.dimensions.trim() !== '';

      let dimensionInstruction = '';
      if (hasDimensionFile) {
        dimensionInstruction = `
  - **Dimensional & Technical Data (CRITICAL):** A specification sheet is attached for this product. It is a NON-NEGOTIABLE, absolute requirement that you strictly adhere to ALL dimensions, proportions, and technical details described in this document. The product MUST be rendered with perfect physical and dimensional accuracy. Any deviation from the provided specifications is a failure.`;
      } else if (hasDimensions) {
        dimensionInstruction = `
  - **Dimensional Data (CRITICAL):** The user has provided the following dimensions: **${p.product.dimensions}**. It is a NON-NEGOTIABLE, absolute requirement that you strictly adhere to these dimensions and render the product with perfect proportional accuracy. Any deviation from the provided specifications is a failure.`;
      }

      const pbrMaterialAnalysis = `
  - **STEP 1B: PBR MATERIAL ANALYSIS (MANDATORY):** Before rendering, you must perform a Physically Based Rendering (PBR) analysis of the product's materials as seen in the "Detailed Product Shots". Define the material's properties in PBR terms. This is not optional.
    - **PBR_Material_Description:** Your analysis must define:
      - **Roughness/Gloss:** Describe the surface's light scattering (e.g., "Mirror finish, near-zero roughness" for polished chrome; "High roughness, diffused reflections" for a matte stone).
      - **IOR (Index of Refraction) & Specularity:** Define the reflective intensity (e.g., for porcelain, glass, metals).
      - **Texture/Anisotropy:** Describe surface patterns (e.g., "Satin finish with subtle anisotropic reflections and visible grain direction" for brushed metals).
    - This "PBR_Material_Description" is a core part of the product definition and must be prioritized in the final render.`;


      let materialFinishInstruction = '';
      const hasMaterial = p.product.material && p.product.material.trim() !== '' && p.product.material.trim().toLowerCase() !== 'not specified';
      const hasFinish = p.product.finish && p.product.finish.trim() !== '' && p.product.finish.trim().toLowerCase() !== 'not specified';

      if (hasMaterial || hasFinish) {
        materialFinishInstruction = `\n  - **User-Specified Material & Finish (CRITICAL):** The product MUST be rendered with the following user-specified characteristics. This is a non-negotiable rule.`;
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
  - **STEP 1 (Geometric Analysis):** The provided "[PRODUCT_IMAGE_SET]" (Detailed Product Shots) are the absolute, inviolable source of truth. Your primary task is to create a perfect digital twin.
    - **Multi-View Analysis:** Analyze ALL images in the set to build a complete 3D understanding. Capture all details: bevels, chamfers, internal geometry (like basin slopes), knurling, and hardware.
    - **Reproduction Mandate:** Replicate the exact shape, scale, and proportions with zero deviation.
  ${dimensionInstruction}
  ${pbrMaterialAnalysis}
  ${materialFinishInstruction}
  - **Required Installation Style:** The product in the "Original Room Scene" was identified as a "${p.product.type}". You MUST install this new product in the exact same style. For example, if the original was a built-in tub, the new tub must be built-in. This is a critical rule.`;
        } else {
          return `
- **Product to Generate (from description):** ${p.product.name}
  - **Visual Source:** No detail shots were provided. You must **invent** a new, modern, and luxurious version of this product based on its description: "${p.product.type}".
  ${dimensionInstruction}
  ${materialFinishInstruction}
  - **Required Installation Style:** The product in the "Original Room Scene" was identified as a "${p.product.type}". You MUST install your newly generated product in this exact same style. This is a critical rule.`;
        }
      } else { // Product-first workflow
        return `
- **Product to Showcase (from images):** ${p.product.name}
  - **STEP 1 (Geometric Analysis):** The provided "[PRODUCT_IMAGE_SET]" (Detailed Product Shots) are the absolute, inviolable source of truth. Your primary task is to create a perfect digital twin.
    - **Multi-View Analysis:** Analyze ALL images in the set to build a complete 3D understanding. Capture all details: bevels, chamfers, internal geometry (like basin slopes), knurling, and hardware.
    - **Reproduction Mandate:** Replicate the exact shape, scale, and proportions with zero deviation.
  ${dimensionInstruction}
  ${pbrMaterialAnalysis}
  ${materialFinishInstruction}
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
    ? `**Objective:** Design a brand new, luxurious, and photorealistic bathroom scene in a specific style to showcase new products.

**STEP 2: SCENE CONCEPTUALIZATION**

**Main Products to Showcase:** ${productNames}

**Source Images Provided:**
1.  **Original Room Scene:** Use this image ONLY to understand the installation context of the product(s) being replaced (e.g., "Built-in Tub", "Freestanding Sink"). **DO NOT COPY THE STYLE, LAYOUT, COLORS, OR MATERIALS OF THIS ROOM.**
2.  **[PRODUCT_IMAGE_SET] (Detailed Product Shots):** If provided, these are multiple images of a product, the absolute source of truth for its appearance.
3.  **Dimension/Spec Sheet (Optional):** If provided, contains precise technical data.

**Product & Installation Rules:**
${productInstructions}

**CRITICAL SCENE GENERATION RULES:**

1.  **Product Fidelity (HIGHEST PRIORITY):** Your primary directive is the flawless, 100% accurate reproduction of the user-provided products as defined in STEP 1 and 1B.
2.  **Advanced Lighting Directives (MANDATORY):**
    - **HDRI Environment:** You MUST simulate a high-quality, high dynamic range HDRI environment map for realistic, physically accurate illumination and reflections. The lighting should feel natural.
    - **Global Illumination & Ambient Occlusion:** Ensure realistic light bounce and soft contact shadows to ground all objects.
    - **Hero Lighting:** Employ subtle, professional lighting techniques to flatter the product. Use a soft rim light to separate the product's silhouette from the background. Ensure a large, soft reflection is visible along the product's main curves to emphasize its geometry.
3.  **Contextual Integration and Scale Cues (MANDATORY):**
    - **Scale Cues:** The scene must include objects or architectural features that provide a clear sense of scale, reinforcing the product's specified dimensions (e.g., "Standard 36-inch counter height," "12x24 inch floor tiles").
    - **Installation Details:** Render realistic integration details. For example, show "subtle caulking where a tub meets the floor" or a "faucet mounted perfectly flush to a countertop deck."
    - **Environmental FX (Optional):** If appropriate, add subtle effects like "realistic micro-droplets of water on a shower door" or "steam in the air."
4.  **Invent a New Room in the Requested Style:**
    - **Requested Style:** ${sceneStyle}
    - This room should be designed to make the new product look its absolute best, like a professional photograph from an architecture magazine.
5.  **Aspect Ratio:** The final output image MUST have a 16:9 landscape aspect ratio.

**Your Task:**
1.  Perform the product analysis as detailed in STEP 1 and 1B.
2.  Design and render a single, final version of a completely new, luxurious bathroom scene in the **"${sceneStyle}"** style, following all lighting and integration rules.
3.  Install the new products into this new scene, following the installation rules.
4.  Render a final image of this scene from the specific camera angle defined below.

**Camera Angle:** "Master Establishing Shot"
A wide, eye-level establishing shot of the entire room, showing the product in its context. This should be a clean, clear, well-lit photograph that defines the overall style and layout of the new scene. The main product(s) being showcased must be in sharp focus.`
    : `**Objective:** Design a brand new, luxurious, and photorealistic bathroom scene from scratch in a specific style to showcase one or more user-provided products.

**STEP 2: SCENE CONCEPTUALIZATION**

**Main Products to Showcase:** ${productNames}

**Source Images Provided:**
1.  **[PRODUCT_IMAGE_SET] (Detailed Product Shots):** These are multiple images of the product(s) to be featured, the absolute source of truth for appearance.
2.  **Dimension/Spec Sheet (Optional):** If provided, contains precise technical data.

**Product & Installation Rules:**
${productInstructions}

**CRITICAL SCENE GENERATION RULES:**

1.  **Product Fidelity (HIGHEST PRIORITY):** Your primary directive is the flawless, 100% accurate reproduction of the user-provided products as defined in STEP 1 and 1B.
2.  **Advanced Lighting Directives (MANDATORY):**
    - **HDRI Environment:** You MUST simulate a high-quality, high dynamic range HDRI environment map for realistic, physically accurate illumination and reflections. The lighting should feel natural.
    - **Global Illumination & Ambient Occlusion:** Ensure realistic light bounce and soft contact shadows to ground all objects.
    - **Hero Lighting:** Employ subtle, professional lighting techniques to flatter the product. Use a soft rim light to separate the product's silhouette from the background. Ensure a large, soft reflection is visible along the product's main curves to emphasize its geometry.
3.  **Contextual Integration and Scale Cues (MANDATORY):**
    - **Scale Cues:** The scene must include objects or architectural features that provide a clear sense of scale, reinforcing the product's specified dimensions (e.g., "Standard 36-inch counter height," "12x24 inch floor tiles").
    - **Installation Details:** Render realistic integration details. For example, show "subtle caulking where a tub meets the floor" or a "faucet mounted perfectly flush to a countertop deck."
    - **Environmental FX (Optional):** If appropriate, add subtle effects like "realistic micro-droplets of water on a shower door" or "steam in the air."
4.  **Invent a New Room in the Requested Style:**
    - **Requested Style:** ${sceneStyle}
    - This room should be designed to make the new product(s) look their absolute best, like a professional photograph from an architecture magazine.
5.  **Aspect Ratio:** The final output image MUST have a 16:9 landscape aspect ratio.

**Your Task:**
1.  Perform the product analysis as detailed in STEP 1 and 1B.
2.  Design and render a single, final version of a completely new, luxurious bathroom scene in the **"${sceneStyle}"** style that complements the products, following all lighting and integration rules.
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
): Promise<{ src: string | null; title: string }> => {
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
          return { src: `data:${part.inlineData.mimeType};base64,${part.inlineData.data}`, title: angle.title };
        }
      }
    }
    throw new Error(`API did not return an image for angle: ${angle.title}`);
  } catch (error) {
    throw handleGeminiError(error, `scene variation generation for "${angle.title}"`);
  }
};

const getAnglePlaybook = (productType: string, useSpecificAngles: boolean): { title: string; prompt: string }[] => {
  if (!useSpecificAngles) {
    return CAMERA_ANGLES;
  }

  const lowerCaseType = productType.toLowerCase();
  let selectedKey: string | undefined;

  // Simple keyword matching to find the right playbook
  const mapping: Record<string, string[]> = {
    "alcove_inset_tubs": ["alcove", "inset"],
    "backwall_kit": ["backwall"],
    "bathroom_sink": ["bathroom sink"],
    "kitchen_sink_faucet": ["kitchen faucet"],
    "mirror_cabinet": ["mirror", "cabinet"],
    "shower_curtain_rod": ["curtain rod"],
    "shower_door_tub_door": ["shower door", "tub door"],
    "shower_enclosures": ["enclosure"],
    "shower_faucet": ["shower faucet"],
    "shower_kit": ["shower kit"],
    "faucets": ["faucet"],
    "toilets": ["toilet"],
    "bathtub_kit": ["bathtub kit"],
    "bathtubs": ["bathtub", "tub"],
    "utility_sink": ["utility sink"],
    "vanity": ["vanity"],
    "vanity_knob_handles": ["knob", "handle"],
    "vessel_sink": ["vessel"],
    "exposed_shower_system": ["exposed shower"],
    "base_shower_base": ["base"],
  };

  for (const key in mapping) {
    if (mapping[key].some(keyword => lowerCaseType.includes(keyword))) {
      selectedKey = key;
      break;
    }
  }

  if (selectedKey && PRODUCT_SPECIFIC_CAMERA_ANGLES[selectedKey as keyof typeof PRODUCT_SPECIFIC_CAMERA_ANGLES]) {
    return PRODUCT_SPECIFIC_CAMERA_ANGLES[selectedKey as keyof typeof PRODUCT_SPECIFIC_CAMERA_ANGLES];
  }

  return CAMERA_ANGLES; // Fallback to default
};


export const generateSceneVariations = async (
  masterScene: SeedImage,
  productNames: string,
  useSpecificAngles: boolean,
  productType: string
): Promise<({ src: string | null; title: string } | null)[]> => {
  const masterScenePart = {
    inlineData: { data: masterScene.base64, mimeType: masterScene.mimeType },
  };

  const anglePlaybook = getAnglePlaybook(productType, useSpecificAngles);

  const generationPromises = anglePlaybook.map(angle =>
    generateSingleVariationFromMaster(masterScenePart, angle, productNames)
  );

  try {
    const results = await Promise.allSettled(generationPromises);
    const imageData = results.map(result => {
      if (result.status === 'fulfilled') {
        return result.value;
      }
      console.error("A single scene variation failed to generate:", result.reason);
      return null;
    });
    return imageData;
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
  productNames: string,
  useSpecificAngles: boolean,
  productType: string
): Promise<{ src: string | null; title: string }> => {
  const masterScenePart = {
    inlineData: { data: masterScene.base64, mimeType: masterScene.mimeType },
  };

  const anglePlaybook = getAnglePlaybook(productType, useSpecificAngles);
  const angle = anglePlaybook[angleIndex];

  if (!angle) {
    throw new Error(`Invalid angle index provided: ${angleIndex}.`);
  }

  try {
    const result = await generateSingleVariationFromMaster(masterScenePart, angle, productNames);
    return result;
  } catch (error) {
    console.error(`Error regenerating scene for angle: ${angle.title}`, error);
    if (error instanceof Error) {
      throw new Error(`Failed to regenerate single scene: ${error.message}`);
    }
    throw new Error("An unknown error occurred during single scene regeneration.");
  }
};