'use client';

import React, { createContext, useContext, useState, useEffect, useMemo, useCallback, ReactNode } from 'react';
import { supabase } from '@/utils/supabaseClient';
import { Project, ProjectFilter } from '@/utils/types';
import { extractCoordinates, extractEntityName, extractClassification } from '@/utils/dataProcessing';

// Import EntityData from useEntities to ensure consistency
import { EntityData as BaseEntityData } from '@/hooks/useEntities';

// Define types for our context
interface EntityData extends BaseEntityData {
  // Any additional properties specific to DataContext can be added here
}

// Extended ProjectFilter type with ID field for our internal use
interface EnhancedProjectFilter extends ProjectFilter {
  id: string;
}

interface FilterState {
  projectFilters: EnhancedProjectFilter[];
  entityFilters: EnhancedProjectFilter[];
  sortOptions: { field: string; direction: 'asc' | 'desc' };
}

interface RawData {
  projects: Project[];
  ahjs: any[];
  utilities: any[];
  financiers: any[];
  isLoading: boolean;
  error: string | null;
}

interface FilteredData {
  projects: Project[];
  ahjs: EntityData[];
  utilities: EntityData[];
  financiers: any[];
}

interface DataContextType extends FilteredData {
  // Raw data access
  rawProjects: Project[];
  rawAhjs: any[];
  rawUtilities: any[];
  rawFinanciers: any[];
  
  // Loading and error states
  isLoading: boolean;
  error: string | null;
  
  // Filter state
  filters: FilterState;
  
  // Filter actions
  addFilter: (filter: ProjectFilter) => void;
  removeFilter: (filterId: string, isEntityFilter?: boolean) => void;
  clearFilters: () => void;
  
  // Search functionality
  searchTerms: string;
  handleSearch: (terms: string) => void;
  
  // Sorting
  updateSortOptions: (field: string, direction: 'asc' | 'desc') => void;
  
  // Location
  userLocation: { latitude: number; longitude: number } | null;
  setUserLocation: (location: { latitude: number; longitude: number } | null) => void;
  
  // User-specific filters
  showOnlyMyProjects: boolean;
  toggleShowOnlyMyProjects: () => void;
  
  // 45-day filter
  show45DayQualified: boolean;
  set45DayFilter: (show: boolean) => void;
  
  // Data fetching
  refreshData: () => Promise<void>;
  fetchAllData: () => Promise<void>;
}

// Create the context
const DataContext = createContext<DataContextType | null>(null);

// Helper function to calculate distances between coordinates
const calculateDistance = (lat1: number, lon1: number, lat2: number, lon2: number): number => {
  // Enhanced validation to prevent zero distances for valid coordinates
  if (typeof lat1 !== 'number' || typeof lon1 !== 'number' || 
      typeof lat2 !== 'number' || typeof lon2 !== 'number' ||
      isNaN(lat1) || isNaN(lon1) || isNaN(lat2) || isNaN(lon2)) {
    return Infinity;
  }
  
  // Check if coordinates are identical (would result in 0 distance)
  if (lat1 === lat2 && lon1 === lon2) {
    // Return a very small distance instead of 0 to avoid sorting issues
    return 0.001;
  }
  
  // Haversine formula for distance calculation
  const R = 6371; // Radius of the earth in km
  const dLat = (lat2 - lat1) * Math.PI / 180;
  const dLon = (lon2 - lon1) * Math.PI / 180;
  const a = 
    Math.sin(dLat/2) * Math.sin(dLat/2) +
    Math.cos(lat1 * Math.PI / 180) * Math.cos(lat2 * Math.PI / 180) * 
    Math.sin(dLon/2) * Math.sin(dLon/2); 
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1-a)); 
  const d = R * c; // Distance in km
  
  return d;
};

// Provider component
interface DataProviderProps {
  children: ReactNode;
}

export const DataProvider: React.FC<{ children: ReactNode }> = ({ children }) => {
  // Data state
  const [rawData, setRawData] = useState<RawData>({
    projects: [],
    ahjs: [],
    utilities: [],
    financiers: [],
    isLoading: true,
    error: null
  });
  
  // User location state
  const [userLocation, setUserLocation] = useState<{ latitude: number; longitude: number } | null>(null);
  
  // Function to get user location directly in the DataContext
  const getUserLocation = useCallback(() => {
    // For testing purposes, use a fixed location (Orem, Utah)
    // In production, this would use the browser's geolocation API
    const testLocation = {
      latitude: 40.2969,
      longitude: -111.6946
    };
    
    // console.log('[DataContext] Setting test location:', testLocation);
    setUserLocation(testLocation);
  }, []);

  // Filter state
  const [filters, setFilters] = useState<FilterState>({
    projectFilters: [],
    entityFilters: [],
    sortOptions: { field: 'name', direction: 'asc' }
  });
  
  // Search state
  const [searchTerms, setSearchTerms] = useState<string>('');
  
  // User-specific filters
  const [showOnlyMyProjects, setShowOnlyMyProjects] = useState<boolean>(false);
  
  // 45-day filter
  const [show45DayQualified, setShow45DayQualified] = useState<boolean>(false);

  // Fetch all data in one call
  const fetchAllData = useCallback(async () => {
    try {
      setRawData(prev => ({ ...prev, isLoading: true, error: null }));

      // Fetch all data in parallel
      const [projectsResult, ahjResult, utilityResult, financierResult] = await Promise.all([
        supabase.from('podio_data').select('*'),
        supabase.from('ahj').select('*'),
        supabase.from('utility').select('*'),
        supabase.from('financier').select('*')
      ]);

      // Check for errors
      if (projectsResult.error) {
        throw new Error(`Error fetching projects: ${projectsResult.error.message}`);
      }
      if (ahjResult.error) {
        throw new Error(`Error fetching AHJs: ${ahjResult.error.message}`);
      }
      if (utilityResult.error) {
        throw new Error(`Error fetching utilities: ${utilityResult.error.message}`);
      }
      if (financierResult.error) {
        throw new Error(`Error fetching financiers: ${financierResult.error.message}`);
      }

      // Process results
      const fetchedData = {
        projects: projectsResult.data || [],
        ahjs: ahjResult.data || [],
        utilities: utilityResult.data || [],
        financiers: financierResult.data || [],
        isLoading: false,
        error: null
      };
      
      // Log the fetched data for verification
      // console.log('===== FETCHED DATA VERIFICATION =====');
      // console.log('Total Projects:', fetchedData.projects.length);
      // console.log('Total AHJs:', fetchedData.ahjs.length);
      // console.log('Total Utilities:', fetchedData.utilities.length);
      // console.log('Total Financiers:', fetchedData.financiers.length);
      // console.log('Sample Project:', fetchedData.projects[0]);
      // console.log('Sample AHJ:', fetchedData.ahjs[0]);
      // console.log('Sample Utility:', fetchedData.utilities[0]);
      // console.log('Sample Financier:', fetchedData.financiers[0]);
      // console.log('===== END DATA VERIFICATION =====');
      
      setRawData(fetchedData);
    } catch (error) {
      console.error('Error fetching data:', error);
      setRawData(prev => ({
        ...prev,
        isLoading: false,
        error: error instanceof Error ? error.message : 'Failed to fetch data'
      }));
    }
  }, []);

  // Fetch data on initial load
  useEffect(() => {
    fetchAllData();
  }, [fetchAllData]);
  
  // Initialize user location
  useEffect(() => {
    // Get user location when the context is initialized
    getUserLocation();
  }, [getUserLocation]);

  // Add a filter
  const addFilter = useCallback((filter: ProjectFilter) => {
    // Create a unique ID for the filter if not provided
    const filterId = filter.id || `filter-${Date.now()}-${Math.random().toString(36).substring(2, 9)}`;
    
    // Create enhanced filter with ID
    const enhancedFilter: EnhancedProjectFilter = {
      ...filter,
      id: filterId
    };
    
    // Determine if this is an entity filter
    const isEntityFilter = filter.type === 'ahj' || filter.type === 'utility';
    
    setFilters(prevFilters => {
      if (isEntityFilter) {
        return {
          ...prevFilters,
          entityFilters: [...prevFilters.entityFilters, enhancedFilter]
        };
      } else {
        return {
          ...prevFilters,
          projectFilters: [...prevFilters.projectFilters, enhancedFilter]
        };
      }
    });
  }, []);

  // Remove a filter
  const removeFilter = useCallback((filterId: string, isEntityFilter = false) => {
    setFilters(prevFilters => {
      if (isEntityFilter) {
        return {
          ...prevFilters,
          entityFilters: prevFilters.entityFilters.filter(f => f.id !== filterId)
        };
      } else {
        return {
          ...prevFilters,
          projectFilters: prevFilters.projectFilters.filter(f => f.id !== filterId)
        };
      }
    });
  }, []);
  
  // Clear all filters
  const clearFilters = useCallback(() => {
    setFilters(prev => ({
      ...prev,
      projectFilters: [],
      entityFilters: []
    }));
    setSearchTerms('');
  }, []);
  
  // Handle search
  const handleSearch = useCallback((terms: string) => {
    setSearchTerms(terms);
    
    // Remove any existing search filters
    setFilters(prev => ({
      ...prev,
      projectFilters: prev.projectFilters.filter(f => f.type !== 'search')
    }));
    
    // Add a search filter if terms are provided
    if (terms.trim()) {
      addFilter({
        type: 'search',
        value: terms.trim(),
        label: `Search: ${terms.trim()}`
      });
    }
  }, [addFilter]);
  
  // Toggle show only my projects
  const toggleShowOnlyMyProjects = useCallback(() => {
    setShowOnlyMyProjects(prev => !prev);
    
    // Remove any existing myprojects filters
    setFilters(prev => ({
      ...prev,
      projectFilters: prev.projectFilters.filter(f => f.type !== 'myprojects')
    }));
    
    // Add the filter if toggled on
    if (!showOnlyMyProjects) {
      addFilter({
        type: 'myprojects',
        value: 'current-user',
        label: 'My Projects'
      });
    }
  }, [showOnlyMyProjects, addFilter]);
  
  // Set 45-day filter
  const set45DayFilter = useCallback((show: boolean) => {
    setShow45DayQualified(show);
    
    // Remove any existing 45day filters
    setFilters(prev => ({
      ...prev,
      projectFilters: prev.projectFilters.filter(f => f.type !== '45day')
    }));
    
    // Add the filter if toggled on
    if (show) {
      addFilter({
        type: '45day',
        value: 'true',
        label: '45-Day Qualified'
      });
    }
  }, [addFilter]);

  // Update sort options
  const updateSortOptions = useCallback((field: string, direction: 'asc' | 'desc') => {
    setFilters(prevFilters => ({
      ...prevFilters,
      sortOptions: { field, direction }
    }));
  }, []);
  
  // Refresh data
  const refreshData = useCallback(async () => {
    await fetchAllData();
  }, [fetchAllData]);

  // Process raw entities into our standard format
  const processedEntities = useMemo(() => {
    // console.log('===== PROCESSING ENTITIES =====');
    // console.log('Raw AHJs available:', rawData.ahjs.length);
    // console.log('Raw Utilities available:', rawData.utilities.length);
    // console.log('Is Loading:', rawData.isLoading);
    
    if (rawData.isLoading) {
      // console.log('Skipping entity processing - data is still loading');
      return { ahjs: [], utilities: [] };
    }
    
    // Debug raw entity data
    if (rawData.ahjs.length > 0) {
      // console.log('Sample raw AHJ:', rawData.ahjs[0]);
    }
    
    if (rawData.utilities.length > 0) {
      // console.log('Sample raw utility:', rawData.utilities[0]);
    }

    // Process AHJs - with more robust field extraction
    const processedAhjs = rawData.ahjs.map(ahj => {
      // Extract ID from various possible field names
      const id = ahj.ahj_item_id || '';
      
      // Extract name using the extractEntityName function which handles nested structures
      // This function already knows how to extract from raw_payload.raw_payload.name
      const name = extractEntityName(ahj, 'ahj');
      
      // Extract classification from various possible field names
      const rawClassification = ahj.classification || ahj['eligible-for-classification'] || 
                               (ahj.raw_payload && ahj.raw_payload.classification) || '';
      const classification = extractClassification(rawClassification);
      
      // Log the extraction process for debugging
      if (id) {
      //  console.log(`AHJ ${id} - Extracted name: "${name}"`);
      }
      
      // Extract coordinates with status
      const coordinates = extractCoordinates(ahj.coordinates || ahj.raw_payload);
      
      // Determine coordinate status
      // If latitude and longitude are present, it's valid
      // Otherwise use the status from extractCoordinates or fallback to 'unknown'
      const coordStatus = coordinates.latitude && coordinates.longitude 
        ? 'valid' 
        : (coordinates.status || 'unknown');
      
      return {
        id,
        name,
        classification,
        projectCount: 0, // Will be calculated later
        distance: 0,
        latitude: coordinates.latitude,
        longitude: coordinates.longitude,
        coordStatus
      };
    }).filter(ahj => ahj.id); // Filter out any AHJs without an ID

    // Process Utilities - with more robust field extraction
    const processedUtilities = rawData.utilities.map(utility => {
      // Extract ID from various possible field names
      const id = utility.utility_company_item_id || '';
      
      // Extract name from various possible field names - handle nested structures
      // First try to use the extractEntityName function which handles nested structures
      const name = extractEntityName(utility, 'utility');
      
      // Extract classification from various possible field names
      const rawClassification = utility.classification || utility['eligible-for-classification'] || 
                               (utility.raw_payload && utility.raw_payload.classification) || '';
      const classification = extractClassification(rawClassification);
      
      // Log the extraction process for debugging
      if (id) {
        // console.log(`Utility ${id} - Extracted name: "${name}"`);
      }
      
      // Extract coordinates with status
      const coordinates = extractCoordinates(utility.coordinates || utility.raw_payload);
      
      // Determine coordinate status
      // If latitude and longitude are present, it's valid
      // Otherwise use the status from extractCoordinates or fallback to 'unknown'
      const coordStatus = coordinates.latitude && coordinates.longitude 
        ? 'valid' 
        : (coordinates.status || 'unknown');
      
      return {
        id,
        name,
        classification,
        projectCount: 0, // Will be calculated later
        distance: 0,
        latitude: coordinates.latitude,
        longitude: coordinates.longitude,
        coordStatus
      };
    }).filter(utility => utility.id); // Filter out any utilities without an ID
    // console.log('Processed entities:', processedAhjs, processedUtilities);
    return { ahjs: processedAhjs, utilities: processedUtilities };
  }, [rawData.ahjs, rawData.utilities, rawData.isLoading]);

  // The core of the filtering system - all filtering logic in one place
  const filteredData = useMemo(() => {
    // Skip filtering if data is not loaded yet
    if (rawData.isLoading || rawData.projects.length === 0) {
      return { projects: [], ahjs: [], utilities: [], financiers: [] };
    }

    let filteredProjects = [...rawData.projects];
    console.log('Filtered projects', filteredProjects[0]);
    // 1. Apply project filters
    filters.projectFilters.forEach(filter => {
      switch (filter.type) {
        case 'search':
          // Search across multiple fields
          filteredProjects = filteredProjects.filter(project => {
            const searchValue = filter.value.toLowerCase();
            return (
              project.address?.toLowerCase().includes(searchValue) ||
              project.ahj?.name?.toLowerCase().includes(searchValue) ||
              project.utility?.name?.toLowerCase().includes(searchValue) ||
              project.city?.toLowerCase().includes(searchValue) ||
              project.state?.toLowerCase().includes(searchValue) ||
              project.zip?.toLowerCase().includes(searchValue)
            );
          });
          break;
        case 'ahj':
          filteredProjects = filteredProjects.filter(project =>
            project.ahj?.id === filter.value
          );
          break;
        case 'utility':
          filteredProjects = filteredProjects.filter(project =>
            project.utility?.id === filter.value
          );
          break;
        case 'financier':
          filteredProjects = filteredProjects.filter(project =>
            project.financier?.id === filter.value
          );
          break;
        case '45day':
          // Filter for 45-day qualified projects
          const has45DayFilter = filters.projectFilters.some(f => f.type === '45day');
          if (has45DayFilter) {
            filteredProjects = filteredProjects.filter(project => {
              // Check both possible formats of the 45-day qualification field
              const qualifies = project.qualifies45Day;
              return qualifies === true || qualifies === 'true' || qualifies === 'yes';
            });
          }
          break;
        case 'myprojects':
          // Filter for projects belonging to the current user
          filteredProjects = filteredProjects.filter(project =>
            project.rep_id === filter.value
          );
          break;
        // Add other filter types as needed
      }
    });
    // 2. Extract entity IDs from filtered projects
    const ahjIds = new Set(filteredProjects.map(p => p.ahj?.id).filter(Boolean));
    const utilityIds = new Set(filteredProjects.map(p => p.utility?.id).filter(Boolean));
    console.log('ENTITY IDs', ahjIds, utilityIds, filteredProjects);
    // 3. Determine if we should filter entities based on project references
    // Check if we have entity-specific filters
    const hasEntitySpecificFilters = filters.entityFilters.length > 0;
    const hasProjectFilters = filters.projectFilters.length > 0;
    const hasSearchTerms = searchTerms.trim() !== '';
    
    // console.log('Filter status:', 
    //             'Entity filters:', hasEntitySpecificFilters, 
    //             'Project filters:', hasProjectFilters, 
    //             'Search terms:', hasSearchTerms);
    
    // IMPORTANT: We want to ensure entities are always available
    // Only apply project-based filtering if we have project filters or search terms
    // If we have entity-specific filters, those will be applied separately below
    let filteredAhjs = processedEntities.ahjs;
    let filteredUtilities = processedEntities.utilities;
    // If we have project filters or search terms, filter entities based on project references
    // But ONLY if we don't have entity-specific filters
    if ((hasProjectFilters || hasSearchTerms) && !hasEntitySpecificFilters) {
      // console.log('FILTER CHECK: Applying project-based entity filtering');
      // console.log('FILTER CHECK: Before filtering - AHJs:', processedEntities.ahjs.length, 'Utilities:', processedEntities.utilities.length);
      // console.log('FILTER CHECK: Project references - AHJ IDs:', Array.from(ahjIds).length, 'Utility IDs:', Array.from(utilityIds).length);
      
      filteredAhjs = processedEntities.ahjs.filter(ahj => ahjIds.has(ahj.id));
      filteredUtilities = processedEntities.utilities.filter(utility => utilityIds.has(utility.id));
      
      console.log('FILTER CHECK: After filtering - AHJs:', filteredAhjs.length, 'Utilities:', filteredUtilities.length);
    }
    
    // console.log('Filtered AHJs after project reference check:', filteredAhjs.length);
    // console.log('Filtered Utilities after project reference check:', filteredUtilities.length);

    // 4. Apply entity-specific filters if they exist
    if (filters.entityFilters.length > 0) {
      // Split filters by entity type
      const ahjFilters = filters.entityFilters.filter(f => f.type === 'ahj' || f.entityType === 'ahj');
      const utilityFilters = filters.entityFilters.filter(f => f.type === 'utility' || f.entityType === 'utility');
      
      // console.log('FILTER DIAGNOSTIC: Applying entity filters - AHJ filters:', ahjFilters.length, 'Utility filters:', utilityFilters.length);
      // console.log('FILTER DIAGNOSTIC: Entity filters structure:', filters.entityFilters);
      
      // Find entity selection filters (these are used for cross-entity filtering)
      const selectedAhjFilter = ahjFilters.find(f => f.filterSource === 'entity-selection' && f.entityId);
      const selectedUtilityFilter = utilityFilters.find(f => f.filterSource === 'entity-selection' && f.entityId);
      
      // Track if we have entity selections for cross-filtering
      const hasSelectedAhj = !!selectedAhjFilter;
      const hasSelectedUtility = !!selectedUtilityFilter;
      
      // console.log('FILTER DIAGNOSTIC: Selected entities - AHJ:', hasSelectedAhj ? selectedAhjFilter?.entityId : 'none', 
      //             'Utility:', hasSelectedUtility ? selectedUtilityFilter?.entityId : 'none');
      
      // Apply AHJ filters if any exist
      if (ahjFilters.length > 0) {
        // console.log('FILTER DIAGNOSTIC: Applying AHJ-specific filters:', ahjFilters.length);
        // console.log('FILTER DIAGNOSTIC: AHJ filters:', ahjFilters.map(f => ({ 
        //   id: f.id,
        //   type: f.type, 
        //   entityType: f.entityType,
        //   entityId: f.entityId, 
        //   value: f.value,
        //   filterSource: f.filterSource
        // })));
        
        // Count before filtering
        const beforeCount = filteredAhjs.length;
        
        // If we have AHJ filters, only show AHJs that match those filters
        filteredAhjs = processedEntities.ahjs.filter(ahj => {
          return ahjFilters.some(filter => {
            // For entity filters, we typically filter by ID
            if (filter.entityId) {
              const matches = ahj.id === filter.entityId;
              if (matches) {
                // console.log(`FILTER CHECK: AHJ ${ahj.name} (${ahj.id}) matches filter by ID`);
              }
              return matches;
            }
            
            // For classification filters (A, B, C)
            if (filter.value === 'A' || filter.value === 'B' || filter.value === 'C') {
              const matches = ahj.classification === filter.value;
              if (matches) {
                // console.log(`FILTER CHECK: AHJ ${ahj.name} matches classification ${filter.value}`);
              }
              return matches;
            }
            
            // For search filters, we search by name
            const matches = ahj.name.toLowerCase().includes(filter.value.toLowerCase());
            if (matches) {
              // console.log(`FILTER CHECK: AHJ ${ahj.name} matches filter by name containing "${filter.value}"`);
            }
            return matches;
          });
        });
        
        // Count after filtering
        // console.log(`FILTER CHECK: AHJs filtered from ${beforeCount} to ${filteredAhjs.length}`);
      }
      
      // Apply cross-entity filtering if we have a selected utility
      // When a utility is selected, only show AHJs that have projects with that utility
      if (hasSelectedUtility && selectedUtilityFilter?.entityId) {
        const utilityId = selectedUtilityFilter.entityId; // Store in variable to avoid TypeScript errors
        console.log(`ENTITY RELATION DEBUG: Cross-filtering AHJs based on selected Utility ${utilityId}`);
        const beforeCrossFilter = filteredAhjs.length;
        
        // Log the selected utility ID for debugging
        console.log('SELECTED UTILITY DEBUG:', {
          selectedUtilityId: utilityId,
          selectedUtilityIdType: typeof utilityId
        });
        
        // Try a different approach to find projects with the selected utility
        // Log the raw project data to see all available fields
        if (filteredProjects.length > 0) {
          const firstProject = filteredProjects[0];
          console.log('COMPLETE PROJECT DEBUG:', {
            fullProject: firstProject,
            // Check if there are any fields that might contain the utility ID
            utilityRelatedFields: Object.keys(firstProject).filter(key => 
              key.toLowerCase().includes('utility') || key.toLowerCase().includes('company')
            )
          });
        }
        
        // Find all projects that have the selected utility
        // Access the utility ID directly from the utility_company_item_id property
        const projectsWithSelectedUtility = filteredProjects.filter(p => {
          // Get the ID from the direct property
          const projectUtilityId = p.utility_company_item_id;
          
          // Log for debugging
          if (p === filteredProjects[0]) {
            console.log('UTILITY ID DEBUG:', {
              projectId: p.id,
              utilityNestedId: p.utility?.id,
              utilityDirectId: p.utility_company_item_id,
              selectedUtilityId: utilityId,
              match: projectUtilityId && projectUtilityId.toString() === utilityId.toString()
            });
          }
          
          // Compare as strings to handle type differences
          return projectUtilityId && projectUtilityId.toString() === utilityId.toString();
        });

        
        // Detailed inspection of the first few projects' utility objects
        console.log('PROJECT UTILITY STRUCTURE DEBUG:', filteredProjects.slice(0, 5).map(p => ({
          projectId: p.id,
          utility: p.utility,
          utilityKeys: p.utility ? Object.keys(p.utility) : 'utility is undefined',
          utilityIdType: p.utility?.id !== undefined ? typeof p.utility.id : 'id is undefined',
          // Deep inspection of the utility object
          utilityStringified: JSON.stringify(p.utility),
          // Check if utility might be a string that needs parsing
          utilityIsString: typeof p.utility === 'string',
          // Check direct property access
          directUtilityId: p.utility ? p.utility.id : 'no direct access'
        })));
        
        // Log the raw project data for the first project
        if (filteredProjects.length > 0) {
          console.log('RAW PROJECT DEBUG:', {
            project: filteredProjects[0],
            projectKeys: Object.keys(filteredProjects[0]),
            utilityType: typeof filteredProjects[0].utility,
            ahjType: typeof filteredProjects[0].ahj
          });
        }
        
        // Check how many projects have utility IDs
        const projectsWithUtilityIds = filteredProjects.filter(p => p.utility?.id !== undefined);
        console.log(`PROJECT FILTERING DEBUG: ${projectsWithUtilityIds.length} out of ${filteredProjects.length} projects have utility IDs`);
        
        // Check if any projects match the selected utility ID
        const matchingProjects = filteredProjects.filter(p => p.utility?.id === selectedUtilityFilter.entityId);
        console.log(`PROJECT FILTERING DEBUG: Found ${matchingProjects.length} projects matching utility ID: ${selectedUtilityFilter.entityId}`);
        
        if (matchingProjects.length > 0) {
          console.log('PROJECT FILTERING DEBUG: First matching project:', {
            id: matchingProjects[0].id,
            utilityId: matchingProjects[0].utility?.id,
            utilityName: matchingProjects[0].utility?.name
          });
        }
        
        if (projectsWithSelectedUtility.length > 0) {
          console.log('ENTITY RELATION DEBUG: Sample project with this Utility:', {
            projectId: projectsWithSelectedUtility[0].id,
            utilityId: projectsWithSelectedUtility[0].utility?.id,
            utilityName: projectsWithSelectedUtility[0].utility?.name,
            ahjId: projectsWithSelectedUtility[0].ahj?.id,
            ahjName: projectsWithSelectedUtility[0].ahj?.name
          });
        }
        
        // Get the AHJ IDs from those projects using the direct ahj_item_id property
        const relatedAhjIds = new Set(
          projectsWithSelectedUtility
            .map(p => p.ahj_item_id ? p.ahj_item_id.toString() : null)
            .filter(Boolean)
        );
        
        console.log(`ENTITY RELATION DEBUG: Found ${relatedAhjIds.size} unique AHJ IDs related to selected Utility`);
        console.log('ENTITY RELATION DEBUG: Related AHJ IDs:', Array.from(relatedAhjIds));
        
        // Compare entity IDs with project entity IDs
        console.log('ENTITY ID COMPARISON DEBUG (UTILITY):', {
          selectedUtilityId: utilityId,
          selectedUtilityIdType: typeof utilityId,
          sampleProjectUtilityId: projectsWithSelectedUtility.length > 0 ? projectsWithSelectedUtility[0].utility?.id : 'no matching projects',
          sampleProjectUtilityIdType: projectsWithSelectedUtility.length > 0 ? typeof projectsWithSelectedUtility[0].utility?.id : 'unknown',
          sampleAhjId: filteredAhjs.length > 0 ? filteredAhjs[0].id : 'no ahjs',
          sampleAhjIdType: filteredAhjs.length > 0 ? typeof filteredAhjs[0].id : 'unknown'
        });
        
        // Filter AHJs to only those related to the selected utility
        // Use string comparison for consistent matching
        filteredAhjs = filteredAhjs.filter(ahj => 
          ahj.id && relatedAhjIds.has(ahj.id.toString())
        );
        
        console.log(`ENTITY RELATION DEBUG: Cross-filtered AHJs from ${beforeCrossFilter} to ${filteredAhjs.length}`);
        
        if (filteredAhjs.length > 0) {
          console.log('ENTITY RELATION DEBUG: First AHJ after filtering:', {
            id: filteredAhjs[0].id,
            name: filteredAhjs[0].name
          });
        } else {
          console.log('ENTITY RELATION DEBUG: No AHJs remain after filtering');
        }
      }
      
      // Apply Utility filters if any exist
      if (utilityFilters.length > 0) {
        // console.log('FILTER DIAGNOSTIC: Applying Utility-specific filters:', utilityFilters.length);
        // console.log('FILTER DIAGNOSTIC: Utility filters:', utilityFilters.map(f => ({ 
        //   id: f.id,
        //   type: f.type, 
        //   entityType: f.entityType,
        //   entityId: f.entityId, 
        //   value: f.value,
        //   filterSource: f.filterSource
        // })));
        
        // Count before filtering
        const beforeCount = processedEntities.utilities.length;
        
        // If we have Utility filters, only show Utilities that match those filters
        filteredUtilities = processedEntities.utilities.filter(utility => {
          return utilityFilters.some(filter => {
            // For entity filters, we typically filter by ID
            if (filter.entityId) {
              const matches = utility.id === filter.entityId;
              if (matches) {
                // console.log(`FILTER CHECK: Utility ${utility.name} (${utility.id}) matches filter by ID`);
              }
              return matches;
            }
            
            // For classification filters (A, B, C)
            if (filter.value === 'A' || filter.value === 'B' || filter.value === 'C') {
              const matches = utility.classification === filter.value;
              if (matches) {
                // console.log(`FILTER CHECK: Utility ${utility.name} matches classification ${filter.value}`);
              }
              return matches;
            }
            
            // For search filters, we search by name
            const matches = utility.name.toLowerCase().includes(filter.value.toLowerCase());
            if (matches) {
              // console.log(`FILTER CHECK: Utility ${utility.name} matches filter by name containing "${filter.value}"`);
            }
            return matches;
          });
        });
        
        // Count after filtering
        // console.log(`FILTER CHECK: Utilities filtered from ${beforeCount} to ${filteredUtilities.length}`);
      }
      
      // Apply cross-entity filtering if we have a selected AHJ
      // When an AHJ is selected, only show Utilities that have projects with that AHJ
      if (hasSelectedAhj && selectedAhjFilter?.entityId) {
        const ahjId = selectedAhjFilter.entityId; // Store in variable to avoid TypeScript errors
        console.log(`ENTITY RELATION DEBUG: Cross-filtering Utilities based on selected AHJ ${ahjId}`);
        const beforeCrossFilter = filteredUtilities.length;
        
        // Log the selected AHJ ID for debugging
        console.log('SELECTED AHJ DEBUG:', {
          selectedAhjId: ahjId,
          selectedAhjIdType: typeof ahjId
        });
        
        // Log a sample of projects to understand their structure
        console.log('PROJECT STRUCTURE DEBUG (AHJ): First 3 projects:', filteredProjects.slice(0, 3).map(p => ({
          id: p.id,
          ahj: p.ahj,
          ahjId: p.ahj?.id,
          ahjIdType: p.ahj?.id !== undefined ? typeof p.ahj.id : 'id is undefined',
          // Deep inspection of the AHJ object
          ahjKeys: p.ahj ? Object.keys(p.ahj) : 'ahj is undefined',
          ahjStringified: JSON.stringify(p.ahj),
          ahjIsString: typeof p.ahj === 'string',
          // Check direct property access
          directAhjId: p.ahj ? p.ahj.id : 'no direct access',
          // Also check utility for comparison
          utility: p.utility,
          utilityId: p.utility?.id
        })));
        
        // Log the raw project data for the first project
        if (filteredProjects.length > 0) {
          const project = filteredProjects[0];
          console.log('RAW PROJECT DEBUG (AHJ):', {
            projectId: project.id,
            projectKeys: Object.keys(project),
            ahjType: typeof project.ahj,
            ahjKeys: project.ahj ? Object.keys(project.ahj) : [],
            utilityType: typeof project.utility,
            utilityKeys: project.utility ? Object.keys(project.utility) : []
          });
        }
        
        // Check how many projects have AHJ IDs
        const projectsWithAhjIds = filteredProjects.filter(p => p.ahj?.id !== undefined);
        console.log(`PROJECT FILTERING DEBUG: ${projectsWithAhjIds.length} out of ${filteredProjects.length} projects have AHJ IDs`);
        
        // Check if any projects match the selected AHJ ID using string comparison
        const matchingProjects = filteredProjects.filter(p => 
          p.ahj?.id && p.ahj.id.toString() === ahjId.toString()
        );
        console.log(`PROJECT FILTERING DEBUG: Found ${matchingProjects.length} projects matching AHJ ID: ${ahjId}`);
        
        // Try a different approach to find projects with the selected AHJ
        // Log the raw project data to see all available fields
        if (filteredProjects.length > 0) {
          const firstProject = filteredProjects[0];
          console.log('COMPLETE PROJECT DEBUG (AHJ):', {
            fullProject: firstProject,
            // Check if there are any fields that might contain the AHJ ID
            ahjRelatedFields: Object.keys(firstProject).filter(key => 
              key.toLowerCase().includes('ahj') || key.toLowerCase().includes('authority')
            )
          });
        }
        
        // Find all projects that have the selected AHJ
        // Access the AHJ ID directly from the ahj_item_id property
        const projectsWithSelectedAhj = filteredProjects.filter(p => {
          // Get the ID from the direct property
          const projectAhjId = p.ahj_item_id;
          
          // Log for debugging
          if (p === filteredProjects[0]) {
            console.log('AHJ ID DEBUG:', {
              projectId: p.id,
              ahjNestedId: p.ahj?.id,
              ahjDirectId: p.ahj_item_id,
              selectedAhjId: ahjId,
              match: projectAhjId && projectAhjId.toString() === ahjId.toString()
            });
          }
          
          // Compare as strings to handle type differences
          return projectAhjId && projectAhjId.toString() === ahjId.toString();
        });
        
        console.log(`ENTITY RELATION DEBUG: Found ${projectsWithSelectedAhj.length} projects with selected AHJ ID: ${ahjId}`);
        
        if (projectsWithSelectedAhj.length > 0) {
          console.log('ENTITY RELATION DEBUG: Sample project with this AHJ:', {
            projectId: projectsWithSelectedAhj[0].id,
            ahjId: projectsWithSelectedAhj[0].ahj?.id,
            ahjName: projectsWithSelectedAhj[0].ahj?.name,
            utilityId: projectsWithSelectedAhj[0].utility?.id,
            utilityName: projectsWithSelectedAhj[0].utility?.name
          });
        }
        
        // Get the Utility IDs from those projects using the direct utility_company_item_id property
        const relatedUtilityIds = new Set(
          projectsWithSelectedAhj
            .map(p => p.utility_company_item_id ? p.utility_company_item_id.toString() : null)
            .filter(Boolean)
        );
        
        console.log(`ENTITY RELATION DEBUG: Found ${relatedUtilityIds.size} unique Utility IDs related to selected AHJ`);
        console.log('ENTITY RELATION DEBUG: Related Utility IDs:', Array.from(relatedUtilityIds));
        
        // Compare entity IDs with project entity IDs
        console.log('ENTITY ID COMPARISON DEBUG:', {
          selectedAhjId: ahjId,
          selectedAhjIdType: typeof ahjId,
          sampleProjectAhjId: projectsWithSelectedAhj.length > 0 ? projectsWithSelectedAhj[0].ahj?.id : 'no matching projects',
          sampleProjectAhjIdType: projectsWithSelectedAhj.length > 0 ? typeof projectsWithSelectedAhj[0].ahj?.id : 'unknown',
          sampleUtilityId: filteredUtilities.length > 0 ? filteredUtilities[0].id : 'no utilities',
          sampleUtilityIdType: filteredUtilities.length > 0 ? typeof filteredUtilities[0].id : 'unknown'
        });
        
        // Filter Utilities to only those related to the selected AHJ
        // Use string comparison for consistent matching
        filteredUtilities = filteredUtilities.filter(utility => 
          utility.id && relatedUtilityIds.has(utility.id.toString())
        );
        
        console.log(`ENTITY RELATION DEBUG: Cross-filtered Utilities from ${beforeCrossFilter} to ${filteredUtilities.length}`);
        
        if (filteredUtilities.length > 0) {
          console.log('ENTITY RELATION DEBUG: First utility after filtering:', {
            id: filteredUtilities[0].id,
            name: filteredUtilities[0].name
          });
        } else {
          console.log('ENTITY RELATION DEBUG: No utilities remain after filtering');
        }
      }
      
      // console.log('After entity filters - AHJs:', filteredAhjs.length, 'Utilities:', filteredUtilities.length);
    }

    // 5. Apply sorting to projects
    const { field, direction } = filters.sortOptions;
    const sortMultiplier = direction === 'asc' ? 1 : -1;

    filteredProjects.sort((a, b) => {
      const valueA = a[field as keyof Project]?.toString() || '';
      const valueB = b[field as keyof Project]?.toString() || '';
      return valueA.localeCompare(valueB) * sortMultiplier;
    });

    // 6. Calculate project counts and relationship data for entities
    // console.log('PROJECT COUNT: Starting project count calculation for entities');
    // console.log(`PROJECT COUNT: Processing ${filteredAhjs.length} AHJs and ${filteredUtilities.length} Utilities`);
    // console.log(`PROJECT COUNT: Using ${filteredProjects.length} filtered projects as reference`);
    console.log('filtered projects', filteredProjects)
    // // DEBUG: Log sample data to understand ID structures
    // if (filteredProjects.length > 0) {
    //   console.log('DEBUG: First project structure:', {
    //     projectId: filteredProjects[0].id,
    //     ahjId: filteredProjects[0].ahj?.id,
    //     utilityId: filteredProjects[0].utility?.id
    //   });
    // }
    
    // if (filteredAhjs.length > 0) {
    //   console.log('DEBUG: First AHJ structure:', {
    //     id: filteredAhjs[0].id,
    //     name: filteredAhjs[0].name
    //   });
    // }
    
    // For AHJs, calculate project counts and related utilities
    filteredAhjs = filteredAhjs.map(ahj => {
      // In the project data, p.ahj.id comes from item.ahj_item_id in useProjects.ts
      // Now that we've fixed entity ID extraction to use ahj_item_id, this should match correctly
      
      // Log debugging information about the current AHJ and available projects
      // console.log(`PROJECT COUNT DEBUG: Current AHJ ID: ${ahj.id}, Name: ${ahj.name}`);
      
      // // Check if we have any projects before trying to access them
      // if (filteredProjects.length > 0) {
      //   // Safely log the first project's AHJ ID if it exists
      //   console.log('PROJECT COUNT DEBUG: First project AHJ ID:', 
      //               filteredProjects[0]?.ahj?.id || 'undefined',
      //               'First project AHJ name:', 
      //               filteredProjects[0]?.ahj?.name || 'undefined');
        
      //   // Log a few sample projects to see their structure
      //   console.log('PROJECT COUNT DEBUG: Sample projects:', 
      //               filteredProjects.slice(0, 3).map(p => ({
      //                 projectId: p.id,
      //                 ahjId: p.ahj?.id || 'undefined',
      //                 ahjName: p.ahj?.name || 'undefined'
      //               })));
      // } else {
      //   console.log('PROJECT COUNT DEBUG: No projects available to filter');
      // }
      
      // DEBUG: Log the current AHJ ID we're trying to match
      // console.log(`DEBUG: Trying to match AHJ ID: ${ahj.id} for AHJ: ${ahj.name}`);
      
      // IMPORTANT: Use the direct ahj_item_id field from the project instead of the nested p.ahj.id
      // This is because the raw data has ahj_item_id directly on the project objects
      let ahjProjects = filteredProjects.filter(p => {
        // Try both the nested structure and the direct field
        return p.ahj?.id === ahj.id || (p as any).ahj_item_id === ahj.id;
      });
      // console.log(`DEBUG: Found ${ahjProjects.length} projects with AHJ ID: ${ahj.id}`);
      
      // If we didn't find any matches, try a different approach - match by name
      if (ahjProjects.length === 0) {
        // Try to find projects by AHJ name instead
        const nameMatchingProjects = filteredProjects.filter(p => 
          p.ahj?.name?.toLowerCase() === ahj.name.toLowerCase());
        // console.log(`DEBUG: Found ${nameMatchingProjects.length} projects matching AHJ name: ${ahj.name}`);
        
        // Use name-based matching if we found matches
        if (nameMatchingProjects.length > 0) {
          // console.log(`DEBUG: Using name-based matching for AHJ: ${ahj.name} since ID matching failed`);
          ahjProjects = nameMatchingProjects;
        }
        
        // Log a few sample projects to see what their AHJ IDs look like
        // if (filteredProjects.length > 0) {
        //   console.log('DEBUG: Sample project AHJ IDs:', 
        //              filteredProjects.slice(0, 5).map(p => ({
        //                projectId: p.id,
        //                ahjId: p.ahj?.id || 'undefined',
        //                ahjName: p.ahj?.name || 'undefined'
        //              })));
        // }
      }
      
      // Get all unique utility IDs from these projects
      // The utility.id in projects comes from item.utility_company_item_id in useProjects.ts
      const relatedUtilityIds = new Set(
        ahjProjects
          .map(p => p.utility?.id)
          .filter(Boolean)
      );
      
     
      
      // Return enhanced AHJ with project count and related utility count
      return {
        ...ahj,
        projectCount: ahjProjects.length,
        relatedUtilityCount: relatedUtilityIds.size,
        // Store related utility IDs for potential use in UI
        relatedUtilityIds: Array.from(relatedUtilityIds)
      };
    });
    
    // For Utilities, calculate project counts and related AHJs
    filteredUtilities = filteredUtilities.map(utility => {
      // DEBUG: Log the current Utility ID we're trying to match
      // console.log(`DEBUG: Trying to match Utility ID: ${utility.id} for Utility: ${utility.name}`);
      
      // IMPORTANT: Use the direct utility_company_item_id field from the project instead of the nested p.utility.id
      // This is because the raw data has utility_company_item_id directly on the project objects
      let utilityProjects = filteredProjects.filter(p => {
        // Try both the nested structure and the direct field
        return p.utility?.id === utility.id || (p as any).utility_company_item_id === utility.id;
      });
      // console.log(`DEBUG: Found ${utilityProjects.length} projects with Utility ID: ${utility.id}`);
      
      // If we didn't find any matches, try a different approach - match by name
      if (utilityProjects.length === 0) {
        // Try to find projects by Utility name instead
        const nameMatchingProjects = filteredProjects.filter(p => 
          p.utility?.name?.toLowerCase() === utility.name.toLowerCase());
        // console.log(`DEBUG: Found ${nameMatchingProjects.length} projects matching Utility name: ${utility.name}`);
        
        // Use name-based matching if we found matches
        if (nameMatchingProjects.length > 0) {
          // console.log(`DEBUG: Using name-based matching for Utility: ${utility.name} since ID matching failed`);
          utilityProjects = nameMatchingProjects;
        }
      }
      
      // Get all unique AHJ IDs from these projects
      // The ahj.id in projects comes from item.ahj_item_id in useProjects.ts
      const relatedAhjIds = new Set(
        utilityProjects
          .map(p => p.ahj?.id)
          .filter(Boolean)
      );
      
      
      
      // Return enhanced utility with project count and related AHJ count
      return {
        ...utility,
        projectCount: utilityProjects.length,
        relatedAhjCount: relatedAhjIds.size,
        // Store related AHJ IDs for potential use in UI
        relatedAhjIds: Array.from(relatedAhjIds)
      };
    });
    
    // Log final entity data to see how project counts are passed
    // console.log('PROJECT COUNT: Final entity data after calculation:');
    if (filteredAhjs.length > 0) {
      const sampleAhj = filteredAhjs[0];
      // console.log(`PROJECT COUNT: Sample AHJ final data - Name: ${sampleAhj.name}, Project Count: ${sampleAhj.projectCount}, Related Utilities: ${(sampleAhj as any).relatedUtilityCount}`);
    }
    
    if (filteredUtilities.length > 0) {
      const sampleUtility = filteredUtilities[0];
      // console.log(`PROJECT COUNT: Sample Utility final data - Name: ${sampleUtility.name}, Project Count: ${sampleUtility.projectCount}, Related AHJs: ${(sampleUtility as any).relatedAhjCount}`);
    }
    
    // Log relationship data for debugging
    // console.log('RELATIONSHIP DATA: Sample AHJ relationships:', 
    //             filteredAhjs.length > 0 ? 
    //             `${filteredAhjs[0].name} has ${filteredAhjs[0].projectCount} projects and ${(filteredAhjs[0] as any).relatedUtilityCount} related utilities` : 
    //             'No AHJs available');
    
    // console.log('RELATIONSHIP DATA: Sample Utility relationships:', 
                // filteredUtilities.length > 0 ? 
                // `${filteredUtilities[0].name} has ${filteredUtilities[0].projectCount} projects and ${(filteredUtilities[0] as any).relatedAhjCount} related AHJs` : 
                // 'No Utilities available');
    
    // 7. Calculate distances if user location is available
    if (userLocation && userLocation.latitude && userLocation.longitude) {
      // Only log once per calculation cycle to reduce console spam
      // console.log('Calculating distances based on user location', userLocation);
      
      // Calculate distances for AHJs
      filteredAhjs = filteredAhjs.map(ahj => {
        if (!ahj.latitude || !ahj.longitude || ahj.coordStatus !== 'valid') {
          return { ...ahj, distance: Infinity };
        }
        
        const distance = calculateDistance(
          userLocation.latitude,
          userLocation.longitude,
          ahj.latitude,
          ahj.longitude
        );
        
        return { ...ahj, distance };
      });
      
      // Calculate distances for Utilities
      filteredUtilities = filteredUtilities.map(utility => {
        if (!utility.latitude || !utility.longitude || utility.coordStatus !== 'valid') {
          return { ...utility, distance: Infinity };
        }
        
        const distance = calculateDistance(
          userLocation.latitude,
          userLocation.longitude,
          utility.latitude,
          utility.longitude
        );
        
        return { ...utility, distance };
      });
      
      // Log summary of distance calculations
      // console.log(`Distance calculation complete for ${filteredAhjs.length} AHJs and ${filteredUtilities.length} Utilities`);
    } else {
      // No user location available, set default distance
      filteredAhjs = filteredAhjs.map(ahj => ({
        ...ahj,
        distance: Infinity
      }));
      
      filteredUtilities = filteredUtilities.map(utility => ({
        ...utility,
        distance: Infinity
      }));
    }
    
    // 8. Apply entity sorting
    // Sort entities by distance (if available), then project count, then name
    filteredAhjs.sort((a, b) => {
      // Check if user location is available
      if (userLocation) {
        // Check if entities have valid coordinates
        const aHasValidCoords = a.latitude && a.longitude && a.coordStatus === 'valid';
        const bHasValidCoords = b.latitude && b.longitude && b.coordStatus === 'valid';
        
        // If one entity has valid coordinates and the other doesn't, prioritize the one with coordinates
        if (aHasValidCoords && !bHasValidCoords) return -1; // A comes first
        if (!aHasValidCoords && bHasValidCoords) return 1;  // B comes first
        
        // If both have valid coordinates, sort by distance
        if (aHasValidCoords && bHasValidCoords) {
          // Direct distance comparison - closest first
          if (a.distance !== b.distance) {
            return a.distance - b.distance; // Ascending (closest first)
          }
        }
      }
      
      // If no user location or distances are equal, fall back to project count
      if (a.projectCount !== b.projectCount) {
        return b.projectCount - a.projectCount; // Descending (most projects first)
      }
      
      // Finally sort alphabetically
      return a.name.localeCompare(b.name);
    });
    
    // Sort utilities using the same logic
    filteredUtilities.sort((a, b) => {
      // Check if user location is available
      if (userLocation) {
        // Check if entities have valid coordinates
        const aHasValidCoords = a.latitude && a.longitude && a.coordStatus === 'valid';
        const bHasValidCoords = b.latitude && b.longitude && b.coordStatus === 'valid';
        
        // If one entity has valid coordinates and the other doesn't, prioritize the one with coordinates
        if (aHasValidCoords && !bHasValidCoords) return -1; // A comes first
        if (!aHasValidCoords && bHasValidCoords) return 1;  // B comes first
        
        // If both have valid coordinates, sort by distance
        if (aHasValidCoords && bHasValidCoords) {
          // Direct distance comparison - closest first
          if (a.distance !== b.distance) {
            return a.distance - b.distance; // Ascending (closest first)
          }
        }
      }
      
      // If no user location or distances are equal, fall back to project count
      if (a.projectCount !== b.projectCount) {
        return b.projectCount - a.projectCount; // Descending (most projects first)
      }
      
      // Finally sort alphabetically
      return a.name.localeCompare(b.name);
    });

    // Create the final filtered data object
    const finalFilteredData = {
      projects: filteredProjects,
      ahjs: filteredAhjs,
      utilities: filteredUtilities,
      financiers: rawData.financiers // Financiers might not need filtering
    };
    
    // Log the processed and filtered data
    // console.log('===== PROCESSED DATA VERIFICATION =====');
    // console.log('Filtered Projects:', finalFilteredData.projects.length);
    // console.log('Filtered AHJs:', finalFilteredData.ahjs.length);
    // console.log('Filtered Utilities:', finalFilteredData.utilities.length);
    // console.log('Active Filters:', {
    //   projectFilters: filters.projectFilters.length,
    //   entityFilters: filters.entityFilters.length,
    //   searchTerms: searchTerms ? 'Yes' : 'No',
    //   showOnlyMyProjects: showOnlyMyProjects ? 'Yes' : 'No',
    //   show45DayQualified: show45DayQualified ? 'Yes' : 'No'
    // });
    // console.log('===== END PROCESSED DATA VERIFICATION =====');
    
    // Debug the filtered data before returning
    // console.log('===== FINAL FILTERED DATA =====');
    // console.log('Final filtered AHJs:', finalFilteredData.ahjs.length);
    // console.log('Final filtered Utilities:', finalFilteredData.utilities.length);
    // console.log('First AHJ (if any):', finalFilteredData.ahjs[0] || 'None');
    // console.log('First Utility (if any):', finalFilteredData.utilities[0] || 'None');
    // console.log('===== END FINAL FILTERED DATA =====');
    
    // Return the final filtered data
    return finalFilteredData;
  }, [rawData, processedEntities, filters, userLocation]);

  // Context value
  const value: DataContextType = {
    // Raw data access
    rawProjects: rawData.projects,
    rawAhjs: rawData.ahjs,
    rawUtilities: rawData.utilities,
    rawFinanciers: rawData.financiers,
    
    // Filtered data
    ...filteredData,
    
    // User location
    userLocation,
    setUserLocation,
    
    // Debug the entity data passed to EntityListView
    // ...(() => {
    //   // Log only the processed and filtered entity data
    //   console.log('===== ENTITY DATA PASSED TO ENTITYLISTVIEW =====');
    //   if (filteredData.ahjs.length > 0) {
    //     console.log('Sample AHJ:', {
    //       id: filteredData.ahjs[0].id,
    //       name: filteredData.ahjs[0].name,
    //       classification: filteredData.ahjs[0].classification,
    //       projectCount: filteredData.ahjs[0].projectCount,
    //       hasCoordinates: !!(filteredData.ahjs[0].latitude && filteredData.ahjs[0].longitude)
    //     });
    //   }
      
    //   if (filteredData.utilities.length > 0) {
    //     console.log('Sample Utility:', {
    //       id: filteredData.utilities[0].id,
    //       name: filteredData.utilities[0].name,
    //       classification: filteredData.utilities[0].classification,
    //       projectCount: filteredData.utilities[0].projectCount,
    //       hasCoordinates: !!(filteredData.utilities[0].latitude && filteredData.utilities[0].longitude)
    //     });
    //   }
    //   console.log('===== END ENTITY DATA =====');
    //   return {};
    // })(),
    
    // Loading and error states
    isLoading: rawData.isLoading,
    error: rawData.error,
    
    // Filter state
    filters,
    
    // Filter actions
    addFilter,
    removeFilter,
    clearFilters,
    
    // Search functionality
    searchTerms,
    handleSearch,
    
    // Sorting
    updateSortOptions,
    
    // User-specific filters
    showOnlyMyProjects,
    toggleShowOnlyMyProjects,
    
    // 45-day filter
    show45DayQualified,
    set45DayFilter,
    
    // Data fetching
    refreshData,
    fetchAllData
  };

  return (
    <DataContext.Provider value={value}>
      {children}
    </DataContext.Provider>
  );
}

// Custom hook to use the data context
export const useData = () => {
  const context = useContext(DataContext);
  if (!context) {
    throw new Error('useData must be used within a DataProvider');
  }
  return context;
};
