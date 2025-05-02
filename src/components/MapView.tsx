import React, { useRef, useState, useEffect, useMemo, useCallback } from 'react';
import mapboxgl from 'mapbox-gl';
import 'mapbox-gl/dist/mapbox-gl.css';
import { AHJ, Project } from '@/utils/types';
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
  selectedUtility?: any; // Changed type to any
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
  onSelectProject
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
  const [countiesLoaded, setCountiesLoaded] = useState(false);
  const [visibleProjects, setVisibleProjects] = useState<Project[]>([]);
  const [isDragging, setIsDragging] = useState(false);
  const [startX, setStartX] = useState(0);
  const [scrollLeft, setScrollLeft] = useState(0);
  const [showLeftArrow, setShowLeftArrow] = useState(false);
  const [showRightArrow, setShowRightArrow] = useState(true);
  const [mapMoved, setMapMoved] = useState(false);
  const [currentCardIndex, setCurrentCardIndex] = useState(0);
  const cardsToShow = 3; // Number of cards to show at once
  const [localSelectedProject, setLocalSelectedProject] = useState<Project | null>(selectedProject);

  // Memoize visible projects to prevent unnecessary re-renders
  const sortedVisibleProjects = useMemo(() => {
    return [...visibleProjects].sort((a, b) => {
      // First, prioritize user's own projects
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
            
            // Fit the map to the bounds with padding
            map.fitBounds(bounds, {
              padding: 100,
              maxZoom: 12
            });
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

  // Add county boundaries source
  useEffect(() => {
    const currentMap = mapRef.current;
    if (!currentMap || !mapLoaded) return;

    // Add county boundaries source
    currentMap.addSource('counties', {
      type: 'vector',
      url: 'https://tiles.arcgis.com/tiles/nGt4QxSblgDfeJF9/arcgis/rest/services/USA_Counties_2019/MapServer',
      minzoom: 4,
      maxzoom: 12
    });

    // Add county boundaries layers
    currentMap.addLayer({
      id: 'county-boundary-fill',
      type: 'fill',
      source: 'counties',
      'source-layer': 'USA_Counties_2019',
      paint: {
        'fill-color': '#000000',  // Black
        'fill-opacity': 0.1
      },
      layout: {
        visibility: 'visible'
      }
    });
    currentMap.addLayer({
      id: 'county-boundary-line',
      type: 'line',
      source: 'counties',
      'source-layer': 'USA_Counties_2019',
      paint: {
        'line-color': '#000000',  // Black
        'line-width': 1,
        'line-opacity': 0.5
      },
      layout: {
        visibility: 'visible'
      }
    });

    setCountiesLoaded(true);
  }, [mapLoaded]);

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
    setStartX(e.pageX - cardListRef.current.offsetLeft);
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
    const x = e.pageX - cardListRef.current.offsetLeft;
    const walk = (x - startX) * 2; // Scroll speed multiplier
    cardListRef.current.scrollLeft = scrollLeft - walk;
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
    setLocalSelectedProject(project);
    
    // Fly to the project location
    if (mapRef.current && project.latitude && project.longitude) {
      mapRef.current.flyTo({
        center: [project.longitude, project.latitude],
        zoom: 14,
        essential: true
      });
    }
  };

  // Update local state when prop changes
  useEffect(() => {
    setLocalSelectedProject(selectedProject);
  }, [selectedProject]);

  // Handle closing the selected project
  const handleCloseProject = () => {
    setLocalSelectedProject(null);
    if (onSelectProject) {
      onSelectProject(null);
    }
  };

  // Get color for classification
  const getClassificationColor = (classification: string | undefined, type: 'ahj' | 'utility' | 'financier') => {
    return getClassificationMapColor(classification);
  };

  // Show county and city boundaries when an AHJ is selected
  useEffect(() => {
    const currentMap = mapRef.current;
    if (!currentMap || !mapLoaded || !countiesLoaded) return;

    try {
      // First, preserve the "show all cities" behavior for testing
      // but we'll still apply specific filters when an AHJ is selected
      if (!selectedAHJ) {
        // Keep showing all cities but hide counties when no AHJ is selected
        currentMap.setLayoutProperty('county-boundary-fill', 'visibility', 'none');
        currentMap.setLayoutProperty('county-boundary-line', 'visibility', 'none');
        return;
      }

      // Clear any existing county boundaries
      currentMap.setLayoutProperty('county-boundary-fill', 'visibility', 'none');
      currentMap.setLayoutProperty('county-boundary-line', 'visibility', 'none');

      if (!selectedAHJ.county) return;

      // Get county name without "County" suffix if present
      const countyName = selectedAHJ.county.replace(/ County$/, '');

      // Determine state from name or county
      let state = '';
      // Check if county contains state info
      const stateMatch = selectedAHJ.county.match(/\b([A-Z]{2})\b/);
      if (stateMatch) {
        state = stateMatch[1];
      }

      // Convert state to FIPS code (first 2 digits of county FIPS)
      const stateToFips: { [key: string]: string } = {
        'AL': '01', 'AK': '02', 'AZ': '04', 'AR': '05', 'CA': '06', 'CO': '08', 'CT': '09',
        'DE': '10', 'FL': '12', 'GA': '13', 'HI': '15', 'ID': '16', 'IL': '17', 'IN': '18',
        'IA': '19', 'KS': '20', 'KY': '21', 'LA': '22', 'ME': '23', 'MD': '24', 'MA': '25',
        'MI': '26', 'MN': '27', 'MS': '28', 'MO': '29', 'MT': '30', 'NE': '31', 'NV': '32',
        'NH': '33', 'NJ': '34', 'NM': '35', 'NY': '36', 'NC': '37', 'ND': '38', 'OH': '39',
        'OK': '40', 'OR': '41', 'PA': '42', 'RI': '44', 'SC': '45', 'SD': '46', 'TN': '47',
        'TX': '48', 'UT': '49', 'VT': '50', 'VA': '51', 'WA': '53', 'WV': '54', 'WI': '55', 'WY': '56'
      };

      // Create filter for the county
      let filter: any[] = ['==', 'NAME', countyName];

      // If we have a state, add it to the filter
      if (state && stateToFips[state]) {
        // The FIPS code in the GeoJSON starts with the state FIPS
        filter = ['all', filter, ['in', 'STATE', stateToFips[state]]];
      }

      // Apply filter to county layers
      currentMap.setFilter('county-boundary-fill', filter);
      currentMap.setFilter('county-boundary-line', filter);

      // Show the county layers
      currentMap.setLayoutProperty('county-boundary-fill', 'visibility', 'visible');
      currentMap.setLayoutProperty('county-boundary-line', 'visibility', 'visible');

      // Extract city name from AHJ name
      if (selectedAHJ.name) {
        // Extract city name from AHJ name (assuming format "City Name, State")
        const cityMatch = selectedAHJ.name.match(/^([^,]+)/);
        if (cityMatch) {
          const cityName = cityMatch[1].trim();
          // Extract state from county if available (format: "County, ST")
          const stateFromCounty = selectedAHJ.county?.split(',')[1]?.trim() || state;

          console.log(`Looking for city boundary: "${cityName}" in state "${stateFromCounty}"`);

          try {
            // Enable debug mode to see all city boundaries
            // currentMap.setLayoutProperty('all-cities-debug', 'visibility', 'visible');

            // Create filter for the city - case insensitive not possible with Mapbox filters
            // So we'll try multiple case variations
            const cityNameVariations = [
              cityName,
              cityName.toLowerCase(),
              cityName.toUpperCase(),
              cityName.charAt(0).toUpperCase() + cityName.slice(1).toLowerCase(), // Title case
              // Add common city name variations
              cityName.replace(/Saint /i, 'St. '),
              cityName.replace(/Saint /i, 'St '),
              cityName.replace(/Mount /i, 'Mt. '),
              cityName.replace(/Mount /i, 'Mt ')
            ];

            // Create a filter that matches any of these name variations
            let cityFilter: any[] = ['any'];
            cityNameVariations.forEach(name => {
              cityFilter.push(['==', 'NAME', name]);
            });

            // If we have a state, add it to the filter
            if (stateFromCounty) {
              cityFilter = ['all', cityFilter, ['==', 'STATE', stateFromCounty]];
            }

            console.log('Applying city filter:', JSON.stringify(cityFilter));

            // Instead of replacing the filter (which would hide all other cities),
            // we'll create a new layer specifically for the selected city
            
            // First, ensure our highlight layers exist
            if (!currentMap.getLayer('selected-city-fill')) {
              currentMap.addLayer({
                id: 'selected-city-fill',
                type: 'fill',
                source: 'cities',
                paint: {
                  'fill-color': '#FFFFFF',  // White for selected city
                  'fill-opacity': 0.5
                },
                layout: {
                  visibility: 'visible'
                },
                filter: ['==', 'NAME', ''] // Empty filter initially
              });
            }
            
            if (!currentMap.getLayer('selected-city-line')) {
              currentMap.addLayer({
                id: 'selected-city-line',
                type: 'line',
                source: 'cities',
                paint: {
                  'line-color': '#FFFFFF',  // White for selected city
                  'line-width': 4,
                  'line-opacity': 1
                },
                layout: {
                  visibility: 'visible'
                },
                filter: ['==', 'NAME', ''] // Empty filter initially
              });
            }
            
            // Apply the filter to our highlight layers
            currentMap.setFilter('selected-city-fill', cityFilter);
            currentMap.setFilter('selected-city-line', cityFilter);
            
            // Make sure they're visible
            currentMap.setLayoutProperty('selected-city-fill', 'visibility', 'visible');
            currentMap.setLayoutProperty('selected-city-line', 'visibility', 'visible');

            // Try to get the bounds of the city to zoom to it
            const cityFeatures = currentMap.querySourceFeatures('cities', {
              filter: cityFilter
            });

            if (cityFeatures.length > 0) {
              console.log(`Found ${cityFeatures.length} matching city features`);

              // Create a bounds object to encompass all features
              const bounds = new mapboxgl.LngLatBounds();

              // Add each feature's coordinates to the bounds
              cityFeatures.forEach(feature => {
                if (feature.geometry.type === 'Polygon') {
                  (feature.geometry.coordinates[0] as any[]).forEach(coord => {
                    bounds.extend(coord as [number, number]);
                  });
                }
              });

              // If we have valid bounds, zoom to them
              if (!bounds.isEmpty()) {
                currentMap.fitBounds(bounds, { padding: 50 });
              }
            } else {
              console.log('No matching city features found');
            }
          } catch (error) {
            console.error('Error applying city boundary filter:', error);
          }
        }
      }
    } catch (error) {
      console.error('Error showing boundaries:', error);
    }
  }, [selectedAHJ, mapLoaded, countiesLoaded]);

  // --- Utility Overlay Effect ---
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
        // Zoom to utility boundary
        const bounds = new mapboxgl.LngLatBounds();
        geojson.features.forEach((feature: any) => {
          if (feature.geometry.type === 'Polygon') {
            feature.geometry.coordinates[0].forEach((coord: [number, number]) => {
              bounds.extend(coord as [number, number]);
            });
          }
        });
        if (!bounds.isEmpty()) {
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

    // Optionally fly to marker if no boundary
    if (!selectedUtility.geojson) {
      currentMap.flyTo({
        center: [selectedUtility.location.lon, selectedUtility.location.lat],
        zoom: 12,
        essential: true
      });
      console.log('[MapView] Fly to utility marker');
    }
  }, [selectedUtility, mapLoaded]);

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
    
    // If a project is selected, fly to it
    if (localSelectedProject && 
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
  }, [projects, localSelectedProject, mapLoaded, onSelectProject, userProfile]);

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

  return (
    <div className="relative w-full h-full rounded-md overflow-hidden">
      <div ref={mapContainer} className="absolute inset-0" />

      {/* Horizontal scrollable project cards with navigation arrows */}
      <div className="absolute bottom-0 left-0 right-0 p-4 z-20">
        {localSelectedProject ? (
          <div className="absolute bottom-4 left-1/2 transform -translate-x-1/2 max-w-2xl w-full px-4">
          <div className="bg-gray-800/90 backdrop-blur-sm rounded-lg shadow-lg p-4 border border-gray-700">
            <div className="flex justify-between items-start mb-2">
              <h3 className="text-lg font-semibold">
                {localSelectedProject.isMasked 
                  ? 'Project Details (Restricted)' 
                  : localSelectedProject.ahj.name || 'Project Details'}
              </h3>
              <button 
                onClick={handleCloseProject}
                className="text-gray-400 hover:text-white"
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
        ) : sortedVisibleProjects && sortedVisibleProjects.length > 0 ? (
          <div className="relative">
            {/* Left navigation arrow */}
            {showLeftArrow && (
              <button
                className="absolute left-0 top-1/2 transform -translate-y-1/2 z-10 bg-neutral-800/80 hover:bg-neutral-700/80 rounded-full p-2 shadow-lg"
                onClick={() => handleArrowClick('left')}
              >
                <svg xmlns="http://www.w3.org/2000/svg" className="h-6 w-6 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
                </svg>
              </button>
            )}

            {/* Right navigation arrow */}
            {showRightArrow && (
              <button
                className="absolute right-0 top-1/2 transform -translate-y-1/2 z-10 bg-neutral-800/80 hover:bg-neutral-700/80 rounded-full p-2 shadow-lg"
                onClick={() => handleArrowClick('right')}
              >
                <svg xmlns="http://www.w3.org/2000/svg" className="h-6 w-6 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
                </svg>
              </button>
            )}
            
            {/* Draggable card list */}
            <div
              ref={cardListRef}
              className="flex overflow-x-auto pb-2 h-40 scrollbar-thin scrollbar-thumb-gray-700 scrollbar-track-transparent"
              onMouseDown={handleMouseDown}
              onMouseUp={handleMouseUpOrLeave}
              onMouseLeave={handleMouseUpOrLeave}
              onMouseMove={handleMouseMove}
              style={{ cursor: isDragging ? 'grabbing' : 'grab' }}
            >
              {sortedVisibleProjects
                .map(project => renderProjectCard(project))}
            </div>
          </div>
        ) : (
          <div className="bg-textured-neutral-800/90 backdrop-blur-sm p-4 rounded-lg shadow-lg text-center max-w-md mx-auto">
            <p className="text-neutral-300">No projects to display. Try adjusting your filters.</p>
          </div>
        )}
      </div>

      {/* Styles for markers */}
      <style jsx global>{`
        .unknown-marker {
          background-color: #999999;  // Light gray
          border: 2px solid #FFFFFF;  // White
        }
        .qualification-badge {
          background-color: #4CAF50; // Green
          border: 2px solid white;
        }
        .text-shadow {
          text-shadow: 0 0 4px rgba(0, 0, 0, 0.8);
        }
        .user-project-indicator {
          background-color: #007bff; // Blue
          border: 1px solid white;
        }
      `}</style>
    </div>
  );
};

export default MapView;
