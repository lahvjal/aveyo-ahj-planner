import React, { useState, useEffect, useRef, useMemo, useCallback, TouchEvent } from 'react';
import { FiMapPin, FiArrowLeft, FiArrowRight } from 'react-icons/fi';
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

const EntityListView = ({ onViewOnMap }: EntityListViewProps): React.ReactElement => {
  // State for active tab in mobile view
  const [activeTab, setActiveTab] = useState<'ahj' | 'utility'>('ahj');
  
  // State for loaded items count (for infinite scrolling)
  const [ahjLoadedCount, setAhjLoadedCount] = useState(10000); // Set to max rows from Supabase
  const [utilityLoadedCount, setUtilityLoadedCount] = useState(10000); // Set to max rows from Supabase
  
  // State for touch events (swipe functionality)
  const [touchStart, setTouchStart] = useState<number | null>(null);
  const [touchEnd, setTouchEnd] = useState<number | null>(null);
  
  // Minimum swipe distance (in px)
  const minSwipeDistance = 50;
  
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
  // Get project entity IDs for reference (used for debugging only)
  const projectAhjIds = useMemo(() => 
    new Set(projects.map(p => p.ahj?.id).filter(Boolean)), 
    [projects]
  );
  
  const projectUtilityIds = useMemo(() => 
    new Set(projects.map(p => p.utility?.id).filter(Boolean)), 
    [projects]
  );
  
  // Use the already filtered entities directly
  // These are already filtered by the DataContext which is hydrated with server data
  const ahjs = allAhjs || [];
  const utilities = allUtilities || [];
  
  // Add focused logging for coordinate data analysis
  useEffect(() => {
    
    // Log AHJ coordinate data
    if (ahjs && ahjs.length > 0) {
      const ahjsWithCoordinates = ahjs.filter(ahj => {
        const coords = (ahj as any).coordinates;
        return coords && 
               typeof coords.latitude === 'number' && 
               typeof coords.longitude === 'number';
      });
    }
    
    // Log Utility coordinate data
    if (utilities && utilities.length > 0) {
      const utilitiesWithCoordinates = utilities.filter(utility => {
        const coords = (utility as any).coordinates;
        return coords && 
               typeof coords.latitude === 'number' && 
               typeof coords.longitude === 'number';
      });
    }
  }, [ahjs, utilities]);
  
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
  
  // Use the already filtered and sorted entities directly from DataContext
  // No additional sorting needed as DataContext now handles all sorting logic
  const filteredAhjs = useMemo(() => {
    // Ensure we have data before returning
    return ahjs && ahjs.length > 0 ? ahjs : []; // Already sorted by DataContext
  }, [ahjs]);
  
  const filteredUtilities = useMemo(() => {
    // Ensure we have data before returning
    return utilities && utilities.length > 0 ? utilities : []; // Already sorted by DataContext
  }, [utilities]);
  
  // Limit displayed entities for infinite scrolling
  const visibleAhjs = useMemo(() => {
    // Ensure we load at least 50 items initially for better UX
    const initialCount = Math.max(50, ahjLoadedCount);
    return filteredAhjs.slice(0, initialCount);
  }, [filteredAhjs, ahjLoadedCount]);
  
  const visibleUtilities = useMemo(() => {
    // Ensure we load at least 50 items initially for better UX
    const initialCount = Math.max(50, utilityLoadedCount);
    return filteredUtilities.slice(0, initialCount);
  }, [filteredUtilities, utilityLoadedCount]);
  
  // Determine which entities are highlighted based on filters
  const highlightedAhjId = useMemo(() => {
    const ahjFilter = filters.filters.find(f => 
      f.type === 'ahj' && f.filterSource === 'entity-selection'
    );
    return ahjFilter?.entityId || null;
  }, [filters.filters]);

  const highlightedUtilityId = useMemo(() => {
    const utilityFilter = filters.filters.find(f => 
      f.type === 'utility' && f.filterSource === 'entity-selection'
    );
    return utilityFilter?.entityId || null;
  }, [filters.filters]);
  
  // Handle AHJ selection
  const handleAhjSelect = (ahj: EntityData) => {
    // Check if this entity is already highlighted via a filter
    const isAlreadyFiltered = highlightedAhjId === ahj.id;
    
    if (isAlreadyFiltered) {
      // If already filtered, find and remove the filter
      const existingFilter = filters.filters.find(f => 
        (f.type === 'ahj' || f.entityType === 'ahj') && 
        ((f.filterSource === 'entity-selection' && f.entityId === ahj.id) ||
        (f.value === ahj.name))
      );
      
      if (existingFilter) {
        // Use removeFilter to properly remove the filter
        removeFilter(existingFilter.id || '');
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
      
      addFilter(newFilter);
    }
  };

  // Handle Utility selection
  const handleUtilitySelect = (utility: EntityData) => {
    // Check if this entity is already highlighted via a filter
    const isAlreadyFiltered = highlightedUtilityId === utility.id;
    
    if (isAlreadyFiltered) {
      // If already filtered, find and remove the filter
      const existingFilter = filters.filters.find(f => 
        (f.type === 'utility' || f.entityType === 'utility') && 
        ((f.filterSource === 'entity-selection' && f.entityId === utility.id) ||
        (f.value === utility.name))
      );
      
      if (existingFilter) {
        // Use removeFilter to properly remove the filter
        removeFilter(existingFilter.id || '');
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
      
      addFilter(newFilter);
    }
  };
  
  // Handle scroll event for AHJ list
  useEffect(() => {
    const handleScroll = () => {
      if (!ahjScrollContainerRef.current) return;
      
      const { scrollTop, scrollHeight, clientHeight } = ahjScrollContainerRef.current;
      
      // Load more when scrolled to bottom (with a smaller buffer to ensure it triggers)
      if (scrollHeight - scrollTop <= clientHeight + 200) {
        setAhjLoadedCount(prev => prev + 20); // Load 20 more items at once for better UX
      }
    };
    
    const container = ahjScrollContainerRef.current;
    if (container) {
      container.addEventListener('scroll', handleScroll);
      
      // Initial check to load more items if needed
      setTimeout(() => {
        handleScroll();
      }, 100);
      
      return () => {
        container.removeEventListener('scroll', handleScroll);
      };
    }
  }, [filteredAhjs.length]); // Re-attach when the filtered list changes
  
  // Handle scroll event for Utility list
  useEffect(() => {
    const handleScroll = () => {
      if (!utilityScrollContainerRef.current) return;
      
      const { scrollTop, scrollHeight, clientHeight } = utilityScrollContainerRef.current;
      
      // Load more when scrolled to bottom (with a smaller buffer to ensure it triggers)
      if (scrollHeight - scrollTop <= clientHeight + 200) {
        setUtilityLoadedCount(prev => prev + 20); // Load 20 more items at once for better UX
      }
    };
    
    const container = utilityScrollContainerRef.current;
    if (container) {
      container.addEventListener('scroll', handleScroll);
      
      // Initial check to load more items if needed
      setTimeout(() => {
        handleScroll();
      }, 100);
      
      return () => {
        container.removeEventListener('scroll', handleScroll);
      };
    }
  }, [filteredUtilities.length]); // Re-attach when the filtered list changes
  
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
  
  // Handle loading state - only show if we don't have any entity data yet
  if (isLoading && (!ahjs || ahjs.length === 0) && (!utilities || utilities.length === 0)) {
    return (
      <div className="flex items-center justify-center h-full p-4">
        <div className="text-gray-400">Loading entities...</div>
      </div>
    );
  }
  
  // Handle error state
  if (error) {
    return (
      <div className="flex items-center justify-center h-full p-4">
        <div className="text-red-500">Error loading entities: {error}</div>
      </div>
    );
  }
  
  // Show empty state if we have no entities after filtering
  if ((!filteredAhjs || filteredAhjs.length === 0) && (!filteredUtilities || filteredUtilities.length === 0)) {
    return (
      <div className="flex flex-col items-center justify-center h-full p-4">
        <EmptyState
          title="No Entities Found"
          message="Try adjusting your filters or search criteria."
        />
      </div>
    );
  }
  
  // Render a single entity list (AHJ or Utility)
  const renderEntityList = (entityType: 'ahj' | 'utility') => {
    const entities = entityType === 'ahj' ? visibleAhjs : visibleUtilities;
    const highlightedId = entityType === 'ahj' ? highlightedAhjId : highlightedUtilityId;
    const handleSelect = entityType === 'ahj' ? handleAhjSelect : handleUtilitySelect;
    const emptyTitle = entityType === 'ahj' ? 'No AHJs Found' : 'No Utilities Found';
    const emptyMessage = 'Try adjusting your filters to see more results.';
    
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
              entityType={entityType}
            />
          );
        })}

      </div>
    );
  };

  // Handle touch events for swipe functionality
  const onTouchStart = (e: TouchEvent<HTMLDivElement>) => {
    setTouchEnd(null); // Reset touch end
    setTouchStart(e.targetTouches[0].clientX);
  };

  const onTouchMove = (e: TouchEvent<HTMLDivElement>) => {
    setTouchEnd(e.targetTouches[0].clientX);
  };

  const onTouchEnd = () => {
    if (!touchStart || !touchEnd) return;
    
    const distance = touchStart - touchEnd;
    const isLeftSwipe = distance > minSwipeDistance;
    const isRightSwipe = distance < -minSwipeDistance;
    
    if (isLeftSwipe && activeTab === 'ahj') {
      setActiveTab('utility');
    } else if (isRightSwipe && activeTab === 'utility') {
      setActiveTab('ahj');
    }
    
    // Reset touch values
    setTouchStart(null);
    setTouchEnd(null);
  };
  
  // Render the main component with responsive design
  return (
    <div 
      className="w-full h-full flex flex-col"
      onTouchStart={onTouchStart}
      onTouchMove={onTouchMove}
      onTouchEnd={onTouchEnd}
    >
      {/* Header with tabs - responsive design */}
      <div className="flex bg-gray-800 border-b border-gray-700">
        {/* Mobile tabs */}
        <button
          onClick={() => setActiveTab('ahj')}
          className={`w-1/2 py-3 px-4 font-medium text-center ${activeTab === 'ahj' ? 'text-blue-500 border-b-2 border-blue-500' : 'text-gray-400'}`}
        >
          AHJs ({filteredAhjs.length})
        </button>
        <button
          onClick={() => setActiveTab('utility')}
          className={`w-1/2 py-3 px-4 font-medium text-center ${activeTab === 'utility' ? 'text-blue-500 border-b-2 border-blue-500' : 'text-gray-400'}`}
        >
          Utilities ({filteredUtilities.length})
        </button>
      </div>
      
      {/* Content area with responsive lists */}
      <div className="flex-grow overflow-hidden">
        {/* Swipe indicator for mobile */}
        <div className="md:hidden flex justify-center items-center text-gray-500 text-xs py-1">
          <FiArrowLeft className="mr-1" /> Swipe to switch lists <FiArrowRight className="ml-1" />
        </div>
        
        {/* Desktop: Side-by-side lists */}
        <div className="hidden md:flex h-full">
          {/* AHJ List */}
          <div 
            ref={ahjScrollContainerRef}
            className="w-1/2 overflow-y-auto border-r border-gray-700 max-h-full"
            style={{ overscrollBehavior: 'contain' }}
          >
            <div className="h-full pb-20">
              {renderEntityList('ahj')}
            </div>
          </div>
          
          {/* Utility List */}
          <div 
            ref={utilityScrollContainerRef}
            className="w-1/2 overflow-y-auto max-h-full"
            style={{ overscrollBehavior: 'contain' }}
          >
            <div className="h-full pb-20">
              {renderEntityList('utility')}
            </div>
          </div>
        </div>
        
        {/* Mobile: Single list with tabs */}
        <div className="md:hidden h-full">
          {/* AHJ List - shown when AHJ tab is active */}
          <div 
            ref={ahjScrollContainerRef}
            className={`h-full overflow-y-auto ${activeTab === 'ahj' ? 'block' : 'hidden'}`}
            style={{ overscrollBehavior: 'contain' }}
          >
            <div className="pb-20">
              {renderEntityList('ahj')}
            </div>
          </div>
          
          {/* Utility List - shown when Utility tab is active */}
          <div 
            ref={utilityScrollContainerRef}
            className={`h-full overflow-y-auto ${activeTab === 'utility' ? 'block' : 'hidden'}`}
            style={{ overscrollBehavior: 'contain' }}
          >
            <div className="pb-20">
              {renderEntityList('utility')}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default EntityListView;
