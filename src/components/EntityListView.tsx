import React, { useState, useEffect, useRef, useMemo, useCallback } from 'react';
import { FiMapPin } from 'react-icons/fi';
import { Project, ProjectFilter } from '@/utils/types';
import { useData } from '@/contexts/DataContext';
import EntityListItem from './EntityListItem';
import { formatDistance } from '@/utils/formatters';
import { getClassificationBadgeClass } from '@/utils/classificationColors';
import EmptyState from './EmptyState';

interface EntityListViewProps {
  onViewOnMap?: (entityId: string, entityType: 'ahj' | 'utility') => void;
}

// Import the EntityData type from useEntities to ensure consistency
import { EntityData } from '@/hooks/useEntities';

const EntityListView = ({ onViewOnMap }: EntityListViewProps): React.ReactNode => {
  // State for loaded items count (for infinite scrolling)
  const [ahjLoadedCount, setAhjLoadedCount] = useState(20);
  const [utilityLoadedCount, setUtilityLoadedCount] = useState(20);
  
  // Scroll container refs for both lists
  const ahjScrollContainerRef = useRef<HTMLDivElement>(null);
  const utilityScrollContainerRef = useRef<HTMLDivElement>(null);
  
  // Use DataContext for all data and filter state
  const { 
    projects,
    ahjs: allAhjs, 
    utilities: allUtilities,
    filters,
    isLoading,
    error,
    addFilter,
    removeFilter,
    userLocation // Get user location from DataContext
  } = useData();
  // console.log('ENTITY PAGE processed AHJs', allAhjs);
  // console.log('ENTITY PAGE processed Utilities', allUtilities);
  // Get project entity IDs for reference (used for debugging only)
  const projectAhjIds = useMemo(() => 
    new Set(projects.map(p => p.ahj?.id).filter(Boolean)), 
    [projects]
  );
  
  const projectUtilityIds = useMemo(() => 
    new Set(projects.map(p => p.utility?.id).filter(Boolean)), 
    [projects]
  );
  
  // IMPORTANT: Use the already filtered entities from DataContext directly
  // The DataContext already applies proper filtering based on:
  // 1. Project filters (when no entity-specific filters exist)
  // 2. Entity-specific filters (when they exist)
  
  // Log filtering status for debugging
  // console.log('EntityListView - Filter status:', 
  //             'Project filters:', filters.projectFilters.length, 
  //             'Entity filters:', filters.entityFilters.length);
  // console.log('EntityListView - Entities from DataContext:', 
  //             'AHJs:', allAhjs.length, 
  //             'Utilities:', allUtilities.length);
  
  // Debug filter structure
  // if (filters.entityFilters.length > 0) {
  //   console.log('FILTER DEBUG: Entity filters:', filters.entityFilters);
  // }
  
  // if (filters.projectFilters.length > 0) {
  //   console.log('FILTER DEBUG: Project filters:', filters.projectFilters);
  // }
  
  // Use the already filtered entities directly
  const ahjs = allAhjs;
  const utilities = allUtilities;
  
  // Log data received by EntityListView component
  useEffect(() => {
    // console.log('===== ENTITYLISTVIEW COMPONENT DATA =====');
    // console.log('Projects received:', projects.length);
    // console.log('Processed AHJs received:', allAhjs.length);
    // console.log('Processed Utilities received:', allUtilities.length);
    // console.log('Is Loading:', isLoading);
    // console.log('Error:', error);
    // console.log('Filters:', filters);
    
    // Check if data is still loading
    if (isLoading) {
      // console.log('Data is still loading, waiting for data to be ready');
    }
    
    // Debug entity data structure
    if (allAhjs.length > 0) {
      // console.log('Sample processed AHJ structure:', allAhjs[0]);
    } else {
      // console.log('No AHJs available at all');
    }
    
    if (allUtilities.length > 0) {
      // console.log('Sample processed Utility structure:', allUtilities[0]);
    } else {
      //console.log('No Utilities available at all');
    }
    
    // Debug project entity references
    if (projects.length > 0) {
      //console.log('Sample Project AHJ reference:', projects[0].ahj);
      //console.log('Sample Project Utility reference:', projects[0].utility);
    }
    
    // Log the actual displayed entities (filtered entities)
    //console.log('AHJs to be displayed:', ahjs.length);
    //console.log('Utilities to be displayed:', utilities.length);
    
    //console.log('===== END ENTITYLISTVIEW COMPONENT DATA =====');
  }, [projects, allAhjs, allUtilities, filters, isLoading, error, ahjs, utilities]);
  
  // Helper function to get related entities
  const getRelatedUtilities = useCallback((ahjId: string) => {
    return utilities.filter((utility: EntityData) => {
      return projects.some(p => p.ahj?.id === ahjId && p.utility?.id === utility.id);
    });
  }, [utilities, projects]);
  
  const getRelatedAhjs = useCallback((utilityId: string) => {
    return ahjs.filter((ahj: EntityData) => {
      return projects.some(p => p.utility?.id === utilityId && p.ahj?.id === ahj.id);
    });
  }, [ahjs, projects]);
  
  // Helper function to calculate distances between coordinates
  const calculateDistance = (lat1: number, lon1: number, lat2: number, lon2: number): number => {
    if (!lat1 || !lon1 || !lat2 || !lon2) return Infinity;
    
    // Haversine formula for distance calculation
    const R = 6371; // Radius of the earth in km
    const dLat = (lat2 - lat1) * Math.PI / 180;
    const dLon = (lon2 - lon1) * Math.PI / 180;
    const a = 
      Math.sin(dLat/2) * Math.sin(dLat/2) +
      Math.cos(lat1 * Math.PI / 180) * Math.cos(lat2 * Math.PI / 180) * 
      Math.sin(dLon/2) * Math.sin(dLon/2);
    const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1-a)); 
    const d = R * c; // Distance in km
    return d;
  };
  
  // No need to calculate distances here anymore as it's handled in DataContext
  // Just log that we're using pre-calculated distances
  // useEffect(() => {
  //   if (userLocation) {
  //     console.log('EntityListView: Using pre-calculated distances from DataContext');
  //   }
  // }, [userLocation]);
  
  // Use the already filtered and sorted entities directly from DataContext
  // No additional sorting needed as DataContext now handles all sorting logic
  const filteredAhjs = useMemo(() => {
    return ahjs; // Already sorted by DataContext
  }, [ahjs]);
  
  const filteredUtilities = useMemo(() => {
    return utilities; // Already sorted by DataContext
  }, [utilities]);
  
  // Limit displayed entities for infinite scrolling
  const visibleAhjs = useMemo(() => 
    filteredAhjs.slice(0, ahjLoadedCount),
    [filteredAhjs, ahjLoadedCount]
  );
  
  const visibleUtilities = useMemo(() => 
    filteredUtilities.slice(0, utilityLoadedCount),
    [filteredUtilities, utilityLoadedCount]
  );
  
  // Determine which entities are highlighted based on filters
  const highlightedAhjId = useMemo(() => {
    const ahjFilter = filters.entityFilters.find(f => 
      f.type === 'ahj' && f.filterSource === 'entity-selection'
    );
    return ahjFilter?.entityId || null;
  }, [filters.entityFilters]);
  
  const highlightedUtilityId = useMemo(() => {
    const utilityFilter = filters.entityFilters.find(f => 
      f.type === 'utility' && f.filterSource === 'entity-selection'
    );
    return utilityFilter?.entityId || null;
  }, [filters.entityFilters]);
  
  // Handle entity selection
  const handleAhjSelect = (ahj: EntityData) => {
    console.log('ENTITY SELECTION DEBUG: Selecting AHJ', {
      id: ahj.id,
      name: ahj.name,
      projectCount: ahj.projectCount,
      relatedUtilityCount: ahj.relatedUtilityCount,
      relatedUtilityIds: ahj.relatedUtilityIds
    });
    
    // Check if this entity is already highlighted via a filter
    const isAlreadyFiltered = highlightedAhjId === ahj.id;
    console.log('ENTITY SELECTION DEBUG: Is already filtered?', isAlreadyFiltered, 'Highlighted ID:', highlightedAhjId);
    
    // Log current filter state before making changes
    console.log('ENTITY SELECTION DEBUG: Current filters before change:', {
      entityFilters: filters.entityFilters.map(f => ({
        id: f.id,
        type: f.type,
        entityType: f.entityType,
        entityId: f.entityId,
        value: f.value,
        filterSource: f.filterSource
      })),
      projectFilters: filters.projectFilters.length
    });
    
    if (isAlreadyFiltered) {
      // If already filtered, find and remove the filter
      const existingFilter = filters.entityFilters.find(f => 
        (f.type === 'ahj' || f.entityType === 'ahj') && 
        ((f.filterSource === 'entity-selection' && f.entityId === ahj.id) ||
         (f.value === ahj.name))
      );
      
      console.log('ENTITY SELECTION DEBUG: Found existing filter to remove:', existingFilter);
      
      if (existingFilter) {
        // Use removeFilter to properly remove the filter
        removeFilter(existingFilter.id || '', true); // Always true for entity filters
        console.log(`ENTITY SELECTION DEBUG: Deselected AHJ ${ahj.id}, removing filter ${existingFilter.id}`);
      }
    } else {
      // If selecting, add an entity-selection filter
      const newFilter: ProjectFilter = {
        type: 'ahj', // This is a valid type according to ProjectFilter
        value: ahj.name,
        label: `AHJ: ${ahj.name}`,
        filterSource: 'entity-selection',
        entityId: ahj.id,
        entityType: 'ahj',
        metadata: {
          latitude: ahj.latitude,
          longitude: ahj.longitude,
          classification: ahj.classification
        }
      };
      
      console.log('ENTITY SELECTION DEBUG: Adding new filter:', newFilter);
      addFilter(newFilter);
      console.log(`ENTITY SELECTION DEBUG: Selected AHJ ${ahj.id}, added filter`);
    }
  };
  
  const handleUtilitySelect = (utility: EntityData) => {
    console.log('ENTITY SELECTION DEBUG: Selecting Utility', {
      id: utility.id,
      name: utility.name,
      projectCount: utility.projectCount,
      relatedAhjCount: utility.relatedAhjCount,
      relatedAhjIds: utility.relatedAhjIds
    });
    
    // Check if this entity is already highlighted via a filter
    const isAlreadyFiltered = highlightedUtilityId === utility.id;
    console.log('ENTITY SELECTION DEBUG: Is already filtered?', isAlreadyFiltered, 'Highlighted ID:', highlightedUtilityId);
    
    // Log current filter state before making changes
    console.log('ENTITY SELECTION DEBUG: Current filters before change:', {
      entityFilters: filters.entityFilters.map(f => ({
        id: f.id,
        type: f.type,
        entityType: f.entityType,
        entityId: f.entityId,
        value: f.value,
        filterSource: f.filterSource
      })),
      projectFilters: filters.projectFilters.length
    });
    
    if (isAlreadyFiltered) {
      // If already filtered, find and remove the filter
      const existingFilter = filters.entityFilters.find(f => 
        (f.type === 'utility' || f.entityType === 'utility') && 
        ((f.filterSource === 'entity-selection' && f.entityId === utility.id) ||
         (f.value === utility.name))
      );
      
      console.log('ENTITY SELECTION DEBUG: Found existing filter to remove:', existingFilter);
      
      if (existingFilter) {
        // Use removeFilter to properly remove the filter
        removeFilter(existingFilter.id || '', true); // Always true for entity filters
        console.log(`ENTITY SELECTION DEBUG: Deselected Utility ${utility.id}, removing filter ${existingFilter.id}`);
      }
    } else {
      // If selecting, add an entity-selection filter
      const newFilter: ProjectFilter = {
        type: 'utility', // This is a valid type according to ProjectFilter
        value: utility.name,
        label: `Utility: ${utility.name}`,
        filterSource: 'entity-selection',
        entityId: utility.id,
        entityType: 'utility',
        metadata: {
          latitude: utility.latitude,
          longitude: utility.longitude,
          classification: utility.classification
        }
      };
      
      console.log('ENTITY SELECTION DEBUG: Adding new filter:', newFilter);
      addFilter(newFilter);
      console.log(`ENTITY SELECTION DEBUG: Selected Utility ${utility.id}, added filter`);
    }
  };
  
  // Handle scroll event for AHJ list
  useEffect(() => {
    const handleScroll = () => {
      if (!ahjScrollContainerRef.current) return;
      
      const { scrollTop, scrollHeight, clientHeight } = ahjScrollContainerRef.current;
      
      // Load more when scrolled to bottom (with a small buffer)
      if (scrollHeight - scrollTop <= clientHeight + 100) {
        setAhjLoadedCount(prev => prev + 10); // Load 10 more items
      }
    };
    
    const container = ahjScrollContainerRef.current;
    if (container) {
      container.addEventListener('scroll', handleScroll);
      
      return () => {
        container.removeEventListener('scroll', handleScroll);
      };
    }
  }, []);
  
  // Handle scroll event for Utility list
  useEffect(() => {
    const handleScroll = () => {
      if (!utilityScrollContainerRef.current) return;
      
      const { scrollTop, scrollHeight, clientHeight } = utilityScrollContainerRef.current;
      
      // Load more when scrolled to bottom (with a small buffer)
      if (scrollHeight - scrollTop <= clientHeight + 100) {
        setUtilityLoadedCount(prev => prev + 10); // Load 10 more items
      }
    };
    
    const container = utilityScrollContainerRef.current;
    if (container) {
      container.addEventListener('scroll', handleScroll);
      
      return () => {
        container.removeEventListener('scroll', handleScroll);
      };
    }
  }, []);
  
  // Update table height based on container size
  useEffect(() => {
    const updateTableHeight = () => {
      const ahjContainer = ahjScrollContainerRef.current;
      const utilityContainer = utilityScrollContainerRef.current;
      
      if (!ahjContainer || !utilityContainer) return;
      
      // Get the parent container height
      const parentHeight = ahjContainer.parentElement?.clientHeight || 0;
      
      if (parentHeight > 0) {
        // Calculate available height for tables
        // Subtract header height and some padding
        const availableHeight = parentHeight - 60; // 40px for header, 20px for padding
        
        // Set height on both containers
        ahjContainer.style.height = `${availableHeight}px`;
        utilityContainer.style.height = `${availableHeight}px`;
      }
    };
    
    // Initial update with a delay to ensure DOM is fully rendered
    const initialTimer = setTimeout(updateTableHeight, 200);
    
    // Run a second time after a longer delay to handle any layout shifts
    const secondTimer = setTimeout(updateTableHeight, 1000);
    
    // Also update on window resize
    window.addEventListener('resize', updateTableHeight);
    
    return () => {
      clearTimeout(initialTimer);
      clearTimeout(secondTimer);
      window.removeEventListener('resize', updateTableHeight);
    };
  }, []);
  
  // Render a single entity list (AHJ or Utility)
  const renderEntityList = (entityType: 'ahj' | 'utility') => {
    const entities = entityType === 'ahj' ? visibleAhjs : visibleUtilities;
    const highlightedId = entityType === 'ahj' ? highlightedAhjId : highlightedUtilityId;
    const handleSelect = entityType === 'ahj' ? handleAhjSelect : handleUtilitySelect;
    const emptyTitle = entityType === 'ahj' ? 'No AHJs Found' : 'No Utilities Found';
    const emptyMessage = 'Try adjusting your filters to see more results.';
    
    if (isLoading) {
      return (
        <div className="flex items-center justify-center h-full">
          <div className="text-gray-400">Loading...</div>
        </div>
      );
    }
    
    if (error) {
      return (
        <div className="flex items-center justify-center h-full">
          <div className="text-red-500">Error loading data: {error}</div>
        </div>
      );
    }
    
    if (entities.length === 0) {
      return (
        <div className="flex items-center justify-center h-full p-4">
          <EmptyState 
            title={emptyTitle} 
            message={emptyMessage}
            icon={entityType === 'ahj' ? 'building' : 'bolt'}
          />
        </div>
      );
    }
    
    return (
      <div className="grid grid-cols-1 gap-2 p-2">
        {entities.map((entity: EntityData) => {
          // Ensure entity has all required properties
          const completeEntity: EntityData = {
            ...entity,
            // Make sure all required properties are set
            projectCount: entity.projectCount ?? 0,
            distance: entity.distance ?? Number.MAX_VALUE // Default distance if not provided
          };
          
          return (
            <EntityListItem
              key={entity.id}
              entity={completeEntity}
              isSelected={entity.id === highlightedId}
              onSelect={() => handleSelect(entity)}
              onViewOnMap={onViewOnMap ? () => onViewOnMap(entity.id, entityType) : undefined}
              entityType={entityType}
            />
          );
        })}

      </div>
    );
  };

  // Render the main component with side-by-side AHJ and Utility lists
  return (
    <div className="w-full h-full flex flex-col">
      {/* Header with tabs */}
      <div className="flex bg-gray-800 border-b border-gray-700">
        <div className="w-1/2 py-2 px-4 font-medium text-center border-r border-gray-700">
          AHJs ({filteredAhjs.length})
          <div className="text-xs text-gray-400">
            Processed: {allAhjs.length} | Filtered: {ahjs.length}
          </div>
        </div>
        <div className="w-1/2 py-2 px-4 font-medium text-center">
          Utilities ({filteredUtilities.length})
          <div className="text-xs text-gray-400">
            Processed: {allUtilities.length} | Filtered: {utilities.length}
          </div>
        </div>
      </div>
      
      {/* Content area with two scrollable lists */}
      <div className="flex flex-grow overflow-hidden">
        {/* AHJ List */}
        <div 
          ref={ahjScrollContainerRef}
          className="w-1/2 overflow-y-auto border-r border-gray-700"
        >
          {renderEntityList('ahj')}
        </div>
        
        {/* Utility List */}
        <div 
          ref={utilityScrollContainerRef}
          className="w-1/2 overflow-y-auto"
        >
          {renderEntityList('utility')}
        </div>
      </div>
    </div>
  );
};

export default EntityListView;
