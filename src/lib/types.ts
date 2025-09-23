export interface TroskovnikItem {
  rb: number;
  nazivArtikla: string;
  brand: string;
  images: UploadedImage[];
  status: 'incomplete' | 'complete';
}

export interface UploadedImage {
  id: string;
  file: File;
  originalFilename: string;
  finalFilename: string;
  isEditing: boolean;
  thumbnail?: string;
}

export interface ManifestEntry {
  rb: number;
  naziv_artikla: string;
  brand: string;
  original_filename: string;
  final_filename: string;
  sha256: string;
  uploaded_at: string;
  note: string;
}

export interface AppState {
  nazivUstanove: string;
  troskovnikItems: TroskovnikItem[];
  isProcessing: boolean;
  errors: string[];
}