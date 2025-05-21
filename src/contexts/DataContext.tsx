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
  filters: EnhancedProjectFilter[];
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
  removeFilter: (filterId: string) => void;
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
  
  // Server-side hydration
  hydrateFromServer: (serverData: any) => void;
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
    filters: [],
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
    
    setFilters(prevFilters => ({
      ...prevFilters,
      filters: [...prevFilters.filters, enhancedFilter]
    }));
  }, []);

  // Remove a filter
  const removeFilter = useCallback((filterId: string) => {
    setFilters(prevFilters => ({
      ...prevFilters,
      filters: prevFilters.filters.filter(f => f.id !== filterId)
    }));
  }, []);
  
  // Clear all filters
  const clearFilters = useCallback(() => {
    setFilters(prev => ({
      ...prev,
      filters: []
    }));
    setSearchTerms('');
  }, []);
  
  // Handle search
  const handleSearch = useCallback((terms: string) => {
    setSearchTerms(terms);
    
    // Remove any existing search filters
    setFilters(prev => ({
      ...prev,
      filters: prev.filters.filter(f => f.type !== 'search')
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
      filters: prev.filters.filter(f => f.type !== 'myprojects')
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
      filters: prev.filters.filter(f => f.type !== '45day')
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
    // Process AHJs - with more robust field extraction
    const processedAhjs = rawData.ahjs.map(ahj => {
      // Extract ID from various possible field names - much more flexible
      const id = ahj.ahj_item_id || ahj.id || ahj._id || ahj.ahj_id || 
                (ahj.raw_payload && (ahj.raw_payload.ahj_item_id || ahj.raw_payload.id)) || '';
      
      // Extract name using the extractEntityName function which handles nested structures
      // This function already knows how to extract from raw_payload.raw_payload.name
      const name = extractEntityName(ahj, 'ahj');
      
      // Extract classification from various possible field names
      const rawClassification = ahj.classification || ahj['eligible-for-classification'] || 
                               (ahj.raw_payload && ahj.raw_payload.classification) || '';
      const classification = extractClassification(rawClassification);
      
      // Extract coordinates with status
      const coordinates = extractCoordinates(ahj.raw);
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
    }).filter(ahj => {
      // Log AHJs that would be filtered out for debugging
      if (!ahj.id) {
        console.warn('[DataContext] AHJ filtered out due to missing ID:', ahj);
        return false;
      }
      return true;
    }); // Filter out any AHJs without an ID
    
    // Process Utilities - with more robust field extraction
    const processedUtilities = rawData.utilities.map(utility => {
      // Extract ID from various possible field names - much more flexible
      const id = utility.utility_company_item_id || utility.id || utility._id || utility.utility_id || 
                (utility.raw_payload && (utility.raw_payload.utility_company_item_id || utility.raw_payload.id)) || '';
      
      // Extract name from various possible field names - handle nested structures
      // First try to use the extractEntityName function which handles nested structures
      const name = extractEntityName(utility, 'utility');
      
      // Extract classification from various possible field names
      const rawClassification = utility.classification || utility['eligible-for-classification'] || 
                               (utility.raw_payload && utility.raw_payload.classification) || '';
      const classification = extractClassification(rawClassification);
      
      // Extract coordinates with status
      const coordinates = extractCoordinates(utility.raw);
      
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
    }).filter(utility => {
      // Log utilities that would be filtered out for debugging
      if (!utility.id) {
        console.warn('[DataContext] Utility filtered out due to missing ID:', utility);
        return false;
      }
      return true;
    }); // Filter out any utilities without an ID
    
    return { ahjs: processedAhjs, utilities: processedUtilities };
  }, [rawData]); // Use the entire rawData object as a dependency

  // The core of the filtering system - all filtering logic in one place
  const filteredData = useMemo(() => {
    // Skip filtering if data is not loaded yet
    if (rawData.isLoading || rawData.projects.length === 0) {
      return { projects: [], ahjs: [], utilities: [], financiers: [] };
    }
    
    // Log processed entities for debugging
    console.log('[DataContext] Processed entities before filtering:', {
      processedAhjsCount: processedEntities.ahjs.length,
      processedUtilitiesCount: processedEntities.utilities.length,
      ahjsWithCoordinates: processedEntities.ahjs.filter(ahj => ahj.latitude && ahj.longitude).length,
      utilitiesWithCoordinates: processedEntities.utilities.filter(utility => utility.latitude && utility.longitude).length,
      sampleAhj: processedEntities.ahjs.length > 0 ? processedEntities.ahjs[0] : null,
      sampleUtility: processedEntities.utilities.length > 0 ? processedEntities.utilities[0] : null
    });

    // Extract coordinates for all projects
    let filteredProjects = rawData.projects.map(project => {
      // If project already has valid coordinates, return it as is
      if (project.latitude && project.longitude) {
        return project;
      }
      
      // Try to access nested coordinates if they exist
      // Using type assertion to access potentially nested properties
      try {
        const rawProject = project as any;
        if (rawProject.raw_payload?.raw_payload?.longitude && rawProject.raw_payload?.raw_payload?.latitude) {
          return {
            ...project,
            latitude: Number(rawProject.raw_payload.raw_payload.latitude),
            longitude: Number(rawProject.raw_payload.raw_payload.longitude)
          };
        }
        
        // Try other potential locations for coordinates
        if (rawProject.raw_payload?.longitude && rawProject.raw_payload?.latitude) {
          return {
            ...project,
            latitude: Number(rawProject.raw_payload.latitude),
            longitude: Number(rawProject.raw_payload.longitude)
          };
        }
      } catch (error) {
        console.log('Error extracting coordinates for project:', project.id, error);
      }
      
      // If we couldn't find coordinates, use default values
      return {
        ...project,
        latitude: 40.7608, // Default to Utah
        longitude: -111.8910
      };
    });
    
    // Create maps of AHJs and utilities by ID for efficient lookup
    const ahjMap = Object.fromEntries(
      processedEntities.ahjs.map(ahj => [ahj.id, ahj])
    );
    
    const utilityMap = Object.fromEntries(
      processedEntities.utilities.map(utility => [utility.id, utility])
    );
    
    // Attach AHJ and utility objects to each project
    filteredProjects = filteredProjects.map(project => {
      const ahjId = project.ahj_item_id;
      const utilityId = project.utility_company_item_id;
      
      return {
        ...project,
        ahj: ahjId ? ahjMap[ahjId] || null : null,
        utility: utilityId ? utilityMap[utilityId] || null : null
      };
    });
    
    // 1. Apply all filters to projects
    filters.filters.forEach(filter => {
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
          filteredProjects = filteredProjects.filter(project => {
            // If we're filtering by classification (A, B, C)
            if (filter.value === 'A' || filter.value === 'B' || filter.value === 'C') {
              return project.ahj?.classification === filter.value;
            }
            // If we're filtering by ID
            if (filter.entityId) {
              return project.ahj_item_id?.toString() === filter.entityId?.toString();
            }
            // If we're filtering by name
            return project.ahj?.name?.toLowerCase().includes(filter.value.toLowerCase());
          });
          break;
        case 'utility':
          filteredProjects = filteredProjects.filter(project => {
            // If we're filtering by classification (A, B, C)
            if (filter.value === 'A' || filter.value === 'B' || filter.value === 'C') {
              return project.utility?.classification === filter.value;
            }
            // If we're filtering by ID
            if (filter.entityId) {
              return project.utility_company_item_id?.toString() === filter.entityId?.toString();
            }
            // If we're filtering by name
            return project.utility?.name?.toLowerCase().includes(filter.value.toLowerCase());
          });
          break;
        case '45day':
          filteredProjects = filteredProjects.filter(project => {
            // Check both possible formats of the 45-day qualification field
            const qualifies = project.qualifies45Day;
            return qualifies === true || qualifies === 'true' || qualifies === 'yes';
          });
          break;
        case 'myprojects':
          // Filter for projects belonging to the current user
          filteredProjects = filteredProjects.filter(project =>
            project.rep_id === filter.value
          );
          break;
        case 'class':
          // Filter by classification (A, B, C)
          filteredProjects = filteredProjects.filter(project => {
            // Check which entity type this classification filter applies to
            if (filter.entityType === 'ahj' || !filter.entityType) {
              return project.ahj?.classification === filter.value;
            } else if (filter.entityType === 'utility') {
              return project.utility?.classification === filter.value;
            }
            return false;
          });
          break;
        // Add other filter types as needed
      }
    });
    // 2. Extract entity IDs from filtered projects
    // const ahjIds = new Set(filteredProjects.map(p => p.ahj?.id).filter(Boolean));
    const ahjIds = new Set((filteredProjects || []).map(p => p.ahj?.id).filter(Boolean));
    const utilityIds = new Set((filteredProjects || []).map(p => p.utility?.id).filter(Boolean));

    // 3. Determine if we should filter entities based on project references
    // Check if we have entity-specific filters (ahj or utility type)
    const entityFilters = filters.filters.filter(f => f.type === 'ahj' || f.type === 'utility');
    const hasEntitySpecificFilters = entityFilters.length > 0;
    const hasSearchTerms = searchTerms.trim() !== '';

    // IMPORTANT: We want to ensure entities are always available
    // Only apply project-based filtering if we have filters or search terms
    let filteredAhjs = processedEntities.ahjs;
    let filteredUtilities = processedEntities.utilities;

    // If we have project filters, filter entities based on project references
    // But ONLY if we don't have entity-specific filters
    if (filters.filters.length > 0 && !hasEntitySpecificFilters && !hasSearchTerms) {
      filteredAhjs = processedEntities.ahjs.filter(ahj => ahjIds.has(ahj.id));
      filteredUtilities = processedEntities.utilities.filter(utility => utilityIds.has(utility.id));
    }
    
    // Handle search filtering similarly to entity selection filtering
    if (hasSearchTerms && !hasEntitySpecificFilters) {
      const searchFilter = filters.filters.find(f => f.type === 'search');
      if (searchFilter) {
        const searchValue = searchFilter.value.toLowerCase();
        
        // Find all projects that match the search term
        const projectsMatchingSearch = filteredProjects.filter(project => {
          return (
            project.address?.toLowerCase().includes(searchValue) ||
            project.ahj?.name?.toLowerCase().includes(searchValue) ||
            project.utility?.name?.toLowerCase().includes(searchValue) ||
            project.city?.toLowerCase().includes(searchValue) ||
            project.state?.toLowerCase().includes(searchValue) ||
            project.zip?.toLowerCase().includes(searchValue)
          );
        });
        
        // Get AHJ IDs from projects matching the search
        const searchRelatedAhjIds = new Set(
          projectsMatchingSearch
            .map(p => p.ahj_item_id ? p.ahj_item_id.toString() : null)
            .filter(Boolean)
        );
        
        // Get Utility IDs from projects matching the search
        const searchRelatedUtilityIds = new Set(
          projectsMatchingSearch
            .map(p => p.utility_company_item_id ? p.utility_company_item_id.toString() : null)
            .filter(Boolean)
        );
        
        // Filter AHJs to only those related to search results
        filteredAhjs = filteredAhjs.filter(ahj => 
          // Include entities that match by ID from project references OR by name directly
          searchRelatedAhjIds.has(ahj.id.toString()) || 
          ahj.name.toLowerCase().includes(searchValue)
        );
        
        // Filter Utilities to only those related to search results
        filteredUtilities = filteredUtilities.filter(utility => 
          // Include entities that match by ID from project references OR by name directly
          searchRelatedUtilityIds.has(utility.id.toString()) || 
          utility.name.toLowerCase().includes(searchValue)
        );
        
        // Update relationship data for entities based on search results
        // (This part remains largely the same)
      }
    }
    
    // Apply classification filters to entities if present in filters
    const classFilters = filters.filters.filter(f => f.type === 'class');
    if (classFilters.length > 0 && !hasEntitySpecificFilters) {
      
      // Get the classification values
      const classValues = classFilters.map(f => f.value.toUpperCase());
      
      // Find projects that match the classification filter
      const projectsMatchingClass = filteredProjects.filter(project => {
        const ahjClass = project.ahj?.classification?.toUpperCase() || '';
        const utilityClass = project.utility?.classification?.toUpperCase() || '';
        return classValues.includes(ahjClass) || classValues.includes(utilityClass);
      });
      
      // Get AHJ IDs from projects matching the classification
      const classRelatedAhjIds = new Set(
        projectsMatchingClass
          .map(p => p.ahj_item_id ? p.ahj_item_id.toString() : null)
          .filter(Boolean)
      );
      
      // Get Utility IDs from projects matching the classification
      const classRelatedUtilityIds = new Set(
        projectsMatchingClass
          .map(p => p.utility_company_item_id ? p.utility_company_item_id.toString() : null)
          .filter(Boolean)
      );
      
      // Filter AHJs by both classification and project references
      filteredAhjs = filteredAhjs.filter(ahj => 
        // Include entities that match by classification OR are referenced by projects with matching classification
        classValues.includes(ahj.classification.toUpperCase()) ||
        classRelatedAhjIds.has(ahj.id.toString())
      );
      
      // Filter Utilities by both classification and project references
      filteredUtilities = filteredUtilities.filter(utility => 
        // Include entities that match by classification OR are referenced by projects with matching classification
        classValues.includes(utility.classification?.toUpperCase() || '') ||
        classRelatedUtilityIds.has(utility.id.toString())
      );
      
      // Update relationship data for entities based on classification results
      // (Keep the existing relationship calculation code)
    }
    
    // 4. Apply entity-specific filters if they exist
    if (hasEntitySpecificFilters) {
      // Split filters by entity type
      const ahjFilters = filters.filters.filter(f => f.type === 'ahj' || f.entityType === 'ahj');
      const utilityFilters = filters.filters.filter(f => f.type === 'utility' || f.entityType === 'utility');
      
      // Find entity selection filters (these are used for cross-entity filtering)
      const selectedAhjFilter = ahjFilters.find(f => f.filterSource === 'entity-selection' && f.entityId);
      const selectedUtilityFilter = utilityFilters.find(f => f.filterSource === 'entity-selection' && f.entityId);
      
      // Track if we have entity selections for cross-filtering
      const hasSelectedAhj = !!selectedAhjFilter;
      const hasSelectedUtility = !!selectedUtilityFilter;
      
      // Apply AHJ filters if any exist
      if (ahjFilters.length > 0) {
        // If we have AHJ filters, only show AHJs that match those filters
        filteredAhjs = processedEntities.ahjs.filter(ahj => {
          return ahjFilters.some(filter => {
            // For entity filters, we typically filter by ID
            if (filter.entityId) {
              const matches = ahj.id === filter.entityId;
              return matches;
            }
            
            // For classification filters (A, B, C)
            if (filter.value === 'A' || filter.value === 'B' || filter.value === 'C') {
              const matches = ahj.classification === filter.value;
              return matches;
            }
            
            // For search filters, we search by name
            const matches = ahj.name.toLowerCase().includes(filter.value.toLowerCase());
            return matches;
          });
        });
      }
      
      // Apply cross-entity filtering if we have a selected utility
      // When a utility is selected, only show AHJs that have projects with that utility
      if (hasSelectedUtility && selectedUtilityFilter?.entityId) {
        const utilityId = selectedUtilityFilter.entityId; // Store in variable to avoid TypeScript errors
        
        // Find all projects that have the selected utility
        // Access the utility ID directly from the utility_company_item_id property
        const projectsWithSelectedUtility = (filteredProjects || []).filter(p => {
          // Get the ID from the direct property
          const projectUtilityId = p.utility_company_item_id;
          
          // Compare as strings to handle type differences
          return projectUtilityId && projectUtilityId.toString() === utilityId.toString();
        });
        
        // Check if any projects match the selected utility ID
        const matchingProjects = (filteredProjects || []).filter(p => p.utility?.id === selectedUtilityFilter.entityId);
        
        // Get the AHJ IDs from those projects using the direct ahj_item_id property
        const relatedAhjIds = new Set(
          (projectsWithSelectedUtility || [])
            .map(p => p.ahj_item_id ? p.ahj_item_id.toString() : null)
            .filter(Boolean)
        );
        
        // Filter AHJs to only those related to the selected utility
        // Use string comparison for consistent matching
        filteredAhjs = filteredAhjs.filter(ahj => 
          ahj.id && relatedAhjIds.has(ahj.id.toString())
        );
      }
      
      // Apply Utility filters if any exist
      if (utilityFilters.length > 0) {
        
        // Count before filtering
        const beforeCount = processedEntities.utilities.length;
        
        // If we have Utility filters, only show Utilities that match those filters
        filteredUtilities = processedEntities.utilities.filter(utility => {
          return utilityFilters.some(filter => {
            // For entity filters, we typically filter by ID
            if (filter.entityId) {
              const matches = utility.id === filter.entityId;
              return matches;
            }
            
            // For classification filters (A, B, C)
            if (filter.value === 'A' || filter.value === 'B' || filter.value === 'C') {
              const matches = utility.classification === filter.value;
              return matches;
            }
            
            // For search filters, we search by name
            const matches = utility.name.toLowerCase().includes(filter.value.toLowerCase());
            return matches;
          });
        });
      }
      
      // Apply cross-entity filtering if we have a selected AHJ
      // When an AHJ is selected, only show Utilities that have projects with that AHJ
      if (hasSelectedAhj && selectedAhjFilter?.entityId) {
        const ahjId = selectedAhjFilter.entityId; // Store in variable to avoid TypeScript errors
        
        // Check if any projects match the selected AHJ ID using string comparison
        const matchingProjects = (filteredProjects || []).filter(p => 
          p.utility_company_item_id && p.utility_company_item_id.toString() === ahjId.toString()
        );
        
        // Find all projects that have the selected AHJ
        // Access the AHJ ID directly from the ahj_item_id property
        const projectsWithSelectedAhj = (filteredProjects || []).filter(p => {
          // Get the ID from the direct property
          const projectAhjId = p.ahj_item_id;
          
          // Compare as strings to handle type differences
          return projectAhjId && projectAhjId.toString() === ahjId.toString();
        });
        
        // Get the Utility IDs from those projects using the direct utility_company_item_id property
        const relatedUtilityIds = new Set(
          (projectsWithSelectedAhj || [])
            .map(p => p.utility_company_item_id ? p.utility_company_item_id.toString() : null)
            .filter(Boolean)
        );
        
        // Filter Utilities to only those related to the selected AHJ
        // Use string comparison for consistent matching
        filteredUtilities = filteredUtilities.filter(utility => 
          utility.id && relatedUtilityIds.has(utility.id.toString())
        );
      }
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
    
    // For AHJs, calculate project counts and related utilities
    filteredAhjs = filteredAhjs.map(ahj => {
      // In the project data, p.ahj.id comes from item.ahj_item_id in useProjects.ts
      // Now that we've fixed entity ID extraction to use ahj_item_id, this should match correctly
      
      // IMPORTANT: Use the direct ahj_item_id field from the project instead of the nested p.ahj.id
      // This is because the raw data has ahj_item_id directly on the project objects
      let ahjProjects = filteredProjects.filter(p => {
        // Try both the nested structure and the direct field
        return p.ahj?.id === ahj.id || (p as any).ahj_item_id === ahj.id;
      });
      
      // If we didn't find any matches, try a different approach - match by name
      if (ahjProjects.length === 0) {
        // Try to find projects by AHJ name instead
        const nameMatchingProjects = filteredProjects.filter(p => 
          p.ahj?.name?.toLowerCase() === ahj.name.toLowerCase());
        
        // Use name-based matching if we found matches
        if (nameMatchingProjects.length > 0) {
          ahjProjects = nameMatchingProjects;
        }
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
        // projectCount: ahjProjects.length,
        relatedUtilityCount: relatedUtilityIds.size,
        // Store related utility IDs for potential use in UI
        relatedUtilityIds: Array.from(relatedUtilityIds)
      };
    });
    
    // For Utilities, calculate project counts and related AHJs
    filteredUtilities = filteredUtilities.map(utility => {
      
      // IMPORTANT: Use the direct utility_company_item_id field from the project instead of the nested p.utility.id
      // This is because the raw data has utility_company_item_id directly on the project objects
      let utilityProjects = filteredProjects.filter(p => {
        // Try both the nested structure and the direct field
        return p.utility?.id === utility.id || (p as any).utility_company_item_id === utility.id;
      });
      
      // If we didn't find any matches, try a different approach - match by name
      if (utilityProjects.length === 0) {
        // Try to find projects by Utility name instead
        const nameMatchingProjects = filteredProjects.filter(p => 
          p.utility?.name?.toLowerCase() === utility.name.toLowerCase());
        
        // Use name-based matching if we found matches
        if (nameMatchingProjects.length > 0) {
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
        // projectCount: utilityProjects.length,
        relatedAhjCount: relatedAhjIds.size,
        // Store related AHJ IDs for potential use in UI
        relatedAhjIds: Array.from(relatedAhjIds)
      };
    });
    
    // Log final entity data to see how project counts are passed
    // console.log('PROJECT COUNT: Final entity data after calculation:');
    if (filteredAhjs.length > 0) {
      const sampleAhj = filteredAhjs[0];
    }
    
    if (filteredUtilities.length > 0) {
      const sampleUtility = filteredUtilities[0];
    }
    
    // 7. Calculate distances if user location is available
    if (userLocation && userLocation.latitude && userLocation.longitude) {
      // Only log once per calculation cycle to reduce console spam
      
      // Calculate distances for AHJs
      filteredAhjs = filteredAhjs.map(ahj => {
        let distance = Infinity;
        // Only calculate distance if coordinates are valid
        if (ahj.latitude && ahj.longitude && ahj.coordStatus === 'valid') {
          distance = calculateDistance(
            userLocation.latitude,
            userLocation.longitude,
            ahj.latitude,
            ahj.longitude
          );
          console.log('distance for ahj:', ahj.name, distance);
        }
        
        // Always calculate project count regardless of coordinate validity
        const projectCount = rawData.projects.filter(p => p.ahj_item_id === ahj.id).length;        
        return { ...ahj, distance, projectCount };
      });
      
      // Calculate distances for Utilities
      filteredUtilities = filteredUtilities.map(utility => {
        let distance = Infinity;
        console.log('filteredUtilities:', filteredUtilities);
        // Only calculate distance if coordinates are valid
        if (utility.latitude && utility.longitude && utility.coordStatus === 'valid') {
          console.log('utility with VALID coordinates:', utility.latitude, utility.longitude);
          distance = calculateDistance(
            userLocation.latitude,
            userLocation.longitude,
            utility.latitude,
            utility.longitude
          );
        }
        
        // Always calculate project count regardless of coordinate validity
        const projectCount = rawData.projects.filter(p => p.utility_company_item_id === utility.id).length;        
        return { ...utility, distance, projectCount };
      });
      
    } else {
      // No user location available, set default distance
      // But still calculate project counts
      filteredAhjs = filteredAhjs.map(ahj => {
        // Calculate project count
        const projectCount = rawData.projects.filter(p => p.ahj_item_id === ahj.id).length;
        return {
          ...ahj,
          distance: Infinity,
          projectCount
        };
      });
      
      filteredUtilities = filteredUtilities.map(utility => {
        // Calculate project count
        const projectCount = rawData.projects.filter(p => p.utility_company_item_id === utility.id).length;
        return {
          ...utility,
          distance: Infinity,
          projectCount
        };
      });
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
    
    // Log AHJs that will be sent to EntityListView
    console.log('[DataContext] AHJs sent to EntityListView:', { count: filteredAhjs.length, withCoordinates: filteredAhjs.filter(ahj => ahj.latitude && ahj.longitude).length, sample: filteredAhjs.slice(0, 3) });
    
    // Return the final filtered data
    return finalFilteredData;
  }, [rawData, processedEntities, filters, userLocation]);

  // Hydrate data from server
  const hydrateFromServer = useCallback((serverData: any) => {
    if (!serverData) return;
    
    // Set loading state to false since we have data
    setRawData(prev => {
      const newState = {
        ...prev,
        projects: serverData.projects || [],
        ahjs: serverData.ahjs || [],
        utilities: serverData.utilities || [],
        financiers: serverData.financiers || [],
        isLoading: false,
        error: serverData.error || null
      };
      
      return newState;
    });
    // Apply filters from server data if available
    if (serverData.filters && Array.isArray(serverData.filters)) {
      // Clear existing filters first
      setFilters(prev => ({
        ...prev,
        filters: []
      }));
      
      // Add each filter from server data
      serverData.filters.forEach((filter: ProjectFilter) => {
        addFilter(filter);
      });
    }
    
    // Set user profile if available
    if (serverData.userProfile) {
      // This would typically be handled by AuthContext
      // but we can use it for filtering if needed
    }
  }, [addFilter]);

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
    fetchAllData,
    
    // Server-side hydration
    hydrateFromServer
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
