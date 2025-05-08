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
  userLocation,
  showOnlyMyProjects = false
}) => {
  const [activeView, setActiveView] = useState<'list' | 'entities'>('list');
  const [myProjects, setMyProjects] = useState<Project[]>([]);

  // Filter projects to get "my projects" based on the showOnlyMyProjects flag
  useEffect(() => {
    if (showOnlyMyProjects) {
      // Filter projects to only include those associated with the current user
      // This assumes projects have a rep_id field that can be used to identify the user's projects
      const { user } = useAuth();
      const filteredProjects = projects.filter(project => project.rep_id === user?.id);
      setMyProjects(filteredProjects);
    } else {
      setMyProjects(projects);
    }
  }, [projects, showOnlyMyProjects]);

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

  // Handle adding a filter when clicking on an entity
  const handleAddEntityFilter = (type: 'ahj' | 'utility', value: string) => {
    onAddFilter({ type, value });
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
          onAddFilter={handleAddEntityFilter}
        />
      )}
    </div>
  );
};

export default DualListView;
