'use client';

import {
  DndContext,
  KeyboardSensor,
  PointerSensor,
  useSensor,
  useSensors,
  DragEndEvent,
  rectIntersection,
} from '@dnd-kit/core';
import {
  SortableContext,
  sortableKeyboardCoordinates,
  verticalListSortingStrategy,
} from '@dnd-kit/sortable';
import { GripVertical } from 'lucide-react';
import { useAppStore } from '@/lib/store';
import { DraggableRow } from './DraggableRow';

export function TroskovnikTable() {
  const { troskovnikItems, reorderItems } = useAppStore();

  const sensors = useSensors(
    useSensor(PointerSensor),
    useSensor(KeyboardSensor, {
      coordinateGetter: sortableKeyboardCoordinates,
    })
  );

  function handleDragEnd(event: DragEndEvent) {
    const { active, over } = event;

    if (over && active.id !== over.id) {
      const activeIndex = parseInt(active.id.toString(), 10);
      const overIndex = parseInt(over.id.toString(), 10);

      if (!isNaN(activeIndex) && !isNaN(overIndex) && activeIndex !== overIndex) {
        reorderItems(activeIndex, overIndex);
      }
    }
  }

  if (troskovnikItems.length === 0) {
    return null;
  }

  return (
    <div className="space-y-6">
      <h2 className="text-xl font-semibold text-gray-900">
        Troškovnik ({troskovnikItems.length} stavki)
      </h2>
      <p className="text-sm text-gray-600 flex items-center gap-2">
        💡 Povuci za <span className="inline-flex items-center mx-1"><GripVertical className="w-3 h-3" /></span> da promijeniš redoslijed stavki
      </p>

      <div className="overflow-x-auto">
        {/* Header */}
        <div className="grid grid-cols-12 gap-4 py-3 px-4 border-b-2 border-gray-200 bg-gray-50 font-semibold text-gray-900 text-sm">
          <div className="col-span-1">Rb.</div>
          <div className="col-span-3">Naziv artikla</div>
          <div className="col-span-2">Brand</div>
          <div className="col-span-5">Fotografije</div>
          <div className="col-span-1 text-center">Status</div>
        </div>

        <DndContext
          sensors={sensors}
          collisionDetection={rectIntersection}
          onDragEnd={handleDragEnd}
        >
          <SortableContext items={troskovnikItems.map((item, index) => index.toString())} strategy={verticalListSortingStrategy}>
            <div className="space-y-1">
              {troskovnikItems.map((item, index) => (
                <DraggableRow key={`item-${index}`} item={item} index={index} />
              ))}
            </div>
          </SortableContext>
        </DndContext>
      </div>
    </div>
  );
}