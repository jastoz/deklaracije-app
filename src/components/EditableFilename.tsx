'use client';

import { useState, useRef, useEffect } from 'react';
import { Edit3, Check, X } from 'lucide-react';
import { useAppStore } from '@/lib/store';

interface EditableFilenameProps {
  rb: number;
  imageId: string;
  filename: string;
  isEditing: boolean;
}

export function EditableFilename({ rb, imageId, filename, isEditing }: EditableFilenameProps) {
  const { updateImageFilename, toggleImageEdit } = useAppStore();
  const [editValue, setEditValue] = useState(filename);
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (isEditing && inputRef.current) {
      inputRef.current.focus();
      // Postavi kursor na početak umjesto označavanja cijelog teksta
      inputRef.current.setSelectionRange(0, 0);
    }
  }, [isEditing]);

  useEffect(() => {
    setEditValue(filename);
  }, [filename]);

  const handleSave = () => {
    const trimmedValue = editValue.trim();
    if (trimmedValue && trimmedValue !== filename) {
      // Provjeri ima li redni broj na početku
      const rbPrefix = `${rb}. `;
      let finalValue = trimmedValue;

      // Ako ne počinje s rednim brojem, dodaj ga
      if (!trimmedValue.startsWith(rbPrefix)) {
        // Ukloni postojeći redni broj ako postoji
        const withoutRb = trimmedValue.replace(/^\d+\.\s*/, '');
        finalValue = rbPrefix + withoutRb;
      }

      updateImageFilename(rb, imageId, finalValue);
    }
    toggleImageEdit(rb, imageId);
  };

  const handleCancel = () => {
    setEditValue(filename);
    toggleImageEdit(rb, imageId);
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter') {
      handleSave();
    } else if (e.key === 'Escape') {
      handleCancel();
    }
  };

  if (isEditing) {
    return (
      <div className="flex items-center gap-1 w-full">
        <input
          ref={inputRef}
          type="text"
          value={editValue}
          onChange={(e) => setEditValue(e.target.value)}
          onKeyDown={handleKeyDown}
          className="flex-1 px-1 py-0.5 text-xs border border-blue-300 rounded focus:outline-none focus:ring-1 focus:ring-blue-500 text-black"
        />
        <button
          onClick={handleSave}
          className="p-0.5 text-green-600 hover:text-green-700 transition-colors"
          title="Spremi"
        >
          <Check className="w-3 h-3" />
        </button>
        <button
          onClick={handleCancel}
          className="p-0.5 text-gray-400 hover:text-gray-600 transition-colors"
          title="Odustani"
        >
          <X className="w-3 h-3" />
        </button>
      </div>
    );
  }

  return (
    <div className="flex items-center gap-1 w-full group">
      <span className="flex-1 text-xs font-medium text-black truncate cursor-pointer" onClick={() => toggleImageEdit(rb, imageId)}>
        {filename}
      </span>
      <button
        onClick={() => toggleImageEdit(rb, imageId)}
        className="opacity-0 group-hover:opacity-100 p-0.5 text-gray-400 hover:text-blue-500 transition-all"
        title="Uredi naziv"
      >
        <Edit3 className="w-3 h-3" />
      </button>
    </div>
  );
}