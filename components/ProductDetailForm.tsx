import React from 'react';
import ImageUpload from './ImageUpload';
import FileUpload from './FileUpload';
import { MATERIALS, FINISHES } from '../constants';
import type { IdentifiedProduct, SeedImage, DimensionFile } from '../types';

interface ProductDetailFormProps {
  product: IdentifiedProduct;
  onProductChange: (id: string, field: 'name' | 'type' | 'material' | 'finish' | 'dimensions', value: string) => void;
  onDetailUpload: (id: string, images: SeedImage[]) => void;
  onDimensionFileUpload: (id: string, file: DimensionFile | null) => void;
  showRemoveButton?: boolean;
  onRemove?: (id: string) => void;
  index: number;
}

const ProductDetailForm: React.FC<ProductDetailFormProps> = ({
  product,
  onProductChange,
  onDetailUpload,
  onDimensionFileUpload,
  showRemoveButton,
  onRemove,
  index,
}) => {
  const isCustomMaterial = product.material !== undefined && product.material !== '' && !MATERIALS.includes(product.material);
  const isCustomFinish = product.finish !== undefined && product.finish !== '' && !FINISHES.includes(product.finish);

  return (
    <div className="bg-slate-800 p-4 rounded-lg border border-slate-700 space-y-4 relative">
      <div className="flex justify-between items-center">
        <h3 className="font-medium text-slate-200">Product {index + 1}</h3>
        {showRemoveButton && onRemove && (
          <button onClick={() => onRemove(product.id)} className="text-slate-500 hover:text-red-400 text-sm p-1">Remove</button>
        )}
      </div>
      <input type="text" placeholder="Product Name (e.g., Bathtub)" value={product.name} onChange={(e) => onProductChange(product.id, 'name', e.target.value)} className="w-full bg-slate-700 border border-slate-600 rounded-md p-2 focus:ring-sky-500 focus:border-sky-500" />
      <input type="text" placeholder="Product Type & Installation (e.g., Freestanding Acrylic Tub)" value={product.type} onChange={(e) => onProductChange(product.id, 'type', e.target.value)} className="w-full bg-slate-700 border border-slate-600 rounded-md p-2 focus:ring-sky-500 focus:border-sky-500" />
      <input type="text" placeholder="Product Dimensions (e.g., 67 L x 30 W x 28 H)" value={product.dimensions || ''} onChange={(e) => onProductChange(product.id, 'dimensions', e.target.value)} className="w-full bg-slate-700 border border-slate-600 rounded-md p-2 focus:ring-sky-500 focus:border-sky-500" />
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <div>
          <label htmlFor={`material-${product.id}`} className="block text-sm font-medium text-slate-300 mb-1">Material (Optional)</label>
          <select id={`material-${product.id}`} value={isCustomMaterial ? 'Custom' : (product.material || '')} onChange={(e) => onProductChange(product.id, 'material', e.target.value === 'Custom' ? ' ' : e.target.value)} className="w-full bg-slate-700 border border-slate-600 rounded-md p-2 focus:ring-sky-500 focus:border-sky-500">
            <option value="">Not specified</option>
            {MATERIALS.map(m => <option key={m} value={m}>{m}</option>)}
            <option value="Custom">Custom...</option>
          </select>
          {isCustomMaterial && <input type="text" value={product.material} onChange={(e) => onProductChange(product.id, 'material', e.target.value)} placeholder="Enter custom material" className="mt-2 w-full bg-slate-700 border border-slate-600 rounded-md p-2 focus:ring-sky-500 focus:border-sky-500"/>}
        </div>
        <div>
          <label htmlFor={`finish-${product.id}`} className="block text-sm font-medium text-slate-300 mb-1">Finish (Optional)</label>
          <select id={`finish-${product.id}`} value={isCustomFinish ? 'Custom' : (product.finish || '')} onChange={(e) => onProductChange(product.id, 'finish', e.target.value === 'Custom' ? ' ' : e.target.value)} className="w-full bg-slate-700 border border-slate-600 rounded-md p-2 focus:ring-sky-500 focus:border-sky-500">
            <option value="">Not specified</option>
            {FINISHES.map(f => <option key={f} value={f}>{f}</option>)}
            <option value="Custom">Custom...</option>
          </select>
          {isCustomFinish && <input type="text" value={product.finish} onChange={(e) => onProductChange(product.id, 'finish', e.target.value)} placeholder="Enter custom finish" className="mt-2 w-full bg-slate-700 border border-slate-600 rounded-md p-2 focus:ring-sky-500 focus:border-sky-500"/>}
        </div>
      </div>

      <ImageUpload title="Upload Detailed Product Shots" onImageUpload={(images) => onDetailUpload(product.id, images)} allowMultiple={true} />
      <FileUpload title="Upload Dimension/Spec Sheet (Optional)" onFileUpload={(file) => onDimensionFileUpload(product.id, file)} />
    </div>
  );
};

export default ProductDetailForm;
