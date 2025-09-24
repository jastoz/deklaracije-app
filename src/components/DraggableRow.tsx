'use client';

import React from 'react';
import { useSortable } from '@dnd-kit/sortable';
import { CSS } from '@dnd-kit/utilities';
import { GripVertical, AlertCircle, CheckCircle, X } from 'lucide-react';
import { useAppStore } from '@/lib/store';
import { TroskovnikItem } from '@/lib/types';
import { ImageUpload } from './ImageUpload';
import { EditableFilename } from './EditableFilename';

interface DraggableRowProps {
  item: TroskovnikItem;
  index: number;
}

export function DraggableRow({ item, index }: DraggableRowProps) {
  const { updateItem, removeImageFromItem } = useAppStore();

  const {
    attributes,
    listeners,
    setNodeRef,
    transform,
    transition,
    isDragging,
  } = useSortable({ id: index.toString() });

  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
    opacity: isDragging ? 0.5 : 1,
  };

  return (
    <div
      ref={setNodeRef}
      style={style}
      className={`grid grid-cols-12 gap-4 py-4 px-4 border border-gray-200 bg-white rounded-lg shadow-sm ${isDragging ? 'shadow-lg z-10 rotate-1' : ''}`}
    >
      {/* Drag Handle + RB */}
      <div className="col-span-1 flex items-center gap-2">
        <button
          className="cursor-grab active:cursor-grabbing p-1 hover:bg-gray-100 rounded transition-colors flex-shrink-0"
          {...attributes}
          {...listeners}
          title="Povuci za promjenu redoslijeda"
        >
          <GripVertical className="w-4 h-4 text-gray-400" />
        </button>
        <span className="font-medium text-gray-900">
          {item.rb}
        </span>
      </div>

      {/* Naziv artikla */}
      <div className="col-span-3 flex items-center">
        <p className="font-medium text-gray-900 text-sm">{item.nazivArtikla}</p>
      </div>

      {/* Brand */}
      <div className="col-span-2 flex items-center">
        <input
          type="text"
          value={item.brand}
          onChange={(e) => updateItem(item.rb, { brand: e.target.value })}
          placeholder="Unesi brand"
          className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 text-black text-sm"
        />
      </div>

      {/* Fotografije */}
      <div className="col-span-5">
        <div className="space-y-3">
          <ImageUpload
            rb={item.rb}
            nazivArtikla={item.nazivArtikla}
            images={item.images}
          />

          {/* Nazivi datoteka za ZIP export */}
          {item.images.length > 0 && (
            <div className="space-y-2">
              <p className="text-xs font-medium text-gray-600">
                Nazivi datoteka za ZIP:
              </p>
              <div className="max-h-32 overflow-y-auto space-y-1">
                {item.images.map((image) => (
                  <div
                    key={image.id}
                    className="flex items-center gap-2 p-1 bg-gray-50 rounded text-xs"
                  >
                    <div className="flex-1 min-w-0">
                      <EditableFilename
                        rb={item.rb}
                        imageId={image.id}
                        filename={image.finalFilename}
                        isEditing={image.isEditing}
                      />
                    </div>
                    <button
                      onClick={() => removeImageFromItem(item.rb, image.id)}
                      className="flex-shrink-0 p-1 text-red-400 hover:text-red-600 transition-colors"
                      title="Ukloni sliku"
                    >
                      <X className="w-3 h-3" />
                    </button>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      </div>

      {/* Status */}
      <div className="col-span-1 flex items-center justify-center">
        {item.images.length > 0 ? (
          <div title="Kompletno">
            <CheckCircle className="w-5 h-5 text-green-500" />
          </div>
        ) : (
          <div title="Nedostaju slike">
            <AlertCircle className="w-5 h-5 text-amber-500" />
          </div>
        )}
      </div>
    </div>
  );
}