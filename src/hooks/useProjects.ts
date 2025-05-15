import { useEffect, useState } from 'react';
import { supabase } from '@/utils/supabaseClient';
import { Project, ProjectFilter } from '@/utils/types';
import { useAuth } from '@/utils/AuthContext';
import { isQualified } from '@/utils/qualificationStatus';

export function useProjects(initialFilters: ProjectFilter[] = []) {
  const [projects, setProjects] = useState<Project[]>([]);
  const [filteredProjects, setFilteredProjects] = useState<Project[]>([]);
  const [filters, setFilters] = useState<ProjectFilter[]>(initialFilters);
  const [searchTerms, setSearchTerms] = useState<string[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [show45DayQualified, setShow45DayQualified] = useState<'all' | 'qualified' | 'not-qualified'>('all');
  const { user, userProfile, isAdmin } = useAuth();

  // Cache key for projects data
  const PROJECTS_CACHE_KEY = 'aveyo_projects_cache';
  
  // Function to load projects from cache
  const loadFromCache = () => {
    try {
      const cachedData = localStorage.getItem(PROJECTS_CACHE_KEY);
      if (!cachedData) return null;
      
      const parsed = JSON.parse(cachedData);
      return parsed;
    } catch (error) {
      return null;
    }
  };
  
  // Function to save projects to cache
  const saveToCache = (projects: Project[]) => {
    try {
      const cacheData = {
        projects,
        timestamp: Date.now()
      };
      localStorage.setItem(PROJECTS_CACHE_KEY, JSON.stringify(cacheData));
    } catch (error) {
      // Silent fail for cache operations
    }
  };
  
  // Fetch all project data
  useEffect(() => {
    const fetchData = async () => {
      setIsLoading(true);
      
      // Set a timeout to ensure loading state doesn't get stuck
      const timeoutId = setTimeout(() => {
        console.warn('[Projects] Data fetching timeout reached - resetting loading state');
        setIsLoading(false);
        
        // Try to use cached data as fallback on timeout
        const cachedData = loadFromCache();
        if (cachedData && cachedData.projects?.length > 0) {
          console.log('[Projects] Using cached data as fallback after timeout');
          setProjects(cachedData.projects);
          setFilteredProjects(cachedData.projects);
          setError('Using cached data. Latest data could not be loaded due to timeout.');
        } else {
          setError('Data fetching timeout reached. Please refresh the page.');
        }
      }, 30000); // 30 second timeout (increased from 15s)
      
      // Try to load from cache first before making any network requests
      const cachedData = loadFromCache();
      const cacheAge = cachedData ? (Date.now() - cachedData.timestamp) / (60 * 1000) : null;
      
      // Always show cached data immediately if available, but ALWAYS fetch fresh data
      if (cachedData) {
        // Immediately set cached data to avoid loading state
        setProjects(cachedData.projects);
        setFilteredProjects(cachedData.projects);
        setIsLoading(false);
        
        // But ALWAYS continue to fetch fresh data regardless of cache age
        
        // Continue fetching in the background
      }
      
      try {
        
        // Create a single timeout promise for all requests
        const FETCH_TIMEOUT = 25000; // 25 second timeout for individual requests
        const timeoutPromise = new Promise((_, reject) => {
          setTimeout(() => {
            reject(new Error('Data fetch timed out'));
          }, FETCH_TIMEOUT);
        });
        
        // Fetch all data in parallel to reduce total wait time
        const [projectsResult, ahjResult, utilityResult, financierResult] = await Promise.all([
          // Fetch projects with timeout
          Promise.race([
            supabase.from('podio_data').select('*'),
            timeoutPromise
          ]) as Promise<any>,
          
          // Fetch AHJs with timeout
          Promise.race([
            supabase.from('ahj').select('*'),
            timeoutPromise
          ]) as Promise<any>,
          
          // Fetch utilities with timeout
          Promise.race([
            supabase.from('utility').select('*'),
            timeoutPromise
          ]) as Promise<any>,
          
          // Fetch financiers with timeout
          Promise.race([
            supabase.from('financier').select('*'),
            timeoutPromise
          ]) as Promise<any>
        ]);
        
        // Clear the timeout since we got responses
        clearTimeout(timeoutId);
        
        // Extract data with proper error handling
        const data = projectsResult.data || [];
        console.log('[Projects] Fetched podio_data:', data.length, 'records');
        
        if (projectsResult.error) {
          console.error('[Projects] Error fetching podio_data:', projectsResult.error);
          throw projectsResult.error;
        }
        
        // Process related data with error handling
        let ahjRes = { data: [] };
        let utilityRes = { data: [] };
        let financierRes = { data: [] };
        
        // Handle AHJ data
        if (!ahjResult.error) {
          ahjRes = ahjResult;
        }
        
        // Handle Utility data
        if (!utilityResult.error) {
          utilityRes = utilityResult;
        }
        
        // Handle Financier data
        if (!financierResult.error) {
          financierRes = financierResult;
        }
        
        // Log the fresh data received from Supabase
        console.log('[Projects] Fresh data received:', {
          projects: {
            count: projectsResult.data?.length || 0,
            sample: projectsResult.data?.length > 0 ? projectsResult.data[0] : null
          },
          ahjs: {
            count: ahjRes.data?.length || 0,
            sample: ahjRes.data?.length > 0 ? ahjRes.data[0] : null
          },
          utilities: {
            count: utilityRes.data?.length || 0,
            sample: utilityRes.data?.length > 0 ? utilityRes.data[0] : null
          },
          financiers: {
            count: financierRes.data?.length || 0,
            sample: financierRes.data?.length > 0 ? financierRes.data[0] : null
          }
        });
        
        // Create lookup maps for faster access - use the correct ID fields
        const ahjMap = Object.fromEntries(
          (ahjRes.data || []).map((a: any) => [a.ahj_item_id || a.id, a])
        );
        
        const utilityMap = Object.fromEntries(
          (utilityRes.data || []).map((u: any) => [u.utility_company_item_id || u.id, u])
        );
        
        const financierMap = Object.fromEntries(
          (financierRes.data || []).map((f: any) => [f.fin_id || f.id, f])
        );
        
        // If no data is found, set empty arrays and exit loading state
        if (!data || data.length === 0) {
          console.log('No project data found. Setting empty arrays.');
          setProjects([]);
          setFilteredProjects([]);
          setIsLoading(false);
          return;
        }
        
        // Transform data to match our Project type
        const transformedData = (data || []).map((item: any) => {
          const ahj = ahjMap[item.ahj_item_id] || {};
          const utility = utilityMap[item.utility_company_item_id] || {};
          const financier = financierMap[item.fin_id] || {};
          
          // Get raw payload data (fallback)
          const raw = item.raw_payload.raw_payload || {};
          
          // Extract location data from raw payload
          const address = `${raw.address || ''}, ${raw.city || ''}, ${raw.state || ''} ${raw.zip || ''}`.trim();
          
          // Extract coordinates from raw data
          let lat: number | undefined = undefined;
          let lng: number | undefined = undefined;
          
          // Only set coordinates if they are valid
          if (raw.latitude && raw.longitude) {
            const parsedLat = parseFloat(raw.latitude);
            const parsedLng = parseFloat(raw.longitude);
            
            // Validate coordinates
            if (!isNaN(parsedLat) && !isNaN(parsedLng) && 
                parsedLat !== 0 && parsedLng !== 0 && 
                parsedLat >= -90 && parsedLat <= 90 && 
                parsedLng >= -180 && parsedLng <= 180) {
              lat = parsedLat;
              lng = parsedLng;
            }
          }
          
          // Check if project should be masked based on status and user role
          // Only show full details if:
          // 1. Status is "Complete" OR
          // 2. The user is the assigned rep OR
          // 3. The user is an admin
          const isComplete = item.status && 
            (item.status.toLowerCase() === 'complete' || 
             item.status.toLowerCase() === 'completed' ||
             item.status.toLowerCase().includes('complete'));
             
          // Check if user is assigned to this project
          const isAssignedToCurrentUser = item.rep_id === userProfile?.rep_id;
          
          // Check if user has admin privileges
          const hasAdminAccess = isAdmin;
          
          // Determine if project should be masked
          // A project is unmasked ONLY if it's complete OR it belongs to the current user OR user is admin
          const shouldMask = !(isComplete || isAssignedToCurrentUser || hasAdminAccess);
          
          return {
            id: item.project_id || '',
            address: shouldMask ? 'Project details restricted' : (address || 'No address'),
            latitude: lat,
            longitude: lng,
            ahj: {
              id: item.ahj_item_id || '',
              // Access AHJ name from raw_payload.raw_payload.name
              name: (ahj.raw_payload && 
                    typeof ahj.raw_payload === 'object' && 
                    ahj.raw_payload.raw_payload && 
                    typeof ahj.raw_payload.raw_payload === 'object' ? 
                      ahj.raw_payload.raw_payload.name : null) || 'Unknown AHJ',
              classification: ahj.classification || ahj['eligible-for-classification'] || 'Unknown'
            },
            utility: {
              id: item.utility_company_item_id || '',
              // Access utility name from company_name
              name: utility.company_name || 'Unknown Utility',
              classification: utility.classification || utility['eligible-for-classification'] || 'Unknown'
            },
            financier: {
              id: item.fin_id || '',
              // Access financier name from company_name
              name: financier.company_name || 'Unknown Financier',
              classification: financier.classification || financier['eligible-for-classification'] || 'Unknown'
            },
            // Access status directly from podio_data table
            status: shouldMask ? 'Restricted' : (item.status || 'Unknown'),
            city: raw.city || '',
            state: raw.state || '',
            zip: raw.zip || '',
            county: raw.county || '',
            milestone: item.milestone || '',
            qualifies45Day: item.qualifies_45_day || '',
            isMasked: shouldMask,
            rep_id: item.rep_id || null,
            contract_signed_date: item.contract_signed_date || ''
          };
        });
        
        console.log('[Projects] Transformed data:', transformedData.length, 'projects');
        
        // Save successful results to cache
        saveToCache(transformedData);
        
        // Update state with the new data
        setProjects(transformedData);
        setFilteredProjects(transformedData);
        setIsLoading(false);
      } catch (err: any) {
        console.error('[Projects] Error fetching project data:', err);
        
        // Try to use cached data as fallback if available
        const cachedData = loadFromCache();
        if (cachedData && cachedData.projects?.length > 0) {
          console.log('[Projects] Using cached data as fallback after error');
          setProjects(cachedData.projects);
          setFilteredProjects(cachedData.projects);
          
          // Show a more specific error message
          const isNetworkError = err.message?.includes('network') || 
                               err.message?.includes('timeout') || 
                               err.message?.includes('fetch');
          const errorType = isNetworkError ? 'network connection' : 'data loading';
          setError(`Using cached data. Latest data could not be loaded due to ${errorType} issues.`);
        } else {
          // Provide more helpful error message
          setError(err.message || 'An error occurred while fetching project data. Please try refreshing the page.');
          
          // Even if there's an error, set projects to an empty array to avoid undefined errors
          setProjects([]);
          setFilteredProjects([]);
        }
      } finally {
        // Always set loading to false to prevent UI from getting stuck
        setIsLoading(false);
        // Always clear the timeout to prevent memory leaks
        clearTimeout(timeoutId);
      }
    };
    
    fetchData();
  }, [userProfile, isAdmin]);

  // Apply filters to projects
  useEffect(() => {
    if (projects.length === 0) return;
    
    // First, apply search terms if present
    let filtered = projects;
    if (searchTerms.length > 0) {
      filtered = filtered.filter(project => {
        return searchTerms.every(term => {
          const query = term.toLowerCase().trim();
          
          // Check if query looks like a zip code (5 digits)
          const isZipCode = /^\d{5}$/.test(query);
          
          // Check if query might be a state name or abbreviation
          const stateAbbreviations: Record<string, string> = {
            'alabama': 'AL', 'alaska': 'AK', 'arizona': 'AZ', 'arkansas': 'AR', 'california': 'CA',
            'colorado': 'CO', 'connecticut': 'CT', 'delaware': 'DE', 'florida': 'FL', 'georgia': 'GA',
            'hawaii': 'HI', 'idaho': 'ID', 'illinois': 'IL', 'indiana': 'IN', 'iowa': 'IA',
            'kansas': 'KS', 'kentucky': 'KY', 'louisiana': 'LA', 'maine': 'ME', 'maryland': 'MD',
            'massachusetts': 'MA', 'michigan': 'MI', 'minnesota': 'MN', 'mississippi': 'MS', 'missouri': 'MO',
            'montana': 'MT', 'nebraska': 'NE', 'nevada': 'NV', 'new hampshire': 'NH', 'new jersey': 'NJ',
            'new mexico': 'NM', 'new york': 'NY', 'north carolina': 'NC', 'north dakota': 'ND', 'ohio': 'OH',
            'oklahoma': 'OK', 'oregon': 'OR', 'pennsylvania': 'PA', 'rhode island': 'RI', 'south carolina': 'SC',
            'south dakota': 'SD', 'tennessee': 'TN', 'texas': 'TX', 'utah': 'UT', 'vermont': 'VT',
            'virginia': 'VA', 'washington': 'WA', 'west virginia': 'WV', 'wisconsin': 'WI', 'wyoming': 'WY'
          };
          
          const stateAbbr = stateAbbreviations[query] || '';
          const isStateSearch = Object.keys(stateAbbreviations).includes(query) || Object.values(stateAbbreviations).map(v => v.toLowerCase()).includes(query);
          
          // If it's a zip code search, prioritize exact zip matches
          if (isZipCode && project.zip) {
            return project.zip === query;
          }
          
          // If it's a state search, prioritize state matches
          if (isStateSearch && project.state) {
            return project.state.toLowerCase() === query || 
                   project.state.toLowerCase() === stateAbbr.toLowerCase();
          }
          
          // Otherwise do a general search across all fields
          return (
            // Search in address
            project.address.toLowerCase().includes(query) ||
            // Search in AHJ name
            project.ahj.name.toLowerCase().includes(query) ||
            // Search in utility name
            project.utility.name.toLowerCase().includes(query) ||
            // Search in financier name
            project.financier.name.toLowerCase().includes(query) ||
            // Search in city
            (project.city && project.city.toLowerCase().includes(query)) ||
            // Search in state
            (project.state && project.state.toLowerCase().includes(query)) ||
            // Search in zip
            (project.zip && project.zip.toLowerCase().includes(query)) ||
            // Search in county
            (project.county && project.county.toLowerCase().includes(query))
          );
        });
      });
    }
    
    // Apply filters
    if (filters.length > 0) {
      filtered = filtered.filter(project => {
        // Separate entity-selection filters from classification filters
        const entitySelectionFilters = filters.filter(f => f.filterSource === 'entity-selection');
        const classificationFilters = filters.filter(f => f.filterSource !== 'entity-selection');
        
        // Handle entity-selection filters first
        if (entitySelectionFilters.length > 0) {
          // Check if any entity-selection filter matches this project
          const ahjEntityFilter = entitySelectionFilters.find(f => f.type === 'ahj');
          const utilityEntityFilter = entitySelectionFilters.find(f => f.type === 'utility');
          
          // If we have an AHJ entity filter, check if the project has that AHJ
          if (ahjEntityFilter && ahjEntityFilter.entityId) {
            if (project.ahj.id !== ahjEntityFilter.entityId) {
              return false; // Project doesn't have the selected AHJ
            }
          }
          
          // If we have a utility entity filter, check if the project has that utility
          if (utilityEntityFilter && utilityEntityFilter.entityId) {
            if (project.utility.id !== utilityEntityFilter.entityId) {
              return false; // Project doesn't have the selected utility
            }
          }
        }
        
        // Then apply regular classification filters
        if (classificationFilters.length > 0) {
          // Group filters by type
          const ahjFilters = classificationFilters.filter(f => f.type === 'ahj').map(f => f.value);
          const utilityFilters = classificationFilters.filter(f => f.type === 'utility').map(f => f.value);
          const financierFilters = classificationFilters.filter(f => f.type === 'financier').map(f => f.value);
          const myProjectsFilter = classificationFilters.some(f => f.type === 'myprojects' && f.value === 'true');
          
          // If there are no filters of a specific type, consider it a match
          const ahjMatch = ahjFilters.length === 0 || ahjFilters.includes(project.ahj.classification);
          const utilityMatch = utilityFilters.length === 0 || (project.utility.classification && utilityFilters.includes(project.utility.classification));
          const financierMatch = financierFilters.length === 0 || (project.financier.classification && financierFilters.includes(project.financier.classification));
          
          // For "my projects" filter, only match if both rep_id values are non-null and equal
          const myProjectsMatch = !myProjectsFilter || 
            (project.rep_id && userProfile?.rep_id && project.rep_id === userProfile.rep_id);
          
          // If any classification filter doesn't match, exclude the project
          if (!(ahjMatch && utilityMatch && financierMatch && myProjectsMatch)) {
            return false;
          }
        }
        
        // If we've made it this far, the project matches all filters
        return true;
      });
    }
    
    // Apply 45 Day qualification filter
    if (show45DayQualified !== 'all') {
      filtered = filtered.filter(project => {
        if (show45DayQualified === 'qualified') {
          return isQualified(project.qualifies45Day);
        } else {
          return !isQualified(project.qualifies45Day);
        }
      });
    }
    
    setFilteredProjects(filtered);
  }, [filters, searchTerms, projects, show45DayQualified, userProfile]);

  // Filter management functions
  const addFilter = (filter: ProjectFilter) => {
    // Prevent duplicate filters
    if (!filters.some(f => f.type === filter.type && f.value === filter.value)) {
      setFilters([...filters, filter]);
    }
  };

  // Remove a filter
  const removeFilter = (filter: ProjectFilter) => {
    setFilters(prev => prev.filter(f => 
      !(f.type === filter.type && f.value === filter.value)
    ));
  };

  const clearFilters = () => {
    setFilters([]);
  };

  // Search function
  const handleSearch = (terms: string[]) => {
    setSearchTerms(terms);
  };

  // 45 Day qualification filter
  const set45DayFilter = (value: 'all' | 'qualified' | 'not-qualified') => {
    setShow45DayQualified(value);
  };

  // Show only my projects filter
  const toggleShowOnlyMyProjects = () => {
    const myProjectsFilter = filters.find(f => f.type === 'myprojects');
    if (myProjectsFilter) {
      removeFilter(myProjectsFilter);
    } else {
      addFilter({ type: 'myprojects', value: 'true' });
    }
  };

  return {
    projects: filteredProjects,
    allProjects: projects,
    isLoading,
    error,
    filters,
    addFilter,
    removeFilter,
    clearFilters,
    handleSearch,
    searchTerms,
    show45DayQualified,
    set45DayFilter,
    showOnlyMyProjects: filters.some(f => f.type === 'myprojects' && f.value === 'true'),
    toggleShowOnlyMyProjects
  };
}
