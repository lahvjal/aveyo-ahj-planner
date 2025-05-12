import React, { useState, useEffect, useRef } from 'react';
import { FiMapPin } from 'react-icons/fi';
import { Project } from '@/utils/types';
import { getClassificationBadgeClass, formatClassification } from '@/utils/classificationColors';
import EmptyState from './EmptyState';

interface ProjectListViewProps {
  projects: Project[];
  onViewOnMap: (project: Project) => void;
  selectedProject?: Project | null;
  onSelectProject?: (project: Project) => void;
  onSort?: (field: string, direction: 'asc' | 'desc') => void;
  sortField?: string;
  sortDirection?: 'asc' | 'desc';
}

const ProjectListView: React.FC<ProjectListViewProps> = ({
  projects,
  onViewOnMap,
  selectedProject = null,
  onSelectProject,
  onSort,
  sortField = 'address',
  sortDirection = 'asc'
}) => {
  const [localSortField, setLocalSortField] = useState<string>(sortField);
  const [localSortDirection, setLocalSortDirection] = useState<'asc' | 'desc'>(sortDirection);
  const scrollContainerRef = useRef<HTMLDivElement>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [visibleItems, setVisibleItems] = useState<Project[]>([]);
  const [loadedCount, setLoadedCount] = useState(20);
  
  // Load more items when scrolling
  useEffect(() => {
    setVisibleItems(projects.slice(0, loadedCount));
  }, [projects, loadedCount]);
  
  // Handle scroll event to load more items
  useEffect(() => {
    const handleScroll = () => {
      if (!scrollContainerRef.current || isLoading) return;
      
      const { scrollTop, scrollHeight, clientHeight } = scrollContainerRef.current;
      
      // If scrolled near the bottom, load more items
      if (scrollHeight - scrollTop - clientHeight < 200) {
        if (loadedCount < projects.length) {
          setIsLoading(true);
          // Simulate loading delay (can be removed in production)
          setTimeout(() => {
            setLoadedCount(prev => Math.min(prev + 10, projects.length));
            setIsLoading(false);
          }, 200);
        }
      }
    };
    
    const currentContainer = scrollContainerRef.current;
    if (currentContainer) {
      currentContainer.addEventListener('scroll', handleScroll);
    }
    
    return () => {
      if (currentContainer) {
        currentContainer.removeEventListener('scroll', handleScroll);
      }
    };
  }, [loadedCount, isLoading, projects.length]);
  
  // Reset loaded count when projects change (e.g., due to filtering)
  useEffect(() => {
    setLoadedCount(20);
  }, [projects]);
  
  // Set a fixed height style to ensure the table fills the available space
  useEffect(() => {
    const updateTableHeight = () => {
      if (!scrollContainerRef.current) return;
      
      // Get viewport height
      const viewportHeight = window.innerHeight;
      
      // Get container's position from the top of the viewport
      const containerRect = scrollContainerRef.current.getBoundingClientRect();
      const containerTop = containerRect.top;
      
      // Calculate available height (viewport height minus container top position minus footer space)
      // The 40px accounts for some bottom margin
      const availableHeight = viewportHeight - containerTop - 40;
      
      // Apply the height to the container
      scrollContainerRef.current.style.height = `${availableHeight}px`;
      
      console.log('Viewport height:', viewportHeight);
      console.log('Container top:', containerTop);
      console.log('Available height:', availableHeight);
    };
    
    // Initial update
    updateTableHeight();
    
    // Update on resize
    window.addEventListener('resize', updateTableHeight);
    
    return () => {
      window.removeEventListener('resize', updateTableHeight);
    };
  }, []);

  // Handle sorting
  const handleSort = (field: string) => {
    const newDirection = localSortField === field && localSortDirection === 'asc' ? 'desc' : 'asc';
    
    setLocalSortField(field);
    setLocalSortDirection(newDirection);
    
    if (onSort) {
      onSort(field, newDirection);
    }
  };

  // Handle project selection
  const handleSelectProject = (project: Project) => {
    if (onSelectProject) {
      onSelectProject(project);
    }
  };

  // Render sort indicator
  const renderSortIndicator = (field: string) => {
    const currentSortField = onSort ? sortField : localSortField;
    const currentSortDirection = onSort ? sortDirection : localSortDirection;
    
    if (currentSortField !== field) return null;
    
    return (
      <span className="ml-1">
        {currentSortDirection === 'asc' ? '↑' : '↓'}
      </span>
    );
  };

  // Get classification display for different types
  const getAHJClassification = (project: Project) => {
    const classification = project.ahj.classification || '';
    
    return (
      <span className={`inline-block px-2 py-0.5 rounded text-xs font-medium ${getClassificationBadgeClass(classification)}`}>
        {formatClassification(classification)}
      </span>
    );
  };

  const getUtilityClassification = (project: Project) => {
    const classification = project.utility.classification || '';
    
    return (
      <span className={`inline-block px-2 py-0.5 rounded text-xs font-medium ${getClassificationBadgeClass(classification)}`}>
        {formatClassification(classification)}
      </span>
    );
  };

  // Table headers
  const tableHeaders = [
    { id: 'customer_name', label: 'Customer Name' },
    { id: 'address', label: 'Address' },
    { id: 'utility.name', label: 'Utility' },
    { id: 'ahj.name', label: 'AHJ' },
    { id: 'status', label: 'Status' },
    { id: 'actions', label: '', sortable: false }
  ];

  return (
    <div className="w-full h-full flex flex-col">
      <h2 className="text-xl font-bold text-white mb-4">MY PROJECTS</h2>
      <div className="rounded-md border border-[#333333] flex-1 h-full flex flex-col">
        {/* Table header */}
        <div className="bg-[#1e1e1e] sticky top-0 z-10">
          <div className="grid grid-cols-6 divide-x divide-[#333333]">
            {tableHeaders.map((header) => (
              <div 
                key={header.id}
                className={`px-6 py-3 text-left text-xs font-medium text-gray-300 uppercase tracking-wider ${header.sortable !== false ? 'cursor-pointer' : ''}`}
                onClick={() => header.sortable !== false && handleSort(header.id)}
              >
                {header.label} {header.sortable !== false && renderSortIndicator(header.id)}
              </div>
            ))}
          </div>
        </div>
        
        {/* Table body - scrollable */}
        <div 
          className="flex-1 overflow-auto bg-[#121212] scroll-smooth" 
          ref={scrollContainerRef}
        >
          {visibleItems.length === 0 ? (
            <div className="px-6 py-4 text-center text-gray-400">
              No projects found
            </div>
          ) : (
            <div className="divide-y divide-[#333333]">
              {visibleItems.map((project) => (
                <div 
                  key={project.id}
                  className={`grid grid-cols-6 hover:bg-[#1e1e1e] ${selectedProject?.id === project.id ? 'bg-[#333333]' : ''} ${
                    project.isMasked ? 'opacity-70' : ''
                  }`}
                  onClick={() => handleSelectProject(project)}
                >
                  <div className="px-6 py-4 whitespace-nowrap text-sm text-white overflow-hidden text-ellipsis">
                    {project.isMasked ? (
                      <div className="flex items-center">
                        <span className="text-gray-400">Non-active project</span>
                        <span className="ml-2 inline-flex items-center px-2 py-0.5 rounded text-xs font-medium bg-amber-100 text-amber-800">
                          Restricted
                        </span>
                      </div>
                    ) : (
                      <span className="truncate block">{project.customer_name || 'Unknown'}</span>
                    )}
                  </div>
                  <div className="px-6 py-4 whitespace-nowrap text-sm text-white overflow-hidden text-ellipsis">
                    <span className="truncate block">{project.address || 'No address'}</span>
                  </div>
                  <div className="px-6 py-4 whitespace-nowrap text-sm text-white overflow-hidden">
                    <div className="flex items-center">
                      <span className="mr-2 truncate">{project.utility.name}</span>
                      {getUtilityClassification(project)}
                    </div>
                  </div>
                  <div className="px-6 py-4 whitespace-nowrap text-sm text-white overflow-hidden">
                    <div className="flex items-center">
                      <span className="mr-2 truncate">{project.ahj.name}</span>
                      {getAHJClassification(project)}
                    </div>
                  </div>
                  <div className="px-6 py-4 whitespace-nowrap text-sm text-white overflow-hidden text-ellipsis">
                    <span className="truncate block">{project.status}</span>
                  </div>
                  <div className="px-6 py-4 whitespace-nowrap text-right text-sm font-medium">
                    <button
                      onClick={(e) => {
                        e.stopPropagation();
                        if (project.latitude && project.longitude) {
                          onViewOnMap(project);
                        }
                      }}
                      className={`flex items-center justify-end ${project.latitude && project.longitude ? 'text-gray-300 hover:text-white' : 'text-gray-800 cursor-default'}`}
                      disabled={!project.latitude || !project.longitude}
                      title={project.latitude && project.longitude ? 'View on map' : 'No coordinates available'}
                    >
                      <FiMapPin className="mr-1" />
                      Map
                    </button>
                  </div>
                </div>
              ))}
              
              {/* Loading indicator */}
              {isLoading && (
                <div className="py-4 text-center text-gray-400">
                  Loading more...
                </div>
              )}
              
              {/* End of list indicator */}
              {!isLoading && loadedCount >= projects.length && projects.length > 0 && (
                <div className="py-4 text-center text-gray-500 text-sm">
                  Showing all {projects.length} projects
                </div>
              )}
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

export default ProjectListView;
