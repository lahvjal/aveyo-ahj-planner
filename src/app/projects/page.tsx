'use client';

import React, { useState, useEffect, useRef } from 'react';
import { useRouter } from 'next/navigation';
import Header from '@/components/Header';
import MapView from '@/components/MapView';
import ProjectListView from '@/components/ProjectListView';
import ImprovedFilterPanel from '@/components/ImprovedFilterPanel';
import { useProjects } from '@/hooks/useProjects';
import { Project, ProjectFilter } from '@/utils/types';
import { useAuth } from '@/utils/AuthContext';
import { FiMap, FiList } from 'react-icons/fi';
import { mapQualificationStatus } from '@/utils/qualificationStatus';

export default function ProjectsPage() {
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

  // Handle sorting
  const [sortField, setSortField] = useState('address');
  const [sortDirection, setSortDirection] = useState<'asc' | 'desc'>('asc');
  
  const handleSort = (field: string, direction: 'asc' | 'desc') => {
    setSortField(field);
    setSortDirection(direction);
  };

  return (
    <div className="flex flex-col h-screen bg-[#121212] text-white">
      <Header activePage="projects" />
      
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
                  <MapView 
                    projects={projects}
                    selectedProject={selectedProject}
                    onSelectProject={(project) => {
                      if (project) handleSelectProject(project);
                    }}
                  />
                  
                  {/* Selected project info panel */}
                  {selectedProject && (
                    <div className="absolute bottom-4 left-1/2 transform -translate-x-1/2 max-w-2xl w-full px-4">
                      <div className="bg-gray-800/90 backdrop-blur-sm rounded-lg shadow-lg p-4 border border-gray-700">
                        <div className="flex justify-between items-start mb-2">
                          <h3 className="text-lg font-semibold">
                            {selectedProject.isMasked 
                              ? 'Project Details (Restricted)' 
                              : selectedProject.ahj.name || 'Project Details'}
                          </h3>
                          <button 
                            onClick={() => setSelectedProject(null)}
                            className="text-gray-400 hover:text-white"
                          >
                            ✕
                          </button>
                        </div>
                        
                        <div className="grid grid-cols-2 gap-2 text-sm">
                          <div>
                            <p className="text-gray-400">Address:</p>
                            <p>{selectedProject.isMasked ? '[Restricted]' : selectedProject.address}</p>
                          </div>
                          <div>
                            <p className="text-gray-400">Status:</p>
                            <p>{selectedProject.status}</p>
                          </div>
                          <div>
                            <p className="text-gray-400">AHJ:</p>
                            <p>{selectedProject.isMasked ? '[Restricted]' : selectedProject.ahj.name}</p>
                          </div>
                          <div>
                            <p className="text-gray-400">Utility:</p>
                            <p>{selectedProject.isMasked ? '[Restricted]' : selectedProject.utility.name}</p>
                          </div>
                          <div>
                            <p className="text-gray-400">Financier:</p>
                            <p>{selectedProject.isMasked ? '[Restricted]' : selectedProject.financier.name}</p>
                          </div>
                          <div>
                            <p className="text-gray-400">45 Day Qualified:</p>
                            <p>{mapQualificationStatus(selectedProject.qualifies45Day)}</p>
                          </div>
                        </div>
                      </div>
                    </div>
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
