/**
 * MapView Component
 * 
 * A comprehensive map view component that displays projects, AHJs, and utilities on a Mapbox GL map.
 * Provides interactive features like filtering, selection, and detailed views.
 */

import React, { useRef, useState, useEffect, useCallback } from 'react';
import 'mapbox-gl/dist/mapbox-gl.css';

// Import mapboxgl dynamically to prevent SSR issues
let mapboxgl: any;
if (typeof window !== 'undefined') {
  mapboxgl = require('mapbox-gl');
}
// Utility imports
import { Project, ProjectFilter } from '@/utils/types';
import { useAuth } from '@/utils/AuthContext';
import { useData } from '@/contexts/DataContext';
import { getClassificationMapColor, getClassificationBadgeClass } from '@/utils/classificationColors';
import { getMapboxToken } from '@/utils/mapbox';
import { mapQualificationStatus, isQualified } from '@/utils/qualificationStatus';

// Component imports
import ImprovedFilterPanel from './ImprovedFilterPanel';
import ToggleOption from './ToggleOption';
import EmptyState from './EmptyState';

/**
 * Component Interface
 */
interface MapViewProps {
  selectedProject: Project | null;
  onSelectProject?: (project: Project | null) => void;
}

/**
 * MapView Component
 */
const MapView: React.FC<MapViewProps> = ({
  selectedProject,
  onSelectProject,
}) => {
  //==========================================================================
  // DATA AND CONTEXT HOOKS
  //==========================================================================
  
  // Use DataContext for data and filters
  const { 
    projects, 
    ahjs, 
    utilities,
    filters,
    isLoading,
    error,
    addFilter,
    removeFilter,
    clearFilters,
    showOnlyMyProjects,
    toggleShowOnlyMyProjects,
    show45DayQualified,
    set45DayFilter,
    userLocation // Add userLocation from DataContext
  } = useData();
  
  // Auth context for user information
  const { userProfile, isAdmin } = useAuth();
  
  //==========================================================================
  // REFS
  //==========================================================================
  
  // Map and marker refs
  const mapContainer = useRef<HTMLDivElement>(null);
  const mapRef = useRef<mapboxgl.Map | null>(null);
  const projectMarkersRef = useRef<mapboxgl.Marker[]>([]);
  const ahjMarkersRef = useRef<mapboxgl.Marker[]>([]);
  const utilityMarkersRef = useRef<mapboxgl.Marker[]>([]);
  // Removed cardListRef as we no longer need project cards
  //==========================================================================
  // STATE
  //==========================================================================
  
  // Map position state
  const [lng, setLng] = useState(-111.8910); // Default to Utah
  const [lat, setLat] = useState(40.7608);
  const [zoom, setZoom] = useState(9);
  const [mapLoaded, setMapLoaded] = useState(false);
  
  // Project selection and display state
  const [localSelectedProject, setLocalSelectedProject] = useState<Project | null>(selectedProject);
  const [visibleProjects, setVisibleProjects] = useState<Project[]>([]);
  
  // Map interaction state
  const [mapMoved, setMapMoved] = useState(false);
  
  // Map movement control flags
  const [allowMapMovement, setAllowMapMovement] = useState<{
    initial: boolean; // Allow initial map setup movement
    selection: boolean; // Allow movement when selecting a project
    utility: boolean; // Allow movement when selecting a utility
  }>({
    initial: true, // Allow initial setup
    selection: true, // Allow movement when selecting a project
    utility: true, // Allow movement when selecting a utility
  });

  //==========================================================================
  // UTILITY FUNCTIONS
  //==========================================================================
  
  /**
   * Handles project selection and updates both local state and parent component
   */
  const handleProjectSelect = useCallback((project: Project) => {
    setLocalSelectedProject(project);
    
    if (onSelectProject) {
      onSelectProject(project);
    }
  }, [onSelectProject]);
  
  /**
   * Converts degrees to radians
   */
  const deg2rad = (deg: number): number => {
    return deg * (Math.PI/180);
  };
  
  /**
   * Calculates distance between two points using Haversine formula
   */
  const calculateDistance = (lat1: number, lon1: number, lat2: number, lon2: number): number => {
    const R = 6371; // Radius of the earth in km
    const dLat = deg2rad(lat2 - lat1);
    const dLon = deg2rad(lon2 - lon1);
    const a = 
      Math.sin(dLat/2) * Math.sin(dLat/2) +
      Math.cos(deg2rad(lat1)) * Math.cos(deg2rad(lat2)) * 
      Math.sin(dLon/2) * Math.sin(dLon/2); 
    const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1-a)); 
    const d = R * c; // Distance in km
    return d;
  };

  /**
   * Creates a GeoJSON circle for radius visualization on the map
   */
  const createGeoJSONCircle = (center: [number, number], radiusInMeters: number, options: { steps?: number, units?: 'meters' } = {}) => {
    const steps = options.steps || 64;
    const units = options.units || 'meters';
    
    const coordinates = [];
    const distanceX = radiusInMeters / (111320 * Math.cos(center[1] * Math.PI / 180));
    const distanceY = radiusInMeters / 110540;

    for (let i = 0; i < steps; i++) {
      const angle = i * 2 * Math.PI / steps;
      const x = center[0] + distanceX * Math.cos(angle);
      const y = center[1] + distanceY * Math.sin(angle);
      coordinates.push([x, y]);
    }
    
    // Add the first point at the end to close the circle
    coordinates.push(coordinates[0]);
    
    return {
      type: 'Feature',
      geometry: {
        type: 'Polygon',
        coordinates: [coordinates]
      },
      properties: {}
    };
  };

  //==========================================================================
  // MAP INITIALIZATION
  //==========================================================================
  
  /**
   * Initialize map on component mount
   * Sets up the Mapbox GL map with controls, event handlers, and initial view
   */
  useEffect(() => {
    // Skip map initialization if no container or mapbox not loaded
    if (!mapContainer.current || !mapboxgl) return;
    
    // Skip if map is already initialized
    if (mapRef.current) return;
    
    // Set mapbox token
    mapboxgl.accessToken = getMapboxToken();
    
    // Create new map instance
    const map = new mapboxgl.Map({
      container: mapContainer.current,
      style: 'mapbox://styles/mapbox/dark-v10',
      center: [lng, lat],
      zoom: zoom
    });
    
    // Save map reference
    mapRef.current = map;
    
    // Add navigation controls
    map.addControl(new mapboxgl.NavigationControl(), 'top-right');
    
    // Handle map load event
    map.on('load', () => {
      setMapLoaded(true);
    });
    
    // Cleanup function
    return () => {
      // Clean up map instance when component unmounts
      map.remove();
      mapRef.current = null;
    };
  }, [lng, lat, zoom, projects.length, ahjs.length, utilities.length]);

  //==========================================================================
  // PROJECT VISIBILITY AND FILTERING
  //==========================================================================
  
  /**
   * Updates the list of visible projects based on current map bounds
   * Filters projects from DataContext to only show those within the visible map area
   */
  const updateVisibleProjects = useCallback((currentMap: mapboxgl.Map) => {
    if (!currentMap || !projects || projects.length === 0) {
      return;
    }

    // Get current map bounds
    const bounds = currentMap.getBounds();
    if (!bounds) {
      return;
    }

    // Filter projects to those within the current map bounds
    const visible = projects.filter(project => {
      if (!project.latitude || !project.longitude) {
        return false;
      }
      
      const isInBounds = bounds.contains([project.longitude, project.latitude]);
      return isInBounds;
    });

    // Update visible projects state
    setVisibleProjects(visible);
  }, [projects]);

  /**
   * Update visible projects when the filtered projects list changes
   * Only runs when projects or mapLoaded changes, not when updateVisibleProjects changes
   */
  useEffect(() => {
    if (!mapRef.current || !mapLoaded || !projects) return;
    updateVisibleProjects(mapRef.current);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [projects, mapLoaded]);
  
  /**
   * Focus map on user location or fit all visible pins
   * - When no filters are active: Center on user's location
   * - When filters are active: Adjust zoom to fit all visible pins
   */
  useEffect(() => {
    if (!mapRef.current || !mapLoaded) return;
    
    const map = mapRef.current;
    const hasFilters = filters.filters.length > 0;
    
    // Get all visible markers (projects, AHJs, utilities)
    const getVisibleMarkers = (): Array<{lng: number, lat: number}> => {
      const markers: Array<{lng: number, lat: number}> = [];
      
      // Add visible project markers
      visibleProjects.forEach(project => {
        if (project.latitude && project.longitude) {
          markers.push({ lng: project.longitude, lat: project.latitude });
        }
      });
      
      // Add visible AHJ markers
      if (ahjMarkersRef.current.length > 0) {
        ahjMarkersRef.current.forEach(marker => {
          const lngLat = marker.getLngLat();
          markers.push({ lng: lngLat.lng, lat: lngLat.lat });
        });
      }
      
      // Add visible utility markers
      if (utilityMarkersRef.current.length > 0) {
        utilityMarkersRef.current.forEach(marker => {
          const lngLat = marker.getLngLat();
          markers.push({ lng: lngLat.lng, lat: lngLat.lat });
        });
      }
      
      return markers;
    };
    
    // Fit map to bounds of visible markers
    const fitMapToBounds = (markers: Array<{lng: number, lat: number}>) => {
      if (markers.length === 0) return;
      
      // Create a bounds object
      const bounds = new mapboxgl.LngLatBounds();
      
      // Extend the bounds to include each marker
      markers.forEach(marker => {
        bounds.extend([marker.lng, marker.lat]);
      });
      
      // Fit the map to the bounds with some padding
      map.fitBounds(bounds, {
        padding: 50,
        maxZoom: 15
      });
      
      console.log(`[MapView] Adjusted map to fit ${markers.length} visible markers`);
    };
    
    // If we have filters, fit the map to the visible markers
    if (hasFilters) {
      const visibleMarkers = getVisibleMarkers();
      if (visibleMarkers.length > 0) {
        fitMapToBounds(visibleMarkers);
      }
    } 
    // Otherwise, center on user location if available
    else if (userLocation && userLocation.latitude && userLocation.longitude) {
      map.flyTo({
        center: [userLocation.longitude, userLocation.latitude],
        zoom: 10,
        essential: true
      });
      console.log('[MapView] Centered map on user location:', userLocation);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [mapLoaded, filters.filters, userLocation, visibleProjects]);

  /**
   * Update visible projects once when the map loads
   * No longer updates on map movement to improve performance
   */
  useEffect(() => {
    if (!mapRef.current || !projects || projects.length === 0 || !mapLoaded) return;
    
    const map = mapRef.current;
    
    // Only track that the map has moved, but don't update visible projects
    const moveEndHandler = () => {
      setMapMoved(true);
      // No longer calling updateVisibleProjects on every map move
    };
    
    map.on('moveend', moveEndHandler);
    
    // Set all projects as visible initially instead of filtering by bounds
    setVisibleProjects(projects);
    
    // Cleanup
    return () => {
      map.off('moveend', moveEndHandler);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [mapLoaded, projects]);
  
  /**
   * Create entity markers (AHJs and Utilities) when filters change, map loads, or entity data changes
   */
  useEffect(() => {
    if (!mapRef.current || !mapLoaded) return;
    
    const map = mapRef.current;
    console.log('[MapView] Creating entity markers based on filters:', filters.filters);
    
    // Create AHJ markers if we have AHJ data
    if (ahjs && ahjs.length > 0) {
      console.log(`[MapView] Creating AHJ markers (${ahjs.length} total, ${ahjs.filter(a => a.latitude && a.longitude).length} with coordinates)`);
      createEntityMarkers(ahjs, 'ahj', map);
    }
    
    // Create Utility markers if we have utility data
    if (utilities && utilities.length > 0) {
      console.log(`[MapView] Creating Utility markers (${utilities.length} total, ${utilities.filter(u => u.latitude && u.longitude).length} with coordinates)`);
      createEntityMarkers(utilities, 'utility', map);
    }
    
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [mapLoaded, filters.filters, ahjs, utilities]);

  //==========================================================================
  // MARKER CREATION AND MANAGEMENT
  //==========================================================================
  
  /**
   * Creates entity markers (AHJs and Utilities) with pulsing effect
   * Only shows entities that are selected or related to selected entities
   */
  const createEntityMarkers = useCallback((entities: any[], entityType: 'ahj' | 'utility', map: mapboxgl.Map) => {
    // Clear existing markers for this entity type
    const markersArray = entityType === 'ahj' ? ahjMarkersRef : utilityMarkersRef;
    markersArray.current.forEach(marker => marker.remove());
    markersArray.current = [];
    
    // Filter entities to those with valid coordinates
    const validEntities = entities.filter(entity => {
      return entity.latitude && entity.longitude;
    });
    
    // Check if we have any entity filters
    const entityFilters = filters.filters.filter(f => f.type === 'ahj' || f.type === 'utility');
    const hasEntityFilters = entityFilters.length > 0;
    
    // Find selected entities of this type
    const selectedEntityIds = entityFilters
      .filter(filter => filter.type === entityType)
      .map(filter => filter.entityId);
    
    // Find related entities (entities related to a selected entity of the other type)
    const otherEntityType = entityType === 'ahj' ? 'utility' : 'ahj';
    const selectedOtherEntityIds = entityFilters
      .filter(filter => filter.type === otherEntityType)
      .map(filter => filter.entityId);
    
    // Determine which entities to show based on selection status
    let entitiesToShow: any[] = [];
    
    // If we have entity filters, only show selected and related entities
    if (hasEntityFilters) {
      entitiesToShow = validEntities.filter(entity => {
        // Show if this entity is selected
        if (selectedEntityIds.includes(entity.id)) {
          return true;
        }
        
        // Show if this entity is related to a selected entity of the other type
        if (selectedOtherEntityIds.length > 0) {
          // For AHJs, check if it's related to any selected utility
          if (entityType === 'ahj' && entity.relatedUtilityIds) {
            return entity.relatedUtilityIds.some((id: string) => selectedOtherEntityIds.includes(id));
          }
          
          // For Utilities, check if it's related to any selected AHJ
          if (entityType === 'utility' && entity.relatedAhjIds) {
            return entity.relatedAhjIds.some((id: string) => selectedOtherEntityIds.includes(id));
          }
        }
        
        return false;
      });
    }
    
    // Create pulsing effect for each entity that should be shown
    entitiesToShow.forEach(entity => {
      // Determine SVG file and styling based on entity type
      const pinSvgPath = entityType === 'ahj' ? '/ahj_pin.svg' : '/utility_pin.svg';
      
      // Create a marker element
      const el = document.createElement('div');
      el.className = `${entityType}-marker`;
      
      // Apply SVG background image
      el.style.backgroundImage = `url(${pinSvgPath})`;
      el.style.backgroundSize = 'contain';
      el.style.backgroundRepeat = 'no-repeat';
      el.style.backgroundPosition = 'center';
      el.style.width = '30px';
      el.style.height = '30px';
      
      // Highlight selected entities
      if (selectedEntityIds.includes(entity.id)) {
        el.style.filter = 'drop-shadow(0 0 5px white)';
        el.style.zIndex = '6'; // Make selected entities appear above others
      }
      
      // Add tooltip with entity name
      el.title = entity.name;
      
      // Create a popup for the entity
      const popup = new mapboxgl.Popup({
        closeButton: false,
        closeOnClick: false,
        offset: 25
      }).setHTML(`<div class="p-2 bg-gray-800 rounded shadow-lg">
        <div class="font-medium text-white">${entity.name}</div>
        <div class="text-xs text-gray-300">${entityType.toUpperCase()}</div>
      </div>`);
      
      // Create and add marker to map
      const marker = new mapboxgl.Marker(el)
        .setLngLat([entity.longitude, entity.latitude])
        .setPopup(popup)
        .addTo(map);
      
      // Add hover events for popup
      el.addEventListener('mouseenter', () => {
        popup.addTo(map);
      });
      
      el.addEventListener('mouseleave', () => {
        popup.remove();
      });
      
      // Add click handler to select the entity
      el.addEventListener('click', () => {
        // Create a filter for this entity
        const filter = {
          type: entityType,
          value: entity.name,
          entityId: entity.id,
          filterSource: 'map-selection' as 'manual' | 'entity-selection' | 'search',
          entityType: entityType
        };
        
        // Add the filter
        addFilter(filter);
      });
      
      // Store marker reference
      markersArray.current.push(marker);
    });
  }, [addFilter, filters.filters]);

  /**
   * Generates a randomized location offset for non-user projects
   * Creates a random offset approximately 100-200 meters from the actual location
   */
  const getRandomizedLocation = (latitude: number, longitude: number, isUserProject: boolean): [number, number] => {
    // If it's the user's project, return the actual coordinates
    if (isUserProject) {
      return [longitude, latitude];
    }
    
    // For non-user projects, create a randomized offset
    // Approximately 0.001 degrees is about 100 meters (varies by latitude)
    const offsetRange = 0.002; // Range of 0.002 degrees (~200 meters)
    
    // Generate random offsets between -offsetRange and +offsetRange
    const latOffset = (Math.random() - 0.5) * offsetRange;
    const lngOffset = (Math.random() - 0.5) * offsetRange;
    
    // Apply offsets to coordinates
    const randomizedLat = latitude + latOffset;
    const randomizedLng = longitude + lngOffset;
    
    return [randomizedLng, randomizedLat];
  };
  
  /**
   * Creates a masked project pin with reduced visibility
   * Used for projects that should have their exact location partially obscured
   */
  const createMaskedProjectPin = (project: Project, map: mapboxgl.Map) => {
    const el = document.createElement('div');
    el.className = 'masked-marker';
    
    // Check if project belongs to the current user
    const isUserProject = project.rep_id === userProfile?.rep_id;
    
    // Use blue pin for user's projects, grey for others
    const pinImage = isUserProject ? '/pin_blue_active.svg' : '/pin_grey.svg';
    el.style.backgroundImage = `url(${pinImage})`;
    
    // Size and styling
    el.style.width = '18px'; // Slightly smaller than standard projects
    el.style.height = '18px';
    el.style.backgroundSize = 'contain';
    el.style.backgroundRepeat = 'no-repeat';
    el.style.backgroundPosition = 'center';
    
    // Opacity - user's projects are visible, others are completely masked (invisible)
    el.style.opacity = isUserProject ? '0.9' : '0';
    el.style.zIndex = isUserProject ? '7' : '1'; // User's projects appear above others
    
    try {
      // Get coordinates (randomized for non-user projects)
      const coordinates = getRandomizedLocation(
        project.latitude!, 
        project.longitude!, 
        isUserProject
      );
      
      const marker = new mapboxgl.Marker(el)
        .setLngLat(coordinates)
        .addTo(map);
      
      marker.getElement().addEventListener('click', () => {
        handleProjectSelect(project);
      });
      
      projectMarkersRef.current.push(marker);
    } catch (error) {
      console.error('Error creating masked marker:', error);
    }
  };
  
  /**
   * Creates a standard project pin with full visibility
   * Used for completed projects or those assigned to the current user
   */
  const createStandardProjectPin = (project: Project, map: mapboxgl.Map) => {
    
    // Create marker element
    const el = document.createElement('div');
    el.className = 'marker';
    
    // Check if project belongs to the current user
    const isUserProject = project.rep_id === userProfile?.rep_id;
    
    // Use blue pin for user's projects, grey for others
    const pinImage = isUserProject ? '/pin_blue_active.svg' : '/pin_grey_active.svg';
    el.style.backgroundImage = `url(${pinImage})`;
    
    // Size and styling
    el.style.width = '25px';
    el.style.height = '25px';
    el.style.backgroundSize = 'contain';
    el.style.backgroundRepeat = 'no-repeat';
    el.style.backgroundPosition = 'center';
    el.style.zIndex = isUserProject ? '12' : '10'; // User's projects appear above others
    
    // Highlight selected project
    if (selectedProject && project.id === selectedProject.id) {
      el.style.width = '36px';
      el.style.height = '36px';
      el.style.border = '2px solid white';
    }
    
    try {
      // Get coordinates (randomized for non-user projects)
      const coordinates = getRandomizedLocation(
        project.latitude!, 
        project.longitude!, 
        isUserProject
      );
      
      const marker = new mapboxgl.Marker(el)
        .setLngLat(coordinates)
        .addTo(map);
      
      marker.getElement().addEventListener('click', () => {
        handleProjectSelect(project);
      });
      
      projectMarkersRef.current.push(marker);
    } catch (error) {
      console.error('Error creating standard marker:', error);
    }
  };

  /**
   * Updates all map markers when projects data changes
   * Recreates markers when filters are applied
   */
  useEffect(() => {
    // Skip if map is not loaded yet
    if (!mapRef.current || !mapLoaded) return;
    
    // Skip if we don't have any data yet (waiting for server data)
    if (projects.length === 0 && ahjs.length === 0 && utilities.length === 0) {
      return;
    }
    
    // Get the map reference
    const map = mapRef.current;
    if (!map) return;
    
    // Use all projects instead of just visible ones
    const projectsToShow = projects;
    
    // Clear existing project markers
    projectMarkersRef.current.forEach(marker => marker.remove());
    projectMarkersRef.current = [];
    
    // Add new markers for each project
    projectsToShow.forEach(project => {
      // Skip projects without valid coordinates
      if (!project.latitude || !project.longitude) {
        return;
      }
      
      // Determine if this project should be masked based on completion status and ownership
      const isComplete = project.status && 
        (project.status.toLowerCase() === 'complete' || 
         project.status.toLowerCase() === 'completed' ||
         project.status.toLowerCase().includes('complete'));
      
      const isAssignedToCurrentUser = project.rep_id === userProfile?.rep_id;
      const shouldMask = !(isComplete || isAssignedToCurrentUser);
      
      if (shouldMask) {
        // Only create masked pins for user's projects, skip others entirely
        if (isAssignedToCurrentUser) {
          createMaskedProjectPin(project, map);
        }
        // Non-user masked projects are not displayed at all
      } else {
        // Create standard project pin
        createStandardProjectPin(project, map);
      }
    });
    
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [mapLoaded, projects]);

  //==========================================================================
  // PROJECT SELECTION AND INTERACTION
  //==========================================================================

  /**
   * Update local selected project when prop changes
   * Flies to the selected project on the map
   */
  useEffect(() => {
    setLocalSelectedProject(selectedProject);
    
    // If a project is selected and we have map access, fly to it
    if (selectedProject && mapRef.current && mapLoaded && allowMapMovement.selection) {
      const { latitude, longitude } = selectedProject;
      
      if (latitude && longitude) {
        mapRef.current.flyTo({
          center: [longitude, latitude],
          zoom: 14,
          essential: true
        });
      }
    }
  }, [selectedProject, mapLoaded, allowMapMovement.selection]);

  /**
   * Handle filter addition
   */
  const handleAddFilter = (filter: ProjectFilter) => {
    addFilter(filter);
  };
  
  /**
   * Handle filter removal
   */
  const handleRemoveFilter = (filterId: string) => {
    removeFilter(filterId);
  };

  /**
   * Handle "My Projects" toggle
   */
  const handleMyProjectsToggle = () => {
    toggleShowOnlyMyProjects();
  };

  /**
   * Handle 45-day qualified projects toggle
   * Check if we have data to display
   */
  const hasData = projects.length > 0;
  
  /**
   * Render loading state - only show if we don't have any data yet
   */
  if (isLoading && (!projects || projects.length === 0) && (!ahjs || ahjs.length === 0) && (!utilities || utilities.length === 0)) {
    return (
      <div className="w-full h-full flex items-center justify-center bg-gray-900">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-t-2 border-b-2 border-blue-500 mx-auto mb-4"></div>
          <p className="text-lg text-gray-300">Loading map data...</p>
        </div>
      </div>
    );
  }
  
  /**
   * Render error state
   */
  if (error) {
    return (
      <div className="w-full h-full flex items-center justify-center bg-gray-900">
        <div className="text-center max-w-md p-6">
          <div className="text-red-500 text-5xl mb-4">⚠️</div>
          <h3 className="text-xl font-bold text-red-400 mb-2">Error Loading Map</h3>
          <p className="text-gray-300 mb-4">{error}</p>
          <button 
            className="px-4 py-2 bg-blue-600 text-white rounded hover:bg-blue-700"
            onClick={() => window.location.reload()}
          >
            Retry
          </button>
        </div>
      </div>
    );
  }
  
  /**
   * Render empty state
   */
  if (!hasData) {
    return (
      <EmptyState 
        title="No Projects Found"
        message="There are no projects matching your current filters."
        icon={<span className="text-4xl mb-3 mx-auto">🗺️</span>}
        isFilterResult={true}
        onClearFilter={clearFilters}
      />
    );
  }

  /**
   * Render the map
   */
  return (
    <div className="w-full h-full flex flex-col">
      {/* Map container */}
      <div className="flex-1 relative">
        <div ref={mapContainer} className="absolute inset-0" />
        {/* Project cards carousel removed */}
      </div>
    </div>
  );
};

export default MapView;
