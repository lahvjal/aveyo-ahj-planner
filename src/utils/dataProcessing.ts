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

export const extractCoordinates = (rawPayload: any): { latitude?: number; longitude?: number; status?: string } => {
  // If no payload provided, return empty status
  if (!rawPayload) {
    return { status: 'empty' };
  }
  
  try {
    // Handle string JSON if needed
    let payload = rawPayload;
    if (typeof payload === 'string') {
      try {
        payload = JSON.parse(payload);
      } catch (e) {
        return { status: 'invalid' };
      }
    }
    
    // IMPORTANT: The coordinates are ALWAYS in the raw_payload field
    // We need to handle the double-nested structure: item.raw_payload.raw_payload.longitude
    
    // First level: Check if payload has raw_payload
    if (typeof payload === 'object' && payload?.raw_payload) {
      // Get first level raw_payload
      let firstLevelPayload = payload.raw_payload;
      
      // If first level raw_payload is a string, try to parse it
      if (typeof firstLevelPayload === 'string') {
        try {
          firstLevelPayload = JSON.parse(firstLevelPayload);
        } catch (e) {
          return { status: 'invalid' };
        }
      }
      
      // Second level: Check if first level payload has raw_payload
      if (typeof firstLevelPayload === 'object' && firstLevelPayload?.raw_payload) {
        // Get second level raw_payload
        let secondLevelPayload = firstLevelPayload.raw_payload;
        
        // If second level raw_payload is a string, try to parse it
        if (typeof secondLevelPayload === 'string') {
          try {
            secondLevelPayload = JSON.parse(secondLevelPayload);
          } catch (e) {
            return { status: 'invalid' };
          }
        }
        
        // Use the second level payload for coordinates
        payload = secondLevelPayload;
      } else {
        // If no second level, use the first level
        payload = firstLevelPayload;
      }
    } else {
      return { status: 'empty' };
    }
    
    // Only continue if payload is an object
    if (typeof payload !== 'object' || payload === null) {
      return { status: 'invalid' };
    }
    
    // Check for common coordinate field patterns
    const coordFields = ['latitude', 'Latitude', 'lat', 'longitude', 'Longitude', 'lng', 'location', 'Location', 'coordinates', 'Coordinates'];
    const availableFields = coordFields.filter(field => field in payload);
    
    // Extract coordinates using various possible property names
    const lat = parseFloat(String(
      payload.latitude || 
      payload.Latitude || 
      payload.lat || 
      (payload.location && payload.location.lat) ||
      (payload.Location && payload.Location.lat) ||
      (payload.coordinates && payload.coordinates[0]) ||
      ''
    ));
    
    const lng = parseFloat(String(
      payload.longitude || 
      payload.Longitude || 
      payload.lng || 
      (payload.location && payload.location.lng) ||
      (payload.Location && payload.Location.lng) ||
      (payload.coordinates && payload.coordinates[1]) ||
      ''
    ));
    
    // Extract and parse coordinate values
    
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
    
    if (lat === 0 && lng === 0) {
      return { status: 'invalid' };
    }
    
    return { latitude: lat, longitude: lng };
  } catch (error) {
    return { status: 'invalid' };
  }
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
      // AHJ names are stored in raw_payload.raw_payload.name
      return (entity.raw_payload && 
              typeof entity.raw_payload === 'object' && 
              entity.raw_payload.raw_payload && 
              typeof entity.raw_payload.raw_payload === 'object' ? 
                entity.raw_payload.raw_payload.name : null) || 
                entity.name || 
                `Unknown AHJ`;
    } else {
      // Utility and Financier names are stored in company_name
      return entity.company_name || `Unknown ${entityType.charAt(0).toUpperCase() + entityType.slice(1)}`;
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
