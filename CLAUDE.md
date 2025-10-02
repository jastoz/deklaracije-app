# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

Deklaracije App is a Next.js application for processing XLSX cost estimates (troškovnici), attaching photos to items, and generating ZIP exports with renamed files. Users upload an XLSX file with item listings, attach photos to each item, and export everything as a ZIP with auto-generated filenames, manifest.csv, and summary.txt.

## Development Commands

```bash
# Development server (runs on http://localhost:3000)
npm run dev

# Production build
npm run build

# Start production server
npm start

# Lint code
npm run lint
```

## Tech Stack

- **Framework**: Next.js 15.5.4 (App Router)
- **State Management**: Zustand (with auto-save)
- **Storage**: LocalStorage (metadata) + IndexedDB (images via idb library)
- **File Processing**: xlsx (parsing), JSZip (ZIP import/export)
- **UI**: React 19, Tailwind CSS 4, @dnd-kit (drag-and-drop)
- **Language**: TypeScript

## Architecture

### State Management (`src/lib/store.ts`)

The app uses Zustand for global state with automatic persistence:

- **Auto-save**: All state changes are debounced (1s) and automatically saved to LocalStorage + IndexedDB
- **State restoration**: On load, `RestoreDialog` component checks for saved data and prompts user to restore
- **Key actions**: `setTroskovnikItems`, `addImageToItem`, `reorderItems`, `importImagesFromFiles`

### Storage Strategy

**Two-tier storage system**:

1. **LocalStorage** (`src/lib/persistence.ts`): Stores metadata (item names, rb numbers, status, filenames)
2. **IndexedDB** (`src/lib/storage.ts`): Stores actual File/Blob objects for images (via `idb` library)

**Key functions**:
- `saveStateToStorage()`: Serializes state to LocalStorage, saves images to IndexedDB
- `loadStateFromStorage()`: Reconstructs File objects by combining LocalStorage metadata with IndexedDB blobs
- `clearAllStorage()`: Wipes both LocalStorage and IndexedDB

### File Processing

**XLSX Parsing** (`src/lib/xlsxParser.ts`):
- Reads XLSX files using `xlsx` library
- Expects items in columns A (rb number) and B (naziv artikla) starting from row 3
- Validates rb numbers (must be unique integers)
- Limits to 200 items maximum

**ZIP Import** (`src/lib/zipImport.ts`):
- Auto-extracts ZIP files uploaded via import section
- Parses filenames to extract rb numbers using patterns: `1. Name`, `1_Name`, `1-Name`
- Matches extracted rb to existing items and adds images automatically

**ZIP Export** (`src/lib/zipExport.ts`):
- Generates ZIP with renamed images following pattern: `{rb}. {brand} {naziv}.{ext}`
- Includes `manifest.csv` with SHA256 hashes and metadata
- Includes `summary.txt` with statistics

**Filename Generation** (`src/lib/fileUtils.ts`):
- Base pattern: `{rb}. {brand} {nazivArtikla}.{extension}`
- Multi-image suffix: `{rb}. {brand} {nazivArtikla} ({index}).{extension}`
- Sanitizes special characters, handles Croatian letters (čćđšž)
- SHA256 hashing via crypto-browserify (client-side)

### Component Structure

**Main Page** (`src/app/page.tsx`):
- Client component using Zustand store
- Conditional rendering based on state (upload → table → import/export)
- Shows RestoreDialog on mount if saved data exists

**Key Components**:
- `FileUpload`: Uploads XLSX troškovnik
- `TroskovnikTable`: Displays items, uses `DraggableRow` for reordering
- `ImageUpload`: Per-item image upload with drag-and-drop
- `ImportSection`: Bulk import via ZIP or multiple files
- `ExportSection`: Generates and downloads ZIP
- `RestoreDialog`: Prompts user to restore saved session or start fresh

**Drag-and-Drop** (`src/components/DraggableRow.tsx`):
- Uses @dnd-kit/core and @dnd-kit/sortable
- Reordering triggers `reorderItems()` which regenerates rb numbers and filenames

## Data Flow

1. **Initial Upload**: User uploads XLSX → parsed by `xlsxParser` → `setTroskovnikItems()` → auto-saved
2. **Adding Images**: User uploads photos → `addImageToItem()` → filenames auto-generated → auto-saved
3. **Reordering**: Drag-and-drop → `reorderItems()` → rb numbers regenerated (1, 2, 3...) → filenames updated → auto-saved
4. **Bulk Import**: ZIP/files → extracted → rb numbers parsed from filenames → matched to items → `addImageToItem()` for each
5. **Export**: Click export → `generateZIP()` → creates ZIP with manifest/summary → downloads

## Important Patterns

- **All state updates auto-save**: Don't manually trigger saves; Zustand middleware handles it
- **File objects persist**: IndexedDB stores actual File objects as blobs, reconstructed on load
- **Filename regeneration**: Happens on add/remove image, reorder items - always keeps filenames in sync with current state
- **Error handling**: Errors accumulate in `errors` array, displayed by `ErrorDisplay` component

## File Structure Notes

- `/src/app/page.tsx`: Main application page (single-page app)
- `/src/components/`: React components (all .tsx files)
- `/src/lib/`: Core logic and utilities (all .ts files)
  - `types.ts`: TypeScript interfaces
  - `store.ts`: Zustand store + actions
  - `persistence.ts`: LocalStorage layer
  - `storage.ts`: IndexedDB layer
  - `xlsxParser.ts`, `zipImport.ts`, `zipExport.ts`: File processing
  - `fileUtils.ts`: Filename generation, SHA256 hashing, thumbnail creation
