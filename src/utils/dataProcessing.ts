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

/**
 * Safely extracts and validates coordinates from raw payload data
 * Handles different property naming conventions and nested structures
 */
/**
 * Recursively search for coordinate fields in a nested object structure
 */
const findCoordinatesInNestedStructure = (obj: any, depth: number = 0, maxDepth: number = 3): { latitude?: number; longitude?: number } => {
  // Prevent infinite recursion or excessive depth
  if (depth > maxDepth || !obj || typeof obj !== 'object') {
    return {};
  }
  
  // Check for coordinate fields directly in this object
  const lat = parseFloat(String(
    obj.latitude || 
    obj.Latitude || 
    obj.lat ||
    ''
  ));
  
  const lng = parseFloat(String(
    obj.longitude || 
    obj.Longitude || 
    obj.lng ||
    ''
  ));
  
  // If we found valid coordinates at this level, return them
  if (!isNaN(lat) && !isNaN(lng) && 
      lat >= -90 && lat <= 90 && 
      lng >= -180 && lng <= 180 && 
      !(lat === 0 && lng === 0)) {
    // Found valid coordinates at this level
    return { latitude: lat, longitude: lng };
  }
  
  // Check for common field names that might contain location data
  const locationFields = ['location', 'Location', 'address', 'Address', 'geo', 'Geo', 'coordinates', 'Coordinates'];
  
  // First check the location-specific fields
  for (const field of locationFields) {
    if (obj[field] && typeof obj[field] === 'object') {
      const result = findCoordinatesInNestedStructure(obj[field], depth + 1, maxDepth);
      if (result.latitude && result.longitude) {
        return result;
      }
    }
  }
  
  // Then recursively check all object fields
  for (const key in obj) {
    if (obj[key] && typeof obj[key] === 'object') {
      const result = findCoordinatesInNestedStructure(obj[key], depth + 1, maxDepth);
      if (result.latitude && result.longitude) {
        return result;
      }
    }
  }
  
  return {};
};

export function extractCoordinates(payload: any): { latitude?: number; longitude?: number; status?: string } {
  // If no payload, return empty result
  if (!payload) {
    return { status: 'no-payload' };
  }
  let rawpayload = payload.raw_payload
  try {
    // SIMPLIFIED APPROACH: Coordinates are now directly in raw_payload
    console.log('PAYLOAD DEFAULT', payload)
    // Ensure payload is an object
    if (typeof rawpayload !== 'object') {
      // If it's a string, try to parse it as JSON
      if (typeof rawpayload === 'string') {
        try {
          rawpayload = JSON.parse(rawpayload);
        } catch (e) {
          return { status: 'parse-error' };
        }
      } else {
        return { status: 'invalid-payload-type' };
      }
    }
    
    // Check for empty strings explicitly
    if (rawpayload.latitude === '' || rawpayload.longitude === '') {
      return { status: 'empty-string-coordinates' };
    }
    
    // Extract latitude and longitude
    const lat = parseFloat(String(rawpayload.latitude || ''));
    const lng = parseFloat(String(rawpayload.longitude || ''));
    
    // Validate coordinates
    if (isNaN(lat) || isNaN(lng)) {
      return { status: 'invalid-coordinates' };
    }
    
    if (lat < -90 || lat > 90) {
      return { status: 'invalid-latitude-range' };
    }
    
    if (lng < -180 || lng > 180) {
      return { status: 'invalid-longitude-range' };
    }
    
    // Skip 0,0 coordinates as they're likely invalid/default values
    if (lat === 0 && lng === 0) {
      return { status: 'zero-coordinates' };
    }
    
    // Valid coordinates found
    return { latitude: lat, longitude: lng };
  } catch (error) {
    return { status: 'exception' };
  }
}

/**
 * Helper function to extract coordinates from an object
 */
const extractCoordsFromObject = (obj: any): { latitude?: number; longitude?: number; status?: string } => {
  if (!obj || typeof obj !== 'object') {
    return { status: 'invalid' };
  }
  
  // Extract coordinates using various possible property names
  const lat = parseFloat(String(
    obj.latitude || 
    obj.Latitude || 
    obj.lat || 
    (obj.location && obj.location.lat) ||
    (obj.Location && obj.Location.lat) ||
    (obj.coordinates && obj.coordinates[0]) ||
    (obj.geo && obj.geo.latitude) ||
    (obj.geo && obj.geo.lat) ||
    ''
  ));
  
  const lng = parseFloat(String(
    obj.longitude || 
    obj.Longitude || 
    obj.lng || 
    (obj.location && obj.location.lng) ||
    (obj.Location && obj.Location.lng) ||
    (obj.coordinates && obj.coordinates[1]) ||
    (obj.geo && obj.geo.longitude) ||
    (obj.geo && obj.geo.lng) ||
    ''
  ));
  
  // Validate coordinates
  if (isNaN(lat) || isNaN(lng)) {
    return { status: 'invalid' };
  }
  
  if (lat < -90 || lat > 90) {
    return { status: 'invalid' };
  }
  
  if (lng < -180 || lng > 180) {
    return { status: 'invalid' };
  }
  
  // Skip 0,0 coordinates as they're likely invalid/default values
  if (lat === 0 && lng === 0) {
    return { status: 'invalid' };
  }
  
  return { latitude: lat, longitude: lng };
};

/**
 * Safely extracts entity name from raw payload data
 * Handles different property structures for AHJs and utilities
 */
export const extractEntityName = (
  entity: any, 
  entityType: 'ahj' | 'utility' | 'financier'
): string => {
  try {
    
    if (entityType === 'ahj') {
      // Check for both single-nested and double-nested raw_payload structures
      // First try the direct properties
      const directName = entity.name || entity.ahj_name || entity.authority_having_jurisdiction;
      if (directName) return directName;
      
      // Then check for single-nested raw_payload (new structure)
      if (entity.raw_payload && typeof entity.raw_payload === 'object') {
        // Try to get name directly from raw_payload
        const singleNestedName = entity.raw_payload.name;
        if (singleNestedName) return singleNestedName;
        
        // If that doesn't work, try the old double-nested structure
        if (entity.raw_payload.raw_payload && typeof entity.raw_payload.raw_payload === 'object') {
          const doubleNestedName = entity.raw_payload.raw_payload.name;
          if (doubleNestedName) return doubleNestedName;
        }
      }
      
      // If all else fails, return Unknown AHJ
      return `Unknown AHJ`;
    } else if (entityType === 'utility') {
      // Try multiple possible field names for utility name
      const name = entity.company_name || 
                  entity.name || 
                  entity.utility_name ||
                  entity.utility_company_name ||
                  entity.company ||
                  // Try to extract from raw_payload
                  (entity.raw_payload && typeof entity.raw_payload === 'object' ? 
                    (entity.raw_payload.company_name || 
                     entity.raw_payload.name || 
                     entity.raw_payload.utility_name) : null);
      
      // If we found a name, return it
      if (name) return name;
      
      // If we still don't have a name, try to extract from nested structures
      if (entity.raw_payload && typeof entity.raw_payload === 'object') {
        // Try first level
        const firstLevel = entity.raw_payload;
        
        // If first level has raw_payload, try that too
        if (firstLevel.raw_payload && typeof firstLevel.raw_payload === 'object') {
          const secondLevel = firstLevel.raw_payload;
          return secondLevel.company_name || 
                 secondLevel.name || 
                 secondLevel.utility_name ||
                 firstLevel.company_name ||
                 firstLevel.name ||
                 firstLevel.utility_name ||
                 `Unknown Utility`;
        }
        
        return firstLevel.company_name || 
               firstLevel.name || 
               firstLevel.utility_name ||
               `Unknown Utility`;
      }
      
      return `Unknown Utility`;
    } else {
      // Financier names
      return entity.company_name || 
             entity.name || 
             entity.financier_name ||
             `Unknown ${entityType.charAt(0).toUpperCase() + entityType.slice(1)}`;
    }
  } catch (error) {
    return `Unknown ${entityType.charAt(0).toUpperCase() + entityType.slice(1)}`;
  }
};

/**
 * Safely extracts classification from entity data
 * Handles different property naming conventions and formats
 */
export const extractClassification = (classificationValue: any): string => {
  // Handle case where input is null, undefined, or empty
  if (!classificationValue) {
    return 'Unknown';
  }
  
  // Convert to string and normalize
  let classStr = '';
  
  if (typeof classificationValue === 'object') {
    // Try to extract from object structure
    classStr = classificationValue.classification || 
               classificationValue['eligible-for-classification'] || 
               classificationValue.class || 
               classificationValue.value || 
               '';
  } else {
    classStr = String(classificationValue).trim();
  }
  
  // Normalize the classification string
  classStr = classStr.toUpperCase();
  
  // Handle common formats
  if (classStr === 'A' || classStr === 'CLASS A' || classStr === 'CLASSA' || classStr === 'A CLASS') {
    return 'A';
  } else if (classStr === 'B' || classStr === 'CLASS B' || classStr === 'CLASSB' || classStr === 'B CLASS') {
    return 'B';
  } else if (classStr === 'C' || classStr === 'CLASS C' || classStr === 'CLASSC' || classStr === 'C CLASS') {
    return 'C';
  }
  
  // If we couldn't determine the classification
  return 'Unknown';
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
