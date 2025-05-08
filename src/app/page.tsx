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
      try {
        if (navigator.geolocation) {
          navigator.geolocation.getCurrentPosition(
            (position) => {
              setUserLocation({
                latitude: position.coords.latitude,
                longitude: position.coords.longitude
              });
              console.log('User location obtained successfully');
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
              // Use a more discreet log level since this is an expected error
              console.log(`Notice: ${errorMessage}. Continuing without geolocation.`);
              
              // Continue without geolocation - application should still work
              setUserLocation(null);
            },
            { 
              timeout: 10000,         // 10 second timeout
              maximumAge: 60000,     // Accept cached positions up to 1 minute old
              enableHighAccuracy: false  // Don't need high accuracy, saves battery
            }
          );
        } else {
          console.log('Geolocation is not supported by this browser');
          setUserLocation(null);
        }
      } catch (err) {
        console.log('Notice: Unable to access geolocation. Continuing without location features.');
        setUserLocation(null);
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
