import { useState, useEffect, useCallback, useRef } from 'react';
import { supabase } from '@/utils/supabaseClient';
import { extractCoordinates, extractEntityName, extractClassification } from '@/utils/dataProcessing';

// Define types for entity data
export interface EntityData {
  id: string;
  name: string;
  classification: string;
  projectCount: number;
  distance: number;
  latitude?: number;
  longitude?: number;
  coordStatus?: string; // Status of coordinate extraction: 'empty', 'invalid', or undefined for valid coordinates
  
  // Relationship data
  relatedUtilityCount?: number;
  relatedAhjCount?: number;
  relatedUtilityIds?: string[];
  relatedAhjIds?: string[];
}

// Cache keys
const ENTITY_CACHE_KEY = 'aveyo_entity_cache';

// Function to load entities from cache
function loadFromCache() {
  try {
    const cachedData = localStorage.getItem(ENTITY_CACHE_KEY);
    if (!cachedData) return null;
    
    const parsed = JSON.parse(cachedData);
    return parsed;
  } catch (error) {
    return null;
  }
}

// Function to save entities to cache
function saveToCache(ahjs: EntityData[], utilities: EntityData[]) {
  try {
    const cacheData = {
      ahjs,
      utilities,
      timestamp: Date.now()
    };
    localStorage.setItem(ENTITY_CACHE_KEY, JSON.stringify(cacheData));
  } catch (error) {
    // Silent fail for cache operations
  }
}

// Define the type for external data passed from useProjects
export interface ExternalEntityData {
  ahjs?: any[];
  utilities?: any[];
}

// Define the return type for the useEntities hook
export interface UseEntitiesResult {
  ahjs: EntityData[];
  utilities: EntityData[];
  isLoading: boolean;
  error: string | null;
  calculateDistances: (userLocation: { latitude: number; longitude: number } | null) => void;
}

/**
 * Custom hook to fetch and manage AHJ and Utility entities
 * Can accept external data from useProjects to avoid redundant fetching
 */
export const useEntities = (externalData?: ExternalEntityData): UseEntitiesResult => {
  // State for AHJs and Utilities
  const [ahjs, setAhjs] = useState<EntityData[]>([]);
  const [utilities, setUtilities] = useState<EntityData[]>([]);
  
  // Loading and error states
  const [isLoading, setIsLoading] = useState<boolean>(false);
  const [error, setError] = useState<string | null>(null);
  const [usingExternalData, setUsingExternalData] = useState<boolean>(false);
  
  // Refs for tracking component mount state and fetch operations
  const isMounted = useRef<boolean>(true);
  const fetchIdRef = useRef(0);

  // Calculate distance between two points using Haversine formula
  const calculateHaversineDistance = (lat1: number, lon1: number, lat2: number, lon2: number): number => {
    const R = 6371; // Radius of the Earth in km
    const dLat = (lat2 - lat1) * Math.PI / 180;
    const dLon = (lon2 - lon1) * Math.PI / 180;
    const a = 
      Math.sin(dLat / 2) * Math.sin(dLat / 2) +
      Math.cos(lat1 * Math.PI / 180) * Math.cos(lat2 * Math.PI / 180) * 
      Math.sin(dLon / 2) * Math.sin(dLon / 2);
    const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
    const distance = R * c; // Distance in km
    return distance;
  };
  
  // Calculate distances between entities and user location
  const calculateDistances = useCallback((userLocation: { latitude: number; longitude: number } | null) => {
    if (!userLocation || !userLocation.latitude || !userLocation.longitude) return;
    
    // Calculate distances for AHJs
    const updatedAhjs = ahjs.map(ahj => {
      if (ahj.latitude && ahj.longitude) {
        const distance = calculateHaversineDistance(
          userLocation.latitude,
          userLocation.longitude,
          ahj.latitude,
          ahj.longitude
        );
        return { ...ahj, distance };
      }
      return { ...ahj, distance: Number.MAX_VALUE }; // Set a very large distance for entities without coordinates
    });
    
    // Calculate distances for utilities
    const updatedUtilities = utilities.map(utility => {
      if (utility.latitude && utility.longitude) {
        const distance = calculateHaversineDistance(
          userLocation.latitude,
          userLocation.longitude,
          utility.latitude,
          utility.longitude
        );
        return { ...utility, distance };
      }
      return { ...utility, distance: Number.MAX_VALUE }; // Set a very large distance for entities without coordinates
    });
    
    setAhjs(updatedAhjs);
    setUtilities(updatedUtilities);
  }, [ahjs, utilities]);

  // Function to process external entity data from useProjects
  const processExternalData = useCallback((data: ExternalEntityData) => {
    if (!data) return;
    
    setIsLoading(true);
    setUsingExternalData(true);
    
    try {
      // Create maps to deduplicate entities
      const ahjMap = new Map<string, EntityData>();
      const utilityMap = new Map<string, EntityData>();
      
      // Process AHJs
      if (data.ahjs && data.ahjs.length > 0) {
        // Process each AHJ and add to map with ID as key
        data.ahjs.forEach(ahj => {
          const id = ahj.ahj_item_id || ahj.id;
          if (!id) return; // Skip entities without IDs
          
          if (!ahjMap.has(id)) {
            ahjMap.set(id, {
              id,
              name: extractEntityName(ahj.name || ahj.ahj_name || '', 'ahj'),
              classification: extractClassification(ahj.classification || ''),
              projectCount: 0, // Will be calculated later if needed
              distance: 0,
              ...extractCoordinates(ahj.coordinates || ahj.raw_payload)
            });
          }
        });
      }
      
      // Process Utilities
      if (data.utilities && data.utilities.length > 0) {
        // Process each utility and add to map with ID as key
        data.utilities.forEach(utility => {
          const id = utility.utility_company_item_id || utility.id;
          if (!id) return; // Skip entities without IDs
          
          if (!utilityMap.has(id)) {
            utilityMap.set(id, {
              id,
              name: extractEntityName(utility.name || utility.utility_name || '', 'utility'),
              classification: extractClassification(utility.classification || ''),
              projectCount: 0, // Will be calculated later if needed
              distance: 0,
              ...extractCoordinates(utility.coordinates || utility.raw_payload)
            });
          }
        });
      }
      
      // Convert maps to arrays
      const processedAhjs = Array.from(ahjMap.values());
      const processedUtilities = Array.from(utilityMap.values());
      
      // Update state with processed data
      setAhjs(processedAhjs);
      setUtilities(processedUtilities);
      
      // Save processed data to cache
      if (processedAhjs.length > 0 || processedUtilities.length > 0) {
        saveToCache(processedAhjs, processedUtilities);
      }
    } catch (err) {
      setError('Error processing entity data');
      console.error('Error in processExternalData:', err);
    } finally {
      setIsLoading(false);
    }
  }, []);
  
  // Function to fetch entities from Supabase
  const fetchEntities = useCallback(async () => {
    // Increment fetch ID to track the latest fetch operation
    const fetchId = ++fetchIdRef.current;
    
    // Set loading state
    setIsLoading(true);
    setError(null);
    
    try {
      // Check if we have cached data
      const cachedData = loadFromCache();
      if (cachedData) {
        // Use cached data if available and not too old (24 hours)
        const cacheAge = Date.now() - cachedData.timestamp;
        const cacheExpiry = 24 * 60 * 60 * 1000; // 24 hours in milliseconds
        
        if (cacheAge < cacheExpiry) {
          // Ensure this is still the latest fetch operation
          if (isMounted.current && fetchId === fetchIdRef.current) {
            setAhjs(cachedData.ahjs || []);
            setUtilities(cachedData.utilities || []);
            setError(null);
            setIsLoading(false);
            return;
          }
        }
      }
      
      // Fetch AHJs and Utilities from Supabase
      const [ahjResult, utilityResult] = await Promise.all([
        supabase.from('ahj').select('*'),
        supabase.from('utility').select('*')
      ]);
      
      // Check if this is still the latest fetch operation
      if (isMounted.current && fetchId === fetchIdRef.current) {
        if (ahjResult.error) {
          setError('Error fetching AHJ data: ' + ahjResult.error.message);
          setIsLoading(false);
          return;
        }
        
        if (utilityResult.error) {
          setError('Error fetching Utility data: ' + utilityResult.error.message);
          setIsLoading(false);
          return;
        }
        
        // Process AHJs
        const processedAhjs = (ahjResult.data || []).map(ahj => ({
          id: ahj.id,
          name: extractEntityName(ahj.name || '', 'ahj'),
          classification: extractClassification(ahj.classification || ''),
          projectCount: 0, // Will be calculated later if needed
          distance: 0,
          ...extractCoordinates(ahj.coordinates || ahj.raw_payload)
        }));
        
        // Process Utilities
        const processedUtilities = (utilityResult.data || []).map(utility => ({
          id: utility.id,
          name: extractEntityName(utility.name || '', 'utility'),
          classification: extractClassification(utility.classification || ''),
          projectCount: 0, // Will be calculated later if needed
          distance: 0,
          ...extractCoordinates(utility.coordinates || utility.raw_payload)
        }));
        
        // Update state with processed data
        setAhjs(processedAhjs);
        setUtilities(processedUtilities);
        setIsLoading(false);
        
        // Save processed data to cache
        saveToCache(processedAhjs, processedUtilities);
      }
    } catch (err) {
      // Only update state if this is still the latest fetch operation
      if (isMounted.current && fetchId === fetchIdRef.current) {
        console.error('Error fetching entities:', err);
        setError('Error fetching entity data');
        setIsLoading(false);
      }
    }
  }, []);
  
  // Effect to fetch data or process external data
  useEffect(() => {
    // Check if we have external data from useProjects
    if (externalData) {
      // Process external data
      processExternalData(externalData);
      return; // Skip fetching if we have external data
    }
    
    // Start the fetch process if no external data
    fetchEntities();
    
    // Cleanup function to prevent state updates after unmount
    return () => {
      isMounted.current = false;
      // Reset fetch ID to cancel any in-progress operations
      fetchIdRef.current = 0;
    };
  }, [externalData, processExternalData, fetchEntities]);
  
  // Return the hook result
  return {
    ahjs,
    utilities,
    isLoading,
    error,
    calculateDistances
  };
};
