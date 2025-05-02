// Utility company data and geojson references
export interface Utility {
  id: string;
  name: string;
  location: { lat: number; lon: number };
  geojson: string;
  color: string;
}

export const UTILITIES: Utility[] = [
  {
    id: 'cornbeltenergy',
    name: 'Corn Belt Energy',
    location: { lat: 41.55, lon: -90.88 }, // Approximate center, adjust as needed
    geojson: '/data/cornbeltenergy_utility_zones.geojson',
    color: '#800000', // Maroon, unique for this utility
  },
  // Add more utilities here
];
