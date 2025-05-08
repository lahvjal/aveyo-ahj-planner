import { useState, useEffect } from 'react';
import { supabase } from '@/utils/supabaseClient';

export interface EntityData {
  id: string;
  name: string;
  classification: string;
  projectCount: number;
  latitude?: number;
  longitude?: number;
  distance: number;
}

export function useEntities() {
  const [ahjs, setAhjs] = useState<EntityData[]>([]);
  const [utilities, setUtilities] = useState<EntityData[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const fetchEntities = async () => {
      setIsLoading(true);
      setError(null);
      
      try {
        // Fetch AHJs
        const { data: ahjData, error: ahjError } = await supabase
          .from('ahj')
          .select('*');
          
        if (ahjError) {
          throw new Error(`Error fetching AHJs: ${ahjError.message}`);
        }
        
        // Fetch Utilities
        const { data: utilityData, error: utilityError } = await supabase
          .from('utility')
          .select('*');
          
        if (utilityError) {
          throw new Error(`Error fetching Utilities: ${utilityError.message}`);
        }
        
        // Count projects for each AHJ and Utility manually since we can't use group in static export mode
        // Get all projects with AHJ and utility IDs
        const { data: projectData, error: projectError } = await supabase
          .from('podio_data')
          .select('ahj_item_id, utility_company_item_id');
          
        if (projectError) {
          console.error('Error fetching project data for counts:', projectError);
        }
        
        // Count projects for each AHJ and Utility
        const ahjCountMap = new Map();
        const utilityCountMap = new Map();
        
        (projectData || []).forEach((project: any) => {
          // Count AHJ projects
          if (project.ahj_item_id) {
            const count = ahjCountMap.get(project.ahj_item_id) || 0;
            ahjCountMap.set(project.ahj_item_id, count + 1);
          }
          
          // Count Utility projects
          if (project.utility_company_item_id) {
            const count = utilityCountMap.get(project.utility_company_item_id) || 0;
            utilityCountMap.set(project.utility_company_item_id, count + 1);
          }
        });
        
        console.log(`[COORDINATES] Processing ${ahjData?.length || 0} AHJs and ${utilityData?.length || 0} Utilities`);
        
        // Process AHJ data
        const processedAhjs = (ahjData || []).map((ahj: any) => {
          // Extract coordinates from raw_payload
          let latitude: number | undefined;
          let longitude: number | undefined;
          
          console.log(`[COORDINATES] Processing AHJ ID: ${ahj.ahj_item_id || ahj.id}`);
          
          try {
            if (ahj.raw_payload) {
              console.log(`[COORDINATES] AHJ has raw_payload, type: ${typeof ahj.raw_payload}`);
              let rawPayload = ahj.raw_payload;
              
              // Handle nested raw_payload structure
              if (typeof rawPayload === 'object' && rawPayload.raw_payload) {
                console.log('[COORDINATES] Found nested raw_payload structure');
                rawPayload = rawPayload.raw_payload;
              }
              
              // Parse string JSON if needed
              if (typeof rawPayload === 'string') {
                console.log('[COORDINATES] raw_payload is a string, attempting to parse as JSON');
                try {
                  rawPayload = JSON.parse(rawPayload);
                  console.log('[COORDINATES] Successfully parsed raw_payload JSON string');
                } catch (e) {
                  console.error('[COORDINATES] Failed to parse AHJ raw_payload JSON string:', e);
                }
              }
              
              // Extract coordinates
              if (typeof rawPayload === 'object') {
                console.log('[COORDINATES] raw_payload keys:', Object.keys(rawPayload));
                
                if (rawPayload.latitude !== undefined) {
                  latitude = parseFloat(rawPayload.latitude);
                  console.log(`[COORDINATES] Found latitude: ${latitude}`);
                } else {
                  console.log('[COORDINATES] No latitude found in raw_payload');
                }
                
                if (rawPayload.longitude !== undefined) {
                  longitude = parseFloat(rawPayload.longitude);
                  console.log(`[COORDINATES] Found longitude: ${longitude}`);
                } else {
                  console.log('[COORDINATES] No longitude found in raw_payload');
                }
              } else {
                console.log(`[COORDINATES] raw_payload is not an object, type: ${typeof rawPayload}`);
              }
            } else {
              console.log('[COORDINATES] AHJ has no raw_payload');
            }
          } catch (error) {
            console.error('[COORDINATES] Error extracting coordinates from AHJ raw_payload:', error);
          }
          
          // Get AHJ name from raw_payload
          let name = 'Unknown AHJ';
          try {
            if (ahj.raw_payload && typeof ahj.raw_payload === 'object' && 
                ahj.raw_payload.raw_payload && typeof ahj.raw_payload.raw_payload === 'object') {
              name = ahj.raw_payload.raw_payload.name || name;
            }
          } catch (error) {
            console.error('Error extracting name from AHJ raw_payload:', error);
          }
          
          // Validate coordinates
          if (latitude !== undefined && longitude !== undefined) {
            if (isNaN(latitude) || isNaN(longitude) || 
                latitude < -90 || latitude > 90 || 
                longitude < -180 || longitude > 180) {
              latitude = undefined;
              longitude = undefined;
            }
          }
          
          return {
            id: ahj.ahj_item_id || ahj.id,
            name,
            classification: ahj.classification || ahj['eligible-for-classification'] || 'Unknown',
            projectCount: ahjCountMap.get(ahj.ahj_item_id || ahj.id) || 0,
            latitude,
            longitude,
            distance: Number.MAX_VALUE
          };
        });
        
        // Process Utility data
        const processedUtilities = (utilityData || []).map((utility: any) => {
          // Extract coordinates from raw_payload
          let latitude: number | undefined;
          let longitude: number | undefined;
          
          console.log(`[COORDINATES] Processing Utility ID: ${utility.utility_company_item_id || utility.id}, Name: ${utility.company_name || 'Unknown'}`);
          
          try {
            if (utility.raw_payload) {
              console.log(`[COORDINATES] Utility has raw_payload, type: ${typeof utility.raw_payload}`);
              let rawPayload = utility.raw_payload;
              
              // Handle nested raw_payload structure
              if (typeof rawPayload === 'object' && rawPayload.raw_payload) {
                console.log('[COORDINATES] Found nested raw_payload structure in Utility');
                rawPayload = rawPayload.raw_payload;
              }
              
              // Parse string JSON if needed
              if (typeof rawPayload === 'string') {
                console.log('[COORDINATES] Utility raw_payload is a string, attempting to parse as JSON');
                try {
                  rawPayload = JSON.parse(rawPayload);
                  console.log('[COORDINATES] Successfully parsed Utility raw_payload JSON string');
                } catch (e) {
                  console.error('[COORDINATES] Failed to parse Utility raw_payload JSON string:', e);
                }
              }
              
              // Extract coordinates
              if (typeof rawPayload === 'object') {
                console.log('[COORDINATES] Utility raw_payload keys:', Object.keys(rawPayload));
                
                if (rawPayload.latitude !== undefined) {
                  latitude = parseFloat(rawPayload.latitude);
                  console.log(`[COORDINATES] Found Utility latitude: ${latitude}`);
                } else {
                  console.log('[COORDINATES] No latitude found in Utility raw_payload');
                }
                
                if (rawPayload.longitude !== undefined) {
                  longitude = parseFloat(rawPayload.longitude);
                  console.log(`[COORDINATES] Found Utility longitude: ${longitude}`);
                } else {
                  console.log('[COORDINATES] No longitude found in Utility raw_payload');
                }
              } else {
                console.log(`[COORDINATES] Utility raw_payload is not an object, type: ${typeof rawPayload}`);
              }
            } else {
              console.log('[COORDINATES] Utility has no raw_payload');
            }
          } catch (error) {
            console.error('[COORDINATES] Error extracting coordinates from Utility raw_payload:', error);
          }
          
          // Validate coordinates
          if (latitude !== undefined && longitude !== undefined) {
            if (isNaN(latitude) || isNaN(longitude) || 
                latitude < -90 || latitude > 90 || 
                longitude < -180 || longitude > 180) {
              latitude = undefined;
              longitude = undefined;
            }
          }
          
          return {
            id: utility.utility_company_item_id || utility.id,
            name: utility.company_name || 'Unknown Utility',
            classification: utility.classification || utility['eligible-for-classification'] || 'Unknown',
            projectCount: utilityCountMap.get(utility.utility_company_item_id || utility.id) || 0,
            latitude,
            longitude,
            distance: Number.MAX_VALUE
          };
        });
        
        setAhjs(processedAhjs);
        setUtilities(processedUtilities);
      } catch (error: any) {
        console.error('Error in useEntities hook:', error);
        setError(error.message || 'Failed to load entity data');
      } finally {
        setIsLoading(false);
      }
    };
    
    fetchEntities();
  }, []);
  
  /**
   * Calculate distances for entities based on user location
   */
  const calculateDistances = (userLocation: { latitude: number; longitude: number } | null) => {
    console.log('[DISTANCE] Starting distance calculations with user location:', userLocation);
    if (!userLocation) {
      console.log('[DISTANCE] No user location provided, skipping distance calculations');
      return;
    }
    
    console.log(`[DISTANCE] Calculating distances for ${ahjs.length} AHJs and ${utilities.length} Utilities`);
    
    // Count how many entities have valid coordinates
    let ahjsWithCoords = 0;
    let utilitiesWithCoords = 0;
    
    // Calculate distance for AHJs
    const updatedAhjs = ahjs.map(ahj => {
      if (ahj.latitude && ahj.longitude) {
        ahjsWithCoords++;
        const distance = calculateDistance(
          userLocation.latitude,
          userLocation.longitude,
          ahj.latitude,
          ahj.longitude
        );
        console.log(`[DISTANCE] AHJ "${ahj.name}" (${ahj.id}): ${distance.toFixed(2)} miles`);
        return { ...ahj, distance };
      }
      console.log(`[DISTANCE] AHJ "${ahj.name}" (${ahj.id}): No coordinates available`);
      return ahj;
    });
    
    // Calculate distance for Utilities
    const updatedUtilities = utilities.map(utility => {
      if (utility.latitude && utility.longitude) {
        utilitiesWithCoords++;
        const distance = calculateDistance(
          userLocation.latitude,
          userLocation.longitude,
          utility.latitude,
          utility.longitude
        );
        console.log(`[DISTANCE] Utility "${utility.name}" (${utility.id}): ${distance.toFixed(2)} miles`);
        return { ...utility, distance };
      }
      console.log(`[DISTANCE] Utility "${utility.name}" (${utility.id}): No coordinates available`);
      return utility;
    });
    
    // Sort by distance
    updatedAhjs.sort((a, b) => a.distance - b.distance);
    updatedUtilities.sort((a, b) => a.distance - b.distance);
    
    console.log(`[DISTANCE] Completed calculations: ${ahjsWithCoords}/${ahjs.length} AHJs and ${utilitiesWithCoords}/${utilities.length} Utilities have coordinates`);
    
    setAhjs(updatedAhjs);
    setUtilities(updatedUtilities);
  };
  
  /**
   * Calculate distance between two points using Haversine formula
   */
  function calculateDistance(lat1: number, lon1: number, lat2: number, lon2: number): number {
    const R = 3958.8; // Earth's radius in miles
    const dLat = (lat2 - lat1) * Math.PI / 180;
    const dLon = (lon2 - lon1) * Math.PI / 180;
    const a = 
      Math.sin(dLat/2) * Math.sin(dLat/2) +
      Math.cos(lat1 * Math.PI / 180) * Math.cos(lat2 * Math.PI / 180) * 
      Math.sin(dLon/2) * Math.sin(dLon/2);
    const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1-a));
    return R * c;
  }
  
  return {
    ahjs,
    utilities,
    isLoading,
    error,
    calculateDistances
  };
}
