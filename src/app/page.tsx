'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import Header from '@/components/Header';
import Search from '@/components/Search';
import FilterBar from '@/components/FilterBar';
import AHJTable from '@/components/AHJTable';
import { AHJ } from '@/utils/types';
import { filterAHJs } from '@/utils/dataProcessing';
import { supabase } from '@/utils/supabaseClient';

export default function Home() {
  const router = useRouter();
  const [ahjs, setAHJs] = useState<AHJ[]>([]);
  const [filteredAHJs, setFilteredAHJs] = useState<AHJ[]>([]);
  const [searchQuery, setSearchQuery] = useState('');
  const [filters, setFilters] = useState<any[]>([]);
  const [currentPage, setCurrentPage] = useState(1);
  const [isLoading, setIsLoading] = useState(true);

  // Increase items per page from 10 to 20
  const itemsPerPage = 20;

  // Calculate total pages based on filtered AHJs
  const totalPages = Math.max(1, Math.ceil(filteredAHJs.length / itemsPerPage));
  
  // Get current page of AHJs
  const currentAHJs = filteredAHJs.slice((currentPage - 1) * itemsPerPage, currentPage * itemsPerPage);

  // Fetch AHJs from Supabase on component mount
  useEffect(() => {
    const fetchAHJs = async () => {
      setIsLoading(true);
      try {
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
        
        // Store AHJs in localStorage for use in map view
        localStorage.setItem('ahjs', JSON.stringify(transformedData));
      } catch (error) {
        console.error('Error fetching AHJs:', error);
        alert('Error fetching AHJ data. Please check the console for details.');
      } finally {
        setIsLoading(false);
      }
    };
    
    fetchAHJs();
  }, []);

  // Handle search
  const handleSearch = (query: string) => {
    setSearchQuery(query);
    setCurrentPage(1);
  };

  // Handle filter change
  const handleFilter = (newFilters: any) => {
    setFilters(newFilters);
    setCurrentPage(1);
  };

  // Handle removing a filter
  const handleRemoveFilter = (id: string) => {
    setFilters(filters.filter(filter => filter.id !== id));
  };

  // Handle clearing all filters
  const handleClearFilters = () => {
    setFilters([]);
  };

  // Handle page change
  const handlePageChange = (page: number) => {
    setCurrentPage(page);
  };

  // Handle view on map
  const handleViewOnMap = (ahj: AHJ) => {
    // Store the selected AHJ in localStorage to access it on the map page
    localStorage.setItem('selectedAHJ', JSON.stringify(ahj));
    router.push('/map');
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
    setCurrentPage(1);
  }, [searchQuery, filters, ahjs]);

  return (
    <div className="min-h-screen flex flex-col">
      <Header activePage="home" />
      
      <main className="flex-1 p-6">
        <Search onSearch={handleSearch} onFilter={handleFilter} />
        
        <div className="mb-4 flex items-center justify-between">
          <FilterBar 
            filters={filters} 
            onRemoveFilter={handleRemoveFilter} 
            onClearFilters={handleClearFilters} 
          />
        </div>
        
        {isLoading ? (
          <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
            <div className="bg-[#1e1e1e] p-6 rounded-md shadow-lg">
              <p className="text-white">Loading AHJ data...</p>
              <div className="mt-4 w-full h-2 bg-[#333333] rounded-full overflow-hidden">
                <div className="h-full bg-[#0066ff] animate-pulse rounded-full"></div>
              </div>
            </div>
          </div>
        ) : filteredAHJs.length === 0 ? (
          <div className="text-center py-12">
            <h2 className="text-xl font-semibold mb-4">No AHJ Data Available</h2>
            <p className="text-gray-400 mb-6">No AHJs found matching your search criteria</p>
          </div>
        ) : (
          <AHJTable 
            ahjs={currentAHJs}
            onViewOnMap={handleViewOnMap}
            currentPage={currentPage}
            totalPages={totalPages}
            onPageChange={handlePageChange}
          />
        )}
      </main>
    </div>
  );
}
