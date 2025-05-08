import React, { useState, useEffect, useRef, useMemo } from 'react';
import { FiMapPin } from 'react-icons/fi';
import { Project } from '@/utils/types';
import { getClassificationBadgeClass } from '@/utils/classificationColors';
import { useEntities, EntityData } from '@/hooks/useEntities';

// Local interface for entity data with projects
interface LocalEntityData extends EntityData {
  projects: Project[];
}

interface EntityListViewProps {
  projects: Project[];
  userLocation?: { latitude: number; longitude: number } | null;
  onViewOnMap: (entityName: string, entityType: 'ahj' | 'utility') => void;
  onAddFilter: (type: 'ahj' | 'utility', value: string) => void;
}

const EntityListView: React.FC<EntityListViewProps> = ({
  projects,
  userLocation,
  onViewOnMap,
  onAddFilter
}) => {
  const [activeTab, setActiveTab] = useState<'ahj' | 'utility'>('ahj');
  const [visibleItems, setVisibleItems] = useState<EntityData[]>([]);
  const [loadedCount, setLoadedCount] = useState(20);
  const scrollContainerRef = useRef<HTMLDivElement>(null);
  
  // Use the entities hook to fetch AHJ and Utility data directly from Supabase
  const { ahjs, utilities, isLoading, error, calculateDistances } = useEntities();

  // Update distances when user location changes
  useEffect(() => {
    if (userLocation) {
      calculateDistances(userLocation);
    }
  }, [userLocation, calculateDistances]);
  
  // Get the current entities based on the active tab
  const currentEntities = activeTab === 'ahj' ? ahjs : utilities;
  
  // Map projects to entities for the "View on Map" functionality
  const entitiesWithProjects = useMemo(() => {
    // If currentEntities is not yet loaded, return an empty array
    if (!currentEntities || currentEntities.length === 0) {
      return [];
    }
    
    const projectMap = new Map<string, Project[]>();
    
    // Group projects by entity ID
    projects.forEach(project => {
      const entityData = activeTab === 'ahj' ? project.ahj : project.utility;
      const entityId = entityData?.id;
      if (!entityId) return;
      
      if (projectMap.has(entityId)) {
        projectMap.get(entityId)!.push(project);
      } else {
        projectMap.set(entityId, [project]);
      }
    });
    
    // Add projects to entities
    return currentEntities.map(entity => ({
      ...entity,
      projects: projectMap.get(entity.id) || []
    }));
  }, [projects, currentEntities, activeTab]);

  // Debugging log - removed to prevent console spam
  /*
  useEffect(() => {
    if (entitiesWithProjects) {
      console.log({
        loadedCount,
        isLoading,
        entitiesLength: entitiesWithProjects.length
      });
    }
  }, [loadedCount, isLoading, entitiesWithProjects]);
  */

  // Load more items when scrolling
  useEffect(() => {
    if (entitiesWithProjects && entitiesWithProjects.length > 0) {
      setVisibleItems(entitiesWithProjects.slice(0, loadedCount));
    } else {
      setVisibleItems([]);
    }
  }, [entitiesWithProjects, loadedCount]);
  
  // Handle scroll event to load more items
  useEffect(() => {
    const handleScroll = () => {
      if (!scrollContainerRef.current || isLoading) return;
      
      const { scrollTop, scrollHeight, clientHeight } = scrollContainerRef.current;
      
      // If scrolled near the bottom, load more items
      if (scrollHeight - scrollTop - clientHeight < 200) {
        if (entitiesWithProjects && loadedCount < entitiesWithProjects.length) {
          // Load more items
          setTimeout(() => {
            setLoadedCount(prev => Math.min(prev + 10, entitiesWithProjects.length));
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
  }, [loadedCount, isLoading]); // Remove entitiesWithProjects.length from dependencies
  
  // Reset loaded count when entities change
  useEffect(() => {
    setLoadedCount(20);
  }, [activeTab]); // Only reset when tab changes, not when entities change
  
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
    };
    
    // Initial update
    updateTableHeight();
    
    // Update on resize
    window.addEventListener('resize', updateTableHeight);
    
    return () => {
      window.removeEventListener('resize', updateTableHeight);
    };
  }, []);

  return (
    <div className="w-full h-full flex flex-col">
      <h2 className="text-xl font-bold text-white mb-4">AHJ & UTILITY</h2>
      
      {/* Tab navigation */}
      <div className="flex mb-4">
        <button
          className={`px-4 py-2 text-sm font-medium rounded-t-md ${
            activeTab === 'ahj' 
              ? 'bg-blue-500 text-white' 
              : 'bg-gray-700 text-gray-300 hover:bg-gray-600'
          }`}
          onClick={() => setActiveTab('ahj')}
        >
          AHJ
        </button>
        <button
          className={`px-4 py-2 text-sm font-medium rounded-t-md ml-2 ${
            activeTab === 'utility' 
              ? 'bg-blue-500 text-white' 
              : 'bg-gray-700 text-gray-300 hover:bg-gray-600'
          }`}
          onClick={() => setActiveTab('utility')}
        >
          UTILITY
        </button>
      </div>
      
      {/* Entity list table */}
      <div className="rounded-md border border-[#333333] flex-1 h-full flex flex-col">
        {/* Table header */}
        <div className="bg-[#1e1e1e] sticky top-0 z-10">
          <div className="grid grid-cols-5 divide-x divide-[#333333]">
            <div className="px-6 py-3 text-left text-xs font-medium text-gray-300 uppercase tracking-wider">
              {activeTab.toUpperCase()}
            </div>
            <div className="px-6 py-3 text-left text-xs font-medium text-gray-300 uppercase tracking-wider">
              NO. PROJ
            </div>
            <div className="px-6 py-3 text-left text-xs font-medium text-gray-300 uppercase tracking-wider">
              CLASSIFICATION
            </div>
            <div className="px-6 py-3 text-left text-xs font-medium text-gray-300 uppercase tracking-wider">
              DISTANCE
            </div>
            <div className="px-6 py-3 text-left text-xs font-medium text-gray-300 uppercase tracking-wider">
              MAP
            </div>
          </div>
        </div>
        
        {/* Table body - scrollable */}
        <div 
          className="flex-1 overflow-auto bg-[#121212] scroll-smooth" 
          ref={scrollContainerRef}
        >
          {isLoading ? (
            <div className="px-6 py-4 text-center text-gray-400">
              Loading {activeTab === 'ahj' ? 'AHJs' : 'utilities'}...
            </div>
          ) : error ? (
            <div className="px-6 py-4 text-center text-red-400">
              Error: {error}
            </div>
          ) : visibleItems.length === 0 ? (
            <div className="px-6 py-4 text-center text-gray-400">
              No {activeTab === 'ahj' ? 'AHJs' : 'utilities'} found
            </div>
          ) : (
            <div className="divide-y divide-[#333333]">
              {visibleItems.map((entity, index) => (
                <div 
                  key={`${entity.name}-${index}`}
                  className="grid grid-cols-5 hover:bg-[#1e1e1e] cursor-pointer"
                  onClick={() => onAddFilter(activeTab, entity.name)}
                >
                  <div className="px-6 py-4 whitespace-nowrap text-sm text-white overflow-hidden text-ellipsis">
                    <span className="truncate block">{entity.name}</span>
                  </div>
                  <div className="px-6 py-4 whitespace-nowrap text-sm text-white overflow-hidden text-ellipsis">
                    <span className="truncate block">{entity.projectCount}</span>
                  </div>
                  <div className="px-6 py-4 whitespace-nowrap text-sm text-white overflow-hidden">
                    <span className={`inline-block px-2 py-0.5 rounded text-xs font-medium ${getClassificationBadgeClass(entity.classification)}`}>
                      {entity.classification || 'Unknown'}
                    </span>
                  </div>
                  <div className="px-6 py-4 whitespace-nowrap text-sm text-white overflow-hidden text-ellipsis">
                    {entity.distance < Number.MAX_VALUE ? (
                      <span className="truncate block">{Math.round(entity.distance * 10) / 10} MILES</span>
                    ) : (
                      <span className="truncate block text-gray-500">Unknown</span>
                    )}
                  </div>
                  <div className="px-6 py-4 whitespace-nowrap text-right text-sm font-medium">
                    <button
                      onClick={(e) => {
                        e.stopPropagation();
                        onViewOnMap(entity.name, activeTab);
                      }}
                      className="text-gray-300 hover:text-white flex items-center justify-end"
                    >
                      <FiMapPin className="mr-1" />
                      View On Map
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
              {!isLoading && loadedCount >= entitiesWithProjects.length && entitiesWithProjects.length > 0 && (
                <div className="py-4 text-center text-gray-500 text-sm">
                  Showing all {entitiesWithProjects.length} {activeTab === 'ahj' ? 'AHJs' : 'utilities'}
                </div>
              )}
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

export default EntityListView;
