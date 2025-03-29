import React, { useState } from 'react';
import { FiSearch, FiFilter } from 'react-icons/fi';
import { Filter } from '@/utils/types';

interface SearchProps {
  onSearch: (query: string) => void;
  onFilter: (filters: Filter[]) => void;
}

const Search: React.FC<SearchProps> = ({ onSearch, onFilter }) => {
  const [query, setQuery] = useState('');
  const [showFilters, setShowFilters] = useState(false);
  const [county, setCounty] = useState('');
  const [zip, setZip] = useState('');
  const [classification, setClassification] = useState<'A' | 'B' | 'C' | ''>('');
  
  const handleSearch = (e: React.FormEvent) => {
    e.preventDefault();
    onSearch(query);
  };

  const handleApplyFilters = () => {
    const filters: Filter[] = [];
    
    if (county) {
      filters.push({
        id: `county-${county}`,
        type: 'county',
        value: county
      });
    }
    
    if (zip) {
      filters.push({
        id: `zip-${zip}`,
        type: 'zip',
        value: zip
      });
    }
    
    if (classification) {
      filters.push({
        id: `class-${classification}`,
        type: 'class',
        value: classification
      });
    }
    
    onFilter(filters);
    setShowFilters(false);
  };

  return (
    <div className="w-full mb-4">
      <form onSubmit={handleSearch} className="relative">
        <div className="relative">
          <input
            type="text"
            placeholder="Search AHJ"
            className="w-full py-3 px-4 pl-12 bg-[#1e1e1e] border border-[#333333] rounded-md text-white focus:outline-none focus:ring-2 focus:ring-[#0066ff] focus:border-transparent"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
          />
          <div className="absolute left-4 top-1/2 transform -translate-y-1/2 text-gray-400">
            <FiSearch size={18} />
          </div>
          <button
            type="button"
            className="absolute right-4 top-1/2 transform -translate-y-1/2 text-gray-400 hover:text-white"
            onClick={() => setShowFilters(!showFilters)}
          >
            <FiFilter size={18} />
          </button>
        </div>
      </form>
      
      {showFilters && (
        <div className="mt-2 p-4 bg-[#1e1e1e] border border-[#333333] rounded-md">
          <h3 className="text-sm font-medium text-white mb-3">Filter Options</h3>
          
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <div>
              <label htmlFor="county" className="block text-sm text-gray-400 mb-1">
                County
              </label>
              <input
                id="county"
                type="text"
                placeholder="Enter county"
                className="w-full py-2 px-3 bg-[#121212] border border-[#333333] rounded-md text-white focus:outline-none focus:ring-1 focus:ring-[#0066ff] focus:border-transparent"
                value={county}
                onChange={(e) => setCounty(e.target.value)}
              />
            </div>
            
            <div>
              <label htmlFor="zip" className="block text-sm text-gray-400 mb-1">
                ZIP Code
              </label>
              <input
                id="zip"
                type="text"
                placeholder="Enter ZIP code"
                className="w-full py-2 px-3 bg-[#121212] border border-[#333333] rounded-md text-white focus:outline-none focus:ring-1 focus:ring-[#0066ff] focus:border-transparent"
                value={zip}
                onChange={(e) => setZip(e.target.value)}
              />
            </div>
            
            <div>
              <label htmlFor="classification" className="block text-sm text-gray-400 mb-1">
                Classification
              </label>
              <select
                id="classification"
                className="w-full py-2 px-3 bg-[#121212] border border-[#333333] rounded-md text-white focus:outline-none focus:ring-1 focus:ring-[#0066ff] focus:border-transparent"
                value={classification}
                onChange={(e) => setClassification(e.target.value as 'A' | 'B' | 'C' | '')}
              >
                <option value="">All</option>
                <option value="A">Class A (45 Day)</option>
                <option value="B">Class B</option>
                <option value="C">Class C</option>
              </select>
            </div>
          </div>
          
          <div className="mt-4 flex justify-end">
            <button
              type="button"
              className="px-4 py-2 bg-transparent text-white hover:bg-[#333333] rounded-md mr-2"
              onClick={() => setShowFilters(false)}
            >
              Cancel
            </button>
            <button
              type="button"
              className="px-4 py-2 bg-[#0066ff] text-white hover:bg-[#0052cc] rounded-md"
              onClick={handleApplyFilters}
            >
              Apply Filters
            </button>
          </div>
        </div>
      )}
    </div>
  );
};

export default Search;
