'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { FiList, FiMap } from 'react-icons/fi';

import { Project } from '@/utils/types';
import { useAuth } from '@/utils/AuthContext';
import { useData } from '@/contexts/DataContext';

import MapView from '@/components/MapView';
import ProjectListView from '@/components/ProjectListView';
import { default as EntityListView } from '@/components/EntityListView';
import ImprovedFilterPanel from '@/components/ImprovedFilterPanel';

export default function HomePage() {
  const router = useRouter();
  const { user, userProfile, isLoading: authLoading } = useAuth();
  const dataContext = useData(); // Access the DataContext
  
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
      // console.log('Switching to map view, triggering resize event');
      setTimeout(() => {
        window.dispatchEvent(new Event('resize'));
      }, 100);
    }
  }, [viewMode]);
  
  // State for entity view mode (projects or entities)
  const [entityViewMode, setEntityViewMode] = useState<'projects' | 'entities'>('entities');
  
  // State for selected project
  const [selectedProject, setSelectedProject] = useState<Project | null>(null);
  
  // Use the userLocation directly from dataContext instead of maintaining local state
  const { userLocation, setUserLocation } = dataContext || {};
  
  // Use our centralized data context
  const { 
    // Data
    projects, 
    ahjs, 
    utilities, 
    
    // Loading and error states
    isLoading: dataLoading, 
    error: dataError, 
    
    // Filter state and actions
    filters, 
    addFilter, 
    removeFilter, 
    clearFilters,
    
    // Search functionality
    searchTerms,
    handleSearch,
    
    // User-specific filters
    showOnlyMyProjects,
    toggleShowOnlyMyProjects,
    
    // 45-day filter
    show45DayQualified,
    set45DayFilter,
    
    // Sorting
    updateSortOptions
  } = useData();

  // Handle project selection
  const handleSelectProject = (project: Project | null) => {
    if (!project) {
      setSelectedProject(null);
      return;
    }
    
    setSelectedProject(prevSelected => 
      prevSelected && prevSelected.id === project.id ? null : project
    );
  };

  // Note: User location is now handled directly in the DataContext

  // Handle sorting
  const [sortField, setSortField] = useState<string>('address'); // Add type annotation
  const [sortDirection, setSortDirection] = useState<'asc' | 'desc'>('asc');
  
  const handleSort = (field: string, direction: 'asc' | 'desc') => {
    setSortField(field);
    setSortDirection(direction);
    updateSortOptions?.(field, direction); // Add optional chaining
  };

  // Check if there's an error from the data context
  if (dataError) {
    return (
      <div className="flex flex-col items-center justify-center h-screen bg-gray-900 text-white p-4">
        <h1 className="text-2xl font-bold mb-4">Error Loading Data</h1>
        <p className="mb-6 text-red-400">{dataError}</p>
        <button 
          onClick={() => window.location.reload()} 
          className="px-4 py-2 bg-blue-600 text-white rounded hover:bg-blue-700 transition-colors"
        >
          Retry
        </button>
      </div>
    );
  }

  // Show loading state
  if (dataLoading || authLoading) {
    return (
      <div className="flex flex-col items-center justify-center min-h-screen bg-[#121212]">
        <div className="animate-spin rounded-full h-12 w-12 border-t-2 border-b-2 border-white mb-4"></div>
        <p className="text-gray-400 mt-4">Loading data...</p>
      </div>
    );
  }

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
                  selectedProject={selectedProject}
                  onSelectProject={handleSelectProject}
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
                    onViewOnMap={(entityId: string, entityType: 'ahj' | 'utility') => {
                      // Find a project with this entity to center the map on
                      const projectWithEntity = projects.find(project => {
                        if (entityType === 'ahj') {
                          return project.ahj?.id === entityId;
                        } else {
                          return project.utility?.id === entityId;
                        }
                      });
                      
                      if (projectWithEntity) {
                        setViewMode('map');
                        handleSelectProject(projectWithEntity);
                      }
                    }}
                  />
                </div>
                
                {/* Project List */}
                <div className={`h-full overflow-hidden ${entityViewMode === 'projects' ? 'block' : 'hidden'}`}>
                  <ProjectListView
                    selectedProject={selectedProject}
                    onSelectProject={handleSelectProject}
                    onViewOnMap={(project: Project) => {
                      setViewMode('map');
                      handleSelectProject(project);
                    }}
                    showOnlyUserProjects={true}
                  />
                </div>
              </div>
            </div>
          </div>
        </div>
      </main>
    </div>
  );
}