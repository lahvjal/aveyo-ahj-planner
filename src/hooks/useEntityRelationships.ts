import { useState, useEffect, useCallback } from 'react';
import { Project } from '@/utils/types';
import { supabase } from '@/utils/supabaseClient';

/**
 * Custom hook to track relationships between AHJs and Utilities based on projects
 * This allows us to filter one entity type based on selection of the other
 */
export function useEntityRelationships(projects: Project[]) {
  // Create state for relationship maps
  const [ahjToUtilityMap, setAhjToUtilityMap] = useState<Map<string, Set<string>>>(new Map());
  const [utilityToAhjMap, setUtilityToAhjMap] = useState<Map<string, Set<string>>>(new Map());
  
  // Process projects to build initial relationship maps
  useEffect(() => {
    // Create new maps to avoid mutating state directly
    const newAhjToUtilityMap = new Map<string, Set<string>>();
    const newUtilityToAhjMap = new Map<string, Set<string>>();
    
    // Process the provided projects (which may be filtered by the user)
    projects.forEach(project => {
      const ahjId = project.ahj?.id;
      const utilityId = project.utility?.id;
      
      if (ahjId && utilityId) {
        // Add utility to AHJ's related utilities
        if (!newAhjToUtilityMap.has(ahjId)) {
          newAhjToUtilityMap.set(ahjId, new Set());
        }
        newAhjToUtilityMap.get(ahjId)!.add(utilityId);
        
        // Add AHJ to utility's related AHJs
        if (!newUtilityToAhjMap.has(utilityId)) {
          newUtilityToAhjMap.set(utilityId, new Set());
        }
        newUtilityToAhjMap.get(utilityId)!.add(ahjId);
      }
    });
    
    // Update state with new maps
    setAhjToUtilityMap(newAhjToUtilityMap);
    setUtilityToAhjMap(newUtilityToAhjMap);
    
    console.log(`[Relationships] Initial maps created from ${projects.length} projects`);
  }, [projects]);
  
  // Fetch all project relationships from Supabase to ensure we have complete data
  useEffect(() => {
    let isMounted = true;
    
    const fetchAllRelationships = async () => {
      // Set a timeout to prevent the operation from hanging indefinitely
      const timeoutPromise = new Promise((_, reject) => {
        setTimeout(() => {
          reject(new Error('[Relationships] Timeout reached while fetching relationships'));
        }, 10000); // 10 second timeout
      });
      
      try {
        console.log('[Relationships] Fetching all project relationships from Supabase...');
        
        // Race the fetch operation against the timeout
        const fetchPromise = supabase
          .from('podio_data')
          .select('ahj_item_id, utility_company_item_id');
          
        // Use Promise.race to either get the data or timeout
        const { data: projectData, error } = await Promise.race([
          fetchPromise,
          timeoutPromise
        ]) as any;
        
        if (error) {
          console.error('Error fetching project relationship data:', error);
          return;
        }
        
        if (!isMounted) return;
        
        // Create new maps based on current state
        const newAhjToUtilityMap = new Map(ahjToUtilityMap);
        const newUtilityToAhjMap = new Map(utilityToAhjMap);
        
        // Process all project data to build complete relationship maps
        let relationshipsAdded = 0;
        
        (projectData || []).forEach((project: any) => {
          const ahjId = project.ahj_item_id;
          const utilityId = project.utility_company_item_id;
          
          if (ahjId && utilityId) {
            // Add utility to AHJ's related utilities
            if (!newAhjToUtilityMap.has(ahjId)) {
              newAhjToUtilityMap.set(ahjId, new Set());
              relationshipsAdded++;
            } else if (!newAhjToUtilityMap.get(ahjId)!.has(utilityId)) {
              relationshipsAdded++;
            }
            newAhjToUtilityMap.get(ahjId)!.add(utilityId);
            
            // Add AHJ to utility's related AHJs
            if (!newUtilityToAhjMap.has(utilityId)) {
              newUtilityToAhjMap.set(utilityId, new Set());
            }
            newUtilityToAhjMap.get(utilityId)!.add(ahjId);
          }
        });
        
        console.log(`[Relationships] Added ${relationshipsAdded} new relationships from Supabase data`);
        
        // Update state with new maps
        setAhjToUtilityMap(newAhjToUtilityMap);
        setUtilityToAhjMap(newUtilityToAhjMap);
      } catch (err) {
        console.error('Error processing project relationships:', err);
        
        // Even if there's an error, ensure we have valid maps to prevent UI issues
        if (isMounted) {
          // Initialize empty maps if we haven't already
          if (ahjToUtilityMap.size === 0) {
            setAhjToUtilityMap(new Map());
          }
          if (utilityToAhjMap.size === 0) {
            setUtilityToAhjMap(new Map());
          }
        }
      }
    };
    
    fetchAllRelationships();
    
    return () => {
      isMounted = false;
    };
  }, []); // Empty dependency array ensures this only runs once on mount
  
  // Helper functions to get related entities - memoized to prevent recreation on every render
  const getRelatedUtilities = useCallback((ahjId: string | null) => {
    if (!ahjId) return null;
    return ahjToUtilityMap.get(ahjId) || new Set();
  }, [ahjToUtilityMap]);
  
  const getRelatedAhjs = useCallback((utilityId: string | null) => {
    if (!utilityId) return null;
    return utilityToAhjMap.get(utilityId) || new Set();
  }, [utilityToAhjMap]);
  
  // Debug function to log relationship counts
  useEffect(() => {
    console.log(`[Relationships] AHJ to Utility map size: ${ahjToUtilityMap.size}`);
    console.log(`[Relationships] Utility to AHJ map size: ${utilityToAhjMap.size}`);
  }, [ahjToUtilityMap, utilityToAhjMap]);
  
  // Return the relationship data and helper functions
  return {
    getRelatedUtilities,
    getRelatedAhjs,
    hasRelationships: ahjToUtilityMap.size > 0 || utilityToAhjMap.size > 0
  };
}
