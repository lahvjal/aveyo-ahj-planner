export interface AHJ {
  id: string;
  name: string;
  county: string;
  zip: string;
  classification: 'A' | 'B' | 'C' | null;
  latitude?: number;
  longitude?: number;
}

export interface Filter {
  id: string;
  type: 'county' | 'zip' | 'city' | 'class';
  value: string;
}

export interface ExcelAHJData {
  name: string;
  county: string;
  zip: string;
  classification: string;
  address?: string;
}
