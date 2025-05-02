import React, { useRef, useState, useEffect, useMemo, useCallback } from 'react';
import mapboxgl from 'mapbox-gl';
import 'mapbox-gl/dist/mapbox-gl.css';
import { AHJ, Project, ProjectFilter } from '@/utils/types';
import { useAuth } from '@/utils/AuthContext';
import { getClassificationMapColor, getClassificationBadgeClass } from '@/utils/classificationColors';
import { getMapboxToken } from '@/utils/mapbox';
import { mapQualificationStatus, isQualified } from '@/utils/qualificationStatus';

// Cache for city boundaries to avoid repeated API calls
const cityBoundaryCache: { [key: string]: any } = {};

interface MapViewProps {
  ahjs?: AHJ[];
  selectedAHJ?: AHJ | null;
  onSelectAHJ?: (ahj: AHJ) => void;
  selectedUtility?: any;
  projects?: Project[];
  selectedProject: Project | null;
  onSelectProject?: (project: Project | null) => void;
  predictionModeActive?: boolean;
  predictionResult?: any;
  setPredictionResult?: React.Dispatch<React.SetStateAction<any>>;
  predictionRadius?: number;
  setPredictionRadius?: React.Dispatch<React.SetStateAction<number>>;
  predictionPinLocation?: [number, number] | null;
  setPredictionPinLocation?: React.Dispatch<React.SetStateAction<[number, number] | null>>;
}

const MapView: React.FC<MapViewProps> = ({
  ahjs,
  selectedAHJ,
  onSelectAHJ,
  selectedUtility,
  projects,
  selectedProject,
  onSelectProject,
  predictionModeActive = true, // Default to true
  predictionResult,
  setPredictionResult,
  predictionRadius,
  setPredictionRadius,
  predictionPinLocation,
  setPredictionPinLocation
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
  const [visibleProjects, setVisibleProjects] = useState<Project[]>([]);
  const [projectMarkers, setProjectMarkers] = useState<mapboxgl.Marker[]>([]);
  const [isDragging, setIsDragging] = useState(false);
  const [startX, setStartX] = useState(0);
  const [scrollLeftPos, setScrollLeftPos] = useState(0);
  const [showLeftArrow, setShowLeftArrow] = useState(false);
  const [showRightArrow, setShowRightArrow] = useState(true);
  const [mapMoved, setMapMoved] = useState(false);
  const [currentCardIndex, setCurrentCardIndex] = useState(0);
  const cardsToShow = 3; // Number of cards to show at once
  const [localSelectedProject, setLocalSelectedProject] = useState<Project | null>(selectedProject);
  
  // Prediction mode state - use props if provided, otherwise use local state
  const [localPredictionPinLocation, setLocalPredictionPinLocation] = useState<[number, number] | null>(null);
  
  // Use the prediction props if provided, otherwise use local state
  const actualPredictionModeActive = predictionModeActive !== undefined ? predictionModeActive : true;
  const actualPredictionRadius = predictionRadius !== undefined ? predictionRadius : 5;
  const actualSetPredictionRadius = setPredictionRadius || ((value: number) => {});
  const actualPredictionResult = predictionResult !== undefined ? predictionResult : null;
  const actualSetPredictionResult = setPredictionResult || ((value: any) => {});
  const actualPredictionPinLocation = predictionPinLocation !== undefined ? predictionPinLocation : localPredictionPinLocation;
  const actualSetPredictionPinLocation = setPredictionPinLocation || setLocalPredictionPinLocation;
  
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

  // Flag to track if map movements should be allowed
  // This prevents automatic map movements when filters change or data updates
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
        const classification = project.ahj.classification;
        
        if (classification === 'A') return 1;
        if (classification === 'B') return 2;
        if (classification === 'C') return 3;
        return 4;
      };
      
      return getClassValue(a) - getClassValue(b);
    });
  }, [visibleProjects, userProfile]);

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

  // Store map state and prediction state when component unmounts (switching to list view)
  useEffect(() => {
    return () => {
      if (mapRef.current) {
        const center = mapRef.current.getCenter().toArray() as [number, number];
        const zoom = mapRef.current.getZoom();
        const bearing = mapRef.current.getBearing();
        const pitch = mapRef.current.getPitch();
        
        // Save the map state to localStorage for persistence
        const mapState = { center, zoom, bearing, pitch };
        localStorage.setItem('mapViewState', JSON.stringify(mapState));
        setSavedMapState(mapState);
        
        // Save prediction state
        if (actualPredictionPinLocation) {
          localStorage.setItem('predictionPinLocation', JSON.stringify(actualPredictionPinLocation));
        }
        
        if (actualPredictionResult) {
          localStorage.setItem('predictionResult', JSON.stringify(actualPredictionResult));
        }
        
        localStorage.setItem('predictionRadius', actualPredictionRadius.toString());
        localStorage.setItem('predictionModeActive', actualPredictionModeActive.toString());
      }
    };
  }, [actualPredictionPinLocation, actualPredictionResult, actualPredictionRadius, actualPredictionModeActive]);

  // Restore map state and prediction state when initializing map
  useEffect(() => {
    if (!mapRef.current || !mapLoaded) return;
    
    try {
      // Try to get saved state from localStorage
      const savedState = localStorage.getItem('mapViewState');
      
      if (savedState) {
        const { center, zoom, bearing, pitch } = JSON.parse(savedState);
        
        // Only restore if we have valid coordinates
        if (center && center.length === 2 && !isNaN(center[0]) && !isNaN(center[1])) {
          console.log('[MapView] Restoring saved map state:', { center, zoom, bearing, pitch });
          
          // Use jumpTo to avoid animation
          mapRef.current.jumpTo({
            center,
            zoom,
            bearing,
            pitch
          });
          
          // Disable initial movement since we're restoring a saved state
          setAllowMapMovement(prev => ({ ...prev, initial: false }));
        }
      }
      
      // Restore prediction state if in prediction mode
      if (actualPredictionModeActive) {
        // Restore prediction pin location
        const savedPinLocation = localStorage.getItem('predictionPinLocation');
        if (savedPinLocation && !actualPredictionPinLocation) {
          const pinLocation = JSON.parse(savedPinLocation) as [number, number];
          actualSetPredictionPinLocation(pinLocation);
          
          // Create prediction pin element
          const pinElement = document.createElement('div');
          pinElement.id = 'prediction-pin';
          pinElement.className = 'prediction-pin';
          pinElement.style.width = '30px';
          pinElement.style.height = '30px';
          pinElement.style.backgroundImage = 'url(/pin_prediction.svg)';
          pinElement.style.backgroundSize = 'contain';
          pinElement.style.backgroundRepeat = 'no-repeat';
          
          // Add prediction pin
          new mapboxgl.Marker(pinElement)
            .setLngLat(pinLocation)
            .addTo(mapRef.current);
          
          // Restore prediction radius circle
          const radiusInMeters = actualPredictionRadius * 1609.34; // Convert miles to meters
          const radiusOptions = {
            steps: 64,
            units: 'meters' as const
          };
          
          const circleGeoJSON = createGeoJSONCircle(pinLocation, radiusInMeters, radiusOptions);
          
          // Add the radius source and layers
          mapRef.current.addSource('prediction-radius', {
            type: 'geojson',
            data: circleGeoJSON as any
          });
          
          mapRef.current.addLayer({
            id: 'prediction-radius-fill',
            type: 'fill',
            source: 'prediction-radius',
            paint: {
              'fill-color': '#4285F4',
              'fill-opacity': 0.2
            }
          });
          
          mapRef.current.addLayer({
            id: 'prediction-radius-outline',
            type: 'line',
            source: 'prediction-radius',
            paint: {
              'line-color': '#4285F4',
              'line-width': 2,
              'line-opacity': 0.7
            }
          });
          
          // Restore prediction result
          const savedPredictionResult = localStorage.getItem('predictionResult');
          if (savedPredictionResult && !actualPredictionResult) {
            actualSetPredictionResult(JSON.parse(savedPredictionResult));
          }
        }
      }
    } catch (error) {
      console.error('[MapView] Error restoring map state:', error);
    }
  }, [mapLoaded, actualPredictionModeActive, actualPredictionPinLocation, actualPredictionResult]);

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
    setScrollLeftPos(cardListRef.current.scrollLeft);
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
    cardListRef.current.scrollLeft = scrollLeftPos - walk;
  };

  // Scroll functions for card list
  const scrollCardLeft = () => {
    if (cardListRef.current) {
      cardListRef.current.scrollBy({ left: -300, behavior: 'smooth' });
    }
  };

  const scrollCardRight = () => {
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
    if (currentCardIndex < visibleProjects.length - cardsToShow) {
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

  // Add project markers to the map - optimized version
  useEffect(() => {
    const currentMap = mapRef.current;
    if (!currentMap || !mapLoaded) return;
    
    console.log('[MapView] Adding markers for', projects?.length || 0, 'projects');
    
    // Clear existing markers
    markersRef.current.forEach(marker => marker.remove());
    markersRef.current = [];
    
    // If there are no projects matching the filters, don't add any markers
    if (!projects || projects.length === 0) {
      console.log('[MapView] No projects match the current filters');
      return;
    }
    
    // Preload SVG images to improve performance
    const preloadImages = [
      '/pin_green.svg', 
      '/pin_green_active.svg',
      '/pin_blue.svg', 
      '/pin_blue_active.svg',
      '/pin_orange.svg', 
      '/pin_orange_active.svg',
      '/pin_grey.svg', 
      '/pin_grey_active.svg'
    ];
    
    preloadImages.forEach(src => {
      const img = new Image();
      img.src = src;
    });
    
    // Create markers in batches to improve performance
    const batchSize = 20;
    let currentBatch = 0;
    
    const createMarkerBatch = () => {
      const start = currentBatch * batchSize;
      const end = Math.min(start + batchSize, projects.length);
      const batch = projects.slice(start, end);
      
      batch.forEach(project => {
        // Skip projects with invalid coordinates
        if (typeof project.latitude !== 'number' || typeof project.longitude !== 'number' || 
            isNaN(project.latitude) || isNaN(project.longitude)) {
          return;
        }
        
        // Get classification based on current view
        let classification = '';
        classification = project.ahj.classification || '';
        
        // Select the appropriate pin image
        let pinImage = '';
        if (classification === 'A') {
          pinImage = project.isMasked ? '/pin_green.svg' : '/pin_green_active.svg';
        } else if (classification === 'B') {
          pinImage = project.isMasked ? '/pin_blue.svg' : '/pin_blue_active.svg';
        } else if (classification === 'C') {
          pinImage = project.isMasked ? '/pin_orange.svg' : '/pin_orange_active.svg';
        } else {
          pinImage = project.isMasked ? '/pin_grey.svg' : '/pin_grey_active.svg';
        }

        // Create marker element
        const el = document.createElement('div');
        el.className = 'project-marker';
        el.style.width = '30px';
        el.style.height = '30px';
        el.style.backgroundImage = `url(${pinImage})`;
        el.style.backgroundSize = 'contain';
        el.style.backgroundRepeat = 'no-repeat';
        el.style.cursor = 'pointer';
        
        // Check if project belongs to current user
        const isUserProject = project.rep_id && userProfile?.rep_id && project.rep_id === userProfile.rep_id;
        
        // Add user project indicator if applicable
        if (isUserProject) {
          const userIndicator = document.createElement('div');
          userIndicator.className = 'user-project-indicator';
          userIndicator.style.position = 'absolute';
          userIndicator.style.top = '2px';
          userIndicator.style.left = '-5px';
          userIndicator.style.width = '10px';
          userIndicator.style.height = '10px';
          userIndicator.style.borderRadius = '50%';
          userIndicator.style.backgroundColor = '#007bff'; // Blue
          userIndicator.title = 'Assigned to you';
          el.appendChild(userIndicator);
        }
        
        // Add 45 Day qualification indicator if applicable
        if (isQualified(project.qualifies45Day)) {
          const badge = document.createElement('div');
          badge.className = 'qualification-badge';
          badge.style.position = 'absolute';
          badge.style.top = '-5px';
          badge.style.right = '-5px';
          badge.style.width = '12px';
          badge.style.height = '12px';
          badge.style.borderRadius = '50%';
          badge.style.backgroundColor = '#4CAF50'; // Green
          badge.style.border = '2px solid white';
          badge.title = '45 Day Program Qualified';
          el.appendChild(badge);
          el.style.position = 'relative'; // Needed for positioning the badge
        }
        
        // Add title for masked projects
        if (project.isMasked) {
          el.title = 'Non-active project — restricted info';
        }
        
        try {
          // Create a marker with consistent options for all markers
          const marker = new mapboxgl.Marker({
            element: el,
            anchor: 'center',
            draggable: false,
            offset: [0, 0],
            rotationAlignment: 'map',
            pitchAlignment: 'map'
          })
            .setLngLat([project.longitude, project.latitude])
            .addTo(currentMap);
          
          // Store marker reference
          markersRef.current.push(marker);

          // Add click event
          el.addEventListener('click', () => {
            handleProjectClick(project);
          });

          // Highlight selected project
          if (localSelectedProject && project.id === localSelectedProject.id) {
            el.style.width = '40px';
            el.style.height = '40px';
            el.style.zIndex = '10';
          }
        } catch (error) {
          console.error(`[MapView] Error creating marker for project ${project.id}:`, error);
        }
      });
      
      currentBatch++;
      
      // If there are more batches to process, schedule the next batch
      if (currentBatch * batchSize < projects.length) {
        setTimeout(createMarkerBatch, 0);
      }
    };
    
    // Start creating markers in batches
    createMarkerBatch();
    
    // If a project is selected, fly to it - but only if prediction mode is not active
    // and only if user initiated the selection
    if (localSelectedProject && 
        !actualPredictionModeActive &&
        allowMapMovement.selection &&
        typeof localSelectedProject.latitude === 'number' && !isNaN(localSelectedProject.latitude) &&
        typeof localSelectedProject.longitude === 'number' && !isNaN(localSelectedProject.longitude)) {
      try {
        currentMap.flyTo({
          center: [localSelectedProject.longitude, localSelectedProject.latitude],
          zoom: 14,
          essential: true
        });
      } catch (error) {
        console.error('[MapView] Error flying to selected project:', error);
      }
    }
  }, [projects, localSelectedProject, mapLoaded, onSelectProject, userProfile, actualPredictionModeActive]);

  // Effect to handle prediction mode changes
  useEffect(() => {
    const currentMap = mapRef.current;
    if (!currentMap || !mapLoaded) return;
    
    // Clean up prediction elements when prediction mode is disabled
    if (!actualPredictionModeActive) {
      if (actualPredictionPinLocation) {
        // Remove existing prediction pin if any
        const existingPin = document.getElementById('prediction-pin');
        if (existingPin) {
          existingPin.remove();
        }
      }
      
      if (currentMap.getSource('prediction-radius')) {
        currentMap.removeLayer('prediction-radius-fill');
        currentMap.removeLayer('prediction-radius-outline');
        currentMap.removeSource('prediction-radius');
      }
      
      actualSetPredictionResult(null);
      return;
    }
    
    // Add click handler for prediction mode
    const handleMapClick = (e: mapboxgl.MapMouseEvent) => {
      if (!actualPredictionModeActive || !currentMap) return;
      
      // Get clicked coordinates
      const { lng: clickedLng, lat: clickedLat } = e.lngLat;
      
      // Remove existing prediction pin if any
      const existingPin = document.getElementById('prediction-pin');
      if (existingPin) {
        existingPin.remove();
      }
      
      // Create prediction pin element
      const pinElement = document.createElement('div');
      pinElement.id = 'prediction-pin';
      pinElement.className = 'prediction-pin';
      pinElement.style.width = '30px';
      pinElement.style.height = '30px';
      pinElement.style.backgroundImage = 'url(/pin_prediction.svg)';
      pinElement.style.backgroundSize = 'contain';
      pinElement.style.backgroundRepeat = 'no-repeat';
      
      // Add new prediction pin
      new mapboxgl.Marker(pinElement)
        .setLngLat([clickedLng, clickedLat])
        .addTo(currentMap);
      
      // Save pin location to state
      const newPinLocation: [number, number] = [clickedLng, clickedLat];
      actualSetPredictionPinLocation(newPinLocation);
      
      // Create or update radius circle
      const radiusInMeters = actualPredictionRadius * 1609.34; // Convert miles to meters
      const radiusOptions = {
        steps: 64,
        units: 'meters' as const
      };
      
      const circleGeoJSON = createGeoJSONCircle([clickedLng, clickedLat], radiusInMeters, radiusOptions);
      
      // Add or update the radius source and layers
      if (currentMap.getSource('prediction-radius')) {
        const source = currentMap.getSource('prediction-radius') as mapboxgl.GeoJSONSource;
        source.setData(circleGeoJSON as any);
      } else {
        currentMap.addSource('prediction-radius', {
          type: 'geojson',
          data: circleGeoJSON as any
        });
        
        currentMap.addLayer({
          id: 'prediction-radius-fill',
          type: 'fill',
          source: 'prediction-radius',
          paint: {
            'fill-color': '#4285F4',
            'fill-opacity': 0.2
          }
        });
        
        currentMap.addLayer({
          id: 'prediction-radius-outline',
          type: 'line',
          source: 'prediction-radius',
          paint: {
            'line-color': '#4285F4',
            'line-width': 2,
            'line-opacity': 0.7
          }
        });
      }
      
      // Calculate prediction
      calculatePrediction(clickedLat, clickedLng);
    };
    
    // Add click handler
    currentMap.on('click', handleMapClick);
    
    // Cleanup function
    return () => {
      currentMap.off('click', handleMapClick);
    };
  }, [actualPredictionModeActive, mapLoaded, actualPredictionPinLocation, actualPredictionRadius, projects]);

  // Function to calculate prediction
  const calculatePrediction = useCallback((lat: number, lng: number) => {
    if (!projects || projects.length === 0) {
      actualSetPredictionResult({
        probability: 0,
        nearbyProjects: [],
        ahj: null,
        utility: null,
        financier: null,
        qualifiedCount: 0,
        totalCount: 0
      });
      return;
    }
    
    // Find nearby projects within radius
    const nearbyProjects = findProjectsInRadius(lat, lng, actualPredictionRadius, projects);
    
    if (nearbyProjects.length === 0) {
      actualSetPredictionResult({
        probability: 0,
        nearbyProjects: [],
        ahj: null,
        utility: null,
        financier: null,
        qualifiedCount: 0,
        totalCount: 0
      });
      return;
    }
    
    // Determine likely AHJ, utility, and financier based on nearby projects
    const servicingEntities = determineServicingEntitiesByMajority(nearbyProjects);
    
    // Calculate distances for each project
    const projectsWithDistance = nearbyProjects.map(project => {
      const distance = calculateHaversineDistance(
        lat, lng, 
        project.latitude || 0, project.longitude || 0
      );
      return { 
        project, 
        distance,
        isQualified: isQualified(project.qualifies45Day)
      };
    });
    
    // Sort by distance
    projectsWithDistance.sort((a, b) => a.distance - b.distance);
    
    // Log for debugging
    console.log("Projects with distance:", JSON.stringify(projectsWithDistance.map(p => ({
      address: p.project.address,
      distance: p.distance.toFixed(2) + " km",
      isQualified: p.isQualified
    })), null, 2));
    
    // Count qualified projects
    const qualifiedProjects = nearbyProjects.filter(project => 
      isQualified(project.qualifies45Day)
    );
    
    // Calculate probability based on:
    // 1. Percentage of nearby qualified projects
    // 2. Classifications of AHJ, utility, and financier
    // 3. Distance-weighted qualification rate (closer projects have more influence)
    
    // Base probability from nearby project qualification rate
    const baseProbability = (qualifiedProjects.length / nearbyProjects.length) * 100;
    console.log("Base probability:", baseProbability.toFixed(2) + "%");
    
    let probability = baseProbability;
    
    // Apply distance weighting to the probability calculation
    if (projectsWithDistance.length > 0) {
      // Maximum radius in km
      const maxRadius = actualPredictionRadius * 1.60934;
      
      // Calculate distance-weighted qualification rate
      let weightedQualifiedSum = 0;
      let weightSum = 0;
      
      // Log individual project weights
      const projectWeights: Array<{
        address: string;
        distance: string;
        weight: string;
        isQualified: boolean;
      }> = [];
      
      projectsWithDistance.forEach(({ project, distance, isQualified }) => {
        // Weight is inversely proportional to distance (closer = higher weight)
        // Projects at the edge of the radius have 10% of the weight of those at the center
        // Use a more aggressive curve to emphasize nearby projects
        const weight = Math.pow(1 - (distance / maxRadius), 2);
        
        // Add to weighted sums
        if (isQualified) {
          weightedQualifiedSum += weight;
        }
        weightSum += weight;
        
        // Log for debugging
        projectWeights.push({
          address: project.address,
          distance: distance.toFixed(2) + " km",
          weight: weight.toFixed(3),
          isQualified
        });
      });
      
      console.log("Project weights:", JSON.stringify(projectWeights, null, 2));
      
      // Calculate weighted probability if we have valid weights
      if (weightSum > 0) {
        const weightedProbability = (weightedQualifiedSum / weightSum) * 100;
        console.log("Weighted probability:", weightedProbability.toFixed(2) + "%");
        
        // Blend the original probability with the weighted probability
        // Give the weighted probability more influence (80%)
        probability = baseProbability * 0.2 + weightedProbability * 0.8;
        console.log("Blended probability:", probability.toFixed(2) + "%");
      }
    }
    
    // Adjust probability based on entity classifications
    const classificationBonus = {
      'A': 20, // A classification adds 20% to probability
      'B': 0,  // B classification is neutral
      'C': -20 // C classification subtracts 20% from probability
    };
    
    let classificationAdjustment = 0;
    
    // Apply classification adjustments if entities are found
    if (servicingEntities.ahj && servicingEntities.ahj.classification) {
      const adjustment = classificationBonus[servicingEntities.ahj.classification as 'A' | 'B' | 'C'] || 0;
      classificationAdjustment += adjustment;
      console.log(`AHJ ${servicingEntities.ahj.classification} adjustment: ${adjustment}%`);
    }
    
    if (servicingEntities.utility && servicingEntities.utility.classification) {
      const adjustment = classificationBonus[servicingEntities.utility.classification as 'A' | 'B' | 'C'] || 0;
      classificationAdjustment += adjustment;
      console.log(`Utility ${servicingEntities.utility.classification} adjustment: ${adjustment}%`);
    }
    
    if (servicingEntities.financier && servicingEntities.financier.classification) {
      const adjustment = classificationBonus[servicingEntities.financier.classification as 'A' | 'B' | 'C'] || 0;
      classificationAdjustment += adjustment;
      console.log(`Financier ${servicingEntities.financier.classification} adjustment: ${adjustment}%`);
    }
    
    probability += classificationAdjustment;
    console.log(`After classification adjustments: ${probability.toFixed(2)}%`);
    
    // Ensure probability is between 0 and 100
    probability = Math.max(0, Math.min(100, probability));
    console.log(`Final probability: ${probability.toFixed(2)}%`);
    
    // Set prediction result
    actualSetPredictionResult({
      probability: Math.round(probability),
      nearbyProjects,
      ahj: servicingEntities.ahj,
      utility: servicingEntities.utility,
      financier: servicingEntities.financier,
      qualifiedCount: qualifiedProjects.length,
      totalCount: nearbyProjects.length
    });
  }, [actualPredictionRadius, projects, actualSetPredictionResult]);
  
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
        project.latitude, project.longitude
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
    financier: { id: string; name: string; classification: string } | null;
  } => {
    // Count occurrences
    const ahjCounts: Record<string, { count: number; name: string; classification: string }> = {};
    const utilityCounts: Record<string, { count: number; name: string; classification: string }> = {};
    const financierCounts: Record<string, { count: number; name: string; classification: string }> = {};
    
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
      
      // Count financiers
      if (project.financier?.id) {
        if (!financierCounts[project.financier.id]) {
          financierCounts[project.financier.id] = { 
            count: 0, 
            name: project.financier.name || 'Unknown',
            classification: project.financier.classification || 'B'
          };
        }
        financierCounts[project.financier.id].count++;
      }
    });
    
    // Find most common entities
    const findMostCommon = (
      counts: Record<string, { count: number; name: string; classification: string }>
    ): { id: string; name: string; classification: string } | null => {
      let maxCount = 0;
      let mostCommon = null;
      
      Object.entries(counts).forEach(([id, data]) => {
        if (data.count > maxCount) {
          maxCount = data.count;
          mostCommon = { id, name: data.name, classification: data.classification };
        }
      });
      
      return mostCommon;
    };
    
    return {
      ahj: findMostCommon(ahjCounts),
      utility: findMostCommon(utilityCounts),
      financier: findMostCommon(financierCounts)
    };
  };

  // Scroll functions for the card list
  const scrollLeft = () => {
    if (cardListRef.current) {
      cardListRef.current.scrollBy({ left: -300, behavior: 'smooth' });
    }
  };

  const scrollRight = () => {
    if (cardListRef.current) {
      cardListRef.current.scrollBy({ left: 300, behavior: 'smooth' });
    }
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
              <h3 className={`text-sm font-semibold truncate w-60 ${project.isMasked ? 'text-neutral-500' : ''}`}>{project.address}</h3>
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
  const [showOnlyMyProjects, setShowOnlyMyProjects] = useState(false);

  const handleSearch = (terms: string[]) => {
    setSearchTerms(terms);
  };

  const handleViewModeChange = (mode: 'map' | 'list') => {
    setViewMode(mode);
  };

  const toggleShowOnlyMyProjects = () => {
    setShowOnlyMyProjects(!showOnlyMyProjects);
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

  const togglePredictionMode = () => {
    const newMode = !actualPredictionModeActive;
    actualSetPredictionRadius(newMode ? 5 : actualPredictionRadius);
    
    // Clear prediction results when turning off prediction mode
    if (!newMode) {
      actualSetPredictionResult(null);
      
      // Remove prediction pin and circle
      const existingPin = document.getElementById('prediction-pin');
      if (existingPin) {
        existingPin.remove();
      }
      
      if (mapRef.current && mapRef.current.getSource('prediction-radius')) {
        mapRef.current.removeLayer('prediction-radius-fill');
        mapRef.current.removeLayer('prediction-radius-outline');
        mapRef.current.removeSource('prediction-radius');
      }
    }
  };

  useEffect(() => {
    // When prediction mode is activated, we don't want to zoom to the selected project
    // This flag will be used in the project selection effect
    if (actualPredictionModeActive) {
      // Clear local selection without triggering a zoom
      setLocalSelectedProject(null);
    }
  }, [actualPredictionModeActive]);

  // Add user controls for map movement
  useEffect(() => {
    // Add a control button to toggle map movement
    if (mapRef.current && mapLoaded) {
      const container = document.createElement('div');
      container.className = 'mapboxgl-ctrl mapboxgl-ctrl-group';
      container.style.backgroundColor = '#333';
      container.style.color = 'white';
      
      const button = document.createElement('button');
      button.className = 'map-movement-toggle';
      button.innerHTML = allowMapMovement.selection ? '🔒' : '🔓';
      button.title = allowMapMovement.selection ? 'Lock Map Position' : 'Allow Map Movement';
      button.style.padding = '5px 10px';
      button.style.fontSize = '16px';
      button.style.cursor = 'pointer';
      button.style.border = 'none';
      button.style.backgroundColor = 'transparent';
      button.style.color = 'white';
      
      button.addEventListener('click', () => {
        setAllowMapMovement(prev => {
          const newState = {
            ...prev,
            selection: !prev.selection,
            utility: !prev.selection
          };
          button.innerHTML = newState.selection ? '🔒' : '🔓';
          button.title = newState.selection ? 'Lock Map Position' : 'Allow Map Movement';
          return newState;
        });
      });
      
      container.appendChild(button);
      
      // Add the custom control to the map
      mapRef.current.addControl({
        onAdd: () => container,
        onRemove: () => {}
      }, 'top-right');
    }
  }, [mapLoaded, allowMapMovement.selection]);

  // Utility Overlay Effect
  useEffect(() => {
    const currentMap = mapRef.current;
    console.log('[MapView] selectedUtility:', selectedUtility, 'mapLoaded:', mapLoaded);
    if (!currentMap || !mapLoaded) return;

    // Clean up previous utility layers and marker
    if (currentMap.getLayer('utility-boundary-fill')) {
      currentMap.removeLayer('utility-boundary-fill');
      console.log('[MapView] Removed previous utility-boundary-fill layer');
    }
    if (currentMap.getLayer('utility-boundary-line')) {
      currentMap.removeLayer('utility-boundary-line');
      console.log('[MapView] Removed previous utility-boundary-line layer');
    }
    if (currentMap.getSource('utility-boundary')) {
      currentMap.removeSource('utility-boundary');
      console.log('[MapView] Removed previous utility-boundary source');
    }
    const prevMarker = document.getElementById('utility-marker');
    if (prevMarker) {
      prevMarker.remove();
      console.log('[MapView] Removed previous utility marker');
    }

    if (!selectedUtility) {
      console.log('[MapView] No selectedUtility, skipping overlay');
      return;
    }

    // Fetch and add the utility GeoJSON
    fetch(selectedUtility.geojson)
      .then(res => {
        if (!res.ok) throw new Error('Failed to fetch utility geojson: ' + selectedUtility.geojson);
        return res.json();
      })
      .then(geojson => {
        console.log('[MapView] Loaded geojson for utility:', geojson);
        currentMap.addSource('utility-boundary', {
          type: 'geojson',
          data: geojson
        });
        currentMap.addLayer({
          id: 'utility-boundary-fill',
          type: 'fill',
          source: 'utility-boundary',
          paint: {
            'fill-color': '#000000',  // Black
            'fill-opacity': 0.3
          }
        });
        currentMap.addLayer({
          id: 'utility-boundary-line',
          type: 'line',
          source: 'utility-boundary',
          paint: {
            'line-color': '#000000',  // Black
            'line-width': 3,
            'line-opacity': 0.8
          }
        });
        // Zoom to utility boundary - only if user initiated
        const bounds = new mapboxgl.LngLatBounds();
        
        // Add each project's coordinates to the bounds
        geojson.features.forEach((feature: any) => {
          if (feature.geometry.type === 'Polygon') {
            feature.geometry.coordinates[0].forEach((coord: [number, number]) => {
              bounds.extend(coord as [number, number]);
            });
          }
        });
        
        if (!bounds.isEmpty() && allowMapMovement.utility) {
          console.log('[MapView] Fitting map to utility bounds:', bounds);
          currentMap.fitBounds(bounds, { padding: 50 });
        }
      })
      .catch(err => {
        console.error('[MapView] Error loading utility geojson:', err);
      });

    // Add utility marker
    const markerEl = document.createElement('div');
    markerEl.id = 'utility-marker';
    markerEl.style.width = '28px';
    markerEl.style.height = '28px';
    markerEl.style.backgroundColor = '#FFFFFF';  // White
    markerEl.style.border = '3px solid #000000';  // Black
    markerEl.style.borderRadius = '50%';
    markerEl.style.boxShadow = '0 0 10px 2px #000000';  // Black
    markerEl.title = selectedUtility.name;
    markerEl.style.display = 'flex';
    markerEl.style.alignItems = 'center';
    markerEl.style.justifyContent = 'center';
    markerEl.style.zIndex = '10';
    markerEl.innerHTML = '<svg width="14" height="14" fill="#000000" viewBox="0 0 24 24"><circle cx="12" cy="12" r="6"/></svg>';
    new mapboxgl.Marker(markerEl)
      .setLngLat([selectedUtility.location.lon, selectedUtility.location.lat])
      .addTo(currentMap);
    console.log('[MapView] Added utility marker at', selectedUtility.location.lon, selectedUtility.location.lat);

    // Optionally fly to marker if no boundary - only if user initiated
    if (!selectedUtility.geojson && allowMapMovement.utility) {
      currentMap.flyTo({
        center: [selectedUtility.location.lon, selectedUtility.location.lat],
        zoom: 12,
        essential: true
      });
      console.log('[MapView] Fly to utility marker');
    }
  }, [selectedUtility, mapLoaded]);

  return (
    <div className="relative w-full h-full">
      <div ref={mapContainer} className="w-full h-full" />
      
      {/* Project cards at the bottom */}
      {(sortedVisibleProjects.length > 0 || localSelectedProject) && (
        <div className="absolute bottom-0 left-0 right-0 p-4 pointer-events-none">
          {/* Left scroll button */}
          {showLeftArrow && (
            <button
              className="absolute left-2 top-1/2 transform -translate-y-1/2 bg-gray-800 rounded-full p-2 z-10 pointer-events-auto"
              onClick={scrollCardLeft}
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
              onClick={scrollCardRight}
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
