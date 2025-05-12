'use client';

import React, { useState, useEffect, useRef } from 'react';
import { useRouter } from 'next/navigation';
import MapView from '@/components/MapView';
import DualListView from '@/components/DualListView';
import ProjectListView from '@/components/ProjectListView';
import EntityListView from '@/components/EntityListView';
import ImprovedFilterPanel from '@/components/ImprovedFilterPanel';
import EmptyState from '@/components/EmptyState';
import { useProjects } from '@/hooks/useProjects';
import { useEntities } from '@/hooks/useEntities';
import { Project, ProjectFilter } from '@/utils/types';
import { useAuth } from '@/utils/AuthContext';
import { FiMap, FiList } from 'react-icons/fi';

export default function HomePage() {
  const router = useRouter();
  const { user, userProfile, isLoading: authLoading } = useAuth();
  
  // Redirect to login if not authenticated
  useEffect(() => {
    if (!authLoading && !user) {
      router.push('/login');
    }
  }, [user, authLoading, router]);

  // State for view mode (map or list)
  const [viewMode, setViewMode] = useState<'map' | 'list'>('list');
  
  // Effect to handle tab changes
  useEffect(() => {
    // When switching to map view, dispatch a resize event to help Mapbox recalculate dimensions
    if (viewMode === 'map') {
      console.log('Switching to map view, triggering resize event');
      setTimeout(() => {
        window.dispatchEvent(new Event('resize'));
      }, 100);
    }
  }, [viewMode]);
  
  // State for entity view mode (projects or entities)
  const [entityViewMode, setEntityViewMode] = useState<'projects' | 'entities'>('entities');
  
  // State for selected project
  const [selectedProject, setSelectedProject] = useState<Project | null>(null);
  
  // State for user location
  const [userLocation, setUserLocation] = useState<{ latitude: number; longitude: number } | null>(null);
  
  // Use the projects hook to fetch and filter data
  const { 
    projects, 
    allProjects, 
    isLoading: projectsLoading, 
    error: projectsError, 
    filters, 
    addFilter: originalAddFilter, 
    removeFilter, 
    clearFilters,
    handleSearch,
    searchTerms,
    show45DayQualified,
    set45DayFilter,
    showOnlyMyProjects,
    toggleShowOnlyMyProjects
  } = useProjects();
  
  // Use the entities hook to fetch AHJs and Utilities with coordinates
  const {
    ahjs,
    utilities,
    isLoading: entitiesLoading,
    error: entitiesError
  } = useEntities();

  // Add a filter
  const addFilter = (filter: ProjectFilter) => {
    // Check if filter already exists to avoid duplicates
    const exists = filters.some(f => 
      f.type === filter.type && f.value === filter.value
    );
    
    if (!exists) {
      originalAddFilter(filter);
    }
  };

  // Handle project selection
  const handleSelectProject = (project: Project) => {
    setSelectedProject(prevSelected => 
      prevSelected && prevSelected.id === project.id ? null : project
    );
  };

  // Get user location
  useEffect(() => {
    // Define a function to safely get the user's location
    const getUserLocation = () => {
      console.log('[GEOLOCATION] Starting geolocation request...');
      
      // Default location (fallback) - Denver, CO coordinates
      const defaultLocation = {
        latitude: 39.7392,
        longitude: -104.9903
      };
      
      try {
        if (navigator.geolocation) {
          console.log('[GEOLOCATION] Browser supports geolocation API');
          
          // Try to get user location with reasonable options
          navigator.geolocation.getCurrentPosition(
            (position) => {
              // Check if coordinates are valid
              if (position.coords.latitude === 0 && position.coords.longitude === 0) {
                console.log('[GEOLOCATION] Warning: Received 0,0 coordinates, likely an error');
                console.log('[GEOLOCATION] Using default location as fallback');
                setUserLocation(defaultLocation);
                return;
              }
              
              const userCoords = {
                latitude: position.coords.latitude,
                longitude: position.coords.longitude
              };
              console.log('[GEOLOCATION] Success! User coordinates obtained');
              console.log('[GEOLOCATION] Accuracy:', position.coords.accuracy, 'meters');
              setUserLocation(userCoords);
            },
            (error) => {
              // Handle specific geolocation errors
              let errorMessage = 'Unknown error';
              switch(error.code) {
                case error.PERMISSION_DENIED:
                  errorMessage = 'User denied the request for geolocation';
                  break;
                case error.POSITION_UNAVAILABLE:
                  errorMessage = 'Location information is unavailable';
                  break;
                case error.TIMEOUT:
                  errorMessage = 'The request to get user location timed out';
                  break;
              }
              console.log(`[GEOLOCATION] Error: ${errorMessage}. Error code: ${error.code}`);
              
              // Use default location for any error
              console.log('[GEOLOCATION] Using default location as fallback for distance calculations');
              setUserLocation(defaultLocation);
            },
            { 
              timeout: 15000,         // 15 second timeout
              maximumAge: 300000,     // Accept cached positions up to 5 minutes old
              enableHighAccuracy: false  // Don't need high accuracy, saves battery
            }
          );
          console.log('[GEOLOCATION] Request sent, waiting for result...');
        } else {
          console.log('[GEOLOCATION] Browser does not support geolocation API');
          console.log('[GEOLOCATION] Using default location as fallback');
          setUserLocation(defaultLocation);
        }
      } catch (err) {
        console.log('[GEOLOCATION] Unexpected error accessing geolocation');
        console.log('[GEOLOCATION] Using default location as fallback');
        setUserLocation(defaultLocation);
      }
    };
    
    // Call the function
    getUserLocation();
  }, []);

  // Handle sorting
  const [sortField, setSortField] = useState('address');
  const [sortDirection, setSortDirection] = useState<'asc' | 'desc'>('asc');
  
  const handleSort = (field: string, direction: 'asc' | 'desc') => {
    setSortField(field);
    setSortDirection(direction);
  };

  // Check if there's an error or loading state
  const error = projectsError || entitiesError;
  if (error) {
    return (
      <div className="flex flex-col items-center justify-center h-screen bg-gray-900 text-white p-4">
        <h1 className="text-2xl font-bold mb-4">Error Loading Data</h1>
        <p className="mb-6 text-red-400">{error}</p>
      </div>
    );
  }

  // Show loading state
  const isLoading = projectsLoading || entitiesLoading;
  if (isLoading || authLoading) {
    return (
      <div className="flex items-center justify-center min-h-screen bg-[#121212]">
        <div className="animate-spin rounded-full h-12 w-12 border-t-2 border-b-2 border-white"></div>
      </div>
    );
  }

  // Import EmptyState component instead of defining inline
  // EmptyState component is now used directly where needed

  return (
    <div className="flex flex-col h-screen bg-[#121212] text-white">
      <main className="flex flex-1 overflow-hidden">
        {/* Filter sidebar - fixed position, non-collapsible */}
        <div className="w-[340px] border-r border-gray-800 bg-gray-900 overflow-y-auto">
          {/* Filter panel content */}
          <div className="h-full">
            <ImprovedFilterPanel
              filters={filters}
              addFilter={addFilter}
              removeFilter={removeFilter}
              clearFilters={clearFilters}
              onSearch={handleSearch}
              searchTerms={searchTerms}
              showOnlyMyProjects={showOnlyMyProjects}
              toggleShowOnlyMyProjects={toggleShowOnlyMyProjects}
            />
          </div>
        </div>
        
        {/* Main content area - takes remaining space */}
        <div className="flex-1 flex flex-col h-full overflow-hidden">
          {error ? (
            <div className="p-4 bg-red-900/50 border border-red-700 rounded-md m-4 flex flex-col items-center">
              <p className="mb-4">Error loading projects: {error}</p>
              <button 
                onClick={() => window.location.reload()} 
                className="px-4 py-2 bg-blue-600 text-white rounded hover:bg-blue-700 transition-colors"
              >
                Retry
              </button>
            </div>
          ) : isLoading ? (
            <div className="flex flex-col justify-center items-center h-full">
              <div className="animate-spin rounded-full h-12 w-12 border-t-2 border-b-2 border-white mb-4"></div>
              <p className="text-gray-400">Loading projects...</p>
              <button 
                onClick={() => window.location.reload()} 
                className="mt-8 px-4 py-2 bg-gray-700 text-white rounded hover:bg-gray-600 transition-colors"
              >
                Refresh if stuck
              </button>
            </div>
          ) : (
            <div className="w-full h-full flex flex-col">
              {/* View toggle tabs */}
              <div className="flex border-b border-gray-800 bg-gray-900 px-4">
                <button
                  className={`px-6 py-3 text-sm font-medium border-b-2 ${viewMode === 'list' 
                    ? 'border-blue-500 text-blue-500' 
                    : 'border-transparent text-gray-400 hover:text-gray-300'}`}
                  onClick={() => setViewMode('list')}
                >
                  <FiList className="inline mr-2" /> List View
                </button>
                <button
                  className={`px-6 py-3 text-sm font-medium border-b-2 ${viewMode === 'map' 
                    ? 'border-blue-500 text-blue-500' 
                    : 'border-transparent text-gray-400 hover:text-gray-300'}`}
                  onClick={() => setViewMode('map')}
                >
                  <FiMap className="inline mr-2" /> Map View
                </button>
              </div>
              
              {/* Content area */}
              <div className="flex-1 relative">
                {/* Map View - always rendered but conditionally visible */}
                <div 
                  className={`absolute inset-0 ${viewMode === 'map' ? 'block' : 'hidden'}`}
                  style={{ width: '100%', height: '100%' }} // Ensure the container has explicit dimensions
                >
                  <MapView 
                    projects={projects || []}
                    selectedProject={selectedProject}
                    onSelectProject={(project) => {
                      if (project) handleSelectProject(project);
                    }}
                    filters={filters}
                    ahjs={ahjs as any[] || []}
                    utilities={utilities as any[] || []}
                  />
                </div>
                
                {/* List View - always rendered but conditionally visible */}
                <div className={`absolute inset-0 p-4 ${viewMode === 'list' ? 'block' : 'hidden'}`}>
                  {/* Entity view toggle */}
                  <div className="flex mb-4">
                    <button
                      className={`px-4 py-2 text-sm font-medium rounded-md ${entityViewMode === 'entities' 
                        ? 'bg-blue-500 text-white' 
                        : 'bg-gray-700 text-gray-300 hover:bg-gray-600'}`}
                      onClick={() => setEntityViewMode('entities')}
                    >
                      Entities
                    </button>
                    <button
                      className={`px-4 py-2 text-sm font-medium rounded-md ml-2 ${entityViewMode === 'projects' 
                        ? 'bg-blue-500 text-white' 
                        : 'bg-gray-700 text-gray-300 hover:bg-gray-600'}`}
                      onClick={() => setEntityViewMode('projects')}
                    >
                      My Projects
                    </button>
                  </div>
                  
                  {/* Entity List */}
                  <div className={`h-full overflow-hidden ${entityViewMode === 'entities' ? 'block' : 'hidden'}`}>
                    <EntityListView
                      projects={projects || []}
                      userLocation={userLocation}
                      onViewOnMap={(entityName: string, entityType: 'ahj' | 'utility') => {
                        // Find a project with this entity to center the map on
                        const projectWithEntity = projects.find(project => {
                          if (entityType === 'ahj') {
                            return project.ahj?.name === entityName;
                          } else {
                            return project.utility?.name === entityName;
                          }
                        });
                        
                        if (projectWithEntity) {
                          setViewMode('map');
                          handleSelectProject(projectWithEntity);
                        }
                      }}
                      onAddFilter={addFilter}
                      onRemoveFilter={removeFilter}
                      filters={filters}
                    />
                  </div>
                  
                  {/* Project List */}
                  <div className={`h-full overflow-hidden ${entityViewMode === 'projects' ? 'block' : 'hidden'}`}>
                    <ProjectListView
                      projects={projects.filter(p => p.rep_id === userProfile?.rep_id) || []}
                      selectedProject={selectedProject}
                      onSelectProject={handleSelectProject}
                      onViewOnMap={(project: Project) => {
                        setViewMode('map');
                        if (project) handleSelectProject(project);
                      }}
                      sortField={sortField}
                      sortDirection={sortDirection}
                      onSort={handleSort}
                    />
                  </div>
                </div>
              </div>
            </div>
          )}
        </div>
      </main>
    </div>
  );
}
