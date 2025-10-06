import { create } from 'zustand';
import { AppState, TroskovnikItem, UploadedImage } from './types';
import { generateFilename } from './fileUtils';
import { saveStateToStorage, loadStateFromStorage, clearAllStorage, debounce } from './persistence';
import { deleteImageFromIndexedDB } from './storage';

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
  loadFromStorage: () => Promise<boolean>;
  clearStorage: () => Promise<void>;
}

const initialState: AppState = {
  nazivUstanove: '',
  troskovnikItems: [],
  isProcessing: false,
  errors: []
};

// Debounced auto-save function
const debouncedAutoSave = debounce(async (nazivUstanove: string, troskovnikItems: TroskovnikItem[]) => {
  try {
    await saveStateToStorage(nazivUstanove, troskovnikItems);
  } catch (error) {
    console.error('Auto-save failed:', error);
  }
}, 1000); // Save 1 second after last change

export const useAppStore = create<AppStore>((set, get) => ({
  ...initialState,

  setNazivUstanove: (naziv) => {
    set({ nazivUstanove: naziv });
    const state = get();
    debouncedAutoSave(state.nazivUstanove, state.troskovnikItems);
  },

  setTroskovnikItems: (items) => {
    console.log(`[setTroskovnikItems] Postavljam ${items.length} items`);
    set({ troskovnikItems: items });
    const state = get();
    console.log(`[setTroskovnikItems] State nakon set: ${state.troskovnikItems.length} items`);
    debouncedAutoSave(state.nazivUstanove, state.troskovnikItems);
  },

  updateItem: (rb, updates) => {
    set((state) => ({
      troskovnikItems: state.troskovnikItems.map(item => {
        if (item.rb !== rb) return item;

        const updatedItem = { ...item, ...updates };

        // Ako se brand promijenio i postoje slike, regeneriraj nazive slika
        if ('brand' in updates && updatedItem.images.length > 0) {
          const updatedImages = updatedItem.images.map((img, index) => {
            const extension = img.finalFilename.split('.').pop() || '';
            return {
              ...img,
              finalFilename: updatedItem.images.length > 1
                ? generateFilename(rb, updatedItem.brand, updatedItem.nazivArtikla, extension, index)
                : generateFilename(rb, updatedItem.brand, updatedItem.nazivArtikla, extension)
            };
          });
          return { ...updatedItem, images: updatedImages };
        }

        return updatedItem;
      })
    }));
    const state = get();
    debouncedAutoSave(state.nazivUstanove, state.troskovnikItems);
  },

  addImageToItem: (rb, image) => {
    set((state) => ({
      troskovnikItems: state.troskovnikItems.map(item =>
        item.rb === rb
          ? (() => {
              const newImages = [...item.images, image];

              // Ako sada ima više od jedne slike, regeneriraj nazive sa sufiksima
              if (newImages.length > 1) {
                const updatedImages = newImages.map((img, index) => {
                  const extension = img.finalFilename.split('.').pop() || '';
                  return {
                    ...img,
                    finalFilename: generateFilename(rb, item.brand, item.nazivArtikla, extension, index)
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
    }));
    const state = get();
    debouncedAutoSave(state.nazivUstanove, state.troskovnikItems);
  },

  removeImageFromItem: (rb, imageId) => {
    // Delete from IndexedDB first
    deleteImageFromIndexedDB(imageId).catch(err => console.error('Failed to delete image from IndexedDB:', err));

    set((state) => ({
      troskovnikItems: state.troskovnikItems.map(item =>
        item.rb === rb
          ? (() => {
              const filteredImages = item.images.filter(img => img.id !== imageId);

              // Regeneriraj nazive za preostale slike
              const updatedImages = filteredImages.map((img, index) => {
                const extension = img.finalFilename.split('.').pop() || '';
                return {
                  ...img,
                  finalFilename: filteredImages.length > 1
                    ? generateFilename(rb, item.brand, item.nazivArtikla, extension, index)
                    : generateFilename(rb, item.brand, item.nazivArtikla, extension)
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
    }));
    const state = get();
    debouncedAutoSave(state.nazivUstanove, state.troskovnikItems);
  },

  updateImageFilename: (rb, imageId, newFilename) => {
    set((state) => ({
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
    }));
    const state = get();
    debouncedAutoSave(state.nazivUstanove, state.troskovnikItems);
  },

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

  reorderItems: (activeIndex, overIndex) => {
    set((state) => {
      if (activeIndex === overIndex) return state;

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
            ? generateFilename(newRb, item.brand, item.nazivArtikla, extension, imgIndex)
            : generateFilename(newRb, item.brand, item.nazivArtikla, extension);

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
    });
    const state = get();
    debouncedAutoSave(state.nazivUstanove, state.troskovnikItems);
  },

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

  reset: () => set(initialState),

  loadFromStorage: async () => {
    try {
      const stored = await loadStateFromStorage();
      if (stored) {
        set({
          nazivUstanove: stored.nazivUstanove,
          troskovnikItems: stored.troskovnikItems,
        });
        return true;
      }
      return false;
    } catch (error) {
      console.error('Failed to load from storage:', error);
      return false;
    }
  },

  clearStorage: async () => {
    try {
      console.log('[store.clearStorage] Započinjem brisanje...');

      // VAŽNO: Otkaži debounced auto-save prije brisanja
      // Inače će stari podaci biti spremljeni nakon što ih obrišemo
      console.log('[store.clearStorage] Otkaz auto-save...');
      debouncedAutoSave.cancel();

      console.log('[store.clearStorage] Pozivam clearAllStorage...');
      await clearAllStorage();

      console.log('[store.clearStorage] Resetiram state na initialState...');
      set(initialState);

      console.log('[store.clearStorage] ✅ Brisanje završeno uspješno');
    } catch (error) {
      console.error('[store.clearStorage] ❌ Failed to clear storage:', error);
      throw error;
    }
  },
}));