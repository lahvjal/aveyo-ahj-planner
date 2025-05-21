'use client';

import { useEffect, useState, useRef } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { FiList, FiMap } from 'react-icons/fi';

import { Project, ProjectFilter } from '@/utils/types';
import { useAuth } from '@/utils/AuthContext';
import { useData } from '@/contexts/DataContext';
import { filtersToUrlParams } from '@/utils/parseFilters';
import { useMediaQuery } from '@/hooks';

import MapView from '@/components/MapView';
import ProjectListView from '@/components/ProjectListView';
import { default as EntityListView } from '@/components/EntityListView';
import ImprovedFilterPanel from '@/components/ImprovedFilterPanel';
import MobileHeader from '@/components/MobileHeader';
import BottomNavbar from '@/components/BottomNavbar';

// Define interface for server data props
export interface ServerData {
  projects: Project[];
  ahjs: any[];
  utilities: any[];
  financiers: any[];
  filters: ProjectFilter[];
  userProfile?: any;
  error?: string;
}

interface ClientHomePageProps {
  serverData?: ServerData;
}

export default function ClientHomePage({ serverData }: ClientHomePageProps) {
  const router = useRouter();
  const searchParams = useSearchParams();
  const { user, userProfile, isLoading: authLoading } = useAuth();
  
  // Reference to track if we've hydrated the DataContext
  const hydrationComplete = useRef(false);
  
  // Access the DataContext
  const dataContext = useData();
  
  // Check if we're on a mobile device
  const isMobile = useMediaQuery('(max-width: 768px)');
  
  // State for filter panel visibility on mobile
  const [isFilterPanelCollapsed, setIsFilterPanelCollapsed] = useState(true);
  
  // Redirect to login if not authenticated
  useEffect(() => {
    if (!authLoading && !user) {
      router.push('/login');
    }
  }, [user, authLoading, router]);
  
  // Hydrate DataContext with server data if available
  useEffect(() => {
    if (serverData && dataContext && !hydrationComplete.current) {
      // Hydrate the DataContext with server data
      dataContext.hydrateFromServer(serverData);
      hydrationComplete.current = true;
    } else if (!serverData && !hydrationComplete.current) {
      // If no server data is available, try to extract it from the DOM
      try {
        const serverDataElement = document.getElementById('server-data');
        if (serverDataElement && serverDataElement.textContent) {
          const extractedData = JSON.parse(serverDataElement.textContent);
          dataContext?.hydrateFromServer(extractedData);
          hydrationComplete.current = true;
        }
      } catch (error) {
        console.error('Error hydrating from DOM:', error);
        // Fall back to client-side fetching
        dataContext?.fetchAllData();
        hydrationComplete.current = true;
      }
    }
  }, [serverData, dataContext]);

  // State for view mode (map, list, or projects for mobile)
  const [viewMode, setViewMode] = useState<'map' | 'list' | 'projects'>('list');
  
  // Effect to handle tab changes
  useEffect(() => {
    // When switching to map view, dispatch a resize event to help Mapbox recalculate dimensions
    if (viewMode === 'map') {
      setTimeout(() => {
        window.dispatchEvent(new Event('resize'));
      }, 100);
    }
  }, [viewMode]);
  
  // State for entity view mode (projects or entities) - for desktop only
  const [entityViewMode, setEntityViewMode] = useState<'projects' | 'entities'>('entities');
  
  // Toggle filter panel visibility
  const toggleFilterPanel = () => {
    setIsFilterPanelCollapsed(!isFilterPanelCollapsed);
  };
  
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
  
  // Handle filter changes - update URL
  const updateUrlWithFilters = (filters: ProjectFilter[]) => {
    const params = filtersToUrlParams(filters);
    const url = new URL(window.location.href);
    
    // Clear existing params
    url.search = '';
    
    // Add new params
    Object.entries(params).forEach(([key, value]) => {
      if (value !== undefined) {
        url.searchParams.set(key, value);
      }
    });
    
    // Update URL without refreshing the page
    window.history.pushState({}, '', url.toString());
  };
  
  // Update URL when filters change
  useEffect(() => {
    if (dataContext?.filters?.filters) {
      updateUrlWithFilters(dataContext.filters.filters);
    }
  }, [dataContext?.filters]);

  // Handle sorting
  const [sortField, setSortField] = useState<string>('address');
  const [sortDirection, setSortDirection] = useState<'asc' | 'desc'>('asc');
  
  const handleSort = (field: string, direction: 'asc' | 'desc') => {
    setSortField(field);
    setSortDirection(direction);
    updateSortOptions?.(field, direction);
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
      {/* Mobile Header - only visible on mobile */}
      {isMobile && (
        <MobileHeader 
          title="AHJ Planner"
        />
      )}
      
      <main className="flex flex-1 overflow-hidden">
        {/* Filter sidebar - desktop: fixed position, mobile: collapsible */}
        {(!isMobile || !isFilterPanelCollapsed) && (
          <div className={isMobile ? 'w-full' : 'w-[340px] border-r border-gray-800 bg-gray-900 overflow-y-auto'}>
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
                isCollapsed={isFilterPanelCollapsed}
                onToggleCollapse={toggleFilterPanel}
                isMobile={isMobile}
              />
            </div>
          </div>
        )}
        
        {/* Collapsed filter panel button - only on mobile */}
        {isMobile && isFilterPanelCollapsed && (
          <ImprovedFilterPanel
            filters={filters}
            addFilter={addFilter}
            removeFilter={removeFilter}
            clearFilters={clearFilters}
            onSearch={handleSearch}
            searchTerms={searchTerms}
            showOnlyMyProjects={showOnlyMyProjects}
            toggleShowOnlyMyProjects={toggleShowOnlyMyProjects}
            isCollapsed={isFilterPanelCollapsed}
            onToggleCollapse={toggleFilterPanel}
            isMobile={isMobile}
          />
        )}
        
        {/* Main content area - takes remaining space */}
        <div className="flex-1 flex flex-col h-full overflow-hidden">
          <div className="w-full h-full flex flex-col">
            {/* View toggle tabs - only visible on desktop */}
            {!isMobile && (
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
            )}
            
            {/* Content area */}
            <div className="flex-1 relative">
              {/* Map View */}
              <div 
                className={`absolute inset-0 ${viewMode === 'map' ? 'block' : 'hidden'}`}
                style={{ width: '100%', height: '100%' }}
              >
                <MapView 
                  selectedProject={selectedProject}
                  onSelectProject={handleSelectProject}
                />
              </div>
              
              {/* Desktop List View with toggle between entities and projects */}
              {!isMobile && (
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
              )}
              
              {/* Mobile: Direct Entity List View */}
              {isMobile && (
                <div className={`absolute inset-0 pt-2 pb-16 ${viewMode === 'list' ? 'block' : 'hidden'}`}>
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
              )}
              
              {/* Mobile: Direct Project List View */}
              {isMobile && (
                <div className={`absolute inset-0 pt-2 pb-16 ${viewMode === 'projects' ? 'block' : 'hidden'}`}>
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
              )}
            </div>
          </div>
        </div>
      </main>
      
      {/* Bottom Navigation - only visible on mobile */}
      {isMobile && (
        <BottomNavbar 
          activeView={viewMode} 
          onChangeView={(view) => setViewMode(view)}
        />
      )}
    </div>
  );
}
