import React, { useState, useCallback } from 'react';
import type { DimensionFile } from '../types';

interface FileUploadProps {
  onFileUpload: (file: DimensionFile | null) => void;
  title: string;
}

const FileUpload: React.FC<FileUploadProps> = ({ onFileUpload, title }) => {
  const [selectedFile, setSelectedFile] = useState<File | null>(null);

  const handleFileChange = useCallback(async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) {
      setSelectedFile(null);
      onFileUpload(null);
      return;
    }

    setSelectedFile(file);

    const reader = new FileReader();
    reader.onloadend = () => {
      const base64 = (reader.result as string).split(',')[1];
      const dimensionFile: DimensionFile = {
        base64,
        mimeType: file.type,
        name: file.name,
      };
      onFileUpload(dimensionFile);
    };
    reader.onerror = (error) => {
      console.error("Error reading file:", error);
      alert("There was an error processing your file.");
      setSelectedFile(null);
      onFileUpload(null);
    };
    reader.readAsDataURL(file);
    
  }, [onFileUpload]);

  const handleClearFile = () => {
    setSelectedFile(null);
    onFileUpload(null);
    // Reset the input value so the same file can be re-selected
    const input = document.getElementById(`file-upload-input-${title}`) as HTMLInputElement;
    if (input) input.value = '';
  }

  return (
    <div className="w-full">
      <label className="block text-sm font-medium text-slate-300">
        {title}
      </label>
      <div className="mt-2 flex items-center justify-between gap-4 bg-slate-700/50 border border-slate-600 rounded-md px-3 py-2">
        <div className="flex items-center gap-2 overflow-hidden">
            <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5 text-slate-400 flex-shrink-0" viewBox="0 0 20 20" fill="currentColor">
                <path fillRule="evenodd" d="M4 4a2 2 0 012-2h4.586A2 2 0 0112 2.586L15.414 6A2 2 0 0116 7.414V16a2 2 0 01-2 2H6a2 2 0 01-2-2V4zm2 6a1 1 0 011-1h6a1 1 0 110 2H7a1 1 0 01-1-1zm1 3a1 1 0 100 2h6a1 1 0 100-2H7z" clipRule="evenodd" />
            </svg>
            <span className="text-sm text-slate-300 truncate" title={selectedFile?.name}>
                {selectedFile ? selectedFile.name : 'No file selected'}
            </span>
        </div>
        <div className="flex-shrink-0 flex items-center gap-2">
            {selectedFile && (
                <button onClick={handleClearFile} className="text-xs font-medium text-slate-400 hover:text-red-400" title="Remove file">
                    &#x2715;
                </button>
            )}
            <label
              htmlFor={`file-upload-input-${title}`}
              className="relative cursor-pointer bg-slate-800 rounded-md text-xs font-medium text-sky-400 hover:text-sky-300 focus-within:outline-none focus-within:ring-2 focus-within:ring-offset-2 focus-within:ring-offset-slate-900 focus-within:ring-sky-500 p-1 px-2"
            >
              <span>{selectedFile ? 'Change' : 'Upload'}</span>
              <input 
                id={`file-upload-input-${title}`} 
                name="file-upload" 
                type="file" 
                className="sr-only" 
                onChange={handleFileChange}
                accept=".pdf,.txt,.png,.jpg,.jpeg"
              />
            </label>
        </div>
      </div>
    </div>
  );
};

export default FileUpload;
