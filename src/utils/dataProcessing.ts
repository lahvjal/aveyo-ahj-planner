import { AHJ } from './types';

// Helper function to map classification strings to our enum
export const mapClassification = (classification: string): 'A' | 'B' | 'C' | null => {
  const classStr = classification?.toString().trim().toUpperCase() || '';
  
  if (classStr === 'A' || classStr === 'CLASS A') {
    return 'A';
  } else if (classStr === 'B' || classStr === 'CLASS B') {
    return 'B';
  } else if (classStr === 'C' || classStr === 'CLASS C') {
    return 'C';
  }
  
  return null;
};

// Filter AHJs based on search query and filters
export const filterAHJs = (
  ahjs: AHJ[],
  searchQuery: string,
  filters: { county?: string; zip?: string; city?: string; classification?: 'A' | 'B' | 'C' | null }
): AHJ[] => {
  return ahjs.filter(ahj => {
    // Search query filter
    if (searchQuery) {
      const query = searchQuery.toLowerCase();
      const matchesQuery = 
        ahj.name.toLowerCase().includes(query) ||
        ahj.county.toLowerCase().includes(query) ||
        ahj.zip.toLowerCase().includes(query);
      
      if (!matchesQuery) return false;
    }
    
    // County filter
    if (filters.county && ahj.county.toLowerCase() !== filters.county.toLowerCase()) {
      return false;
    }
    
    // Zip filter
    if (filters.zip && ahj.zip !== filters.zip) {
      return false;
    }
    
    // Classification filter
    if (filters.classification && ahj.classification !== filters.classification) {
      return false;
    }
    
    return true;
  });
};
