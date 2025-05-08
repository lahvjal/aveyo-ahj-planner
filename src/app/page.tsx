'use client';

import React, { useState, useEffect, useRef } from 'react';
import { useRouter } from 'next/navigation';
import MapView from '@/components/MapView';
import DualListView from '@/components/DualListView';
import ImprovedFilterPanel from '@/components/ImprovedFilterPanel';
import { useProjects } from '@/hooks/useProjects';
import { Project, ProjectFilter, PredictionResult } from '@/utils/types';
import { useAuth } from '@/utils/AuthContext';
import { FiMap, FiList, FiAlertCircle } from 'react-icons/fi';

export default function HomePage() {
  const router = useRouter();
  const { user, isLoading: authLoading } = useAuth();
  
  // Redirect to login if not authenticated
  useEffect(() => {
    if (!authLoading && !user) {
      router.push('/login');
    }
  }, [user, authLoading, router]);

  // State for view mode (map or list)
  const [viewMode, setViewMode] = useState<'map' | 'list'>('map');
  
  // State for selected project
  const [selectedProject, setSelectedProject] = useState<Project | null>(null);
  
  // State for user location
  const [userLocation, setUserLocation] = useState<{ latitude: number; longitude: number } | null>(null);
  
  // Use the projects hook to fetch and filter data
  const { 
    projects, 
    allProjects, 
    isLoading, 
    error, 
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
      console.log('[GEOLOCATION-DEBUG] Starting geolocation request...');
      console.log('[GEOLOCATION-DEBUG] User agent:', navigator.userAgent);
      console.log('[GEOLOCATION-DEBUG] Platform:', navigator.platform);
      
      // Default location (fallback) - Denver, CO coordinates
      const defaultLocation = {
        latitude: 39.7392,
        longitude: -104.9903
      };
      
      // Debug function to check if we're in a simulator or emulator
      const checkForSimulator = () => {
        const ua = navigator.userAgent.toLowerCase();
        const isSimulator = ua.includes('simulator') || 
                           ua.includes('xcode') || 
                           (navigator.platform === 'MacIntel' && navigator.maxTouchPoints > 1);
        console.log('[GEOLOCATION-DEBUG] Possible simulator/emulator detected:', isSimulator);
        return isSimulator;
      };
      
      // Check for simulator environment
      const isPossiblySimulator = checkForSimulator();
      if (isPossiblySimulator) {
        console.log('[GEOLOCATION-DEBUG] Running in simulator environment - location services may be unreliable');
      }
      
      try {
        if (navigator.geolocation) {
          console.log('[GEOLOCATION-DEBUG] Browser supports geolocation API');
          
          // Log all available properties of the geolocation object
          console.log('[GEOLOCATION-DEBUG] Geolocation object properties:', 
            Object.getOwnPropertyNames(navigator.geolocation));
          
          // Simple location test with minimal options
          console.log('[GEOLOCATION-DEBUG] Attempting basic location request first...');
          navigator.geolocation.getCurrentPosition(
            (position) => {
              console.log('[GEOLOCATION-DEBUG] Basic location request succeeded!');
              console.log('[GEOLOCATION-DEBUG] Position object keys:', Object.keys(position));
              console.log('[GEOLOCATION-DEBUG] Coords object keys:', Object.keys(position.coords));
              
              // Check if coordinates are valid
              if (position.coords.latitude === 0 && position.coords.longitude === 0) {
                console.log('[GEOLOCATION-DEBUG] Warning: Received 0,0 coordinates, likely an error');
                console.log('[GEOLOCATION-DEBUG] Using default location as fallback');
                setUserLocation(defaultLocation);
                return;
              }
              
              const userCoords = {
                latitude: position.coords.latitude,
                longitude: position.coords.longitude
              };
              console.log('[GEOLOCATION-DEBUG] Success! User coordinates:', userCoords);
              console.log('[GEOLOCATION-DEBUG] Full position data:', {
                accuracy: position.coords.accuracy,
                altitude: position.coords.altitude,
                altitudeAccuracy: position.coords.altitudeAccuracy,
                heading: position.coords.heading,
                speed: position.coords.speed,
                timestamp: position.timestamp
              });
              setUserLocation(userCoords);
            },
            (basicError) => {
              console.log('[GEOLOCATION-DEBUG] Basic location request failed with error code:', basicError.code);
              console.log('[GEOLOCATION-DEBUG] Error message:', basicError.message);
              console.log('[GEOLOCATION-DEBUG] Full error object:', basicError);
              
              // Try with high accuracy as a fallback
              console.log('[GEOLOCATION-DEBUG] Trying with explicit options...');
              navigator.geolocation.getCurrentPosition(
                (position) => {
                  // Check if coordinates are valid
                  if (position.coords.latitude === 0 && position.coords.longitude === 0) {
                    console.log('[GEOLOCATION-DEBUG] Warning: Received 0,0 coordinates, likely an error');
                    console.log('[GEOLOCATION-DEBUG] Using default location as fallback');
                    setUserLocation(defaultLocation);
                    return;
                  }
                  
                  const userCoords = {
                    latitude: position.coords.latitude,
                    longitude: position.coords.longitude
                  };
                  console.log('[GEOLOCATION-DEBUG] Success with high accuracy! User coordinates:', userCoords);
                  console.log('[GEOLOCATION-DEBUG] Accuracy:', position.coords.accuracy, 'meters');
                  setUserLocation(userCoords);
                },
                (highAccuracyError) => {
                  console.log('[GEOLOCATION-DEBUG] High accuracy position failed with error code:', highAccuracyError.code);
                  console.log('[GEOLOCATION-DEBUG] Error message:', highAccuracyError.message);
                  
                  // If high accuracy fails, try with low accuracy
                  console.log('[GEOLOCATION-DEBUG] Trying with low accuracy...');
                  navigator.geolocation.getCurrentPosition(
                    (position) => {
                      const userCoords = {
                        latitude: position.coords.latitude,
                        longitude: position.coords.longitude
                      };
                      console.log('[GEOLOCATION-DEBUG] Success with low accuracy! User coordinates:', userCoords);
                      console.log('[GEOLOCATION-DEBUG] Accuracy:', position.coords.accuracy, 'meters');
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
                      console.log(`[GEOLOCATION-DEBUG] All attempts failed. Final error: ${errorMessage}. Error code: ${error.code}`);
                      console.log('[GEOLOCATION-DEBUG] Error message:', error.message);
                      
                      // For kCLErrorLocationUnknown (POSITION_UNAVAILABLE), use default location
                      console.log('[GEOLOCATION-DEBUG] Using default location as fallback for distance calculations');
                      setUserLocation(defaultLocation);
                    },
                    { 
                      timeout: 20000,         // 20 second timeout
                      maximumAge: 300000,     // Accept cached positions up to 5 minutes old
                      enableHighAccuracy: false  // Low accuracy mode
                    }
                  );
                },
                { 
                  timeout: 10000,         // 10 second timeout
                  maximumAge: 60000,     // Accept cached positions up to 1 minute old
                  enableHighAccuracy: true  // Try high accuracy first
                }
              );
            },
            // No options for basic request
            {}
          );
          console.log('[GEOLOCATION-DEBUG] Requests sent, waiting for results...');
        } else {
          console.log('[GEOLOCATION-DEBUG] Browser does not support geolocation API');
          console.log('[GEOLOCATION-DEBUG] Using default location as fallback');
          setUserLocation(defaultLocation);
        }
      } catch (err) {
        console.log('[GEOLOCATION-DEBUG] Unexpected error:', err);
        console.log('[GEOLOCATION-DEBUG] Using default location as fallback');
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

  // If still loading auth, show a loading spinner
  if (authLoading) {
    return (
      <div className="flex items-center justify-center min-h-screen bg-[#121212]">
        <div className="animate-spin rounded-full h-12 w-12 border-t-2 border-b-2 border-white"></div>
      </div>
    );
  }

  // Component for empty state message
  const EmptyStateMessage = () => (
    <div className="flex flex-col items-center justify-center h-full p-8 text-center">
      <FiAlertCircle className="text-yellow-500 text-5xl mb-4" />
      <h2 className="text-xl font-semibold mb-2">No Projects Available</h2>
      <p className="text-gray-400 max-w-md">
        There are currently no projects in the database. Projects will appear here once data is loaded.
      </p>
    </div>
  );

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
              viewMode={viewMode}
              onViewModeChange={setViewMode}
              showOnlyMyProjects={showOnlyMyProjects}
              toggleShowOnlyMyProjects={toggleShowOnlyMyProjects}

            />
          </div>
        </div>
        
        {/* Main content area - takes remaining space */}
        <div className="flex-1 flex flex-col h-full overflow-hidden">
          {error ? (
            <div className="p-4 bg-red-900/50 border border-red-700 rounded-md m-4">
              <p>Error loading projects: {error}</p>
            </div>
          ) : isLoading ? (
            <div className="flex justify-center items-center h-full">
              <div className="animate-spin rounded-full h-12 w-12 border-t-2 border-b-2 border-white"></div>
            </div>
          ) : (
            <>
              {/* Map View */}
              {viewMode === 'map' && (
                <div className="w-full h-full">
                  {projects && projects.length > 0 ? (
                    <MapView 
                      projects={projects}
                      selectedProject={selectedProject}
                      onSelectProject={(project) => {
                        if (project) handleSelectProject(project);
                      }}
                    />
                  ) : (
                    <EmptyStateMessage />
                  )}
                </div>
              )}
              
              {/* List View */}
              {viewMode === 'list' && (
                <div className="flex flex-col h-full flex-1 p-4">
                  <div className="flex-1 overflow-hidden">
                    {projects && projects.length > 0 ? (
                      <DualListView
                        projects={projects || []}
                        selectedProject={selectedProject}
                        onSelectProject={handleSelectProject}
                        onViewOnMap={(project) => {
                          setViewMode('map');
                          if (project) handleSelectProject(project);
                        }}
                        sortField={sortField}
                        sortDirection={sortDirection}
                        onSort={handleSort}
                        onAddFilter={addFilter}
                        userLocation={userLocation}
                        showOnlyMyProjects={showOnlyMyProjects}
                      />
                    ) : (
                      <EmptyStateMessage />
                    )}
                  </div>
                </div>
              )}
            </>
          )}
        </div>
      </main>
    </div>
  );
}
