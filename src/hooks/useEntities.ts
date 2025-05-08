import { useState, useEffect, useRef, useCallback } from 'react';
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
  // Add a ref to track if the component is mounted
  const isMounted = useRef(true);

  // Add a ref to track the fetch request ID to handle race conditions
  const fetchIdRef = useRef(0);

  useEffect(() => {
    // Set isMounted to true when component mounts
    isMounted.current = true;
    
    const fetchEntities = async () => {
      // Only set state if component is still mounted
      if (!isMounted.current) return;
      
      // Increment fetch ID to track the latest request
      const currentFetchId = ++fetchIdRef.current;
      
      // Set loading state
      setIsLoading(true);
      setError(null);
      
      // Add timeout to prevent infinite loading
      const timeoutId = setTimeout(() => {
        if (isMounted.current && fetchIdRef.current === currentFetchId) {
          setError('Request timed out. Please try again.');
          setIsLoading(false);
        }
      }, 15000); // 15 second timeout
      
      try {
        // Fetch AHJs with a timeout promise
        const ahjPromise = supabase.from('ahj').select('*');
        
        // Fetch Utilities with a timeout promise
        const utilityPromise = supabase.from('utility').select('*');
        
        // Wait for both requests to complete
        const [ahjResult, utilityResult] = await Promise.all([ahjPromise, utilityPromise]);
        
        // Check if this is still the latest request
        if (!isMounted.current || fetchIdRef.current !== currentFetchId) {
          clearTimeout(timeoutId);
          return;
        }
        
        // Check for errors
        if (ahjResult.error) {
          throw new Error(`Error fetching AHJs: ${ahjResult.error.message}`);
        }
        
        if (utilityResult.error) {
          throw new Error(`Error fetching Utilities: ${utilityResult.error.message}`);
        }
        
        // Extract data
        const ahjData = ahjResult.data;
        const utilityData = utilityResult.data;
        
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
        
        // Log summary of entities being processed
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
        
        // Only update state if component is still mounted and this is still the latest request
        if (isMounted.current && fetchIdRef.current === currentFetchId) {
          setAhjs(processedAhjs);
          setUtilities(processedUtilities);
          setIsLoading(false);
        }
        
        // Clear the timeout since we completed successfully
        clearTimeout(timeoutId);
      } catch (error: any) {
        console.error('Error in useEntities hook:', error);
        // Only update state if component is still mounted and this is still the latest request
        if (isMounted.current && fetchIdRef.current === currentFetchId) {
          setError(error.message || 'Failed to load entity data');
          setIsLoading(false);
        }
        
        // Clear the timeout since we handled the error
        clearTimeout(timeoutId);
      }
    };
    
    // Start the fetch process
    const fetchPromise = fetchEntities();
    
    // Cleanup function to prevent state updates after unmount
    return () => {
      isMounted.current = false;
      // Reset fetch ID to cancel any in-progress operations
      fetchIdRef.current = 0;
    };
  }, []);
  
  /**
   * Calculate distances for entities based on user location
   * Memoized to prevent unnecessary recalculations
   */
  const calculateDistances = useCallback((userLocation: { latitude: number; longitude: number } | null) => {
    // Create a calculation ID to track this specific calculation request
    const calculationId = ++fetchIdRef.current;
    
    console.log('[DISTANCE] Starting distance calculations with user location:', userLocation);
    if (!userLocation) {
      console.log('[DISTANCE] No user location provided, skipping distance calculations');
      return;
    }
    
    // If component is not mounted, don't proceed
    if (!isMounted.current) {
      return;
    }
    
    // Performance metrics
    const startTime = performance.now();
    
    // Create spatial indices for AHJs and Utilities
    const ahjIndex = createSpatialIndex(ahjs);
    const utilityIndex = createSpatialIndex(utilities);
    
    // Get user's grid cell
    const gridSize = 1; // Must match the value in createSpatialIndex
    const userCellX = Math.floor(userLocation.longitude / gridSize);
    const userCellY = Math.floor(userLocation.latitude / gridSize);
    
    // Determine nearby cells (current cell and 8 surrounding cells)
    const nearbyCells: string[] = [];
    for (let dx = -1; dx <= 1; dx++) {
      for (let dy = -1; dy <= 1; dy++) {
        nearbyCells.push(`${userCellX + dx}:${userCellY + dy}`);
      }
    }
    
    console.log(`[DISTANCE] User location is in cell ${userCellX}:${userCellY}, checking ${nearbyCells.length} nearby cells`);
    
    // Process AHJs with spatial indexing
    let ahjsWithCoords = 0;
    let ahjsInNearbyCells = 0;
    const updatedAhjs = ahjs.map(ahj => {
      if (ahj.latitude && ahj.longitude) {
        ahjsWithCoords++;
        
        // Calculate the entity's cell
        const cellX = Math.floor(ahj.longitude / gridSize);
        const cellY = Math.floor(ahj.latitude / gridSize);
        const cellKey = `${cellX}:${cellY}`;
        
        // Check if the entity is in a nearby cell
        const isNearby = nearbyCells.includes(cellKey);
        
        // For nearby entities, calculate exact distance
        // For distant entities, use an approximate distance based on cell centers
        let distance;
        if (isNearby) {
          ahjsInNearbyCells++;
          distance = calculateDistance(
            userLocation.latitude,
            userLocation.longitude,
            ahj.latitude,
            ahj.longitude
          );
          // Only log a few entities to reduce console spam
          if (ahjsInNearbyCells <= 3) {
            console.log(`[DISTANCE] Nearby AHJ "${ahj.name}" (${ahj.id}): ${distance.toFixed(2)} miles`);
          }
        } else {
          // Approximate distance based on cell centers
          // This is less accurate but much faster for distant entities
          const approxDistance = calculateDistance(
            userLocation.latitude,
            userLocation.longitude,
            (cellY + 0.5) * gridSize, // Center of cell
            (cellX + 0.5) * gridSize  // Center of cell
          );
          distance = approxDistance;
        }
        
        return { ...ahj, distance };
      }
      return ahj;
    });
    
    // Process Utilities with spatial indexing
    let utilitiesWithCoords = 0;
    let utilitiesInNearbyCells = 0;
    const updatedUtilities = utilities.map(utility => {
      if (utility.latitude && utility.longitude) {
        utilitiesWithCoords++;
        
        // Calculate the entity's cell
        const cellX = Math.floor(utility.longitude / gridSize);
        const cellY = Math.floor(utility.latitude / gridSize);
        const cellKey = `${cellX}:${cellY}`;
        
        // Check if the entity is in a nearby cell
        const isNearby = nearbyCells.includes(cellKey);
        
        // For nearby entities, calculate exact distance
        // For distant entities, use an approximate distance based on cell centers
        let distance;
        if (isNearby) {
          utilitiesInNearbyCells++;
          distance = calculateDistance(
            userLocation.latitude,
            userLocation.longitude,
            utility.latitude,
            utility.longitude
          );
          // Only log a few entities to reduce console spam
          if (utilitiesInNearbyCells <= 3) {
            console.log(`[DISTANCE] Nearby Utility "${utility.name}" (${utility.id}): ${distance.toFixed(2)} miles`);
          }
        } else {
          // Approximate distance based on cell centers
          const approxDistance = calculateDistance(
            userLocation.latitude,
            userLocation.longitude,
            (cellY + 0.5) * gridSize, // Center of cell
            (cellX + 0.5) * gridSize  // Center of cell
          );
          distance = approxDistance;
        }
        
        return { ...utility, distance };
      }
      return utility;
    });
    
    // Sort by distance
    const sortedAhjs = [...updatedAhjs].sort((a, b) => a.distance - b.distance);
    const sortedUtilities = [...updatedUtilities].sort((a, b) => a.distance - b.distance);
    
    // Performance metrics
    const endTime = performance.now();
    console.log(`[DISTANCE] Calculation completed in ${(endTime - startTime).toFixed(2)}ms`);
    console.log(`[DISTANCE] Processed ${ahjsInNearbyCells}/${ahjsWithCoords} nearby AHJs and ${utilitiesInNearbyCells}/${utilitiesWithCoords} nearby Utilities with exact distances`);
    
    console.log(`[DISTANCE] Completed calculations: ${ahjsWithCoords}/${ahjs.length} AHJs and ${utilitiesWithCoords}/${utilities.length} Utilities have coordinates`);
    
    // Only update state if component is still mounted, this is the latest calculation,
    // and if the distances have actually changed
    if (isMounted.current && fetchIdRef.current === calculationId) {
      // Use functional updates to avoid dependency issues
      setAhjs(prev => {
        // Only update if the distances have changed
        const hasChanged = sortedAhjs.some((ahj, i) => 
          i >= prev.length || ahj.distance !== prev[i].distance
        );
        return hasChanged ? sortedAhjs : prev;
      });
      
      setUtilities(prev => {
        // Only update if the distances have changed
        const hasChanged = sortedUtilities.some((utility, i) => 
          i >= prev.length || utility.distance !== prev[i].distance
        );
        return hasChanged ? sortedUtilities : prev;
      });
      
      console.log('[DISTANCE] Distance calculations applied successfully');
    } else {
      console.log('[DISTANCE] Skipping state update - newer calculation in progress or component unmounted');
    }
  }, [ahjs, utilities]);
  
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
  
  /**
   * Create a grid-based spatial index for more efficient distance calculations
   * This divides the US into grid cells and only calculates exact distances for entities in nearby cells
   */
  function createSpatialIndex(entities: EntityData[]): Map<string, EntityData[]> {
    const gridSize = 1; // Grid cell size in degrees (roughly 69 miles per degree at the equator)
    const spatialIndex = new Map<string, EntityData[]>();
    
    entities.forEach(entity => {
      if (entity.latitude && entity.longitude) {
        // Calculate grid cell key based on coordinates
        const cellX = Math.floor(entity.longitude / gridSize);
        const cellY = Math.floor(entity.latitude / gridSize);
        const cellKey = `${cellX}:${cellY}`;
        
        // Add entity to its grid cell
        if (!spatialIndex.has(cellKey)) {
          spatialIndex.set(cellKey, []);
        }
        spatialIndex.get(cellKey)!.push(entity);
      }
    });
    
    return spatialIndex;
  }
  
  return {
    ahjs,
    utilities,
    isLoading,
    error,
    calculateDistances
  };
}
