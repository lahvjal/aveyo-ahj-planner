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

// New interfaces for Project Browser pivot
export interface Project {
  id: string;
  address: string;
  latitude?: number;
  longitude?: number;
  ahj: {
    id?: string;
    name: string;
    classification: string;
  };
  utility: {
    id?: string;
    name: string;
    classification?: string;
  };
  financier: {
    id?: string;
    name: string;
    classification?: string;
  };
  status?: string;
  city?: string;
  state?: string;
  zip?: string;
  county?: string;
  // New fields for 45 Day Program features
  milestone?: string;
  qualifies45Day?: string | boolean;
  isMasked?: boolean;
  rep_id?: string | null;
  contract_signed_date?: string;
}

export interface ProjectFilter {
  type: 'ahj' | 'utility' | 'financier' | '45day' | 'search' | 'myprojects';
  value: string;
}

export interface PredictionResult {
  category: 'High' | 'Medium' | 'Low' | 'Unknown';
  message: string;
  nearbyProjects: Project[];
  ahj: { id: string; name: string; classification: string } | null;
  utility: { id: string; name: string; classification: string } | null;
  qualifiedCount: number;
  totalCount: number;
  score?: number;
  scoreDetails?: {
    qualified45Day: number;
    ahjClassification: number;
    utilityClassification: number;
    distanceWeighted: number;
  };
}
