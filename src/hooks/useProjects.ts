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

  // Fetch all project data
  useEffect(() => {
    const fetchData = async () => {
      console.log('Fetching project data...');
      setIsLoading(true);
      try {
        // Fetch podio_data (projects)
        const { data, error } = await supabase
          .from('podio_data')
          .select('*');
        
        console.log('Fetched podio_data:', data?.length || 0, 'records');
        
        if (error) {
          console.error('Error fetching podio_data:', error);
          throw error;
        }
        
        // Fetch related data (similar to AHJ fetching pattern)
        const ahjRes = await supabase.from('ahj').select('*');
        const utilityRes = await supabase.from('utility').select('*');
        const financierRes = await supabase.from('financier').select('*');
        
        // Log the structure of the first items to debug
        if (ahjRes.data && ahjRes.data.length > 0) {
          console.log('AHJ first item structure:', ahjRes.data[0]);
        }
        if (utilityRes.data && utilityRes.data.length > 0) {
          console.log('Utility first item structure:', utilityRes.data[0]);
        }
        if (financierRes.data && financierRes.data.length > 0) {
          console.log('Financier first item structure:', financierRes.data[0]);
        }
        
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
        
        console.log('Transformed data:', transformedData.length, 'projects');
        setProjects(transformedData);
        setFilteredProjects(transformedData);
      } catch (error) {
        console.error('Error in useProjects hook:', error);
        setError('Failed to load project data. Please try again later.');
      } finally {
        setIsLoading(false);
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
