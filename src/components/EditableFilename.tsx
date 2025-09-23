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
      inputRef.current.select();
    }
  }, [isEditing]);

  useEffect(() => {
    setEditValue(filename);
  }, [filename]);

  const handleSave = () => {
    const trimmedValue = editValue.trim();
    if (trimmedValue && trimmedValue !== filename) {
      updateImageFilename(rb, imageId, trimmedValue);
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
      <div className="flex items-center gap-2 w-full">
        <input
          ref={inputRef}
          type="text"
          value={editValue}
          onChange={(e) => setEditValue(e.target.value)}
          onKeyDown={handleKeyDown}
          className="flex-1 px-2 py-1 text-sm border border-blue-300 rounded focus:outline-none focus:ring-2 focus:ring-blue-500"
        />
        <button
          onClick={handleSave}
          className="p-1 text-green-600 hover:text-green-700 transition-colors"
          title="Spremi"
        >
          <Check className="w-4 h-4" />
        </button>
        <button
          onClick={handleCancel}
          className="p-1 text-gray-400 hover:text-gray-600 transition-colors"
          title="Odustani"
        >
          <X className="w-4 h-4" />
        </button>
      </div>
    );
  }

  return (
    <div className="flex items-center gap-2 w-full group">
      <span className="flex-1 text-sm font-medium text-gray-900 truncate">
        {filename}
      </span>
      <button
        onClick={() => toggleImageEdit(rb, imageId)}
        className="opacity-0 group-hover:opacity-100 p-1 text-gray-400 hover:text-blue-500 transition-all"
        title="Uredi naziv"
      >
        <Edit3 className="w-4 h-4" />
      </button>
    </div>
  );
}