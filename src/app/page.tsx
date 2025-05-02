'use client';

import React, { useState, useEffect, useRef } from 'react';
import { useRouter } from 'next/navigation';
import MapView from '@/components/MapView';
import ProjectListView from '@/components/ProjectListView';
import ImprovedFilterPanel from '@/components/ImprovedFilterPanel';
import { useProjects } from '@/hooks/useProjects';
import { Project, ProjectFilter } from '@/utils/types';
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
  
  // State for prediction mode
  const [predictionModeActive, setPredictionModeActive] = useState(true); // Default to true
  const [predictionResult, setPredictionResult] = useState(null);
  const [predictionRadius, setPredictionRadius] = useState(5);
  const [predictionPinLocation, setPredictionPinLocation] = useState<[number, number] | null>(null);
  
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
    // Disable prediction mode when selecting a project
    if (predictionModeActive) {
      setPredictionModeActive(false);
    }
    
    setSelectedProject(prevSelected => 
      prevSelected && prevSelected.id === project.id ? null : project
    );
  };

  // Toggle prediction mode
  const togglePredictionMode = () => {
    // Clear selected project when entering prediction mode
    if (!predictionModeActive) {
      setSelectedProject(null);
    }
    setPredictionModeActive(!predictionModeActive);
    
    // Clear prediction results when turning off prediction mode
    if (predictionModeActive) {
      setPredictionResult(null);
    }
  };

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
              predictionModeActive={predictionModeActive}
              togglePredictionMode={togglePredictionMode}
              predictionResult={predictionResult}
              predictionRadius={predictionRadius}
              setPredictionRadius={setPredictionRadius}
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
                      predictionModeActive={predictionModeActive}
                      predictionResult={predictionResult}
                      setPredictionResult={setPredictionResult}
                      predictionRadius={predictionRadius}
                      setPredictionRadius={setPredictionRadius}
                      predictionPinLocation={predictionPinLocation}
                      setPredictionPinLocation={setPredictionPinLocation}
                    />
                  ) : (
                    <EmptyStateMessage />
                  )}
                </div>
              )}
              
              {/* List View */}
              {viewMode === 'list' && (
                <div className="flex flex-col h-full flex-1 p-4">
                  <div className="mb-4 flex justify-between items-center">
                    <h2 className="text-xl font-semibold">Projects ({projects?.length || 0})</h2>
                  </div>
                  
                  <div className="flex-1 overflow-hidden">
                    {projects && projects.length > 0 ? (
                      <ProjectListView
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
