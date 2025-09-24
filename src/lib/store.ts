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
  reorderItems: (activeIndex: number, overIndex: number) => void;
  importImagesFromFiles: (files: FileList | File[]) => Promise<{ imported: number; skipped: number; errors: string[] }>;
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

  addImageToItem: (rb, image) => set((state) => {
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    const { generateFilename } = require('./fileUtils');

    return {
      troskovnikItems: state.troskovnikItems.map(item =>
        item.rb === rb
          ? (() => {
              const newImages = [...item.images, image];

              // Ako sada ima više od jedne slike, regeneriraj nazive sa sufiksima
              if (newImages.length > 1) {
                const updatedImages = newImages.map((img, index) => {
                  const extension = img.finalFilename.split('.').pop() || '';
                  const artikal = item.nazivArtikla;
                  return {
                    ...img,
                    finalFilename: generateFilename(rb, artikal, extension, index)
                  };
                });
                return {
                  ...item,
                  images: updatedImages,
                  status: 'complete' as const
                };
              } else {
                return {
                  ...item,
                  images: newImages,
                  status: 'complete' as const
                };
              }
            })()
          : item
      )
    };
  }),

  removeImageFromItem: (rb, imageId) => set((state) => {
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    const { generateFilename } = require('./fileUtils');

    return {
      troskovnikItems: state.troskovnikItems.map(item =>
        item.rb === rb
          ? (() => {
              const filteredImages = item.images.filter(img => img.id !== imageId);

              // Regeneriraj nazive za preostale slike
              const updatedImages = filteredImages.map((img, index) => {
                const extension = img.finalFilename.split('.').pop() || '';
                const artikal = item.nazivArtikla;
                return {
                  ...img,
                  finalFilename: filteredImages.length > 1
                    ? generateFilename(rb, artikal, extension, index)
                    : generateFilename(rb, artikal, extension)
                };
              });

              return {
                ...item,
                images: updatedImages,
                status: updatedImages.length > 0 ? 'complete' as const : 'incomplete' as const
              };
            })()
          : item
      )
    };
  }),

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

  reorderItems: (activeIndex, overIndex) => set((state) => {
    if (activeIndex === overIndex) return state;

    // eslint-disable-next-line @typescript-eslint/no-require-imports
    const { generateFilename } = require('./fileUtils');
    const items = [...state.troskovnikItems];

    // Premjesti stavku
    const [reorderedItem] = items.splice(activeIndex, 1);
    items.splice(overIndex, 0, reorderedItem);

    // Regeneriraj redne brojeve i nazive slika za sve stavke
    const reorderedItems = items.map((item, index) => {
      const newRb = index + 1;

      // Ažuriraj nazive slika s novim rednim brojem
      const updatedImages = item.images.map((image, imgIndex) => {
        const extension = image.finalFilename.split('.').pop() || '';
        const finalFilename = item.images.length > 1
          ? generateFilename(newRb, item.nazivArtikla, extension, imgIndex)
          : generateFilename(newRb, item.nazivArtikla, extension);

        return {
          ...image,
          finalFilename
        };
      });

      return {
        ...item,
        rb: newRb,
        images: updatedImages
      };
    });

    return { troskovnikItems: reorderedItems };
  }),

  setProcessing: (processing) => set({ isProcessing: processing }),

  addError: (error) => set((state) => ({
    errors: [...state.errors, error]
  })),

  clearErrors: () => set({ errors: [] }),

  importImagesFromFiles: async (files) => {
    const { processImportFiles, importImagesToItems } = await import('./zipImport');

    try {
      set({ isProcessing: true });

      // Procesiraj datoteke (ekstraktiraj ZIP ako je potrebno)
      const { files: processedFiles, errors: processErrors } = await processImportFiles(files);

      // Dodaj greške iz procesiranja
      if (processErrors.length > 0) {
        set((state) => ({ errors: [...state.errors, ...processErrors] }));
      }

      // Importiraj slike u postojeće stavke
      const currentState = useAppStore.getState();
      const { importedImages, result } = await importImagesToItems(processedFiles, currentState.troskovnikItems);

      // Dodaj slike u store
      for (const { rb, image } of importedImages) {
        currentState.addImageToItem(rb, image);
      }

      // Dodaj greške iz importa
      if (result.errors.length > 0) {
        set((state) => ({ errors: [...state.errors, ...result.errors] }));
      }

      set({ isProcessing: false });
      return result;
    } catch (error) {
      set((state) => ({
        isProcessing: false,
        errors: [...state.errors, `Greška pri uvoza slika: ${error}`]
      }));
      return { imported: 0, skipped: 0, errors: [`Greška pri uvoza slika: ${error}`] };
    }
  },

  reset: () => set(initialState)
}));