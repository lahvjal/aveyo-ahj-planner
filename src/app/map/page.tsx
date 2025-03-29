'use client';

import { useState, useEffect } from 'react';
import Header from '@/components/Header';
import Search from '@/components/Search';
import FilterBar from '@/components/FilterBar';
import MapView from '@/components/MapView';
import { AHJ, Filter } from '@/utils/types';
import { filterAHJs } from '@/utils/dataProcessing';
import { getMapboxToken } from '@/utils/mapbox';
import { supabase } from '@/utils/supabaseClient';

// Get the Mapbox token from environment variables
const MAPBOX_ACCESS_TOKEN = getMapboxToken();

export default function MapPage() {
  const [ahjs, setAHJs] = useState<AHJ[]>([]);
  const [filteredAHJs, setFilteredAHJs] = useState<AHJ[]>([]);
  const [selectedAHJ, setSelectedAHJ] = useState<AHJ | null>(null);
  const [searchQuery, setSearchQuery] = useState('');
  const [filters, setFilters] = useState<Filter[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  // Fetch AHJs from Supabase on component mount
  useEffect(() => {
    const fetchAHJs = async () => {
      try {
        // Check if there's a selected AHJ in localStorage
        const storedSelectedAHJ = localStorage.getItem('selectedAHJ');
        if (storedSelectedAHJ) {
          try {
            const parsedAHJ = JSON.parse(storedSelectedAHJ);
            setSelectedAHJ(parsedAHJ);
            // Clear the localStorage after retrieving the selected AHJ
            localStorage.removeItem('selectedAHJ');
          } catch (error) {
            console.error('Error parsing selected AHJ:', error);
          }
        }

        // Fetch AHJs directly from Supabase
        const { data, error } = await supabase
          .from('ahjs')
          .select('*');
        
        if (error) {
          throw error;
        }
        
        // Transform data to match our AHJ type
        const transformedData = data.map(item => ({
          id: item.id,
          name: item.name,
          county: item.county || '',
          zip: item.zip || '',
          classification: item.classification as 'A' | 'B' | 'C' | null,
          latitude: item.latitude || undefined,
          longitude: item.longitude || undefined
        }));
        
        setAHJs(transformedData);
        setFilteredAHJs(transformedData);
      } catch (error) {
        console.error('Error fetching AHJs:', error);
        
        // Fallback to localStorage if Supabase fetch fails
        const storedAHJs = localStorage.getItem('ahjs');
        if (storedAHJs) {
          try {
            const parsedAHJs = JSON.parse(storedAHJs);
            setAHJs(parsedAHJs);
            setFilteredAHJs(parsedAHJs);
          } catch (error) {
            console.error('Error parsing AHJs from localStorage:', error);
          }
        }
      } finally {
        setIsLoading(false);
      }
    };
    
    fetchAHJs();
  }, []);

  // Handle search
  const handleSearch = (query: string) => {
    setSearchQuery(query);
  };

  // Handle filter change
  const handleFilter = (newFilters: Filter[]) => {
    setFilters(newFilters);
  };

  // Handle removing a filter
  const handleRemoveFilter = (id: string) => {
    setFilters(filters.filter(filter => filter.id !== id));
  };

  // Handle clearing all filters
  const handleClearFilters = () => {
    setFilters([]);
  };

  // Handle selecting an AHJ
  const handleSelectAHJ = (ahj: AHJ) => {
    setSelectedAHJ(ahj);
  };

  // Apply filters when search query or filters change
  useEffect(() => {
    if (ahjs.length === 0) return;
    
    const activeFilters: any = {};
    
    filters.forEach(filter => {
      if (filter.type === 'county') activeFilters.county = filter.value;
      if (filter.type === 'zip') activeFilters.zip = filter.value;
      if (filter.type === 'city') activeFilters.city = filter.value;
      if (filter.type === 'class') activeFilters.classification = filter.value;
    });
    
    const filtered = filterAHJs(ahjs, searchQuery, activeFilters);
    setFilteredAHJs(filtered);
  }, [searchQuery, filters, ahjs]);

  return (
    <div className="min-h-screen flex flex-col">
      <Header activePage="map" />
      
      <main className="flex-1 p-6">
        <Search onSearch={handleSearch} onFilter={handleFilter} />
        
        <FilterBar 
          filters={filters} 
          onRemoveFilter={handleRemoveFilter} 
          onClearFilters={handleClearFilters} 
        />
        
        {isLoading ? (
          <div className="flex items-center justify-center h-[calc(100vh-200px)]">
            <div className="text-center">
              <div className="w-12 h-12 border-4 border-t-[#0066ff] border-r-transparent border-b-transparent border-l-transparent rounded-full animate-spin mx-auto mb-4"></div>
              <p className="text-gray-400">Loading map data...</p>
            </div>
          </div>
        ) : ahjs.length === 0 ? (
          <div className="text-center py-12">
            <h2 className="text-xl font-semibold mb-4">No AHJ Data Available</h2>
            <p className="text-gray-400 mb-6">No AHJ data found in the database. Please import your data first.</p>
          </div>
        ) : (
          <MapView 
            ahjs={filteredAHJs}
            selectedAHJ={selectedAHJ}
            onSelectAHJ={handleSelectAHJ}
          />
        )}
      </main>
    </div>
  );
}
