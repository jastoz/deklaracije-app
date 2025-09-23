import * as XLSX from 'xlsx';
import { TroskovnikItem } from './types';

export interface ParsedXLSXData {
  items: TroskovnikItem[];
  errors: string[];
}

export function parseXLSX(file: File): Promise<ParsedXLSXData> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();

    reader.onload = (e) => {
      try {
        const data = new Uint8Array(e.target?.result as ArrayBuffer);
        const workbook = XLSX.read(data, { type: 'array' });

        const firstSheetName = workbook.SheetNames[0];
        const worksheet = workbook.Sheets[firstSheetName];

        const jsonData = XLSX.utils.sheet_to_json(worksheet, {
          header: 1,
          range: 2 // Preskače prva 2 retka
        });

        const items: TroskovnikItem[] = [];
        const errors: string[] = [];
        const usedRb = new Set<number>();

        jsonData.forEach((row, index) => {
          if (!Array.isArray(row) || row.length < 2) return; // Prazan red

          const rb = row[0]; // Kolona A
          const nazivArtikla = row[1]; // Kolona B

          // Validacija rb
          if (!rb || typeof rb !== 'number' || !Number.isInteger(rb)) {
            errors.push(`Red ${index + 3}: Redni broj mora biti cijeli broj`);
            return;
          }

          // Provjeri duplikate
          if (usedRb.has(rb)) {
            errors.push(`Red ${index + 3}: Duplikat rednog broja ${rb}`);
            return;
          }
          usedRb.add(rb);

          // Validacija naziva
          if (!nazivArtikla || typeof nazivArtikla !== 'string' || nazivArtikla.trim() === '') {
            errors.push(`Red ${index + 3}: Naziv artikla je obavezan`);
            return;
          }

          items.push({
            rb,
            nazivArtikla: nazivArtikla.trim(),
            brand: '',
            images: [],
            status: 'incomplete'
          });
        });

        // Ograniči na 200 stavki
        if (items.length > 200) {
          errors.push(`Troškovnik sadrži ${items.length} stavki. Maksimalno je dozvoljeno 200.`);
          items.splice(200);
        }

        resolve({ items, errors });

      } catch (error) {
        reject(new Error(`Greška pri čitanju XLSX datoteke: ${error}`));
      }
    };

    reader.onerror = () => {
      reject(new Error('Greška pri čitanju datoteke'));
    };

    reader.readAsArrayBuffer(file);
  });
}