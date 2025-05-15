import React, { useRef, useState, useEffect, useMemo, useCallback } from 'react';
import 'mapbox-gl/dist/mapbox-gl.css';
// Import mapboxgl dynamically to prevent SSR issues
let mapboxgl: any;
if (typeof window !== 'undefined') {
  mapboxgl = require('mapbox-gl');
}
import { Project, ProjectFilter } from '@/utils/types';
import { useAuth } from '@/utils/AuthContext';
import { useData } from '@/contexts/DataContext';
import { getClassificationMapColor, getClassificationBadgeClass } from '@/utils/classificationColors';
import { getMapboxToken } from '@/utils/mapbox';
import { mapQualificationStatus, isQualified } from '@/utils/qualificationStatus';
import ImprovedFilterPanel from './ImprovedFilterPanel';
import ToggleOption from './ToggleOption';
import EmptyState from './EmptyState';

interface MapViewProps {
  selectedProject: Project | null;
  onSelectProject?: (project: Project | null) => void;
}

const MapView: React.FC<MapViewProps> = ({
  selectedProject,
  onSelectProject,
}) => {
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
  
  // Log data received by MapView component
  useEffect(() => {
    // console.log('===== MAPVIEW COMPONENT DATA =====');
    // console.log('Projects received:', projects.length);
    // console.log('AHJs received:', ahjs.length);
    // console.log('Utilities received:', utilities.length);
    // console.log('Filters:', filters);
    // console.log('===== END MAPVIEW COMPONENT DATA =====');
  }, [projects, ahjs, utilities, filters]);
  
  const { userProfile, isAdmin } = useAuth();
  
  // Map refs and state
  const mapContainer = useRef<HTMLDivElement>(null);
  const mapRef = useRef<mapboxgl.Map | null>(null);
  const markersRef = useRef<mapboxgl.Marker[]>([]);
  const cardListRef = useRef<HTMLDivElement>(null);
  
  // Map position state
  const [lng, setLng] = useState(-111.8910); // Default to Utah
  const [lat, setLat] = useState(40.7608);
  const [zoom, setZoom] = useState(9);
  const [mapLoaded, setMapLoaded] = useState(false);
  
  // Project selection and display state
  const [localSelectedProject, setLocalSelectedProject] = useState<Project | null>(selectedProject);
  const [visibleProjects, setVisibleProjects] = useState<Project[]>([]);
  
  // UI interaction state
  const [currentCardIndex, setCurrentCardIndex] = useState(0);
  const [isDragging, setIsDragging] = useState(false);
  const [startX, setStartX] = useState(0);
  const [scrollLeft, setScrollLeft] = useState(0);
  const [showLeftArrow, setShowLeftArrow] = useState(false);
  const [showRightArrow, setShowRightArrow] = useState(false);
  const [mapMoved, setMapMoved] = useState(false);
  
  // Flag to track if map movements should be allowed
  const [allowMapMovement, setAllowMapMovement] = useState<{
    initial: boolean; // Allow initial map setup movement
    selection: boolean; // Allow movement when selecting a project
    utility: boolean; // Allow movement when selecting a utility
  }>({
    initial: true, // Allow initial setup
    selection: true, // Allow project selection movement
    utility: false // Don't move map for utility changes by default
  });

  // Store map state for view switching
  const [savedMapState, setSavedMapState] = useState<{
    center: [number, number];
    zoom: number;
    bearing: number;
    pitch: number;
  } | null>(null);

  // Helper function to create a GeoJSON circle
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

  // Calculate distance between two points using Haversine formula
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
  
  const deg2rad = (deg: number): number => {
    return deg * (Math.PI/180);
  };

  // Effect to handle window resize events
  useEffect(() => {
    const handleResize = () => {
      try {
        if (mapRef.current) {
          mapRef.current.resize();
        }
      } catch (error) {
        // Silent error handling for map resize
      }
    };
    
    window.addEventListener('resize', handleResize);
    
    return () => {
      window.removeEventListener('resize', handleResize);
    };
  }, []);
  
  // Effect to initialize map
  useEffect(() => {
    if (!mapContainer.current) return;
    
    // Clean up previous map instance if it exists
    try {
      if (mapRef.current) {
        if (typeof mapRef.current.remove === 'function') {
          mapRef.current.remove();
        }
      }
    } catch (error) {
      // Silent error handling for map cleanup
    }
    
    mapRef.current = null;
    
    const initializeMap = async () => {
      // Set Mapbox access token using the utility function
      mapboxgl.accessToken = getMapboxToken();
      
      // Check if token is available
      if (!mapboxgl.accessToken) {
        // Cannot proceed without a Mapbox token
        return;
      }
      
      // Initialize the map
      const map = new mapboxgl.Map({
        container: mapContainer.current as HTMLElement,
        style: 'mapbox://styles/mapbox/dark-v11', // Updated to dark-v11 which has better layer support
        center: [-95.7129, 37.0902], // Center of US
        zoom: 3,
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
      
      // Set up event handlers
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
        
        // Try to get user location and find nearby projects
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
              
              // Process nearest projects
              
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
        
        // Hide city labels until zoomed in
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
      
      map.on('error', (e: mapboxgl.ErrorEvent) => {
        // Handle map error silently
      });
      
    };
    
    initializeMap();
    
    // Cleanup function
    return () => {
      if (mapRef.current) {
        mapRef.current.remove();
      }
    };
  }, []);

  // Update visible projects based on map bounds
  const updateVisibleProjects = useCallback((currentMap: mapboxgl.Map) => {
    if (!currentMap || !projects || projects.length === 0) {
      // Map or projects not available
      return;
    }

    const bounds = currentMap.getBounds();
    if (!bounds) {
      // Map bounds not available
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

    // Update visible projects
    setVisibleProjects(visible);
  }, [projects]);

  // Update visible projects when projects changes
  useEffect(() => {
    if (!mapRef.current || !mapLoaded || !projects) return;
    updateVisibleProjects(mapRef.current);
  }, [projects, mapLoaded, updateVisibleProjects]);

  // Update visible projects whenever map moves or projects change
  useEffect(() => {
    if (!mapRef.current || !projects || projects.length === 0 || !mapLoaded) return;
    
    const map = mapRef.current;
    
    // Add event listeners for map movement
    const moveEndHandler = () => {
      setMapMoved(true);
      updateVisibleProjects(map);
    };
    
    map.on('moveend', moveEndHandler);
    
    // Initial update
    updateVisibleProjects(map);
    
    // Cleanup
    return () => {
      map.off('moveend', moveEndHandler);
    };
  }, [mapLoaded, projects, updateVisibleProjects]);

  // Update markers when visible projects change
  useEffect(() => {
    if (!mapRef.current || !mapLoaded) return;
    
    // Clear existing markers
    markersRef.current.forEach(marker => marker.remove());
    markersRef.current = [];
    
    const map = mapRef.current;
    
    // Add new markers for each visible project
    visibleProjects.forEach(project => {
      if (!project.latitude || !project.longitude) return;
      
      // Determine if this project should be masked
      const isComplete = project.status && 
        (project.status.toLowerCase() === 'complete' || 
         project.status.toLowerCase() === 'completed' ||
         project.status.toLowerCase().includes('complete'));
      
      const isAssignedToCurrentUser = project.rep_id === userProfile?.rep_id;
      // We don't have admin users right now, so we're simplifying the masking logic
      const shouldMask = !(isComplete || isAssignedToCurrentUser);
      
      // Skip adding exact location for masked projects to protect sensitive information
      if (shouldMask) {
        // For masked projects, we could either:
        // 1. Not show them at all
        // 2. Show them with a different icon
        // 3. Show them with a slight location offset
        // 4. Only show them at certain zoom levels
        
        // For now, we'll use approach #2 - show with a different icon
        const el = document.createElement('div');
        el.className = 'masked-marker';
        el.style.backgroundImage = `url(/pin_grey.svg)`;
        el.style.width = '24px';
        el.style.height = '24px';
        el.style.backgroundSize = '100%';
        el.style.opacity = '0.6'; // Make it semi-transparent
        
        const marker = new mapboxgl.Marker(el)
          .setLngLat([project.longitude, project.latitude])
          .addTo(map);
        
        marker.getElement().addEventListener('click', () => {
          handleProjectSelect(project);
        });
        
        markersRef.current.push(marker);
        return;
      }
      
      // For unmasked projects, show normal markers with classification colors
      const classification = project.ahj?.classification || 'unknown';
      const pinColor = getClassificationMapColor(classification);
      
      const el = document.createElement('div');
      el.className = 'marker';
      el.style.backgroundImage = `url(/pin_${pinColor}.svg)`;
      el.style.width = '24px';
      el.style.height = '24px';
      el.style.backgroundSize = '100%';
      
      // Highlight selected project
      if (selectedProject && project.id === selectedProject.id) {
        el.style.width = '32px';
        el.style.height = '32px';
        el.style.zIndex = '10';
      }
      
      const marker = new mapboxgl.Marker(el)
        .setLngLat([project.longitude, project.latitude])
        .addTo(map);
      
      marker.getElement().addEventListener('click', () => {
        handleProjectSelect(project);
      });
      
      markersRef.current.push(marker);
    });
  }, [visibleProjects, selectedProject, mapLoaded, userProfile]);

  // Update local selected project when prop changes
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



  // Handle project selection
  const handleProjectSelect = (project: Project) => {
    setLocalSelectedProject(project);
    
    if (onSelectProject) {
      onSelectProject(project);
    }
  };

  // Handle filter addition
  const handleAddFilter = (filter: ProjectFilter) => {
    addFilter(filter);
  };
  
  // Handle filter removal
  const handleRemoveFilter = (filter: ProjectFilter) => {
    removeFilter(filter.id || '');
  };

  // Handle "My Projects" toggle
  const handleMyProjectsToggle = () => {
    toggleShowOnlyMyProjects();
  };

  // Handle 45-day qualified projects toggle
  const handle45DayToggle = () => {
    set45DayFilter(!show45DayQualified);
  };

  // Mouse event handlers for card carousel
  const handleMouseDown = (e: React.MouseEvent) => {
    if (!cardListRef.current) return;
    
    setIsDragging(true);
    setStartX(e.pageX - cardListRef.current.offsetLeft);
    setScrollLeft(cardListRef.current.scrollLeft);
  };
  
  const handleMouseUp = () => {
    setIsDragging(false);
  };
  
  const handleMouseMove = (e: React.MouseEvent) => {
    if (!isDragging || !cardListRef.current) return;
    
    e.preventDefault();
    const x = e.pageX - cardListRef.current.offsetLeft;
    const walk = (x - startX) * 2; // Scroll speed multiplier
    cardListRef.current.scrollLeft = scrollLeft - walk;
  };
  
  const handleMouseLeave = () => {
    setIsDragging(false);
  };

  // Check if arrows should be shown for card carousel
  useEffect(() => {
    if (!cardListRef.current) return;
    
    const checkArrows = () => {
      const container = cardListRef.current;
      if (!container) return;
      
      setShowLeftArrow(container.scrollLeft > 0);
      setShowRightArrow(container.scrollLeft < container.scrollWidth - container.clientWidth);
    };
    
    const container = cardListRef.current;
    container.addEventListener('scroll', checkArrows);
    window.addEventListener('resize', checkArrows);
    
    // Initial check
    checkArrows();
    
    return () => {
      container.removeEventListener('scroll', checkArrows);
      window.removeEventListener('resize', checkArrows);
    };
  }, [visibleProjects]);

  // Scroll card carousel left/right
  const scrollCarousel = (direction: 'left' | 'right') => {
    if (!cardListRef.current) return;
    
    const container = cardListRef.current;
    const scrollAmount = container.clientWidth * 0.8; // Scroll 80% of visible width
    
    if (direction === 'left') {
      container.scrollBy({ left: -scrollAmount, behavior: 'smooth' });
    } else {
      container.scrollBy({ left: scrollAmount, behavior: 'smooth' });
    }
  };

  // Memoize visible projects to prevent unnecessary re-renders
  const sortedVisibleProjects = useMemo(() => {
    return [...visibleProjects].sort((a, b) => {
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
      
      // Within each group (masked or unmasked), prioritize user's own projects
      if (aIsAssignedToCurrentUser && !bIsAssignedToCurrentUser) return -1;
      if (!aIsAssignedToCurrentUser && bIsAssignedToCurrentUser) return 1;
      
      // Then sort by 45-day qualification
      const aIs45Day = isQualified(a);
      const bIs45Day = isQualified(b);
      
      if (aIs45Day && !bIs45Day) return -1;
      if (!aIs45Day && bIs45Day) return 1;
      // Finally sort alphabetically by name or id if name is not available
      return (a.address || a.id || '').localeCompare(b.address || b.id || '');
    });
  }, [visibleProjects, userProfile]);

  // Render project cards for the carousel
  const renderProjectCards = () => {
    if (sortedVisibleProjects.length === 0) {
      return (
        <div className="flex items-center justify-center h-full w-full p-4">
          <EmptyState 
            title="No projects in this area" 
            message="Try zooming out or panning to see more projects."
            icon="map"
          />
        </div>
      );
    }
    
    return sortedVisibleProjects.map((project, index) => {
      // Determine if this project should be masked
      const isComplete = project.status && 
        (project.status.toLowerCase() === 'complete' || 
         project.status.toLowerCase() === 'completed' ||
         project.status.toLowerCase().includes('complete'));
      
      const isAssignedToCurrentUser = project.rep_id === userProfile?.rep_id;
      // We don't have admin users right now, so we're simplifying the masking logic
      const isMasked = !(isComplete || isAssignedToCurrentUser);
      
      // Get AHJ classification for color
      const classification = project.ahj?.classification || 'unknown';
      const badgeClass = getClassificationBadgeClass(classification);
      
      return (
        <div 
          key={project.id} 
          className={`
            flex-shrink-0 w-80 p-4 rounded-lg shadow-md m-2 cursor-pointer
            ${selectedProject?.id === project.id ? 'bg-gray-800 border border-blue-500' : 'bg-gray-900'}
            transition-all duration-200 hover:bg-gray-800
          `}
          onClick={() => handleProjectSelect(project)}
        >
          <div className="flex justify-between items-start mb-2">
            <h3 className="text-lg font-semibold text-white truncate">
              {isMasked ? 'Project details restricted' : (project.address || 'Unnamed Project')}
            </h3>
            <div className={`px-2 py-1 rounded text-xs font-medium ${badgeClass}`}>
              {classification.toUpperCase()}
            </div>
          </div>
          
          <div className="text-sm text-gray-300 mb-1">
            <span className="font-medium">Status:</span> {isMasked ? 'Restricted' : project.status || 'Unknown'}
          </div>
          
          <div className="text-sm text-gray-300 mb-1">
            <span className="font-medium">Address:</span> {isMasked ? 'Project details restricted' : project.address || 'No address'}
          </div>
          
          {!isMasked && (
            <>
              <div className="text-sm text-gray-300 mb-1">
                <span className="font-medium">AHJ:</span> {project.ahj?.name || 'Unknown'}
              </div>
              
              <div className="text-sm text-gray-300 mb-1">
                <span className="font-medium">Utility:</span> {project.utility?.name || 'Unknown'}
              </div>
              
              <div className="text-sm text-gray-300">
                <span className="font-medium">45-Day Qualified:</span> {isQualified(project) ? 'Yes' : 'No'}
              </div>
            </>
          )}
        </div>
      );
    });
  };

  // Render the main component
  return (
    <div className="h-full w-full flex flex-col relative">
      {/* Map container */}
      <div 
        ref={mapContainer} 
        className="flex-grow w-full"
        style={{ height: 'calc(100% - 120px)' }}
      />
      
      {/* Project cards carousel */}
      <div className="h-32 w-full bg-gray-900 relative">
        {/* Left scroll arrow */}
        {showLeftArrow && (
          <button
            className="absolute left-0 top-0 bottom-0 bg-gradient-to-r from-gray-900 to-transparent z-10 px-2"
            onClick={() => scrollCarousel('left')}
          >
            ←
          </button>
        )}
        
        {/* Cards container */}
        <div
          ref={cardListRef}
          className="flex overflow-x-auto h-full py-2 px-4 hide-scrollbar"
          onMouseDown={handleMouseDown}
          onMouseUp={handleMouseUp}
          onMouseMove={handleMouseMove}
          onMouseLeave={handleMouseLeave}
        >
          {renderProjectCards()}
        </div>
        
        {/* Right scroll arrow */}
        {showRightArrow && (
          <button
            className="absolute right-0 top-0 bottom-0 bg-gradient-to-l from-gray-900 to-transparent z-10 px-2"
            onClick={() => scrollCarousel('right')}
          >
            →
          </button>
        )}
      </div>
      
      {/* Loading indicator */}
      {isLoading && (
        <div className="absolute inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
          <div className="text-white">Loading projects...</div>
        </div>
      )}
      
      {/* Error message */}
      {error && (
        <div className="absolute inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
          <div className="bg-red-900 text-white p-4 rounded-lg max-w-md">
            <h3 className="text-lg font-bold mb-2">Error</h3>
            <p>{error}</p>
          </div>
        </div>
      )}
    </div>
  );
};

export default MapView;
