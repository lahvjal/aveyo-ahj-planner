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
    set45DayFilter
  } = useData();
  
  // Log the projects data from DataContext
  // console.log('projects', projects);
  
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
  // console.log('markers', projectMarkersRef.current, ahjMarkersRef.current, utilityMarkersRef.current);
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
    if (!mapContainer.current) return; // No container to render into
    
    // Get Mapbox token
    const token = getMapboxToken();
    if (!token) {
      console.error('No Mapbox token found');
      return;
    }
    
    // Set Mapbox token
    mapboxgl.accessToken = token;
    
    /**
     * Initialize the map with configuration and event handlers
     */
    const initializeMap = () => {
      // Create map instance
      const map = new mapboxgl.Map({
        container: mapContainer.current!,
        style: 'mapbox://styles/mapbox/dark-v11', // Dark theme
        center: [lng, lat],
        zoom: zoom,
        maxBounds: [
          [-180, -85], // Southwest coordinates
          [180, 85]    // Northeast coordinates
        ],
        projection: {
          name: 'mercator',
          center: [-95.7129, 37.0902]
        },
        minZoom: 2 // Prevent zooming out too far
      });
      
      // Save map reference
      mapRef.current = map;
      
      // Add navigation controls (zoom in/out)
      map.addControl(new mapboxgl.NavigationControl(), 'top-right');
      
      // Add geolocate control and trigger it automatically
      const geolocateControl = new mapboxgl.GeolocateControl({
        positionOptions: {
          enableHighAccuracy: true
        },
        trackUserLocation: true,
        showUserHeading: true
      });
      
      map.addControl(geolocateControl, 'top-right');
      
      /**
       * Map load event handler
       * Sets up initial view and configurations once the map is loaded
       */
      map.on('load', () => {
        setMapLoaded(true);
        
        // Force a resize after load to fix any sizing issues
        setTimeout(() => {
          try {
            map.resize();
          } catch (error) {
            // Silent error handling for map resize
          }
        }, 200);
        
        /**
         * Find nearby projects and center the map view
         * Uses user location and project coordinates to create an optimal view
         */
        setTimeout(() => {
          try {
            // Get user's location from the map if available
            const userLocation = mapRef.current?.getCenter();
            
            if (userLocation && projects.length > 0) {
              const projectsWithDistance = projects
                .filter(project => project.latitude && project.longitude)
                .map(project => {
                  const distance = calculateDistance(
                    userLocation.lat,
                    userLocation.lng,
                    project.latitude!,
                    project.longitude!
                  );
                  return { project, distance };
                })
                .sort((a, b) => a.distance - b.distance)
                .slice(0, 5);
              
              if (projectsWithDistance.length === 0) return;
              
              // Create a bounds object to encompass all nearby projects and user location
              const bounds = new mapboxgl.LngLatBounds();
              
              // Add user location to bounds
              bounds.extend([userLocation.lng, userLocation.lat]);
              
              // Add each project's coordinates to the bounds
              projectsWithDistance.forEach(({ project }) => {
                bounds.extend([project.longitude!, project.latitude!]);
              });
              
              // Fit the map to the bounds with padding - only during initial setup
              if (allowMapMovement.initial) {
                map.fitBounds(bounds, {
                  padding: 100,
                  maxZoom: 12
                });
                
                // Disable initial movement after first use
                setAllowMapMovement(prev => ({ ...prev, initial: false }));
              }
            }
          } catch (error) {
            // Silent error handling for location processing
          }
        }, 1000); // Short delay to ensure map is fully loaded
        
        /**
         * Zoom event handler
         * Controls visibility of map labels based on zoom level
         */
        map.on('zoom', () => {
          const zoom = map.getZoom();
          const showLabels = zoom >= 10;
          const visibility = showLabels ? 'visible' : 'none';
          
          // Check if layers exist before trying to modify them
          const layers = ['settlement-label', 'settlement-minor-label', 'settlement-major-label', 'place-label'];
          
          layers.forEach(layer => {
            try {
              if (map.getLayer(layer)) {
                map.setLayoutProperty(layer, 'visibility', visibility);
              }
            } catch (error) {
              // Layer not found in map style, skipping
            }
          });
        });
      });
      
      // Error handler
      map.on('error', (e: mapboxgl.ErrorEvent) => {
        // Handle map error silently
      });
    };
    
    // Initialize the map
    initializeMap();
    
    // Cleanup function
    return () => {
      if (mapRef.current) {
        mapRef.current.remove();
      }
    };
  }, []);

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
    // console.log('Setting all projects as visible:', projects.length);
    
    // Cleanup
    return () => {
      map.off('moveend', moveEndHandler);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [mapLoaded, projects]);

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
      // Determine color based on entity type
      const pulseColor = entityType === 'ahj' ? '#87CEFA' : '#FFFF00'; // Light blue for AHJs, yellow for utilities
      
      // Create a ping ripple element
      const el = document.createElement('div');
      el.className = `${entityType}-pulse-marker`;
      
      // Don't override the CSS size here since we're using the CSS classes
      // The ping ripple effect is controlled by the CSS
      
      // Highlight selected entities
      if (selectedEntityIds.includes(entity.id)) {
        el.style.border = '2px solid white';
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
   * Creates a masked project pin with reduced visibility
   * Used for projects that should have their exact location partially obscured
   */
  const createMaskedProjectPin = (project: Project, map: mapboxgl.Map) => {
    // console.log('Creating MASKED pin for project:', project.id, project.address);
    
    // For masked projects, use a grey pin with reduced opacity
    const el = document.createElement('div');
    el.className = 'masked-marker';
    el.style.backgroundImage = 'url(/pin_grey.svg)';
    el.style.width = '18px'; // Slightly smaller than active projects
    el.style.height = '18px';
    el.style.backgroundSize = 'contain';
    el.style.backgroundRepeat = 'no-repeat';
    el.style.backgroundPosition = 'center';
    el.style.opacity = '0'; // More transparent for masked projects
    el.style.zIndex = '5'; // Below active projects
    
    // try {
    //   const marker = new mapboxgl.Marker(el)
    //     .setLngLat([project.longitude!, project.latitude!])
    //     .addTo(map);
      
    //   marker.getElement().addEventListener('click', () => {
    //     handleProjectSelect(project);
    //   });
      
    //   projectMarkersRef.current.push(marker);
    //   // console.log('Successfully added masked marker to map, total markers:', projectMarkersRef.current.length);
    // } catch (error) {
    //   console.error('Error creating masked marker:', error);
    // }
  };
  
  /**
   * Creates a standard project pin with full visibility
   * Used for completed projects or those assigned to the current user
   */
  const createStandardProjectPin = (project: Project, map: mapboxgl.Map) => {
    // console.log('Creating STANDARD pin for project:', project.id, project.address);
    
    // For unmasked projects, use pin_green_active.svg
    const el = document.createElement('div');
    el.className = 'marker';
    el.style.backgroundImage = 'url(/pin_grey_active.svg)';
    el.style.width = '25px';
    el.style.height = '25px';
    el.style.backgroundSize = 'contain';
    el.style.backgroundRepeat = 'no-repeat';
    el.style.backgroundPosition = 'center';
    el.style.zIndex = '10'; // Ensure project pins are above entity markers
    
    // Highlight selected project
    if (selectedProject && project.id === selectedProject.id) {
      el.style.width = '36px';
      el.style.height = '36px';
      el.style.border = '2px solid white';
    }
    
    try {
      const marker = new mapboxgl.Marker(el)
        .setLngLat([project.longitude!, project.latitude!])
        .addTo(map);
      
      marker.getElement().addEventListener('click', () => {
        handleProjectSelect(project);
      });
      
      projectMarkersRef.current.push(marker);
      // console.log('Successfully added standard marker to map, total markers:', projectMarkersRef.current.length);
    } catch (error) {
      console.error('Error creating standard marker:', error);
    }
  };

  /**
   * Updates all map markers when projects data changes
   * Recreates markers when filters are applied
   */
  useEffect(() => {
    if (!mapRef.current || !mapLoaded) return;
    
    const map = mapRef.current;
    // console.log('Map markers update triggered, projects:', projects.length);
    
    // Clear existing project markers whenever projects change
    projectMarkersRef.current.forEach(marker => marker.remove());
    projectMarkersRef.current = [];
    
    // Create entity markers for AHJs and utilities
    // Only recreate these if they don't exist yet
    if (ahjMarkersRef.current.length === 0) {
      createEntityMarkers(ahjs, 'ahj', map);
    }
    
    if (utilityMarkersRef.current.length === 0) {
      createEntityMarkers(utilities, 'utility', map);
    }
    
    // Use all projects instead of just visible ones
    const projectsToShow = projects;
    // console.log('Projects to show after filtering:', projectsToShow.length);
    
    // Check if any projects have coordinates
    const projectsWithCoords = projectsToShow.filter(p => p.latitude && p.longitude);
    // console.log('Projects with coordinates:', projectsWithCoords.length);
    
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
        // Create masked project pin (reduced visibility for privacy)
        createMaskedProjectPin(project, map);
      } else {
        // Create standard project pin
        createStandardProjectPin(project, map);
      }
    });
    
    // console.log('Finished creating/updating all markers, total:', projectMarkersRef.current.length);
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
   * Render loading state
   */
  if (isLoading) {
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
