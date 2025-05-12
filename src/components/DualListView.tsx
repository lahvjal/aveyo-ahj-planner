import React, { useState, useEffect } from 'react';
import { Project, ProjectFilter } from '@/utils/types';
import ProjectListView from './ProjectListView';
import EntityListView from './EntityListView';
import { useAuth } from '@/utils/AuthContext';

interface DualListViewProps {
  projects: Project[];
  onViewOnMap: (project: Project) => void;
  selectedProject?: Project | null;
  onSelectProject?: (project: Project) => void;
  onSort?: (field: string, direction: 'asc' | 'desc') => void;
  sortField?: string;
  sortDirection?: 'asc' | 'desc';
  onAddFilter: (filter: ProjectFilter) => void;
  onRemoveFilter: (filter: ProjectFilter) => void;
  filters: ProjectFilter[];
  userLocation?: { latitude: number; longitude: number } | null;
  showOnlyMyProjects?: boolean;
}

const DualListView: React.FC<DualListViewProps> = ({
  projects,
  onViewOnMap,
  selectedProject,
  onSelectProject,
  onSort,
  sortField,
  sortDirection,
  onAddFilter,
  onRemoveFilter,
  filters,
  userLocation,
  showOnlyMyProjects = false
}) => {
  const [activeView, setActiveView] = useState<'list' | 'entities'>('list');
  const [myProjects, setMyProjects] = useState<Project[]>([]);

  // Get auth context
  const { user, userProfile } = useAuth();
  
  // Filter projects to get "my projects" based on the user's rep_id
  useEffect(() => {
    // Always filter to only show the user's projects in the My Projects view
    // This uses the rep_id field to identify the user's projects
    if (userProfile?.rep_id) {
      // Create a stable reference to filtered projects to prevent infinite loops
      const filteredProjects = projects.filter(project => 
        project.rep_id === userProfile.rep_id
      );
      
      // Only update state if the filtered projects have actually changed
      const currentIds = myProjects.map(p => p.id).sort().join(',');
      const newIds = filteredProjects.map(p => p.id).sort().join(',');
      
      if (currentIds !== newIds) {
        setMyProjects(filteredProjects);
        console.log(`Filtered to ${filteredProjects.length} projects for rep_id: ${userProfile.rep_id}`);
      }
    } else if (myProjects.length > 0) {
      // If no rep_id is available, show no projects, but only update if needed
      setMyProjects([]);
      console.log('No rep_id available, showing no projects in My Projects view');
    }
  }, [projects, userProfile, myProjects]);

  // Handle entity view on map
  const handleEntityViewOnMap = (entityName: string, entityType: 'ahj' | 'utility') => {
    // Find a project with this entity to center the map on
    const projectWithEntity = projects.find(project => {
      if (entityType === 'ahj') {
        return project.ahj.name === entityName;
      } else {
        return project.utility.name === entityName;
      }
    });

    if (projectWithEntity) {
      onViewOnMap(projectWithEntity);
    }
  };

  /**
   * Handle adding or removing a filter from entity selection
   * This function receives an enhanced ProjectFilter object with entity metadata
   * from the EntityListView component
   * 
   * If the filter has entityId and the user is deselecting an entity,
   * we need to find and remove any existing entity-selection filter for that entity
   */
  const handleEntityFilter = (filter: ProjectFilter) => {
    // If this is a deselection (no filter provided but just logging), find and remove the entity filter
    if (filter.filterSource === 'entity-selection' && Array.isArray(filters)) {
      // Check if we already have an entity-selection filter for this entity
      const existingFilter = filters.find(f => 
        f && f.filterSource === 'entity-selection' && 
        f.type === filter.type && 
        f.entityId === filter.entityId
      );
      
      if (existingFilter) {
        // If we already have a filter for this entity, remove it
        console.log(`[DualListView] Removing existing entity filter for ${filter.type} ${filter.entityId}`);
        onRemoveFilter(existingFilter);
        return;
      }
    }
    
    // Otherwise, add the new filter
    console.log(`[DualListView] Adding entity filter for ${filter.type} ${filter.value}`);
    onAddFilter(filter);
  };

  return (
    <div className="w-full h-full flex flex-col">
      {/* View toggle buttons */}
      <div className="flex mb-4">
        <button
          className={`px-4 py-2 text-sm font-medium rounded-md ${
            activeView === 'list' 
              ? 'bg-blue-500 text-white' 
              : 'bg-gray-700 text-gray-300 hover:bg-gray-600'
          }`}
          onClick={() => setActiveView('list')}
        >
          My Projects
        </button>
        <button
          className={`px-4 py-2 text-sm font-medium rounded-md ml-2 ${
            activeView === 'entities' 
              ? 'bg-blue-500 text-white' 
              : 'bg-gray-700 text-gray-300 hover:bg-gray-600'
          }`}
          onClick={() => setActiveView('entities')}
        >
          Entities
        </button>
      </div>

      {/* Active view */}
      {activeView === 'list' ? (
        <ProjectListView
          projects={myProjects}
          onViewOnMap={onViewOnMap}
          selectedProject={selectedProject}
          onSelectProject={onSelectProject}
          onSort={onSort}
          sortField={sortField}
          sortDirection={sortDirection}
        />
      ) : (
        <EntityListView
          projects={projects}
          userLocation={userLocation}
          onViewOnMap={handleEntityViewOnMap}
          onAddFilter={handleEntityFilter}
          onRemoveFilter={onRemoveFilter}
          filters={filters}
        />
      )}
    </div>
  );
};

export default DualListView;
