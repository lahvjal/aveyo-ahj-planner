import React, { useRef, useEffect, useState } from 'react';
import mapboxgl from 'mapbox-gl';
import { AHJ } from './AHJTable';
import { getMapboxToken } from '@/utils/mapbox';

// Get the Mapbox token from environment variables
const MAPBOX_ACCESS_TOKEN = getMapboxToken();

interface MapViewProps {
  ahjs: AHJ[];
  selectedAHJ: AHJ | null;
  onSelectAHJ: (ahj: AHJ) => void;
}

const MapView: React.FC<MapViewProps> = ({ ahjs, selectedAHJ, onSelectAHJ }) => {
  const mapContainer = useRef<HTMLDivElement>(null);
  const cardListRef = useRef<HTMLDivElement>(null);
  const map = useRef<mapboxgl.Map | null>(null);
  const [lng, setLng] = useState(-111.8910); // Default to Utah
  const [lat, setLat] = useState(40.7608);
  const [zoom, setZoom] = useState(9);
  const [mapLoaded, setMapLoaded] = useState(false);
  const [countiesLoaded, setCountiesLoaded] = useState(false);
  const [visibleAHJs, setVisibleAHJs] = useState<AHJ[]>([]);
  const [isDragging, setIsDragging] = useState(false);
  const [startX, setStartX] = useState(0);
  const [scrollLeft, setScrollLeft] = useState(0);
  const [showLeftArrow, setShowLeftArrow] = useState(false);
  const [showRightArrow, setShowRightArrow] = useState(true);
  
  // Initialize map
  useEffect(() => {
    if (map.current || !mapContainer.current || !MAPBOX_ACCESS_TOKEN) return;
    
    mapboxgl.accessToken = MAPBOX_ACCESS_TOKEN;
    
    const newMap = new mapboxgl.Map({
      container: mapContainer.current,
      style: 'mapbox://styles/mapbox/dark-v11',
      center: [lng, lat],
      zoom: zoom
    });
    
    // Add navigation controls
    newMap.addControl(new mapboxgl.NavigationControl(), 'top-right');
    
    // Add geolocate control
    newMap.addControl(
      new mapboxgl.GeolocateControl({
        positionOptions: {
          enableHighAccuracy: true
        },
        trackUserLocation: true,
        showUserHeading: true
      }),
      'top-right'
    );
    
    newMap.on('load', () => {
      // Add county boundaries source
      newMap.addSource('counties', {
        type: 'geojson',
        data: '/data/us-counties.json',
        generateId: true
      });
      
      // Add county boundary line layer (hidden by default)
      newMap.addLayer({
        id: 'county-boundaries-line',
        type: 'line',
        source: 'counties',
        layout: {
          visibility: 'none'
        },
        paint: {
          'line-color': '#3388ff',
          'line-width': 2,
          'line-opacity': 0.8
        }
      });
      
      // Add county fill layer (hidden by default)
      newMap.addLayer({
        id: 'county-boundaries-fill',
        type: 'fill',
        source: 'counties',
        layout: {
          visibility: 'none'
        },
        paint: {
          'fill-color': '#3388ff',
          'fill-opacity': 0.1
        }
      });
      
      setMapLoaded(true);
      setCountiesLoaded(true);
    });
    
    // Add move end event to update visible AHJs
    newMap.on('moveend', () => {
      updateVisibleAHJs(newMap);
    });
    
    map.current = newMap;
    
    return () => {
      newMap.remove();
      map.current = null;
    };
  }, [lng, lat, zoom]);
  
  // Update visible AHJs based on map bounds
  const updateVisibleAHJs = (currentMap: mapboxgl.Map) => {
    if (!currentMap || ahjs.length === 0) return;
    
    const bounds = currentMap.getBounds();
    if (!bounds) return;
    
    const visible = ahjs.filter(ahj => {
      if (!ahj.latitude || !ahj.longitude) return false;
      return bounds.contains([ahj.longitude, ahj.latitude]);
    });
    
    setVisibleAHJs(visible);
  };
  
  // Update visible AHJs when ahjs changes
  useEffect(() => {
    if (!map.current || !mapLoaded) return;
    updateVisibleAHJs(map.current);
  }, [ahjs, mapLoaded]);
  
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
  }, [visibleAHJs]);
  
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
  
  // Show county boundary when an AHJ is selected
  useEffect(() => {
    const currentMap = map.current;
    if (!currentMap || !mapLoaded || !countiesLoaded || !selectedAHJ || !selectedAHJ.county) return;
    
    try {
      // Get county name without "County" suffix if present
      const countyName = selectedAHJ.county.replace(/ County$/, '');
      
      // Determine state from address or name
      let state = '';
      if (selectedAHJ.address) {
        const stateMatch = selectedAHJ.address.match(/\b([A-Z]{2})\b/);
        if (stateMatch) {
          state = stateMatch[1];
        }
      }
      
      if (!state && selectedAHJ.name) {
        const stateMatch = selectedAHJ.name.match(/\b([A-Z]{2})\b/);
        if (stateMatch) {
          state = stateMatch[1];
        }
      }
      
      // Convert state to FIPS code (first 2 digits of county FIPS)
      const stateToFips: {[key: string]: string} = {
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
      currentMap.setFilter('county-boundaries-line', filter);
      currentMap.setFilter('county-boundaries-fill', filter);
      
      // Show the county layers
      currentMap.setLayoutProperty('county-boundaries-line', 'visibility', 'visible');
      currentMap.setLayoutProperty('county-boundaries-fill', 'visibility', 'visible');
      
      console.log(`Showing boundary for ${countyName}, ${state || 'unknown state'}`);
    } catch (error) {
      console.error('Error showing county boundary:', error);
    }
  }, [selectedAHJ, mapLoaded, countiesLoaded]);
  
  // Add markers when AHJs or map changes
  useEffect(() => {
    const currentMap = map.current;
    if (!currentMap || !mapLoaded || ahjs.length === 0) return;
    
    // Clear existing markers
    const markers = document.getElementsByClassName('mapboxgl-marker');
    while (markers[0]) {
      markers[0].remove();
    }
    
    // Add markers for each AHJ
    ahjs.forEach(ahj => {
      if (!ahj.latitude || !ahj.longitude) return;
      
      // Create marker element
      const markerEl = document.createElement('div');
      markerEl.className = `w-6 h-6 rounded-full flex items-center justify-center cursor-pointer`;
      
      // Set marker color based on classification
      if (ahj.classification === 'A') {
        markerEl.classList.add('class-a-marker');
      } else if (ahj.classification === 'B') {
        markerEl.classList.add('class-b-marker');
      } else if (ahj.classification === 'C') {
        markerEl.classList.add('class-c-marker');
      } else {
        markerEl.classList.add('unknown-marker');
      }
      
      // Add pulse effect if this is the selected AHJ
      if (selectedAHJ && selectedAHJ.id === ahj.id) {
        markerEl.classList.add('animate-pulse');
        markerEl.style.boxShadow = '0 0 0 2px white';
      }
      
      // Create and add the marker
      const marker = new mapboxgl.Marker(markerEl)
        .setLngLat([ahj.longitude, ahj.latitude])
        .addTo(currentMap);
      
      // Add click handler
      markerEl.addEventListener('click', () => {
        onSelectAHJ(ahj);
      });
    });
    
    // If there's a selected AHJ, fly to it
    if (selectedAHJ && selectedAHJ.latitude && selectedAHJ.longitude) {
      currentMap.flyTo({
        center: [selectedAHJ.longitude, selectedAHJ.latitude],
        zoom: 14,
        essential: true
      });
    }
  }, [ahjs, selectedAHJ, mapLoaded, onSelectAHJ]);
  
  // Render an AHJ card
  const renderAHJCard = (ahj: AHJ) => {
    return (
      <div 
        key={ahj.id}
        className={`flex-shrink-0 w-72 h-full p-4 rounded-md mr-4 cursor-pointer transition-all duration-200 ${
          selectedAHJ?.id === ahj.id 
            ? 'bg-gray-800/90 border-2 border-blue-500' 
            : 'bg-gray-900/80 border border-gray-700 hover:border-gray-500'
        }`}
        onClick={() => onSelectAHJ(ahj)}
      >
        <div className="flex flex-col h-full">
          <div className="flex justify-between items-start mb-2">
            <h3 className="text-sm font-semibold truncate">{ahj.name}</h3>
            <span 
              className={`inline-flex items-center px-2 py-0.5 rounded text-xs font-medium ${
                ahj.classification === 'A'
                  ? 'bg-blue-900 text-blue-100' 
                  : ahj.classification === 'B'
                    ? 'bg-orange-900 text-orange-100'
                    : ahj.classification === 'C'
                      ? 'bg-green-900 text-green-100'
                      : 'bg-gray-700 text-gray-300'
              }`}
            >
              Class {ahj.classification || 'Unknown'}
            </span>
          </div>
          
          <div className="text-xs text-gray-400 mb-1">
            AHJ: {ahj.name}
          </div>
          
          <div className="text-xs text-gray-400 mb-1">
            County: {ahj.county || 'Unknown'}
          </div>
          
          <div className="text-xs text-gray-400 mb-auto">
            Zip: {ahj.zip || 'Unknown'}
          </div>
          
          <div className="mt-2 text-xs text-gray-500">
            {ahj.latitude?.toFixed(7)}, {ahj.longitude?.toFixed(7)}
          </div>
        </div>
      </div>
    );
  };
  
  return (
    <div className="relative w-full h-[calc(100vh-180px)] rounded-md overflow-hidden">
      <div ref={mapContainer} className="w-full h-full" />
      
      {/* Horizontal scrollable AHJ cards with navigation arrows */}
      <div className="absolute bottom-0 left-0 right-0 p-4">
        {visibleAHJs.length > 0 ? (
          <div className="relative">
            {/* Left navigation arrow */}
            {showLeftArrow && (
              <button 
                className="absolute left-0 top-1/2 transform -translate-y-1/2 z-10 bg-gray-800/80 hover:bg-gray-700/80 rounded-full p-2 shadow-lg"
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
                className="absolute right-0 top-1/2 transform -translate-y-1/2 z-10 bg-gray-800/80 hover:bg-gray-700/80 rounded-full p-2 shadow-lg"
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
              {visibleAHJs.map(ahj => renderAHJCard(ahj))}
            </div>
          </div>
        ) : (
          <div className="flex items-center justify-center h-40 text-white text-shadow">
            No AHJs visible in the current map view. Try zooming out or panning the map.
          </div>
        )}
      </div>
    </div>
  );
};

export default MapView;
