import React, { useRef, useState, useEffect, useMemo, useCallback } from 'react';
import mapboxgl from 'mapbox-gl';
import 'mapbox-gl/dist/mapbox-gl.css';
import { AHJ, Project, ProjectFilter } from '@/utils/types';
import { useAuth } from '@/utils/AuthContext';
import { getClassificationMapColor, getClassificationBadgeClass } from '@/utils/classificationColors';
import { getMapboxToken } from '@/utils/mapbox';
import { mapQualificationStatus, isQualified } from '@/utils/qualificationStatus';
import ImprovedFilterPanel from './ImprovedFilterPanel';
import ToggleOption from './ToggleOption';

interface MapViewProps {
  ahjs?: AHJ[];
  selectedAHJ?: AHJ | null;
  onSelectAHJ?: (ahj: AHJ) => void;
  selectedUtility?: any;
  projects?: Project[];
  selectedProject: Project | null;
  onSelectProject?: (project: Project | null) => void;
}

const MapView: React.FC<MapViewProps> = ({
  ahjs,
  selectedAHJ,
  onSelectAHJ,
  selectedUtility,
  projects,
  selectedProject,
  onSelectProject,
}) => {
  const { userProfile } = useAuth();
  const mapContainer = useRef<HTMLDivElement>(null);
  const cardListRef = useRef<HTMLDivElement>(null);
  const mapRef = useRef<mapboxgl.Map | null>(null);
  const markersRef = useRef<mapboxgl.Marker[]>([]);
  const [lng, setLng] = useState(-111.8910); // Default to Utah
  const [lat, setLat] = useState(40.7608);
  const [zoom, setZoom] = useState(9);
  const [mapLoaded, setMapLoaded] = useState(false);
  const [localSelectedProject, setLocalSelectedProject] = useState<Project | null>(selectedProject);
  const [visibleProjects, setVisibleProjects] = useState<Project[]>([]);
  const [currentCardIndex, setCurrentCardIndex] = useState(0);
  const [isDragging, setIsDragging] = useState(false);
  const [startX, setStartX] = useState(0);
  const [scrollLeft, setScrollLeft] = useState(0);
  const [showLeftArrow, setShowLeftArrow] = useState(false);
  const [showRightArrow, setShowRightArrow] = useState(false);
  const [mapMoved, setMapMoved] = useState(false);
  const [showOnlyMyProjects, setShowOnlyMyProjects] = useState(false);
  const [showKefeProjects, setShowKefeProjects] = useState(false); // New state for "Test" filter
  
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

  // Function to prepare heatmap data from projects
  const prepareHeatmapData = (projectsData: Project[]) => {
    console.log('[MapView] Preparing heatmap data for', projectsData.length, 'projects');
    
    // Filter out projects with missing coordinates
    const validProjects = projectsData.filter(project => 
      typeof project.latitude === 'number' && 
      typeof project.longitude === 'number'
    );
    
    console.log('[MapView] Found', validProjects.length, 'projects with valid coordinates');
    
    // Count 45-day qualified projects
    const qualified45DayProjects = validProjects.filter(project => 
      isQualified(project.qualifies45Day)
    );
    
    console.log('[MapView] 45-day qualified projects:', qualified45DayProjects.length);
    
    // Create features for the heatmap
    return {
      type: 'FeatureCollection' as const,
      features: validProjects.map(project => {
        // Get classification values
        const ahjClass = project.ahj?.classification || '';
        const utilityClass = project.utility?.classification || '';
        const is45DayQualified = isQualified(project.qualifies45Day);
        
        // Base weight calculation - start with a low default weight
        let baseWeight = 0.1;
        
        // Set base weight for 45-day qualified projects
        if (is45DayQualified) {
          baseWeight = 1.0;
        }
        
        // Apply AHJ classification multiplier
        let ahjMultiplier = 1.0; // Default multiplier
        if (ahjClass === 'A') {
          ahjMultiplier = 2.0;
        } else if (ahjClass === 'B') {
          ahjMultiplier = 1.5;
        } else if (ahjClass === 'C') {
          ahjMultiplier = 1.0;
        } else {
          ahjMultiplier = 0.5; // Unknown classification
        }
        
        // Apply Utility classification multiplier
        let utilityMultiplier = 1.0; // Default multiplier
        if (utilityClass === 'A') {
          utilityMultiplier = 2.0;
        } else if (utilityClass === 'B') {
          utilityMultiplier = 1.5;
        } else if (utilityClass === 'C') {
          utilityMultiplier = 1.0;
        } else {
          utilityMultiplier = 0.5; // Unknown classification
        }
        
        // Calculate final weight
        const finalWeight = baseWeight * ahjMultiplier * utilityMultiplier;
        
        // Log high value projects
        if (finalWeight >= 3.0) {
          console.log(`[MapView] HIGH VALUE PROJECT: Weight ${finalWeight.toFixed(2)} at [${project.longitude}, ${project.latitude}] (45-day: ${is45DayQualified}, AHJ: ${ahjClass}, Utility: ${utilityClass})`);
        }
        
        return {
          type: 'Feature' as const,
          properties: {
            id: project.id,
            ahjClass,
            utilityClass,
            is45DayQualified,
            weight: finalWeight
          },
          geometry: {
            type: 'Point' as const,
            coordinates: [project.longitude || 0, project.latitude || 0]
          }
        };
      })
    };
  };

  // Effect to initialize map
  useEffect(() => {
    if (!mapContainer.current) return;
    
    const initializeMap = async () => {
      // Set Mapbox access token using the utility function
      mapboxgl.accessToken = getMapboxToken();
      
      // Check if token is available
      if (!mapboxgl.accessToken) {
        console.error('[MapView] Mapbox token is missing. Please check your environment variables.');
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
        console.log('[MapView] Map loaded');
        setMapLoaded(true);
        
        // After map loads, trigger geolocation and find nearest projects
        setTimeout(() => {
          console.log('[MapView] Triggering geolocation');
          geolocateControl.trigger();
          
          // Listen for the geolocate event to find nearest projects
          geolocateControl.on('geolocate', (e) => {
            if (!projects || projects.length === 0) return;
            
            const userLocation = {
              longitude: e.coords.longitude,
              latitude: e.coords.latitude
            };
            
            console.log('[MapView] User location:', userLocation);
            
            // Find the 5 closest projects to the user's location
            const projectsWithDistance = projects
              .filter(p => p.latitude && p.longitude)
              .map(project => {
                const distance = calculateDistance(
                  userLocation.latitude,
                  userLocation.longitude,
                  project.latitude!,
                  project.longitude!
                );
                return { project, distance };
              })
              .sort((a, b) => a.distance - b.distance)
              .slice(0, 5);
            
            if (projectsWithDistance.length === 0) return;
            
            console.log('[MapView] Nearest projects:', projectsWithDistance);
            
            // Create a bounds object to encompass all nearby projects and user location
            const bounds = new mapboxgl.LngLatBounds();
            
            // Add user location to bounds
            bounds.extend([userLocation.longitude, userLocation.latitude]);
            
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
          });
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
              console.log(`[MapView] Layer ${layer} not found in map style, skipping`);
            }
          });
        });
      });
      
      map.on('error', (e) => {
        console.error('[MapView] Map error:', e);
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

  // Update visible projects based on map bounds
  const updateVisibleProjects = (currentMap: mapboxgl.Map) => {
    if (!currentMap || !projects || projects.length === 0) {
      console.log('Cannot update visible projects: map or projects not available');
      return;
    }

    const bounds = currentMap.getBounds();
    if (!bounds) {
      console.log('Cannot update visible projects: map bounds not available');
      return;
    }

    console.log(`Total projects: ${projects.length}`);
    
    const visible = projects.filter(project => {
      if (!project.latitude || !project.longitude) {
        console.log(`Project ${project.id} has no coordinates`);
        return false;
      }
      
      const isInBounds = bounds.contains([project.longitude, project.latitude]);
      if (isInBounds) {
        console.log(`Project ${project.id} is in bounds at ${project.latitude}, ${project.longitude}`);
      }
      return isInBounds;
    });

    console.log(`Found ${visible.length} visible projects in current map view`);
    setVisibleProjects(visible);
  };

  // Update visible projects when projects changes
  useEffect(() => {
    if (!mapRef.current || !mapLoaded || !projects) return;
    updateVisibleProjects(mapRef.current);
  }, [projects, mapLoaded]);

  // Update visible projects whenever map moves or projects change
  useEffect(() => {
    if (!mapRef.current || !projects || projects.length === 0 || !mapLoaded) return;
    
    // Get the current map bounds
    const bounds = mapRef.current.getBounds();
    if (!bounds) return;
    
    // Filter projects to only those within the current map bounds
    const inBoundsProjects = projects.filter(project => {
      if (!project.latitude || !project.longitude) return false;
      
      // Add a buffer around the map bounds (approximately 5% of the map width/height)
      const westBuffer = bounds.getWest() - (bounds.getEast() - bounds.getWest()) * 0.05;
      const eastBuffer = bounds.getEast() + (bounds.getEast() - bounds.getWest()) * 0.05;
      const southBuffer = bounds.getSouth() - (bounds.getNorth() - bounds.getSouth()) * 0.05;
      const northBuffer = bounds.getNorth() + (bounds.getNorth() - bounds.getSouth()) * 0.05;
      
      return (
        project.longitude >= westBuffer &&
        project.longitude <= eastBuffer &&
        project.latitude >= southBuffer &&
        project.latitude <= northBuffer
      );
    });
    
    console.log(`Found ${inBoundsProjects.length} projects in current map view`);
    setVisibleProjects(inBoundsProjects);
  }, [projects, mapMoved, mapLoaded]);

  // Add move end event to update visible AHJs
  useEffect(() => {
    const currentMap = mapRef.current;
    if (!currentMap || !mapLoaded) return;

    currentMap.on('moveend', () => {
      console.log('Map moved, updating visible projects');
      updateVisibleProjects(currentMap);
      setMapMoved(prev => !prev); // Toggle to force re-render
    });

    // Also update on load
    currentMap.on('load', () => {
      console.log('Map loaded, updating visible projects');
      updateVisibleProjects(currentMap);
    });
  }, [mapLoaded]);

  // Check scroll position to show/hide arrows
  useEffect(() => {
    const checkScrollPosition = () => {
      if (!cardListRef.current) return;

      const { scrollLeft, scrollWidth, clientWidth } = cardListRef.current;
      setShowLeftArrow(scrollLeft > 0);
      setShowRightArrow(scrollLeft < scrollWidth - clientWidth - 10); // 10px buffer
    };

    const cardList = cardListRef.current;
    if (cardList) {
      cardList.addEventListener('scroll', checkScrollPosition);
      // Initial check
      checkScrollPosition();
    }

    return () => {
      if (cardList) {
        cardList.removeEventListener('scroll', checkScrollPosition);
      }
    };
  }, [visibleProjects]);

  // Handle mouse down for dragging
  const handleMouseDown = (e: React.MouseEvent) => {
    if (!cardListRef.current) return;

    setIsDragging(true);
    setStartX(e.pageX);
    setScrollLeft(cardListRef.current.scrollLeft);
  };

  // Handle mouse leave and mouse up
  const handleMouseUpOrLeave = () => {
    setIsDragging(false);
  };

  // Handle mouse move for dragging
  const handleMouseMove = (e: React.MouseEvent) => {
    if (!isDragging || !cardListRef.current) return;

    e.preventDefault();
    const x = e.pageX;
    const walk = (x - startX) * 2; // Scroll speed multiplier
    cardListRef.current.scrollLeft = scrollLeft - walk;
  };

  // Scroll functions for card list
  const scrollCardListLeft = () => {
    if (cardListRef.current) {
      cardListRef.current.scrollBy({ left: -300, behavior: 'smooth' });
    }
  };

  const scrollCardListRight = () => {
    if (cardListRef.current) {
      cardListRef.current.scrollBy({ left: 300, behavior: 'smooth' });
    }
  };

  // Handle arrow click
  const handleArrowClick = (direction: 'left' | 'right') => {
    if (!cardListRef.current) return;

    const scrollAmount = 300; // Adjust as needed
    const currentScroll = cardListRef.current.scrollLeft;

    cardListRef.current.scrollTo({
      left: direction === 'left' ? currentScroll - scrollAmount : currentScroll + scrollAmount,
      behavior: 'smooth'
    });
  };

  // Handle card navigation
  const handleNextCard = () => {
    if (currentCardIndex < visibleProjects.length - 3) {
      setCurrentCardIndex(currentCardIndex + 1);
    }
  };

  const handlePrevCard = () => {
    if (currentCardIndex > 0) {
      setCurrentCardIndex(currentCardIndex - 1);
    }
  };

  // Handle project click
  const handleProjectClick = (project: Project) => {
    // If the project is already selected, do nothing
    if (localSelectedProject && localSelectedProject.id === project.id) {
      return;
    }
    
    setLocalSelectedProject(project);
    
    // Call the parent component's onSelectProject callback
    if (onSelectProject) {
      onSelectProject(project);
    }
    
    // Fly to the project location - only if user initiated the selection
    if (mapRef.current && project.latitude && project.longitude && allowMapMovement.selection) {
      mapRef.current.flyTo({
        center: [project.longitude, project.latitude],
        zoom: 14,
        essential: true
      });
    }
  };

  // Update local state when prop changes
  useEffect(() => {
    // Only update if the selectedProject prop changes directly
    // This prevents re-focusing when filters are applied or pins are dropped
    if (selectedProject !== localSelectedProject) {
      setLocalSelectedProject(selectedProject);
      
      // Fly to the project location if a new project is selected - only if user initiated
      if (selectedProject && selectedProject.latitude && selectedProject.longitude && 
          mapRef.current && allowMapMovement.selection) {
        mapRef.current.flyTo({
          center: [selectedProject.longitude, selectedProject.latitude],
          zoom: 14,
          essential: true
        });
      }
    }
  }, [selectedProject]);

  // Function to create markers for projects
  const createMarkersForProjects = (projectsToShow: Project[]) => {
    if (!mapRef.current) return [];
    
    const markers = projectsToShow
      .map(project => {
        // Skip projects without coordinates
        if (typeof project.latitude !== 'number' || typeof project.longitude !== 'number') return null;
        
        // Get pin color based on AHJ classification
        let pinImage = '/pin_grey.svg';
        
        if (project.ahj?.classification) {
          if (project.ahj.classification === 'A') {
            pinImage = '/pin_green_active.svg';
          } else if (project.ahj.classification === 'B') {
            pinImage = '/pin_blue_active.svg';
          } else if (project.ahj.classification === 'C') {
            pinImage = '/pin_orange_active.svg';
          } else {
            pinImage = '/pin_grey_active.svg';
          }
        }
        
        // Create marker element
        const el = document.createElement('div');
        el.className = 'marker project-pin'; // Add project-pin class for easy selection
        el.setAttribute('data-pin-type', 'project'); // Add data attribute for better identification
        el.style.backgroundImage = `url(${pinImage})`;
        el.style.width = '30px';
        el.style.height = '30px';
        el.style.backgroundSize = 'contain';
        el.style.backgroundRepeat = 'no-repeat';
        el.style.cursor = 'pointer';
        
        // Create popup
        const popup = new mapboxgl.Popup({
          offset: 25,
          closeButton: false,
          className: 'custom-popup'
        }).setHTML(`
          <div class="p-2">
            <h3 class="text-sm font-semibold">${project.address}</h3>
            <p class="text-xs">AHJ: ${project.ahj?.name || 'Unknown'}</p>
            <p class="text-xs">Status: ${project.status || 'Unknown'}</p>
          </div>
        `);
        
        // Create and return marker
        const marker = new mapboxgl.Marker(el)
          .setLngLat([project.longitude, project.latitude])
          .setPopup(popup)
          .addTo(mapRef.current!);
        
        // Add click handler
        el.addEventListener('click', () => {
          handleProjectClick(project);
        });
        
        return marker;
      })
      .filter(Boolean) as mapboxgl.Marker[];
    
    // Store markers for later reference
    return markers;
  };

  // Add project markers to map
  useEffect(() => {
    if (!mapRef.current || !mapLoaded) return;
    
    console.log('[MapView] Adding markers for', projects?.length || 0, 'projects');
    
    // Clear existing markers
    markersRef.current.forEach(marker => marker.remove());
    
    const unmaskedProjects = projects?.filter(project => !project.isMasked) || [];
    console.log('[MapView] Showing', unmaskedProjects.length, 'unmasked project pins');
    
    const newMarkers = createMarkersForProjects(unmaskedProjects);
    markersRef.current = newMarkers;
  }, [projects, mapLoaded]);

  // Function to find projects within radius
  const findProjectsInRadius = (
    pinLat: number, 
    pinLng: number, 
    radiusInMiles: number, 
    allProjects: Project[]
  ): Project[] => {
    // Convert miles to kilometers (Haversine uses km)
    const radiusInKm = radiusInMiles * 1.60934;
    
    return allProjects.filter(project => {
      if (!project.latitude || !project.longitude) return false;
      
      // Calculate distance using Haversine formula
      const distance = calculateHaversineDistance(
        pinLat, pinLng, 
        project.latitude || 0, project.longitude || 0
      );
      
      // Return projects within the radius
      return distance <= radiusInKm;
    });
  };
  
  // Haversine formula implementation
  const calculateHaversineDistance = (
    lat1: number, lon1: number, 
    lat2: number, lon2: number
  ): number => {
    const R = 6371; // Earth's radius in km
    const dLat = (lat2 - lat1) * Math.PI / 180;
    const dLon = (lon2 - lon1) * Math.PI / 180;
    
    const a = 
      Math.sin(dLat/2) * Math.sin(dLat/2) +
      Math.cos(lat1 * Math.PI / 180) * Math.cos(lat2 * Math.PI / 180) * 
      Math.sin(dLon/2) * Math.sin(dLon/2);
    
    const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1-a));
    return R * c; // Distance in km
  };
  
  // Function to determine servicing entities by majority vote
  const determineServicingEntitiesByMajority = (
    nearbyProjects: Project[]
  ): { 
    ahj: { id: string; name: string; classification: string } | null;
    utility: { id: string; name: string; classification: string } | null;
  } => {
    // Count occurrences
    const ahjCounts: Record<string, { count: number; name: string; classification: string }> = {};
    const utilityCounts: Record<string, { count: number; name: string; classification: string }> = {};
    
    nearbyProjects.forEach(project => {
      // Count AHJs
      if (project.ahj?.id) {
        if (!ahjCounts[project.ahj.id]) {
          ahjCounts[project.ahj.id] = { 
            count: 0, 
            name: project.ahj.name || 'Unknown',
            classification: project.ahj.classification || 'B'
          };
        }
        ahjCounts[project.ahj.id].count++;
      }
      
      // Count utilities
      if (project.utility?.id) {
        if (!utilityCounts[project.utility.id]) {
          utilityCounts[project.utility.id] = { 
            count: 0, 
            name: project.utility.name || 'Unknown',
            classification: project.utility.classification || 'B'
          };
        }
        utilityCounts[project.utility.id].count++;
      }
    });
    
    // Find the most common entities
    let topAHJ = null;
    let topUtility = null;
    let maxAHJCount = 0;
    let maxUtilityCount = 0;
    
    // Find top AHJ
    Object.entries(ahjCounts).forEach(([id, data]) => {
      if (data.count > maxAHJCount) {
        maxAHJCount = data.count;
        topAHJ = { id, name: data.name, classification: data.classification };
      }
    });
    
    // Find top utility
    Object.entries(utilityCounts).forEach(([id, data]) => {
      if (data.count > maxUtilityCount) {
        maxUtilityCount = data.count;
        topUtility = { id, name: data.name, classification: data.classification };
      }
    });
    
    return {
      ahj: topAHJ,
      utility: topUtility
    };
  };

  // Mouse event handlers for dragging
  const handleMouseUp = () => {
    setIsDragging(false);
  };

  const handleMouseLeave = () => {
    setIsDragging(false);
  };

  // Handle closing the selected project
  const handleCloseProject = () => {
    setLocalSelectedProject(null);
    if (onSelectProject) {
      onSelectProject(null);
    }
  };

  // Render a project card
  const renderProjectCard = (project: Project) => {
    // Check if project belongs to current user
    const isUserProject = project.rep_id && userProfile?.rep_id && project.rep_id === userProfile.rep_id;
    
    return (
      <div
        key={project.id}
        className={`flex-shrink-0 w-100 h-full p-4 rounded-md mr-4 cursor-pointer transition-all duration-200 ${
          localSelectedProject?.id === project.id
            ? 'bg-textured-neutral-800 border-2 border-neutral-300'
            : 'bg-textured-neutral-900 border border-neutral-700 hover:border-neutral-500'
        } ${project.isMasked ? 'bg-textured-neutral-800' : ''}`}
        onClick={() => handleProjectClick(project)}
      >
        <div className="flex flex-col h-full">
          <div className="flex justify-between items-start mb-2 w-100%">
            <div className="flex items-start gap-2">
              {isUserProject && (
                <div 
                  className="w-3 h-3 rounded-full bg-blue-500 mt-1 flex-shrink-0" 
                  title="Assigned to you"
                />
              )}
              <h3 className={`text-sm font-semibold truncate w-60 ${project.isMasked ? 'text-neutral-500' : ''}`}>{project.address || 'Unnamed'}</h3>
            </div>
            <div className="flex items-center gap-1">
              {isQualified(project.qualifies45Day) && (
                <span className="inline-flex items-center px-2 py-0.5 rounded text-xs font-medium bg-green-900 text-green-100">
                  45 Day
                </span>
              )}
              <span
                className={`inline-flex items-center px-2 py-1 rounded-sm text-xs font-medium ${getClassificationBadgeClass(project.ahj.classification)}`}
              >
                Class {project.ahj.classification || 'Unknown'}
              </span>
            </div>
          </div>

          <div className={`text-xs mb-1 ${project.isMasked ? 'text-neutral-500' : 'text-neutral-100'}`}>
            AHJ: {project.ahj.name}
          </div>

          <div className={`text-xs mb-1 ${project.isMasked ? 'text-neutral-500' : 'text-neutral-100'}`}>
            Utility: {project.utility.name}
          </div>

          <div className={`text-xs mb-auto ${project.isMasked ? 'text-neutral-500' : 'text-neutral-100'}`}>
            Financier: {project.financier.name}
          </div>

          <div className="mt-2 text-xs text-neutral-500 flex justify-between">
            <span>Status: {project.status || 'Unknown'}</span>
            {project.isMasked && (
              <span className="text-amber-500">Restricted Info</span>
            )}
          </div>
        </div>
      </div>
    );
  };

  const [filters, setFilters] = useState<ProjectFilter[]>([]);
  const [searchTerms, setSearchTerms] = useState<string[]>([]);
  const [viewMode, setViewMode] = useState<'map' | 'list'>('map');

  const handleSearch = (terms: string[]) => {
    setSearchTerms(terms);
  };

  const handleViewModeChange = (mode: 'map' | 'list') => {
    setViewMode(mode);
  };

  const toggleShowOnlyMyProjects = () => {
    setShowOnlyMyProjects(!showOnlyMyProjects);
  };

  const toggleShowKefeProjects = () => {
    setShowKefeProjects(!showKefeProjects);
  };

  const addFilter = (filter: ProjectFilter) => {
    setFilters([...filters, filter]);
  };

  const removeFilter = (filter: ProjectFilter) => {
    setFilters(filters.filter(f => !(f.type === filter.type && f.value === filter.value)));
  };

  const clearFilters = () => {
    setFilters([]);
  };

  // Memoize visible projects to prevent unnecessary re-renders
  const sortedVisibleProjects = useMemo(() => {
    return [...visibleProjects].sort((a, b) => {
      // First, prioritize unmasked projects over masked ones
      if (!a.isMasked && b.isMasked) return -1;
      if (a.isMasked && !b.isMasked) return 1;
      
      // Within each group (masked or unmasked), prioritize user's own projects
      const aIsUserProject = a.rep_id && userProfile?.rep_id && a.rep_id === userProfile.rep_id;
      const bIsUserProject = b.rep_id && userProfile?.rep_id && b.rep_id === userProfile.rep_id;
      
      if (aIsUserProject && !bIsUserProject) return -1;
      if (!aIsUserProject && bIsUserProject) return 1;
      
      // Then sort by classification
      const getClassValue = (project: Project) => {
        const classification = project.ahj?.classification;
        
        if (classification === 'A') return 1;
        if (classification === 'B') return 2;
        if (classification === 'C') return 3;
        return 4;
      };
      
      return getClassValue(a) - getClassValue(b);
    });
  }, [visibleProjects, userProfile]);

  return (
    <div className="relative w-full h-full">
      <div ref={mapContainer} className="w-full h-full" />
      
      {/* Improved Filter Panel */}
      <ImprovedFilterPanel
        filters={[]} // Pass empty filters array or implement filters logic
        addFilter={() => {}} // Implement filter adding logic
        removeFilter={() => {}} // Implement filter removing logic
        clearFilters={() => {}} // Implement clear filters logic
        viewMode="map"
        onViewModeChange={() => {}} // This is handled internally in MapView
        showOnlyMyProjects={showOnlyMyProjects}
        toggleShowOnlyMyProjects={toggleShowOnlyMyProjects}
      />
      
      {/* Project cards at the bottom */}
      {(sortedVisibleProjects.length > 0 || localSelectedProject) && (
        <div className="absolute bottom-0 left-0 right-0 p-4 pointer-events-none">
          {/* Left scroll button */}
          {showLeftArrow && (
            <button
              className="absolute left-2 top-1/2 transform -translate-y-1/2 bg-gray-800 rounded-full p-2 z-10 pointer-events-auto"
              onClick={scrollCardListLeft}
            >
              <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5 text-white" viewBox="0 0 20 20" fill="currentColor">
                <path fillRule="evenodd" d="M12.707 5.293a1 1 0 010 1.414L9.414 10l3.293 3.293a1 1 0 01-1.414 1.414l-4-4a1 1 0 010-1.414l4-4a1 1 0 011.414 0z" clipRule="evenodd" />
              </svg>
            </button>
          )}
          
          {/* Right scroll button */}
          {showRightArrow && (
            <button
              className="absolute right-2 top-1/2 transform -translate-y-1/2 bg-gray-800 rounded-full p-2 z-10 pointer-events-auto"
              onClick={scrollCardListRight}
            >
              <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5 text-white" viewBox="0 0 20 20" fill="currentColor">
                <path fillRule="evenodd" d="M7.293 14.707a1 1 0 010-1.414L10.586 10 7.293 6.707a1 1 0 011.414-1.414l4 4a1 1 0 010 1.414l-4 4a1 1 0 01-1.414 0z" clipRule="evenodd" />
              </svg>
            </button>
          )}
          
          <div 
            ref={cardListRef}
            className="flex space-x-4 overflow-x-auto pb-2 snap-x pointer-events-auto scrollbar-thin scrollbar-thumb-gray-600 scrollbar-track-transparent"
            onMouseDown={handleMouseDown}
            onMouseUp={handleMouseUpOrLeave}
            onMouseLeave={handleMouseUpOrLeave}
            onMouseMove={handleMouseMove}
          >
            {/* Selected Project Card */}
            {localSelectedProject && (
              <div 
                className={`flex-shrink-0 w-96 bg-gray-800 rounded-lg shadow-lg overflow-hidden`}
              >
                <div className="p-4">
                  <div className="flex justify-between items-start mb-2">
                    <h3 className="text-lg font-semibold">
                      {localSelectedProject.isMasked 
                        ? 'Project Details (Restricted)' 
                        : localSelectedProject.ahj.name || 'Project Details'}
                    </h3>
                    <button 
                      onClick={handleCloseProject}
                      className="text-gray-400 hover:text-white pointer-events-auto"
                    >
                      ✕
                    </button>
                  </div>
                  
                  <div className="grid grid-cols-2 gap-2 text-sm">
                    <div>
                      <p className="text-gray-400">Address:</p>
                      <p>{localSelectedProject.isMasked ? '[Restricted]' : localSelectedProject.address}</p>
                    </div>
                    <div>
                      <p className="text-gray-400">Status:</p>
                      <p>{localSelectedProject.status}</p>
                    </div>
                    <div>
                      <p className="text-gray-400">AHJ:</p>
                      <p>
                        {localSelectedProject.isMasked ? '[Restricted]' : localSelectedProject.ahj.name}
                        {localSelectedProject.ahj.classification && (
                          <span className={`ml-2 inline-block px-2 py-0.5 rounded text-xs font-medium ${getClassificationBadgeClass(localSelectedProject.ahj.classification)}`}>
                            {localSelectedProject.ahj.classification}
                          </span>
                        )}
                      </p>
                    </div>
                    <div>
                      <p className="text-gray-400">Utility:</p>
                      <p>
                        {localSelectedProject.isMasked ? '[Restricted]' : localSelectedProject.utility.name}
                        {localSelectedProject.utility.classification && (
                          <span className={`ml-2 inline-block px-2 py-0.5 rounded text-xs font-medium ${getClassificationBadgeClass(localSelectedProject.utility.classification)}`}>
                            {localSelectedProject.utility.classification}
                          </span>
                        )}
                      </p>
                    </div>
                    <div>
                      <p className="text-gray-400">Financier:</p>
                      <p>
                        {localSelectedProject.isMasked ? '[Restricted]' : localSelectedProject.financier.name}
                        {localSelectedProject.financier.classification && (
                          <span className={`ml-2 inline-block px-2 py-0.5 rounded text-xs font-medium ${getClassificationBadgeClass(localSelectedProject.financier.classification)}`}>
                            {localSelectedProject.financier.classification}
                          </span>
                        )}
                      </p>
                    </div>
                    <div>
                      <p className="text-gray-400">45 Day Qualified:</p>
                      <p>{mapQualificationStatus(localSelectedProject.qualifies45Day)}</p>
                    </div>
                  </div>
                </div>
              </div>
            )}
            
            {/* Project Cards */}
            {sortedVisibleProjects.map(project => renderProjectCard(project))}
          </div>
        </div>
      )}
    </div>
  );
};

export default MapView;
