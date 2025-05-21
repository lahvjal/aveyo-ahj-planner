/**
 * ServerDataService.ts
 * 
 * Server-side data service for fetching and processing data from Supabase.
 * This service is designed to be used in server components and API routes.
 */

import { createClient } from '@supabase/supabase-js';
import { 
  extractCoordinates, 
  extractEntityName, 
  extractClassification 
} from '@/utils/dataProcessing';
import { Project, ProjectFilter } from '@/utils/types';

// Initialize Supabase client with server-side credentials
// Using environment variables for security
const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || '';
const supabaseKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || '';

// Create a single instance of the Supabase client for server-side use
const supabase = createClient(supabaseUrl, supabaseKey);

// Define types for processed data
export interface ProcessedData {
  projects: Project[];
  ahjs: any[];
  utilities: any[];
  financiers: any[];
}

// Define types for filter parameters
export interface FilterParams {
  search?: string;
  ahj?: string;
  utility?: string;
  financier?: string;
  classification?: string;
  entityType?: 'ahj' | 'utility' | 'financier';
  qualified45Day?: boolean;
  myProjects?: string; // Rep ID
  sortField?: string;
  sortDirection?: 'asc' | 'desc';
}

/**
 * Fetch all data from Supabase
 * @returns Promise with processed data
 */
export async function fetchAllData(): Promise<ProcessedData> {
  try {
    // Fetch all data in parallel for efficiency
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

    // Return the raw data for further processing
    return {
      projects: projectsResult.data || [],
      ahjs: ahjResult.data || [],
      utilities: utilityResult.data || [],
      financiers: financierResult.data || []
    };
  } catch (error) {
    console.error('Error in fetchAllData:', error);
    throw error;
  }
}

/**
 * Process raw AHJ data into a standardized format
 * @param ahjs Raw AHJ data from Supabase
 * @returns Processed AHJ data
 */
export function processAhjs(ahjs: any[]) {
  return ahjs.map(ahj => {
    // Extract ID from various possible field names
    const id = ahj.ahj_item_id || '';
    
    // Extract name using the extractEntityName function which handles nested structures
    const name = extractEntityName(ahj, 'ahj');
    
    // Extract classification from various possible field names
    const rawClassification = ahj.classification || ahj['eligible-for-classification'] || 
                            (ahj.raw_payload && ahj.raw_payload.classification) || '';
    const classification = extractClassification(rawClassification);
    
    // Extract coordinates with status
    const coordinates = extractCoordinates(ahj.coordinates || ahj.raw_payload);
    
    // Determine coordinate status
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
      coordStatus,
      raw: ahj // Include raw data for debugging
    };
  }).filter(ahj => ahj.id); // Filter out any AHJs without an ID
}

/**
 * Process raw Utility data into a standardized format
 * @param utilities Raw Utility data from Supabase
 * @returns Processed Utility data
 */
export function processUtilities(utilities: any[]) {
  return utilities.map(utility => {
    // Extract ID from various possible field names
    const id = utility.utility_company_item_id || '';
    
    // Extract name from various possible field names
    const name = extractEntityName(utility, 'utility');
    
    // Extract classification from various possible field names
    const rawClassification = utility.classification || utility['eligible-for-classification'] || 
                            (utility.raw_payload && utility.raw_payload.classification) || '';
    const classification = extractClassification(rawClassification);
    
    // Extract coordinates with status
    const coordinates = extractCoordinates(utility.coordinates || utility.raw_payload);
    
    // Determine coordinate status
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
      coordStatus,
      raw: utility // Include raw data for debugging
    };
  }).filter(utility => utility.id); // Filter out any utilities without an ID
}

/**
 * Process raw Financier data into a standardized format
 * @param financiers Raw Financier data from Supabase
 * @returns Processed Financier data
 */
export function processFinanciers(financiers: any[]) {
  return financiers.map(financier => {
    // Extract ID from various possible field names
    const id = financier.fin_id || '';
    
    // Extract name from company_name field
    const name = financier.company_name || '';
    
    // Extract classification from various possible field names
    const rawClassification = financier.classification || financier['eligible-for-classification'] || '';
    const classification = extractClassification(rawClassification);
    
    return {
      id,
      name,
      classification,
      projectCount: 0, // Will be calculated later
      raw: financier // Include raw data for debugging
    };
  }).filter(financier => financier.id); // Filter out any financiers without an ID
}

/**
 * Process raw Project data and enrich with entity references
 * @param projects Raw Project data from Supabase
 * @param processedAhjs Processed AHJ data
 * @param processedUtilities Processed Utility data
 * @param processedFinanciers Processed Financier data
 * @returns Processed Project data with entity references
 */
export function processProjects(
  projects: any[], 
  processedAhjs: any[], 
  processedUtilities: any[],
  processedFinanciers: any[]
) {
  // Create maps for efficient entity lookup
  const ahjMap = new Map(processedAhjs.map(ahj => [ahj.id, ahj]));
  const utilityMap = new Map(processedUtilities.map(utility => [utility.id, utility]));
  const financierMap = new Map(processedFinanciers.map(financier => [financier.id, financier]));

  // console.log('Processing projects with entity maps:', {
  //   projects: projects.length,
  //   ahjMapSize: ahjMap.size,
  //   utilityMapSize: utilityMap.size,
  //   financierMapSize: financierMap.size
  // });

  // // Log a sample of the first few AHJs and utilities for debugging
  // if (processedAhjs.length > 0) {
  //   console.log('Sample AHJ:', {
  //     id: processedAhjs[0].id,
  //     name: processedAhjs[0].name
  //   });
  // }
  
  // if (processedUtilities.length > 0) {
  //   console.log('Sample Utility:', {
  //     id: processedUtilities[0].id,
  //     name: processedUtilities[0].name
  //   });
  // }

  // Process and enrich projects
  return projects.map(project => {
    // Extract coordinates for the project
    let latitude = null;
    let longitude = null;

    // Try to access nested coordinates if they exist
    try {
      if (project.latitude && project.longitude) {
        latitude = Number(project.latitude);
        longitude = Number(project.longitude);
      } else if (project.raw_payload?.raw_payload?.longitude && project.raw_payload?.raw_payload?.latitude) {
        latitude = Number(project.raw_payload.raw_payload.latitude);
        longitude = Number(project.raw_payload.raw_payload.longitude);
      } else if (project.raw_payload?.longitude && project.raw_payload?.latitude) {
        latitude = Number(project.raw_payload.latitude);
        longitude = Number(project.raw_payload.longitude);
      }
    } catch (error) {
      console.log('Error extracting coordinates for project:', project.id, error);
    }

    // Look for AHJ reference in various possible fields
    let ahjId = project.ahj_item_id;
    if (!ahjId && project.ahj) {
      ahjId = typeof project.ahj === 'object' ? project.ahj.id : project.ahj;
    }
    if (!ahjId && project.ahj_data) {
      ahjId = typeof project.ahj_data === 'object' ? project.ahj_data.id : project.ahj_data;
    }

    // Look for Utility reference in various possible fields
    let utilityId = project.utility_company_item_id;
    if (!utilityId && project.utility) {
      utilityId = typeof project.utility === 'object' ? project.utility.id : project.utility;
    }
    if (!utilityId && project.utility_data) {
      utilityId = typeof project.utility_data === 'object' ? project.utility_data.id : project.utility_data;
    }

    // Look for Financier reference in various possible fields
    let financierId = project.fin_id || project.financier_id;
    if (!financierId && project.financier) {
      financierId = typeof project.financier === 'object' ? project.financier.id : project.financier;
    }

    // Get entity references from maps
    const ahj = ahjId && ahjMap.has(ahjId) ? ahjMap.get(ahjId) : null;
    const utility = utilityId && utilityMap.has(utilityId) ? utilityMap.get(utilityId) : null;
    const financier = financierId && financierMap.has(financierId) ? financierMap.get(financierId) : null;

    // For debugging the first few projects
    // if (projects.indexOf(project) < 3) {
    //   console.log('Project entity references:', {
    //     projectId: project.id,
    //     projectName: project.name || project.project_name,
    //     ahjId,
    //     utilityId,
    //     foundAhj: Boolean(ahj),
    //     foundUtility: Boolean(utility)
    //   });
    // }

    return {
      ...project,
      latitude,
      longitude,
      ahj,
      utility,
      financier,
      // Store IDs separately for relationship calculations
      ahj_item_id: ahjId,
      utility_company_item_id: utilityId,
      financier_id: financierId
    };
  });
}

/**
 * Calculate entity relationships and project counts
 * @param projects Processed projects
 * @param ahjs Processed AHJs
 * @param utilities Processed Utilities
 * @returns Updated entities with relationship data
 */
export function calculateRelationships(projects: any[], ahjs: any[], utilities: any[]) {
  // console.log('Calculating relationships with:', {
  //   projectsCount: projects.length,
  //   ahjsCount: ahjs.length,
  //   utilitiesCount: utilities.length
  // });
  
  // Create a map of entity IDs for faster lookups
  const ahjMap = new Map(ahjs.map(ahj => [ahj.id, ahj]));
  const utilityMap = new Map(utilities.map(utility => [utility.id, utility]));
  
  // Track related entities for each project
  const ahjProjectCounts = new Map();
  const utilityProjectCounts = new Map();
  const ahjToUtilityRelations = new Map();
  const utilityToAhjRelations = new Map();
  
  // Process each project to build relationship data
  projects.forEach(project => {
    // Check for AHJ relationship - handle different possible field names
    const ahjId = project.ahj_item_id || 
                 (project.ahj && project.ahj.id) || 
                 (project.ahj_data && project.ahj_data.id);
    
    // Check for Utility relationship - handle different possible field names
    const utilityId = project.utility_company_item_id || 
                     (project.utility && project.utility.id) || 
                     (project.utility_data && project.utility_data.id);
    
    // Log the first few projects for debugging
    // if (projects.indexOf(project) < 3) {
    //   console.log('Project entity references:', {
    //     projectId: project.id,
    //     projectName: project.name || project.project_name,
    //     ahjId,
    //     utilityId,
    //     hasAhj: Boolean(ahjId && ahjMap.has(ahjId)),
    //     hasUtility: Boolean(utilityId && utilityMap.has(utilityId))
    //   });
    // }
    
    // Update AHJ project count
    if (ahjId && ahjMap.has(ahjId)) {
      const currentCount = ahjProjectCounts.get(ahjId) || 0;
      ahjProjectCounts.set(ahjId, currentCount + 1);
      
      // Track AHJ to Utility relation
      if (utilityId) {
        const relations = ahjToUtilityRelations.get(ahjId) || new Set();
        relations.add(utilityId);
        ahjToUtilityRelations.set(ahjId, relations);
      }
    }
    
    // Update Utility project count
    if (utilityId && utilityMap.has(utilityId)) {
      const currentCount = utilityProjectCounts.get(utilityId) || 0;
      utilityProjectCounts.set(utilityId, currentCount + 1);
      
      // Track Utility to AHJ relation
      if (ahjId) {
        const relations = utilityToAhjRelations.get(utilityId) || new Set();
        relations.add(ahjId);
        utilityToAhjRelations.set(utilityId, relations);
      }
    }
  });
  
  // Update AHJs with relationship data
  const updatedAhjs = ahjs.map(ahj => {
    const projectCount = ahjProjectCounts.get(ahj.id) || 0;
    const relatedUtilityIds = Array.from(ahjToUtilityRelations.get(ahj.id) || new Set());
    
    return {
      ...ahj,
      projectCount,
      relatedUtilityCount: relatedUtilityIds.length,
      relatedUtilityIds
    };
  });
  
  // Update Utilities with relationship data
  const updatedUtilities = utilities.map(utility => {
    const projectCount = utilityProjectCounts.get(utility.id) || 0;
    const relatedAhjIds = Array.from(utilityToAhjRelations.get(utility.id) || new Set());
    
    return {
      ...utility,
      projectCount,
      relatedAhjCount: relatedAhjIds.length,
      relatedAhjIds
    };
  });
  
  // console.log('Relationship calculation results:', {
  //   updatedAhjsCount: updatedAhjs.length,
  //   updatedUtilitiesCount: updatedUtilities.length,
  //   ahjsWithProjects: updatedAhjs.filter(a => a.projectCount > 0).length,
  //   utilitiesWithProjects: updatedUtilities.filter(u => u.projectCount > 0).length
  // });
  
  return { updatedAhjs, updatedUtilities };
}

/**
 * Apply filters to projects based on filter parameters
 * @param projects Processed projects
 * @param filters Filter parameters
 * @param userProfile User profile for access control
 * @returns Filtered projects
 */
export function filterProjects(projects: any[], filters: FilterParams, userProfile: any = null) {
  let filteredProjects = [...projects];

  // Apply search filter
  if (filters.search) {
    const searchValue = filters.search.toLowerCase();
    filteredProjects = filteredProjects.filter(project => {
      return (
        project.address?.toLowerCase().includes(searchValue) ||
        project.ahj?.name?.toLowerCase().includes(searchValue) ||
        project.utility?.name?.toLowerCase().includes(searchValue) ||
        project.city?.toLowerCase().includes(searchValue) ||
        project.state?.toLowerCase().includes(searchValue) ||
        project.zip?.toLowerCase().includes(searchValue)
      );
    });
  }

  // Apply AHJ filter
  if (filters.ahj) {
    filteredProjects = filteredProjects.filter(project => {
      // If filtering by classification (A, B, C)
      if (filters.ahj === 'A' || filters.ahj === 'B' || filters.ahj === 'C') {
        return project.ahj?.classification === filters.ahj;
      }
      // If filtering by ID
      return project.ahj_item_id === filters.ahj;
    });
  }

  // Apply Utility filter
  if (filters.utility) {
    filteredProjects = filteredProjects.filter(project => {
      // If filtering by classification (A, B, C)
      if (filters.utility === 'A' || filters.utility === 'B' || filters.utility === 'C') {
        return project.utility?.classification === filters.utility;
      }
      // If filtering by ID
      return project.utility_company_item_id === filters.utility;
    });
  }

  // Apply Financier filter
  if (filters.financier) {
    filteredProjects = filteredProjects.filter(project => {
      // If filtering by classification (A, B, C)
      if (filters.financier === 'A' || filters.financier === 'B' || filters.financier === 'C') {
        return project.financier?.classification === filters.financier;
      }
      // If filtering by ID
      return project.fin_id === filters.financier;
    });
  }

  // Apply classification filter
  if (filters.classification && filters.entityType) {
    filteredProjects = filteredProjects.filter(project => {
      if (filters.entityType === 'ahj') {
        return project.ahj?.classification === filters.classification;
      } else if (filters.entityType === 'utility') {
        return project.utility?.classification === filters.classification;
      } else if (filters.entityType === 'financier') {
        return project.financier?.classification === filters.classification;
      }
      return false;
    });
  }

  // Apply 45-day qualification filter
  if (filters.qualified45Day) {
    filteredProjects = filteredProjects.filter(project => {
      const qualifies = project.qualifies_45_day;
      return qualifies === true || qualifies === 'true' || qualifies === 'yes';
    });
  }

  // Apply my projects filter
  if (filters.myProjects && userProfile) {
    filteredProjects = filteredProjects.filter(project => 
      project.rep_id === filters.myProjects
    );
  }

  // Apply masking for non-admin users
  if (userProfile && !userProfile.isAdmin) {
    filteredProjects = filteredProjects.map(project => {
      const isComplete = project.status && 
        (project.status.toLowerCase() === 'complete' || 
         project.status.toLowerCase() === 'completed' ||
         project.status.toLowerCase().includes('complete'));
      
      const isAssignedToCurrentUser = project.rep_id === userProfile.rep_id;
      const shouldMask = !(isComplete || isAssignedToCurrentUser);
      
      if (shouldMask) {
        return {
          ...project,
          address: "Project details restricted",
          status: "Restricted",
          isMasked: true,
          // Mask coordinates to prevent location identification
          latitude: null,
          longitude: null
        };
      }
      
      return {
        ...project,
        isMasked: false
      };
    });
  }

  // Apply sorting
  if (filters.sortField) {
    const direction = filters.sortDirection === 'desc' ? -1 : 1;
    
    filteredProjects.sort((a, b) => {
      // First, prioritize unmasked projects over masked ones
      if (a.isMasked && !b.isMasked) return 1;
      if (!a.isMasked && b.isMasked) return -1;
      
      // Then sort by the selected field
      let aValue: any = a[filters.sortField as keyof typeof a];
      let bValue: any = b[filters.sortField as keyof typeof b];
      
      // Handle special cases
      if (filters.sortField === 'ahj') {
        aValue = a.ahj?.name || '';
        bValue = b.ahj?.name || '';
      } else if (filters.sortField === 'utility') {
        aValue = a.utility?.name || '';
        bValue = b.utility?.name || '';
      } else if (filters.sortField === 'financier') {
        aValue = a.financier?.name || '';
        bValue = b.financier?.name || '';
      }
      
      // Convert to strings for comparison if they're not already
      if (typeof aValue !== 'number') aValue = String(aValue || '').toLowerCase();
      if (typeof bValue !== 'number') bValue = String(bValue || '').toLowerCase();
      
      // Compare based on direction
      return direction * (aValue > bValue ? 1 : aValue < bValue ? -1 : 0);
    });
  }

  return filteredProjects;
}

/**
 * Get filtered data based on URL parameters
 * @param searchParams URL search parameters
 * @param userProfile User profile for access control
 * @returns Filtered and processed data
 */
export async function getFilteredData(searchParams: any, userProfile: any = null) {
  try {
    // Await the searchParams before accessing its properties
    const params = await searchParams;
    // Parse filter parameters from search params
    const filters: FilterParams = {
      search: params.search ? params.search : '',
      ahj: params.ahj ? params.ahj : '',
      utility: params.utility ? params.utility : '',
      financier: params.financier ? params.financier : '',
      classification: params.classification ? params.classification : '',
      entityType: params.entityType ? (params.entityType as 'ahj' | 'utility' | 'financier') : undefined,
      qualified45Day: params.qualified45Day ? params.qualified45Day === 'true' : false,
      myProjects: params.myProjects ? params.myProjects : '',
      sortField: params.sortField ? params.sortField : 'name',
      sortDirection: params.sortDirection ? (params.sortDirection as 'asc' | 'desc') : 'asc'
    };

    // Fetch all data
    const rawData = await fetchAllData();

    // Process entities
    const processedAhjs = processAhjs(rawData.ahjs);
    const processedUtilities = processUtilities(rawData.utilities);
    const processedFinanciers = processFinanciers(rawData.financiers);

    // Process projects with entity references
    const processedProjects = processProjects(
      rawData.projects,
      processedAhjs,
      processedUtilities,
      processedFinanciers
    );

    // Apply filters to projects
    const filteredProjects = filterProjects(processedProjects, filters, userProfile);

    // Calculate relationships based on filtered projects
    const { updatedAhjs, updatedUtilities } = calculateRelationships(
      filteredProjects,
      processedAhjs,
      processedUtilities
    );

    // Log data counts for debugging
    // console.log('ServerDataService processed data counts:', {
    //   rawAhjs: rawData.ahjs.length,
    //   rawUtilities: rawData.utilities.length,
    //   processedAhjs: processedAhjs.length,
    //   processedUtilities: processedUtilities.length,
    //   updatedAhjs: updatedAhjs.length,
    //   updatedUtilities: updatedUtilities.length,
    //   filteredProjects: filteredProjects.length
    // });
    
    // Make sure we're returning all entities, not just those with relationships
    // This ensures that the client has access to all entities, even if they don't have
    // relationships with the filtered projects
    const allAhjs = processedAhjs.map(ahj => {
      // Find the updated version if it exists
      const updatedVersion = updatedAhjs.find(updated => updated.id === ahj.id);
      return updatedVersion || {
        ...ahj,
        projectCount: 0,
        relatedUtilityCount: 0,
        relatedUtilityIds: []
      };
    });
    
    const allUtilities = processedUtilities.map(utility => {
      // Find the updated version if it exists
      const updatedVersion = updatedUtilities.find(updated => updated.id === utility.id);
      return updatedVersion || {
        ...utility,
        projectCount: 0,
        relatedAhjCount: 0,
        relatedAhjIds: []
      };
    });
  
    // console.log('Returning all entities to client:', {
    //   projectsCount: filteredProjects.length,
    //   ahjsCount: allAhjs.length,
    //   utilitiesCount: allUtilities.length,
    //   financiersCount: processedFinanciers.length
    // });
  
    // Return the processed and filtered data
    return {
      projects: filteredProjects,
      ahjs: allAhjs,
      utilities: allUtilities,
      financiers: processedFinanciers
    };
  } catch (error) {
    console.error('Error in getFilteredData:', error);
    throw error;
  }
}

/**
 * Parse filter objects from URL search parameters
 * @param searchParams URL search parameters
 * @returns Array of filter objects
 */
export function parseFiltersFromUrl(searchParams: any) {
  const filters = [];

  // Parse search filter
  if (searchParams.search) {
    filters.push({
      type: 'search',
      value: searchParams.search,
      label: `Search: ${searchParams.search}`
    });
  }

  // Parse AHJ filter
  if (searchParams.ahj) {
    filters.push({
      type: 'ahj',
      value: searchParams.ahj,
      label: `AHJ: ${searchParams.ahj}`
    });
  }

  // Parse Utility filter
  if (searchParams.utility) {
    filters.push({
      type: 'utility',
      value: searchParams.utility,
      label: `Utility: ${searchParams.utility}`
    });
  }

  // Parse Financier filter
  if (searchParams.financier) {
    filters.push({
      type: 'financier',
      value: searchParams.financier,
      label: `Financier: ${searchParams.financier}`
    });
  }

  // Parse Classification filter
  if (searchParams.classification && searchParams.entityType) {
    filters.push({
      type: 'class',
      value: searchParams.classification,
      entityType: searchParams.entityType,
      label: `${searchParams.entityType.toUpperCase()} Class: ${searchParams.classification}`
    });
  }

  // Parse 45-day qualification filter
  if (searchParams.qualified45Day === 'true') {
    filters.push({
      type: '45day',
      value: 'true',
      label: '45-Day Qualified'
    });
  }

  // Parse My Projects filter
  if (searchParams.myProjects) {
    filters.push({
      type: 'myprojects',
      value: searchParams.myProjects,
      label: 'My Projects'
    });
  }

  return filters;
}

// Export the Supabase client for use in other server components
export { supabase };
