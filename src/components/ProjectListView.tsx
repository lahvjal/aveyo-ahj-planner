import React, { useState, useEffect, useRef, useMemo, useCallback } from 'react';
import { FiMapPin } from 'react-icons/fi';
import { Project } from '@/utils/types';
import { useData } from '@/contexts/DataContext';
import { useAuth } from '@/utils/AuthContext';
import { getClassificationBadgeClass, formatClassification } from '@/utils/classificationColors';
import { isQualified } from '@/utils/qualificationStatus';
import EmptyState from './EmptyState';

interface ProjectListViewProps {
  onViewOnMap: (project: Project) => void;
  selectedProject?: Project | null;
  onSelectProject?: (project: Project) => void;
  showOnlyUserProjects?: boolean;
  sortField?: string;
  sortDirection?: 'asc' | 'desc';
  onSort?: (field: string, direction: 'asc' | 'desc') => void;
}

const ProjectListView: React.FC<ProjectListViewProps> = ({
  onViewOnMap,
  selectedProject = null,
  onSelectProject,
  showOnlyUserProjects = false
}) => {
  // Use DataContext for data and filters
  const { 
    projects,
    isLoading,
    error,
    updateSortOptions,
    filters
  } = useData();
  
  const { userProfile } = useAuth();
  
  // Local state for sorting
  const [localSortField, setLocalSortField] = useState<string>('name');
  const [localSortDirection, setLocalSortDirection] = useState<'asc' | 'desc'>('asc');
  
  // Ref for scroll container
  const scrollContainerRef = useRef<HTMLDivElement>(null);
  
  // State for infinite scrolling
  const [loadedCount, setLoadedCount] = useState(20);
  
  // Filter projects if showing only user's projects
  // This will work with both server-rendered and client-fetched data
  const filteredProjects = useMemo(() => {
    // First check if we have projects data
    if (!projects || projects.length === 0) return [];
    
    // Then apply user filtering if needed
    if (!showOnlyUserProjects || !userProfile) return projects;
    return projects.filter(project => project.rep_id === userProfile.rep_id);
  }, [projects, showOnlyUserProjects, userProfile]);
  
  // Sort projects based on current sort field and direction
  const sortedProjects = useMemo(() => {
    return [...filteredProjects].sort((a, b) => {
      // First, prioritize unmasked projects over masked ones
      const aIsComplete = a.status && 
        (a.status.toLowerCase() === 'complete' || 
         a.status.toLowerCase() === 'completed' ||
         a.status.toLowerCase().includes('complete'));
      
      const bIsComplete = b.status && 
        (b.status.toLowerCase() === 'complete' || 
         b.status.toLowerCase() === 'completed' ||
         b.status.toLowerCase().includes('complete'));
      
      const aIsAssignedToCurrentUser = a.rep_id === userProfile?.rep_id;
      const bIsAssignedToCurrentUser = b.rep_id === userProfile?.rep_id;
      
      const aIsMasked = !(aIsComplete || aIsAssignedToCurrentUser);
      const bIsMasked = !(bIsComplete || bIsAssignedToCurrentUser);
      
      if (!aIsMasked && bIsMasked) return -1;
      if (aIsMasked && !bIsMasked) return 1;
      
      // Then sort by the selected field
      let aValue: any = a[localSortField as keyof Project];
      let bValue: any = b[localSortField as keyof Project];
      
      // Handle special cases
      if (localSortField === 'ahj') {
        aValue = a.ahj?.name || '';
        bValue = b.ahj?.name || '';
      } else if (localSortField === 'utility') {
        aValue = a.utility?.name || '';
        bValue = b.utility?.name || '';
      } else if (localSortField === 'financier') {
        aValue = a.financier?.name || '';
        bValue = b.financier?.name || '';
      } else if (localSortField === '45day') {
        aValue = isQualified(a) ? 1 : 0;
        bValue = isQualified(b) ? 1 : 0;
      }
      
      // Convert to strings for comparison if they're not already
      if (typeof aValue !== 'number') aValue = String(aValue || '').toLowerCase();
      if (typeof bValue !== 'number') bValue = String(bValue || '').toLowerCase();
      
      // Compare based on direction
      if (localSortDirection === 'asc') {
        return aValue > bValue ? 1 : aValue < bValue ? -1 : 0;
      } else {
        return aValue < bValue ? 1 : aValue > bValue ? -1 : 0;
      }
    });
  }, [filteredProjects, localSortField, localSortDirection, userProfile]);
  
  // Get visible items based on loaded count
  const visibleItems = useMemo(() => {
    return sortedProjects.slice(0, loadedCount);
  }, [sortedProjects, loadedCount]);
  
  // Handle sorting
  const handleSort = (field: string) => {
    if (field === localSortField) {
      // Toggle direction if clicking the same field
      const newDirection = localSortDirection === 'asc' ? 'desc' : 'asc';
      setLocalSortDirection(newDirection);
      updateSortOptions(field, newDirection);
    } else {
      // Set new field with default ascending direction
      setLocalSortField(field);
      setLocalSortDirection('asc');
      updateSortOptions(field, 'asc');
    }
  };
  
  // Handle scroll event for infinite scrolling
  useEffect(() => {
    const handleScroll = () => {
      if (!scrollContainerRef.current) return;
      
      const { scrollTop, scrollHeight, clientHeight } = scrollContainerRef.current;
      
      // Load more when scrolled to bottom (with a small buffer)
      if (scrollHeight - scrollTop <= clientHeight + 100) {
        setLoadedCount(prev => prev + 10); // Load 10 more items
      }
    };
    
    const container = scrollContainerRef.current;
    if (container) {
      container.addEventListener('scroll', handleScroll);
      
      return () => {
        container.removeEventListener('scroll', handleScroll);
      };
    }
  }, []);
  
  // Reset loaded count when projects change
  useEffect(() => {
    setLoadedCount(20);
  }, [filteredProjects.length]);
  
  // Render sort indicator
  const renderSortIndicator = (field: string) => {
    if (field !== localSortField) return null;
    
    return (
      <span className="ml-1">
        {localSortDirection === 'asc' ? '↑' : '↓'}
      </span>
    );
  };
  
  // Handle project selection
  const handleSelectProject = (project: Project) => {
    if (onSelectProject) {
      onSelectProject(project);
    }
  };
  
  // Render loading state - only show if we don't have any projects data yet
  if (isLoading && (!projects || projects.length === 0)) {
    return (
      <div className="flex items-center justify-center h-full">
        <div className="text-gray-400">Loading projects...</div>
      </div>
    );
  }
  
  // Render error state
  if (error) {
    return (
      <div className="flex items-center justify-center h-full">
        <div className="text-red-500">Error loading projects: {error}</div>
      </div>
    );
  }
  
  // Show empty state if we have no projects after filtering
  if (filteredProjects.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center h-full p-4">
        <EmptyState
          title="No Projects Found"
          message={showOnlyUserProjects ? 
            "You don't have any projects assigned to you that match the current filters." : 
            "No projects match the current filters."}
        />
      </div>
    );
  }
  
  return (
    <div className="h-full flex flex-col">
      {/* Table header */}
      <div className="grid grid-cols-6 gap-4 bg-gray-800 p-3 font-medium text-gray-300 border-b border-gray-700">
        <div 
          className="cursor-pointer hover:text-white flex items-center"
          onClick={() => handleSort('name')}
        >
          Project Name {renderSortIndicator('name')}
        </div>
        <div 
          className="cursor-pointer hover:text-white flex items-center"
          onClick={() => handleSort('address')}
        >
          Address {renderSortIndicator('address')}
        </div>
        <div 
          className="cursor-pointer hover:text-white flex items-center"
          onClick={() => handleSort('ahj')}
        >
          AHJ {renderSortIndicator('ahj')}
        </div>
        <div 
          className="cursor-pointer hover:text-white flex items-center"
          onClick={() => handleSort('utility')}
        >
          Utility {renderSortIndicator('utility')}
        </div>
        <div 
          className="cursor-pointer hover:text-white flex items-center"
          onClick={() => handleSort('status')}
        >
          Status {renderSortIndicator('status')}
        </div>
        <div 
          className="cursor-pointer hover:text-white flex items-center"
          onClick={() => handleSort('45day')}
        >
          45-Day {renderSortIndicator('45day')}
        </div>
      </div>
      
      {/* Table body - scrollable */}
      <div 
        ref={scrollContainerRef}
        className="flex-1 overflow-y-auto"
      >
        {visibleItems.map((project) => {
          // Determine if this project should be masked
          const isComplete = project.status && 
            (project.status.toLowerCase() === 'complete' || 
             project.status.toLowerCase() === 'completed' ||
             project.status.toLowerCase().includes('complete'));
          
          const isAssignedToCurrentUser = project.rep_id === userProfile?.rep_id;
          // No admin users in the system, so only check completion status and assignment
          const isMasked = !(isComplete || isAssignedToCurrentUser);
          
          // Get classification badges
          const ahjClassification = project.ahj?.classification || 'unknown';
          const utilityClassification = project.utility?.classification || 'unknown';
          const financierClassification = project.financier?.classification || 'unknown';
          
          const ahjBadgeClass = getClassificationBadgeClass(ahjClassification);
          const utilityBadgeClass = getClassificationBadgeClass(utilityClassification);
          const financierBadgeClass = getClassificationBadgeClass(financierClassification);
          
          return (
            <div 
              key={project.id}
              className={`
                grid grid-cols-6 gap-4 p-3 border-b border-gray-700 hover:bg-gray-800 cursor-pointer
                ${selectedProject?.id === project.id ? 'bg-gray-800' : ''}
              `}
              onClick={() => handleSelectProject(project)}
            >
              <div className="truncate">
                {isMasked ? 'Project details restricted' : (project.id || 'No project id')}
              </div>
              <div className="truncate">
                {isMasked ? 'Project details restricted' : (project.address || 'No address')}
              </div>
              <div className="flex items-center">
                {isMasked ? (
                  'Restricted'
                ) : (
                  <>
                    <span className="truncate">{project.ahj?.name || 'Unknown'}</span>
                    <span className={`ml-2 px-2 py-1 rounded text-xs font-medium ${ahjBadgeClass}`}>
                      {formatClassification(ahjClassification)}
                    </span>
                  </>
                )}
              </div>
              <div className="flex items-center">
                {isMasked ? (
                  'Restricted'
                ) : (
                  <>
                    <span className="truncate">{project.utility?.name || 'Unknown'}</span>
                    <span className={`ml-2 px-2 py-1 rounded text-xs font-medium ${utilityBadgeClass}`}>
                      {formatClassification(utilityClassification)}
                    </span>
                  </>
                )}
              </div>
              <div className="truncate">
                {isMasked ? 'Restricted' : (project.status || 'Unknown')}
              </div>
              <div className="flex items-center space-x-2">
                {isMasked ? (
                  'Restricted'
                ) : (
                  <>
                    <span>{isQualified(project) ? 'Yes' : 'No'}</span>
                    <button 
                      className="p-1 bg-blue-600 rounded hover:bg-blue-700 flex items-center"
                      onClick={(e) => {
                        e.stopPropagation();
                        onViewOnMap(project);
                      }}
                    >
                      <FiMapPin size={16} />
                    </button>
                  </>
                )}
              </div>
            </div>
          );
        })}
        
        {/* Loading more indicator */}
        {loadedCount < sortedProjects.length && (
          <div className="p-3 text-center text-gray-400">
            Loading more projects...
          </div>
        )}
      </div>
    </div>
  );
};

export default ProjectListView;
