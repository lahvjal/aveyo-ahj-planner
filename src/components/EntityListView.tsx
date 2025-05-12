import React, { useState, useEffect, useRef, useMemo } from 'react';
import { FiMapPin } from 'react-icons/fi';
import { Project, ProjectFilter } from '@/utils/types';
import { useEntities, EntityData } from '@/hooks/useEntities';
import { useEntityRelationships } from '@/hooks/useEntityRelationships';
import EntityListItem from './EntityListItem';
import { formatDistance } from '@/utils/formatters';
import { getClassificationBadgeClass } from '@/utils/classificationColors';
import EmptyState from './EmptyState';

interface EntityListViewProps {
  projects: Project[];
  userLocation?: { latitude: number; longitude: number } | null;
  onViewOnMap: (entityName: string, entityType: 'ahj' | 'utility') => void;
  onAddFilter: (filter: ProjectFilter) => void;
  onRemoveFilter: (filter: ProjectFilter) => void; // Add prop for removing filters
  filters?: ProjectFilter[]; // Add filters prop to receive active filters
}

const EntityListView: React.FC<EntityListViewProps> = ({
  projects,
  userLocation,
  onViewOnMap,
  onAddFilter,
  onRemoveFilter,
  filters = []
}) => {
  // We no longer need direct selection state variables as we're using filter panel exclusively
  
  // State for loaded items count (for infinite scrolling)
  const [ahjLoadedCount, setAhjLoadedCount] = useState(20);
  const [utilityLoadedCount, setUtilityLoadedCount] = useState(20);
  
  // Scroll container refs for both lists
  const ahjScrollContainerRef = useRef<HTMLDivElement>(null);
  const utilityScrollContainerRef = useRef<HTMLDivElement>(null);
  
  // Use the entities hook to fetch ALL AHJ and Utility data directly from Supabase
  // We'll use this data as a base, but filter it based on the filtered projects
  const { ahjs: allAhjs, utilities: allUtilities, isLoading, error, calculateDistances } = useEntities();
  
  // Create filtered lists of entities based on the filtered projects
  // This ensures that panel filters affect which entities are shown
  const projectAhjIds = useMemo(() => new Set(projects.map(p => p.ahj?.id).filter(Boolean)), [projects]);
  const projectUtilityIds = useMemo(() => new Set(projects.map(p => p.utility?.id).filter(Boolean)), [projects]);
  
  // Filter the entities to only include those that appear in the filtered projects
  const ahjs = useMemo(() => allAhjs.filter(ahj => projectAhjIds.has(ahj.id)), [allAhjs, projectAhjIds]);
  const utilities = useMemo(() => allUtilities.filter(utility => projectUtilityIds.has(utility.id)), [allUtilities, projectUtilityIds]);
  
  // Use the entity relationships hook to track connections between AHJs and Utilities
  // We pass ALL projects to ensure we have complete relationship data
  const { getRelatedUtilities, getRelatedAhjs } = useEntityRelationships(projects);
  
  // Helper functions to identify entities that match active filters
  const getHighlightedAhjId = useMemo(() => {
    // Look for entity-selection filters or manual filters of type 'ahj'
    const ahjFilter = filters.find(f => f.type === 'ahj');
    if (ahjFilter) {
      // If it's an entity-selection filter, use the entityId
      if (ahjFilter.filterSource === 'entity-selection' && ahjFilter.entityId) {
        return ahjFilter.entityId;
      }
      // For manual filters, find the AHJ by name
      const matchingAhj = ahjs.find(ahj => ahj.name === ahjFilter.value);
      return matchingAhj?.id || null;
    }
    return null;
  }, [filters, ahjs]);

  const getHighlightedUtilityId = useMemo(() => {
    // Look for entity-selection filters or manual filters of type 'utility'
    const utilityFilter = filters.find(f => f.type === 'utility');
    if (utilityFilter) {
      // If it's an entity-selection filter, use the entityId
      if (utilityFilter.filterSource === 'entity-selection' && utilityFilter.entityId) {
        return utilityFilter.entityId;
      }
      // For manual filters, find the utility by name
      const matchingUtility = utilities.find(utility => utility.name === utilityFilter.value);
      return matchingUtility?.id || null;
    }
    return null;
  }, [filters, utilities]);
  
  // Log relationship status for debugging
  useEffect(() => {
    console.log(`[EntityListView] Using relationships from ${projects.length} projects`);
    
    // Log highlighted entities from filters
    if (getHighlightedAhjId) {
      const relatedUtilities = getRelatedUtilities(getHighlightedAhjId);
      console.log(`[EntityListView] Highlighted AHJ ${getHighlightedAhjId} has ${relatedUtilities?.size || 0} related utilities`);
    }
    if (getHighlightedUtilityId) {
      const relatedAhjs = getRelatedAhjs(getHighlightedUtilityId);
      console.log(`[EntityListView] Highlighted Utility ${getHighlightedUtilityId} has ${relatedAhjs?.size || 0} related AHJs`);
    }
  }, [projects, getRelatedUtilities, getRelatedAhjs, getHighlightedAhjId, getHighlightedUtilityId]);

  // Update distances when user location changes
  // Using a ref to track previous location to avoid unnecessary calculations
  const prevLocationRef = useRef<{ latitude: number; longitude: number } | null>(null);
  
  useEffect(() => {
    // Only calculate distances if the location has actually changed
    if (userLocation) {
      const locationChanged = !prevLocationRef.current || 
        prevLocationRef.current.latitude !== userLocation.latitude || 
        prevLocationRef.current.longitude !== userLocation.longitude;
      
      if (locationChanged) {
        console.log('[EntityListView] Calculating distances with user location:', userLocation);
        calculateDistances(userLocation);
        prevLocationRef.current = userLocation;
        
        // Debug: Log AHJs with coordinates
        console.log('[EntityListView] AHJs with coordinates:', 
          ahjs.filter(a => a.latitude && a.longitude)
            .map(a => ({ id: a.id, name: a.name, lat: a.latitude, lng: a.longitude, distance: a.distance }))
        );
      }
    }
  }, [userLocation, calculateDistances, ahjs]);
  
  // Filter utilities based on highlighted AHJ from filters
  const filteredUtilities = useMemo(() => {
    // Use highlighted AHJ from filters
    const targetAhjId = getHighlightedAhjId;
    
    if (!targetAhjId) return utilities; // Show already filtered utilities if no AHJ is highlighted
    
    const relatedUtilityIds = getRelatedUtilities(targetAhjId);
    if (!relatedUtilityIds || relatedUtilityIds.size === 0) return [];
    
    // Filter utilities by related IDs
    return utilities.filter(utility => relatedUtilityIds.has(utility.id));
  }, [utilities, getHighlightedAhjId, getRelatedUtilities]);
  
  // Filter AHJs based on highlighted utility from filters
  const filteredAhjs = useMemo(() => {
    // Use highlighted utility from filters
    const targetUtilityId = getHighlightedUtilityId;
    
    if (!targetUtilityId) return ahjs; // Show already filtered AHJs if no utility is highlighted
    
    const relatedAhjIds = getRelatedAhjs(targetUtilityId);
    if (!relatedAhjIds || relatedAhjIds.size === 0) return [];
    
    // Filter AHJs by related IDs
    return ahjs.filter(ahj => relatedAhjIds.has(ahj.id));
  }, [ahjs, getHighlightedUtilityId, getRelatedAhjs]);
  
  // Visible items for both lists (with pagination)
  const visibleAhjs = useMemo(() => {
    return filteredAhjs.slice(0, ahjLoadedCount);
  }, [filteredAhjs, ahjLoadedCount]);
  
  const visibleUtilities = useMemo(() => {
    return filteredUtilities.slice(0, utilityLoadedCount);
  }, [filteredUtilities, utilityLoadedCount]);
  
  // Handle entity selection - now only adds/removes filters in the panel
  const handleAhjSelect = (ahj: EntityData) => {
    // Check if this entity is already highlighted via a filter
    const isAlreadyFiltered = getHighlightedAhjId === ahj.id;
    
    // We no longer manage direct selection state, only filter panel filters
    if (isAlreadyFiltered) {
      // If already filtered, find and remove the filter
      const existingFilter = filters.find(f => 
        f.type === 'ahj' && 
        f.filterSource === 'entity-selection' && 
        f.entityId === ahj.id
      );
      
      if (existingFilter) {
        // Use onRemoveFilter to properly remove the filter
        onRemoveFilter(existingFilter);
        console.log(`[EntityListView] Deselected AHJ ${ahj.id}, removing filter`);
      }
    } else {
      // If selecting, add an entity-selection filter
      onAddFilter({
        type: 'ahj',
        value: ahj.name,
        filterSource: 'entity-selection',
        entityId: ahj.id,
        metadata: {
          latitude: ahj.latitude,
          longitude: ahj.longitude,
          classification: ahj.classification
        }
      });
      console.log(`[EntityListView] Selected AHJ ${ahj.id}, added filter`);
    }
  };
  
  const handleUtilitySelect = (utility: EntityData) => {
    // Check if this entity is already highlighted via a filter
    const isAlreadyFiltered = getHighlightedUtilityId === utility.id;
    
    // We no longer manage direct selection state, only filter panel filters
    if (isAlreadyFiltered) {
      // If already filtered, find and remove the filter
      const existingFilter = filters.find(f => 
        f.type === 'utility' && 
        f.filterSource === 'entity-selection' && 
        f.entityId === utility.id
      );
      
      if (existingFilter) {
        // Use onRemoveFilter to properly remove the filter
        onRemoveFilter(existingFilter);
        console.log(`[EntityListView] Deselected Utility ${utility.id}, removing filter`);
      }
    } else {
      // If selecting, add an entity-selection filter
      onAddFilter({
        type: 'utility',
        value: utility.name,
        filterSource: 'entity-selection',
        entityId: utility.id,
        metadata: {
          latitude: utility.latitude,
          longitude: utility.longitude,
          classification: utility.classification
        }
      });
      console.log(`[EntityListView] Selected Utility ${utility.id}, added filter`);
    }
  };
  
  // Handle scroll event for AHJ list
  useEffect(() => {
    const handleScroll = () => {
      if (!ahjScrollContainerRef.current || isLoading) return;
      
      const { scrollTop, scrollHeight, clientHeight } = ahjScrollContainerRef.current;
      
      // If scrolled near the bottom, load more items
      if (scrollHeight - scrollTop - clientHeight < 200) {
        if (filteredAhjs.length > ahjLoadedCount) {
          setAhjLoadedCount(prev => Math.min(prev + 10, filteredAhjs.length));
        }
      }
    };
    
    const container = ahjScrollContainerRef.current;
    if (container) {
      container.addEventListener('scroll', handleScroll);
      
      // Initial check
      setTimeout(handleScroll, 100);
    }
    
    return () => {
      if (container) {
        container.removeEventListener('scroll', handleScroll);
      }
    };
  }, [ahjLoadedCount, isLoading, filteredAhjs]);
  
  // Handle scroll event for Utility list
  useEffect(() => {
    const handleScroll = () => {
      if (!utilityScrollContainerRef.current || isLoading) return;
      
      const { scrollTop, scrollHeight, clientHeight } = utilityScrollContainerRef.current;
      
      // If scrolled near the bottom, load more items
      if (scrollHeight - scrollTop - clientHeight < 200) {
        if (filteredUtilities.length > utilityLoadedCount) {
          setUtilityLoadedCount(prev => Math.min(prev + 10, filteredUtilities.length));
        }
      }
    };
    
    const container = utilityScrollContainerRef.current;
    if (container) {
      container.addEventListener('scroll', handleScroll);
      
      // Initial check
      setTimeout(handleScroll, 100);
    }
    
    return () => {
      if (container) {
        container.removeEventListener('scroll', handleScroll);
      }
    };
  }, [utilityLoadedCount, isLoading, filteredUtilities]);
  
  // Set a fixed height style to ensure the table fills the available space
  useEffect(() => {
    const updateTableHeight = () => {
      if (!ahjScrollContainerRef.current || !utilityScrollContainerRef.current) return;
      
      // Get viewport height
      const viewportHeight = window.innerHeight;
      
      // Get container's position from the top of the viewport
      const ahjContainerRect = ahjScrollContainerRef.current.getBoundingClientRect();
      const containerTop = ahjContainerRect.top;
      
      // Calculate available height (viewport height minus container top position minus footer space)
      const bottomMargin = 40;
      const availableHeight = viewportHeight - containerTop - bottomMargin;
      
      // Apply the height to both containers - ensure minimum height of 400px
      const finalHeight = Math.max(400, availableHeight);
      
      ahjScrollContainerRef.current.style.height = `${finalHeight}px`;
      ahjScrollContainerRef.current.style.overflowY = 'auto';
      
      utilityScrollContainerRef.current.style.height = `${finalHeight}px`;
      utilityScrollContainerRef.current.style.overflowY = 'auto';
    };
    
    // Initial update with a delay to ensure DOM is fully rendered
    const initialTimer = setTimeout(updateTableHeight, 200);
    
    // Run a second time after a longer delay to handle any layout shifts
    const secondTimer = setTimeout(updateTableHeight, 500);
    
    // Update on resize
    window.addEventListener('resize', updateTableHeight);
    
    return () => {
      clearTimeout(initialTimer);
      clearTimeout(secondTimer);
      window.removeEventListener('resize', updateTableHeight);
    };
  }, []);
  
  // Render a single entity list (AHJ or Utility)
  const renderEntityList = (entityType: 'ahj' | 'utility') => {
    const isAhj = entityType === 'ahj';
    const entities = isAhj ? visibleAhjs : visibleUtilities;
    // We no longer use direct selection, only highlighted entities from filters
    const highlightedId = isAhj ? getHighlightedAhjId : getHighlightedUtilityId;
    const handleSelect = isAhj ? handleAhjSelect : handleUtilitySelect;
    const scrollRef = isAhj ? ahjScrollContainerRef : utilityScrollContainerRef;
    const totalCount = isAhj ? filteredAhjs.length : filteredUtilities.length;
    const loadedCount = isAhj ? ahjLoadedCount : utilityLoadedCount;
    
    return (
      <div className="h-full flex flex-col">
        {/* Table header */}
        <div className="bg-[#1e1e1e] sticky top-0 z-10">
          <div className="grid-cols-5-new divide-x divide-[#333333]">
            <div className="px-6 py-3 text-left text-xs font-medium text-gray-300 uppercase tracking-wider">
              {entityType.toUpperCase()}
            </div>
            <div className="px-6 py-3 text-center text-xs font-medium text-gray-300 uppercase tracking-wider">
              NO. PROJ
            </div>
            <div className="px-6 py-3 text-center text-xs font-medium text-gray-300 uppercase tracking-wider">
              CLASS
            </div>
            <div className="px-6 py-3 text-left text-xs font-medium text-gray-300 uppercase tracking-wider">
              DISTANCE
            </div>
            <div className="px-6 py-3 text-right text-xs font-medium text-gray-300 uppercase tracking-wider pr-6">
              MAP
            </div>
          </div>
        </div>
        
        {/* Table body - scrollable */}
        <div 
          className="overflow-y-auto bg-[#121212] scroll-smooth" 
          ref={scrollRef}
          style={{ minHeight: '400px', display: 'block' }}
        >
          {isLoading ? (
            <div className="px-6 py-4 text-center text-gray-400">
              Loading {entityType === 'ahj' ? 'AHJs' : 'utilities'}...
            </div>
          ) : error ? (
            <div className="px-6 py-4 text-center text-red-400">
              Error: {error}
            </div>
          ) : entities.length === 0 ? (
            <div className="px-6 py-4 text-center text-gray-400">
              {highlightedId ? 
                `No ${entityType === 'ahj' ? 'AHJs' : 'utilities'} related to the highlighted ${entityType === 'ahj' ? 'utility' : 'AHJ'}.` :
                `No ${entityType === 'ahj' ? 'AHJs' : 'utilities'} found.`
              }
              {/* Clear Selection button removed as we now use filter panel exclusively */}
            </div>
          ) : (
            <div className="divide-y divide-[#333333]">
              {entities.map((entity) => (
                <EntityListItem
                  key={entity.id}
                  entity={entity}
                  isSelected={false} // No longer using direct selection
                  isHighlighted={entity.id === highlightedId}
                  onSelect={handleSelect}
                  onViewOnMap={onViewOnMap}
                  entityType={entityType}
                />
              ))}
              
              {/* Loading indicator */}
              {isLoading && (
                <div className="py-4 text-center text-gray-400">
                  Loading more...
                </div>
              )}
              
              {/* End of list indicator */}
              {!isLoading && loadedCount >= totalCount && totalCount > 0 && (
                <div className="py-4 text-center text-gray-500 text-sm">
                  Showing all {totalCount} {entityType === 'ahj' ? 'AHJs' : 'utilities'}
                </div>
              )}
            </div>
          )}
        </div>
      </div>
    );
  };

  // Render the main component with side-by-side AHJ and Utility lists
  return (
    <div className="w-full h-full flex flex-col">
      
      {/* Side-by-side entity lists */}
      <div className="grid grid-cols-2 gap-4 flex-1">
        {/* AHJ List */}
        <div className="flex-1 h-full">
          <h2 className="text-xl font-bold text-white mb-4">AHJ</h2>
          <div className="rounded-md border border-[#333333] w-100% h-100%">
            {renderEntityList('ahj')}
          </div>
        </div>
        
        {/* Utility List */}
        <div className="flex-1 h-full">
          <h2 className="text-xl font-bold text-white mb-4">UTILITY</h2>
          <div className="rounded-md border border-[#333333] w-100% h-100%">
            {renderEntityList('utility')}
          </div>
        </div>
      </div>
      
      {/* Selection status and clear button - now based on filter panel filters */}
      {(getHighlightedAhjId || getHighlightedUtilityId) && (
        <div className="mt-4 p-2 bg-[#1e1e1e] rounded-md text-sm text-gray-300">
          {getHighlightedAhjId && (
            <p>Showing utilities that have projects with the highlighted AHJ</p>
          )}
          {getHighlightedUtilityId && (
            <p>Showing AHJs that have projects with the highlighted utility</p>
          )}
          <div className="flex mt-2">
            <button 
              onClick={() => {
                // Clear any highlighted entities by removing their filters
                const ahjFilter = filters.find(f => f.type === 'ahj' && f.filterSource === 'entity-selection');
                const utilityFilter = filters.find(f => f.type === 'utility' && f.filterSource === 'entity-selection');
                
                // If we have an AHJ filter and we can find the entity, remove it
                if (ahjFilter && ahjFilter.entityId) {
                  const highlightedEntity = ahjs.find(a => a.id === ahjFilter.entityId);
                  if (highlightedEntity) {
                    handleAhjSelect(highlightedEntity); // This will toggle/deselect
                  }
                }
                
                // If we have a utility filter and we can find the entity, remove it
                if (utilityFilter && utilityFilter.entityId) {
                  const highlightedEntity = utilities.find(u => u.id === utilityFilter.entityId);
                  if (highlightedEntity) {
                    handleUtilitySelect(highlightedEntity); // This will toggle/deselect
                  }
                }
              }}
              className="text-blue-400 hover:text-blue-300 text-xs"
            >
              Clear Selection
            </button>
          </div>
        </div>
      )}
    </div>
  );
};

export default EntityListView;
