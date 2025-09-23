import { create } from 'zustand';
import { AppState, TroskovnikItem, UploadedImage } from './types';

interface AppStore extends AppState {
  setNazivUstanove: (naziv: string) => void;
  setTroskovnikItems: (items: TroskovnikItem[]) => void;
  updateItem: (rb: number, updates: Partial<TroskovnikItem>) => void;
  addImageToItem: (rb: number, image: UploadedImage) => void;
  removeImageFromItem: (rb: number, imageId: string) => void;
  updateImageFilename: (rb: number, imageId: string, newFilename: string) => void;
  toggleImageEdit: (rb: number, imageId: string) => void;
  setProcessing: (processing: boolean) => void;
  addError: (error: string) => void;
  clearErrors: () => void;
  reset: () => void;
}

const initialState: AppState = {
  nazivUstanove: '',
  troskovnikItems: [],
  isProcessing: false,
  errors: []
};

export const useAppStore = create<AppStore>((set) => ({
  ...initialState,

  setNazivUstanove: (naziv) => set({ nazivUstanove: naziv }),

  setTroskovnikItems: (items) => set({ troskovnikItems: items }),

  updateItem: (rb, updates) => set((state) => ({
    troskovnikItems: state.troskovnikItems.map(item =>
      item.rb === rb ? { ...item, ...updates } : item
    )
  })),

  addImageToItem: (rb, image) => set((state) => ({
    troskovnikItems: state.troskovnikItems.map(item =>
      item.rb === rb
        ? {
            ...item,
            images: [...item.images, image],
            status: 'complete' as const
          }
        : item
    )
  })),

  removeImageFromItem: (rb, imageId) => set((state) => ({
    troskovnikItems: state.troskovnikItems.map(item =>
      item.rb === rb
        ? {
            ...item,
            images: item.images.filter(img => img.id !== imageId),
            status: item.images.filter(img => img.id !== imageId).length > 0 ? 'complete' as const : 'incomplete' as const
          }
        : item
    )
  })),

  updateImageFilename: (rb, imageId, newFilename) => set((state) => ({
    troskovnikItems: state.troskovnikItems.map(item =>
      item.rb === rb
        ? {
            ...item,
            images: item.images.map(img =>
              img.id === imageId ? { ...img, finalFilename: newFilename } : img
            )
          }
        : item
    )
  })),

  toggleImageEdit: (rb, imageId) => set((state) => ({
    troskovnikItems: state.troskovnikItems.map(item =>
      item.rb === rb
        ? {
            ...item,
            images: item.images.map(img =>
              img.id === imageId ? { ...img, isEditing: !img.isEditing } : img
            )
          }
        : item
    )
  })),

  setProcessing: (processing) => set({ isProcessing: processing }),

  addError: (error) => set((state) => ({
    errors: [...state.errors, error]
  })),

  clearErrors: () => set({ errors: [] }),

  reset: () => set(initialState)
}));