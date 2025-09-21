import React from 'react';
import type { InteractiveModel } from '../types';
import Button from './Button';
import InteractiveViewer from './InteractiveViewer';

interface ModelViewerProps {
  interactiveModels: InteractiveModel[];
  onApprove: () => void;
  onReject: () => void;
  isLoading: boolean;
}

const ModelViewer: React.FC<ModelViewerProps> = ({ interactiveModels, onApprove, onReject, isLoading }) => {
  return (
    <div className="space-y-8">
      <div>
        <h2 className="text-lg font-semibold text-slate-300 mb-2">4. Approve 3D Model</h2>
        <p className="text-sm text-slate-400 mb-4">
          The AI has generated an interactive 3D model based on your images. Drag to rotate and scroll to zoom. Please review for accuracy. This step may take longer as it generates multiple angles.
        </p>
        <div className="space-y-6">
            {interactiveModels.map(model => (
                <InteractiveViewer 
                    key={model.productId}
                    productName={model.productName}
                    imageUrls={model.imageUrls}
                />
            ))}
        </div>
      </div>
      <div className="space-y-3">
        <Button onClick={onApprove} isLoading={isLoading}>
          Approve & Create Room
        </Button>
        <button
            onClick={onReject}
            disabled={isLoading}
            className="w-full flex items-center justify-center px-6 py-3 border border-slate-600 text-base font-medium rounded-md text-slate-300 bg-slate-700 hover:bg-slate-600 disabled:opacity-50 disabled:cursor-not-allowed focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-offset-slate-900 focus:ring-sky-500 transition-all duration-300"
        >
          Reject & Upload New Shots
        </button>
      </div>
    </div>
  );
};

export default ModelViewer;
