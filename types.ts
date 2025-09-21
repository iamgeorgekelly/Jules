
export interface SeedImage {
  base64: string;
  mimeType: string;
}

export interface DimensionFile {
  base64: string;
  mimeType: string;
  name: string;
}

export interface GeneratedImage {
  id: number;
  src: string | null;
  title: string;
}

export interface IdentifiedProduct {
  id: string;
  name: string;
  type: string;
  material?: string;
  finish?: string;
}

// FIX: Added missing InteractiveModel interface used in ModelViewer.tsx.
export interface InteractiveModel {
  productId: string;
  productName: string;
  imageUrls: string[];
}

export type WorkflowStep = 
  | 'workflow_selection'
  | 'scene_upload' 
  | 'product_identification'
  | 'product_selection' 
  | 'direct_product_upload'
  | 'detail_upload'
  | 'master_scene_generation'
  | 'scene_approval'
  | 'generating' 
  | 'results';
