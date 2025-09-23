'use client';

import { AlertCircle, CheckCircle } from 'lucide-react';
import { useAppStore } from '@/lib/store';
import { ImageUpload } from './ImageUpload';
import { EditableFilename } from './EditableFilename';

export function TroskovnikTable() {
  const { troskovnikItems, updateItem } = useAppStore();

  if (troskovnikItems.length === 0) {
    return null;
  }

  return (
    <div className="space-y-6">
      <h2 className="text-xl font-semibold text-gray-900">
        Troškovnik ({troskovnikItems.length} stavki)
      </h2>

      <div className="overflow-x-auto">
        <table className="w-full border-collapse">
          <thead>
            <tr className="border-b-2 border-gray-200">
              <th className="text-left py-3 px-4 font-semibold text-gray-900 w-16">
                Rb.
              </th>
              <th className="text-left py-3 px-4 font-semibold text-gray-900 min-w-[200px]">
                Naziv artikla
              </th>
              <th className="text-left py-3 px-4 font-semibold text-gray-900 w-32">
                Brand
              </th>
              <th className="text-left py-3 px-4 font-semibold text-gray-900 min-w-[300px]">
                Fotografije
              </th>
              <th className="text-left py-3 px-4 font-semibold text-gray-900 w-20">
                Status
              </th>
            </tr>
          </thead>
          <tbody>
            {troskovnikItems.map((item) => (
              <tr key={item.rb} className="border-b border-gray-100">
                <td className="py-4 px-4 text-center font-medium text-gray-900">
                  {item.rb}
                </td>
                <td className="py-4 px-4">
                  <p className="font-medium text-gray-900">{item.nazivArtikla}</p>
                </td>
                <td className="py-4 px-4">
                  <input
                    type="text"
                    value={item.brand}
                    onChange={(e) => updateItem(item.rb, { brand: e.target.value })}
                    placeholder="Unesi brand"
                    className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 text-black"
                  />
                </td>
                <td className="py-4 px-4">
                  <div className="space-y-3">
                    <ImageUpload
                      rb={item.rb}
                      nazivArtikla={item.nazivArtikla}
                      images={item.images}
                    />

                    {/* Lista slika s editabilnim nazivima */}
                    {item.images.length > 0 && (
                      <div className="space-y-2">
                        <p className="text-sm font-medium text-gray-700">
                          Nazivi datoteka:
                        </p>
                        <div className="space-y-1">
                          {item.images.map((image) => (
                            <div
                              key={image.id}
                              className="flex items-center gap-3 p-2 bg-white border border-gray-200 rounded"
                            >
                              <div className="flex-shrink-0 w-8 h-8 bg-gray-100 rounded overflow-hidden">
                                {image.thumbnail ? (
                                  <img
                                    src={image.thumbnail}
                                    alt="thumbnail"
                                    className="w-full h-full object-cover"
                                  />
                                ) : (
                                  <div className="w-full h-full bg-gray-200" />
                                )}
                              </div>
                              <div className="flex-1">
                                <EditableFilename
                                  rb={item.rb}
                                  imageId={image.id}
                                  filename={image.finalFilename}
                                  isEditing={image.isEditing}
                                />
                                <p className="text-xs text-gray-500 truncate">
                                  {image.originalFilename}
                                </p>
                              </div>
                            </div>
                          ))}
                        </div>
                      </div>
                    )}
                  </div>
                </td>
                <td className="py-4 px-4 text-center">
                  <div title={item.status === 'complete' ? 'Kompletno' : 'Nedostaju fotografije'}>
                    {item.status === 'complete' ? (
                      <CheckCircle className="w-6 h-6 text-green-500 mx-auto" />
                    ) : (
                      <AlertCircle className="w-6 h-6 text-yellow-500 mx-auto" />
                    )}
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}