
import React, { useState, useCallback } from 'react';
import type { SeedImage } from '../types';

interface ImageUploadProps {
  onImageUpload: (images: SeedImage[]) => void;
  title: string;
  allowMultiple?: boolean;
}

const ImageUpload: React.FC<ImageUploadProps> = ({ onImageUpload, title, allowMultiple = true }) => {
  const [previews, setPreviews] = useState<string[]>([]);

  const handleFileChange = useCallback(async (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files;
    if (!files || files.length === 0) {
      setPreviews([]);
      onImageUpload([]);
      return;
    }

    const imageFiles = Array.from(files).filter(file => file.type.startsWith('image/'));
    if (imageFiles.length !== files.length) {
      alert('Please upload only image files.');
      e.target.value = ''; // Reset input to allow re-selection of the same files
      return;
    }
    
    // If only one file is allowed, only process the first one
    const filesToProcess = allowMultiple ? imageFiles : [imageFiles[0]];


    const fileToDataURL = (file: File): Promise<string> => {
      return new Promise((resolve, reject) => {
        const reader = new FileReader();
        reader.onloadend = () => resolve(reader.result as string);
        reader.onerror = reject;
        reader.readAsDataURL(file);
      });
    };

    try {
      const dataUrls = await Promise.all(filesToProcess.map(fileToDataURL));
      setPreviews(dataUrls);
      
      const seedImages: SeedImage[] = dataUrls.map((dataUrl, index) => ({
        base64: dataUrl.split(',')[1],
        mimeType: filesToProcess[index].type,
      }));
      onImageUpload(seedImages);
    } catch (error) {
      console.error("Error reading files:", error);
      alert("There was an error processing your images.");
    }
  }, [onImageUpload, allowMultiple]);

  const previewContent = () => {
    if (previews.length === 0) {
      return (
        <svg className="mx-auto h-12 w-12 text-slate-500" stroke="currentColor" fill="none" viewBox="0 0 48 48" aria-hidden="true">
          <path d="M28 8H12a4 4 0 00-4 4v20m32-12v8m0 4v.01M28 8l4.586 4.586a2 2 0 010 2.828L16 32h-4v-4l16-16z" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
        </svg>
      );
    }

    if (allowMultiple) {
       return (
        <div className="grid grid-cols-3 sm:grid-cols-4 gap-4">
          {previews.map((src, index) => (
            <img key={index} src={src} alt={`Upload preview ${index + 1}`} className="h-24 w-full object-contain rounded-md bg-slate-700 p-1" />
          ))}
        </div>
      );
    }

    return <img src={previews[0]} alt="Upload preview" className="max-h-48 w-auto object-contain rounded-md mx-auto" />;
  }

  return (
    <div className="w-full">
      <label htmlFor="image-upload" className="block text-sm font-medium text-slate-300 mb-2">
        {title}
      </label>
      <div className="mt-1 flex justify-center px-6 pt-5 pb-6 border-2 border-slate-600 border-dashed rounded-md hover:border-sky-500 transition-colors duration-300">
        <div className="space-y-4 text-center w-full">
          {previewContent()}
          <div className="flex text-sm justify-center text-slate-500">
            <label
              htmlFor={`file-upload-${title}`}
              className="relative cursor-pointer bg-slate-800 rounded-md font-medium text-sky-400 hover:text-sky-300 focus-within:outline-none focus-within:ring-2 focus-within:ring-offset-2 focus-within:ring-offset-slate-900 focus-within:ring-sky-500 p-1 px-2"
            >
              <span>{previews.length > 0 ? (allowMultiple ? 'Change files' : 'Change file') : (allowMultiple ? 'Upload file(s)' : 'Upload a file')}</span>
              <input id={`file-upload-${title}`} name="file-upload" type="file" className="sr-only" accept="image/*" onChange={handleFileChange} multiple={allowMultiple} />
            </label>
            {previews.length === 0 && <p className="pl-1">or drag and drop</p>}
          </div>
          {previews.length === 0 && <p className="text-xs text-slate-600">PNG, JPG, GIF up to 10MB</p>}
        </div>
      </div>
    </div>
  );
};

export default ImageUpload;
