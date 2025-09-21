import React, { useState, useCallback, useEffect } from 'react';
import Header from './components/Header';
import ImageUpload from './components/ImageUpload';
import FileUpload from './components/FileUpload';
import Button from './components/Button';
import ImageGrid from './components/ImageGrid';
import { identifyProductsInScene, generateSceneVariations, generateMasterScene, regenerateSingleSceneVariation } from './services/geminiService';
import { CAMERA_ANGLES, ROOM_STYLES, MATERIALS, FINISHES } from './constants';
import type { SeedImage, GeneratedImage, IdentifiedProduct, WorkflowStep, DimensionFile } from './types';

const App: React.FC = () => {
  const [step, setStep] = useState<WorkflowStep>('workflow_selection');
  const [roomScene, setRoomScene] = useState<SeedImage | null>(null);
  const [identifiedProducts, setIdentifiedProducts] = useState<IdentifiedProduct[]>([]);
  const [selectedProductIds, setSelectedProductIds] = useState<Set<string>>(new Set());
  const [detailedShots, setDetailedShots] = useState<Record<string, SeedImage[]>>({});
  const [dimensionFiles, setDimensionFiles] = useState<Record<string, DimensionFile | null>>({});
  const [masterSceneImage, setMasterSceneImage] = useState<string | null>(null);
  const [sceneStyle, setSceneStyle] = useState<string>(ROOM_STYLES[0]);
  const [customSceneStyle, setCustomSceneStyle] = useState<string>('');
  
  const [generatedImages, setGeneratedImages] = useState<GeneratedImage[]>([]);
  const [isLoading, setIsLoading] = useState<boolean>(false);
  const [loadingMessage, setLoadingMessage] = useState<string>('');
  const [error, setError] = useState<string | null>(null);
  const [regeneratingImageId, setRegeneratingImageId] = useState<number | null>(null);

  const getSelectedProductsWithData = useCallback(() => {
    return Array.from(selectedProductIds)
      .map(id => identifiedProducts.find(p => p.id === id))
      .filter((p): p is IdentifiedProduct => !!p)
      .map(product => ({
        product,
        images: detailedShots[product.id] || [],
        dimensionFile: dimensionFiles[product.id] || null,
      }));
  }, [selectedProductIds, identifiedProducts, detailedShots, dimensionFiles]);


  useEffect(() => {
    const runProductIdentification = async () => {
      if (step === 'product_identification' && roomScene) {
        setIsLoading(true);
        setError(null);
        setLoadingMessage('AI is identifying products in your scene...');
        try {
          const products = await identifyProductsInScene(roomScene);
          setIdentifiedProducts(products);
          setStep('product_selection');
        } catch (err: any) {
          setError(err.message || 'Failed to identify products.');
          setStep('scene_upload'); // Revert on error
        } finally {
          setIsLoading(false);
          setLoadingMessage('');
        }
      }
    };
    runProductIdentification();
  }, [step, roomScene]);

  useEffect(() => {
    const runMasterSceneGeneration = async () => {
      if (step === 'master_scene_generation') {
        setIsLoading(true);
        setError(null);
        setLoadingMessage('Generating new room concept...');
        try {
          const productsToInclude = getSelectedProductsWithData();
          const finalSceneStyle = sceneStyle === 'Custom' ? customSceneStyle : sceneStyle;

          if (finalSceneStyle.trim() === '') {
            setError('Please enter a custom style or select a predefined one.');
            setStep(roomScene ? 'detail_upload' : 'direct_product_upload');
            setIsLoading(false);
            return;
          }

          const masterImage = await generateMasterScene(roomScene, productsToInclude, finalSceneStyle);
          setMasterSceneImage(masterImage);
          setStep('scene_approval');
        } catch (err: any) {
          setError(err.message || 'Failed to generate master scene.');
          setStep(roomScene ? 'detail_upload' : 'direct_product_upload'); // Revert on error
        } finally {
          setIsLoading(false);
          setLoadingMessage('');
        }
      }
    };
    runMasterSceneGeneration();
  }, [step, roomScene, getSelectedProductsWithData, sceneStyle, customSceneStyle]);


  const handleSceneUpload = useCallback((images: SeedImage[]) => {
    if (images.length > 0) {
      setRoomScene(images[0]);
      setStep('product_identification');
    } else {
      setRoomScene(null);
    }
  }, []);
  
  const handleToggleProductSelection = (productId: string) => {
    setSelectedProductIds(prev => {
      const newSet = new Set(prev);
      if (newSet.has(productId)) {
        newSet.delete(productId);
      } else {
        newSet.add(productId);
      }
      return newSet;
    });
  };

  const handleDetailUpload = (productId: string, images: SeedImage[]) => {
    setDetailedShots(prev => ({
      ...prev,
      [productId]: images,
    }));
  };
  
  const handleDimensionFileUpload = (productId: string, file: DimensionFile | null) => {
    setDimensionFiles(prev => ({
        ...prev,
        [productId]: file,
    }));
  };

  const handleProceedToMasterSceneGeneration = () => {
    setError(null);
    setStep('master_scene_generation');
  };
  
  const handleGenerateFinalScenes = async () => {
    if (!masterSceneImage) {
      setError('A master scene is required to generate variations.');
      return;
    }
    
    setIsLoading(true);
    setLoadingMessage('Generating your final scenes...');
    setError(null);
    setStep('generating');
    setGeneratedImages([]);

    try {
      const mimeType = masterSceneImage.match(/data:(.*);base64,/)?.[1];
      if (!mimeType) throw new Error("Could not determine MIME type of master scene image.");
      const base64 = masterSceneImage.split(',')[1];
      const masterSeedImage: SeedImage = { base64, mimeType };

      const productsToInclude = getSelectedProductsWithData();
      const productNames = productsToInclude.map(p => p.product.name).join(', ') || 'the main product';

      const imageUrls = await generateSceneVariations(masterSeedImage, productNames);
      const newImages = imageUrls.map((url, index) => ({
        id: index,
        src: url,
        title: CAMERA_ANGLES[index]?.title || `Image ${index + 1}`,
      }));
      setGeneratedImages(newImages);
      setStep('results');
    } catch (err: any) {
      setError(err.message || 'An unexpected error occurred.');
       setStep('scene_approval'); // Revert to allow changes
    } finally {
      setIsLoading(false);
      setLoadingMessage('');
    }
  };

  const handleRegenerateSingleImage = async (imageId: number) => {
    if (!masterSceneImage) {
      setError('Cannot regenerate without a master scene.');
      return;
    }
    if (regeneratingImageId !== null) return; // Prevent multiple concurrent regenerations

    setRegeneratingImageId(imageId);
    setError(null);

    try {
      const mimeType = masterSceneImage.match(/data:(.*);base64,/)?.[1];
      if (!mimeType) throw new Error("Could not determine MIME type of master scene image.");
      const base64 = masterSceneImage.split(',')[1];
      const masterSeedImage: SeedImage = { base64, mimeType };

      const productsToInclude = getSelectedProductsWithData();
      const productNames = productsToInclude.map(p => p.product.name).join(', ') || 'the main product';

      const newImageUrl = await regenerateSingleSceneVariation(masterSeedImage, imageId, productNames);
      
      setGeneratedImages(prevImages => {
        const newImages = [...prevImages];
        newImages[imageId] = { ...newImages[imageId], src: newImageUrl };
        return newImages;
      });

    } catch (err: any) {
      setError(err.message || 'Failed to regenerate image.');
    } finally {
      setRegeneratingImageId(null);
    }
  };

  const handleSelectWorkflow = (type: 'scene' | 'product') => {
    resetFlow(false);
    if (type === 'scene') {
      setStep('scene_upload');
    } else {
      const initialProductId = `product-${Date.now()}`;
      const initialProduct: IdentifiedProduct = {
        id: initialProductId,
        name: '',
        type: '',
        material: '',
        finish: '',
      };
      setIdentifiedProducts([initialProduct]);
      setSelectedProductIds(new Set([initialProductId]));
      setStep('direct_product_upload');
    }
  };

  const handleAddDirectProduct = () => {
    const newId = `product-${Date.now()}`;
    const newProduct: IdentifiedProduct = {
      id: newId,
      name: '',
      type: '',
      material: '',
      finish: '',
    };
    setIdentifiedProducts(prev => [...prev, newProduct]);
    setSelectedProductIds(prev => new Set(prev).add(newId));
  };
  
  const handleRemoveDirectProduct = (idToRemove: string) => {
    if (identifiedProducts.length <= 1) return; // Must have at least one product
    setIdentifiedProducts(prev => prev.filter(p => p.id !== idToRemove));
    setSelectedProductIds(prev => {
      const newSet = new Set(prev);
      newSet.delete(idToRemove);
      return newSet;
    });
    setDetailedShots(prev => {
      const newShots = { ...prev };
      delete newShots[idToRemove];
      return newShots;
    });
    setDimensionFiles(prev => {
      const newFiles = { ...prev };
      delete newFiles[idToRemove];
      return newFiles;
    });
  };
  
  const handleDirectProductChange = (id: string, field: 'name' | 'type' | 'material' | 'finish', value: string) => {
    setIdentifiedProducts(prev => prev.map(p => p.id === id ? { ...p, [field]: value } : p));
  };

  const selectedProducts = identifiedProducts.filter(p => selectedProductIds.has(p.id));

  const resetFlow = (toStart = true) => {
    setStep(toStart ? 'workflow_selection' : step);
    setRoomScene(null);
    setIdentifiedProducts([]);
    setSelectedProductIds(new Set());
    setDetailedShots({});
    setDimensionFiles({});
    setMasterSceneImage(null);
    setGeneratedImages([]);
    setError(null);
    setIsLoading(false);
    setSceneStyle(ROOM_STYLES[0]);
    setCustomSceneStyle('');
  };
  
  const renderStepContent = () => {
    switch(step) {
      case 'workflow_selection':
        return (
          <div className="space-y-6 text-center">
             <h2 className="text-xl font-semibold text-slate-300">Choose Your Starting Point</h2>
             <div className="flex flex-col md:flex-row gap-4">
                <button onClick={() => handleSelectWorkflow('scene')} className="flex-1 p-6 bg-slate-800 rounded-lg border-2 border-slate-700 hover:border-sky-500 transition-all duration-300 focus:outline-none focus:ring-2 focus:ring-sky-500">
                    <h3 className="text-lg font-bold text-sky-400">Start with a Room Scene</h3>
                    <p className="text-slate-400 mt-1 text-sm">Upload a photo of an existing room to replace products within it.</p>
                </button>
                <button onClick={() => handleSelectWorkflow('product')} className="flex-1 p-6 bg-slate-800 rounded-lg border-2 border-slate-700 hover:border-sky-500 transition-all duration-300 focus:outline-none focus:ring-2 focus:ring-sky-500">
                    <h3 className="text-lg font-bold text-sky-400">Start with Product Images</h3>
                    <p className="text-slate-400 mt-1 text-sm">Upload your own product shots to generate a new scene from scratch.</p>
                </button>
             </div>
          </div>
        );

      case 'scene_upload':
        return (
          <ImageUpload 
            onImageUpload={handleSceneUpload} 
            title="1. Upload a Room Scene"
            allowMultiple={false}
          />
        );

      case 'product_identification':
      case 'master_scene_generation':
        return (
          <div className="text-center p-8 bg-slate-800 rounded-lg">
            <svg className="animate-spin mx-auto h-12 w-12 text-sky-400" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24">
              <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
              <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
            </svg>
            <p className="mt-4 text-slate-300">{loadingMessage}</p>
          </div>
        );

      case 'product_selection':
        return (
          <div className="space-y-6">
            <div>
                <h2 className="text-lg font-semibold text-slate-300 mb-2">1. Your Room Scene</h2>
                <img src={`data:${roomScene?.mimeType};base64,${roomScene?.base64}`} alt="Room scene" className="rounded-lg max-h-64 mx-auto" />
            </div>
            <div>
              <label className="block text-sm font-medium text-slate-300 mb-2">
                2. Select Products to Replace
              </label>
              <div className="space-y-2 bg-slate-800 p-4 rounded-md border border-slate-700">
                {identifiedProducts.map(product => (
                  <div key={product.id} className="flex items-center">
                    <input 
                      id={`product-${product.id}`}
                      type="checkbox"
                      checked={selectedProductIds.has(product.id)}
                      onChange={() => handleToggleProductSelection(product.id)}
                      className="h-4 w-4 rounded border-slate-500 bg-slate-700 text-sky-600 focus:ring-sky-500"
                    />
                    <label htmlFor={`product-${product.id}`} className="ml-3 block text-sm text-slate-200">
                      {product.name} <span className="text-slate-400">({product.type})</span>
                    </label>
                  </div>
                ))}
              </div>
            </div>
            <Button onClick={() => setStep('detail_upload')} disabled={selectedProductIds.size === 0}>
              Next: Upload Product Details
            </Button>
          </div>
        );

      case 'direct_product_upload':
        const isDirectUploadGenerateDisabled = selectedProducts.some(p => !p.name.trim() || !p.type.trim() || !detailedShots[p.id] || detailedShots[p.id].length === 0) || (sceneStyle === 'Custom' && customSceneStyle.trim() === '');
        return (
          <div className="space-y-8">
            <div>
              <h2 className="text-lg font-semibold text-slate-300 mb-2">1. Add Your Product(s)</h2>
              <p className="text-sm text-slate-400 mb-4">
                  For each product, provide a name, a descriptive type (including installation style), and upload its images.
              </p>
              <div className="space-y-6">
                {selectedProducts.map((product, index) => {
                   const isCustomMaterial = product.material !== undefined && product.material !== '' && !MATERIALS.includes(product.material);
                   const isCustomFinish = product.finish !== undefined && product.finish !== '' && !FINISHES.includes(product.finish);
                   return (
                   <div key={product.id} className="bg-slate-800 p-4 rounded-lg border border-slate-700 space-y-4 relative">
                      <div className="flex justify-between items-center">
                         <h3 className="font-medium text-slate-200">Product {index + 1}</h3>
                         {selectedProducts.length > 1 && (
                            <button onClick={() => handleRemoveDirectProduct(product.id)} className="text-slate-500 hover:text-red-400 text-sm p-1">Remove</button>
                         )}
                      </div>
                      <input type="text" placeholder="Product Name (e.g., Bathtub)" value={product.name} onChange={(e) => handleDirectProductChange(product.id, 'name', e.target.value)} className="w-full bg-slate-700 border border-slate-600 rounded-md p-2 focus:ring-sky-500 focus:border-sky-500" />
                      <input type="text" placeholder="Product Type & Installation (e.g., Freestanding Acrylic Tub)" value={product.type} onChange={(e) => handleDirectProductChange(product.id, 'type', e.target.value)} className="w-full bg-slate-700 border border-slate-600 rounded-md p-2 focus:ring-sky-500 focus:border-sky-500" />
                      
                      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                        <div>
                          <label htmlFor={`material-${product.id}`} className="block text-sm font-medium text-slate-300 mb-1">Material (Optional)</label>
                          <select id={`material-${product.id}`} value={isCustomMaterial ? 'Custom' : (product.material || '')} onChange={(e) => handleDirectProductChange(product.id, 'material', e.target.value === 'Custom' ? ' ' : e.target.value)} className="w-full bg-slate-700 border border-slate-600 rounded-md p-2 focus:ring-sky-500 focus:border-sky-500">
                            <option value="">Not specified</option>
                            {MATERIALS.map(m => <option key={m} value={m}>{m}</option>)}
                            <option value="Custom">Custom...</option>
                          </select>
                          {isCustomMaterial && <input type="text" value={product.material} onChange={(e) => handleDirectProductChange(product.id, 'material', e.target.value)} placeholder="Enter custom material" className="mt-2 w-full bg-slate-700 border border-slate-600 rounded-md p-2 focus:ring-sky-500 focus:border-sky-500"/>}
                        </div>
                        <div>
                          <label htmlFor={`finish-${product.id}`} className="block text-sm font-medium text-slate-300 mb-1">Finish (Optional)</label>
                          <select id={`finish-${product.id}`} value={isCustomFinish ? 'Custom' : (product.finish || '')} onChange={(e) => handleDirectProductChange(product.id, 'finish', e.target.value === 'Custom' ? ' ' : e.target.value)} className="w-full bg-slate-700 border border-slate-600 rounded-md p-2 focus:ring-sky-500 focus:border-sky-500">
                            <option value="">Not specified</option>
                            {FINISHES.map(f => <option key={f} value={f}>{f}</option>)}
                            <option value="Custom">Custom...</option>
                          </select>
                          {isCustomFinish && <input type="text" value={product.finish} onChange={(e) => handleDirectProductChange(product.id, 'finish', e.target.value)} placeholder="Enter custom finish" className="mt-2 w-full bg-slate-700 border border-slate-600 rounded-md p-2 focus:ring-sky-500 focus:border-sky-500"/>}
                        </div>
                      </div>

                      <ImageUpload title="Upload Detailed Product Shots" onImageUpload={(images) => handleDetailUpload(product.id, images)} allowMultiple={true} />
                      <FileUpload title="Upload Dimension/Spec Sheet (Optional)" onFileUpload={(file) => handleDimensionFileUpload(product.id, file)} />
                   </div>
                )})}
              </div>
              <button onClick={handleAddDirectProduct} className="mt-4 text-sm text-sky-400 hover:text-sky-300">+ Add Another Product</button>
            </div>
             <div>
              <h2 className="text-lg font-semibold text-slate-300 mb-2">2. Choose a Room Style</h2>
              <select value={sceneStyle} onChange={(e) => setSceneStyle(e.target.value)} className="w-full bg-slate-800 border border-slate-600 rounded-md p-2 focus:ring-sky-500 focus:border-sky-500">
                  {ROOM_STYLES.map(style => <option key={style} value={style}>{style}</option>)}
                  <option value="Custom">Custom...</option>
              </select>
              {sceneStyle === 'Custom' && (
                  <input type="text" value={customSceneStyle} onChange={(e) => setCustomSceneStyle(e.target.value)} placeholder="e.g., 'Cyberpunk Futuristic Bathroom'" className="mt-2 w-full bg-slate-800 border border-slate-600 rounded-md p-2 focus:ring-sky-500 focus:border-sky-500"/>
              )}
            </div>
            <Button onClick={handleProceedToMasterSceneGeneration} isLoading={isLoading} disabled={isDirectUploadGenerateDisabled}>
              Generate Room Concept
            </Button>
          </div>
        );

      case 'detail_upload':
        const isSceneGenerateDisabled = selectedProducts.length === 0 || (sceneStyle === 'Custom' && customSceneStyle.trim() === '');
        return (
          <div className="space-y-8">
             <div>
                <h2 className="text-lg font-semibold text-slate-300 mb-2">3. Specify Product Details</h2>
                 <p className="text-sm text-slate-400 mb-4">
                    For each product, you can optionally specify the material and finish. You can also provide images for a precise visual match. If you don't upload any images, the AI will generate a new design based on its description.
                </p>
                <div className="space-y-6">
                 {selectedProducts.map(product => {
                    const isCustomMaterial = product.material !== undefined && product.material !== '' && !MATERIALS.includes(product.material);
                    const isCustomFinish = product.finish !== undefined && product.finish !== '' && !FINISHES.includes(product.finish);
                    return (
                    <div key={product.id} className="bg-slate-800 p-4 rounded-lg border border-slate-700 space-y-4">
                      <h3 className="font-medium text-slate-200">{product.name} <span className="text-slate-400 text-sm">({product.type})</span></h3>
                       <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                        <div>
                          <label htmlFor={`material-${product.id}`} className="block text-sm font-medium text-slate-300 mb-1">Material (Optional)</label>
                          <select id={`material-${product.id}`} value={isCustomMaterial ? 'Custom' : (product.material || '')} onChange={(e) => handleDirectProductChange(product.id, 'material', e.target.value === 'Custom' ? ' ' : e.target.value)} className="w-full bg-slate-700 border border-slate-600 rounded-md p-2 focus:ring-sky-500 focus:border-sky-500">
                            <option value="">Not specified</option>
                            {MATERIALS.map(m => <option key={m} value={m}>{m}</option>)}
                            <option value="Custom">Custom...</option>
                          </select>
                          {isCustomMaterial && <input type="text" value={product.material} onChange={(e) => handleDirectProductChange(product.id, 'material', e.target.value)} placeholder="Enter custom material" className="mt-2 w-full bg-slate-700 border border-slate-600 rounded-md p-2 focus:ring-sky-500 focus:border-sky-500"/>}
                        </div>
                        <div>
                          <label htmlFor={`finish-${product.id}`} className="block text-sm font-medium text-slate-300 mb-1">Finish (Optional)</label>
                          <select id={`finish-${product.id}`} value={isCustomFinish ? 'Custom' : (product.finish || '')} onChange={(e) => handleDirectProductChange(product.id, 'finish', e.target.value === 'Custom' ? ' ' : e.target.value)} className="w-full bg-slate-700 border border-slate-600 rounded-md p-2 focus:ring-sky-500 focus:border-sky-500">
                            <option value="">Not specified</option>
                            {FINISHES.map(f => <option key={f} value={f}>{f}</option>)}
                            <option value="Custom">Custom...</option>
                          </select>
                          {isCustomFinish && <input type="text" value={product.finish} onChange={(e) => handleDirectProductChange(product.id, 'finish', e.target.value)} placeholder="Enter custom finish" className="mt-2 w-full bg-slate-700 border border-slate-600 rounded-md p-2 focus:ring-sky-500 focus:border-sky-500"/>}
                        </div>
                      </div>
                      <ImageUpload 
                        title={`Detailed Shots for ${product.name} (Optional)`}
                        onImageUpload={(images) => handleDetailUpload(product.id, images)}
                        allowMultiple={true}
                      />
                      <FileUpload 
                        title="Upload Dimension/Spec Sheet (Optional)"
                        onFileUpload={(file) => handleDimensionFileUpload(product.id, file)}
                      />
                    </div>
                  )})}
                </div>
            </div>
            <div>
              <h2 className="text-lg font-semibold text-slate-300 mb-2">4. Choose a Room Style</h2>
              <p className="text-sm text-slate-400 mb-4">
                  Select an aesthetic for the new room. This will guide the AI in generating the overall look and feel.
              </p>
              <select
                  value={sceneStyle}
                  onChange={(e) => setSceneStyle(e.target.value)}
                  className="w-full bg-slate-800 border border-slate-600 rounded-md p-2 focus:ring-sky-500 focus:border-sky-500"
              >
                  {ROOM_STYLES.map(style => <option key={style} value={style}>{style}</option>)}
                  <option value="Custom">Custom...</option>
              </select>
              {sceneStyle === 'Custom' && (
                  <input
                      type="text"
                      value={customSceneStyle}
                      onChange={(e) => setCustomSceneStyle(e.target.value)}
                      placeholder="e.g., 'Cyberpunk Futuristic Bathroom'"
                      className="mt-2 w-full bg-slate-800 border border-slate-600 rounded-md p-2 focus:ring-sky-500 focus:border-sky-500"
                  />
              )}
            </div>
            <Button onClick={handleProceedToMasterSceneGeneration} isLoading={isLoading} disabled={isSceneGenerateDisabled}>
              Generate Room Concept
            </Button>
          </div>
        );
      
      case 'scene_approval':
        return (
          <div className="space-y-8">
            <div>
              <h2 className="text-lg font-semibold text-slate-300 mb-2">Approve Room Concept</h2>
              <p className="text-sm text-slate-400 mb-4">
                The AI has generated a wide "establishing shot" of a new room concept. Review it on the right. If you're happy with the overall style, approve it to generate the final detailed shots.
              </p>
            </div>
            <div className="space-y-3">
              <Button onClick={handleGenerateFinalScenes} isLoading={isLoading}>
                Approve & Generate Shots
              </Button>
              <button
                  onClick={() => setStep('master_scene_generation')}
                  disabled={isLoading}
                  className="w-full flex items-center justify-center px-6 py-3 border border-slate-600 text-base font-medium rounded-md text-slate-300 bg-slate-700 hover:bg-slate-600 disabled:opacity-50 disabled:cursor-not-allowed focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-offset-slate-900 focus:ring-sky-500 transition-all duration-300"
              >
                Reject & Generate New Scene
              </button>
            </div>
          </div>
        );

        default:
          return null;
    }
  }


  return (
    <div className="min-h-screen bg-slate-900 text-slate-100 font-sans">
      <Header />
      <main className="container mx-auto px-4 py-8">
        <div className="grid grid-cols-1 lg:grid-cols-5 gap-8">
          
          <div className="lg:col-span-2 space-y-6">
            {(step !== 'generating' && step !== 'results') && renderStepContent()}
            {error && <div className="text-red-400 bg-red-900/50 p-3 rounded-md text-sm">{error}</div>}
            {(step === 'generating' || step === 'results') && (
                <div className="space-y-4">
                    <h2 className="text-lg font-semibold text-slate-300">New Scenes Generated</h2>
                    <p className="text-slate-400 text-sm">The AI has generated new scenes based on your approved room concept. Hover over an image to download or regenerate it.</p>
                    <Button onClick={() => resetFlow(true)}>Start Over</Button>
                </div>
            )}
            {step !== 'workflow_selection' && step !== 'generating' && step !== 'results' && (
               <button onClick={() => resetFlow(true)} className="text-sm text-slate-500 hover:text-slate-300 transition-colors w-full text-center mt-4">
                 &larr; Back to start
               </button>
            )}
          </div>

          <div className="lg:col-span-3">
             <h2 className="text-lg font-semibold text-slate-300 mb-4">
              {step === 'results' || step === 'generating' ? 'Generated Scenes' : 'Output Preview'}
             </h2>
             {step === 'scene_approval' && masterSceneImage ? (
                <div className="aspect-video bg-slate-800 rounded-lg overflow-hidden relative border border-slate-700">
                    <img src={masterSceneImage} alt="Master Scene Preview" className="w-full h-full object-contain" />
                </div>
                ) : (
                <ImageGrid 
                  images={generatedImages} 
                  isLoading={step === 'generating' || isLoading}
                  onRegenerate={step === 'results' ? handleRegenerateSingleImage : undefined}
                  regeneratingImageId={regeneratingImageId}
                />
            )}
          </div>

        </div>
      </main>
      <footer className="text-center p-4 text-slate-500 text-sm">
        <p>Built with React, Tailwind CSS, and the Gemini API.</p>
      </footer>
    </div>
  );
};

export default App;