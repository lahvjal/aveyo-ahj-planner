import React, { useState, KeyboardEvent } from 'react';
import Image from 'next/image';
import Link from 'next/link';
import { ProjectFilter } from '@/utils/types';
import CollapsibleFilterSection from './CollapsibleFilterSection';
import ActiveFilterChip from './ActiveFilterChip';
import { FiMap, FiList, FiSearch, FiLogOut } from 'react-icons/fi';
import { useAuth } from '@/utils/AuthContext';
import { getClassificationBadgeClass } from '@/utils/classificationColors';
import ToggleOption from './ToggleOption';

interface ImprovedFilterPanelProps {
  filters: ProjectFilter[];
  addFilter: (filter: ProjectFilter) => void;
  removeFilter: (filter: ProjectFilter) => void;
  clearFilters: () => void;
  onSearch?: (terms: string[]) => void;
  searchTerms?: string[];
  viewMode: 'map' | 'list';
  onViewModeChange: (mode: 'map' | 'list') => void;
  showOnlyMyProjects?: boolean;
  toggleShowOnlyMyProjects?: () => void;
}

const ImprovedFilterPanel: React.FC<ImprovedFilterPanelProps> = ({
  filters,
  addFilter,
  removeFilter,
  clearFilters,
  onSearch,
  searchTerms = [],
  viewMode,
  onViewModeChange,
  showOnlyMyProjects,
  toggleShowOnlyMyProjects,
}) => {
  const [searchInput, setSearchInput] = useState('');
  const { signOut, userProfile } = useAuth();

  // Handle classification filter change
  const handleClassificationFilterChange = (
    type: 'ahj' | 'utility' | 'financier',
    value: string
  ) => {
    // Toggle the filter - if it's already active, remove it
    if (isFilterActive(type, value)) {
      const filterToRemove = filters.find(f => f.type === type && f.value === value);
      if (filterToRemove) {
        removeFilter(filterToRemove);
      }
    } else {
      // Add the filter
      addFilter({ type, value });
    }
  };

  // Check if a filter is active
  const isFilterActive = (type: string, value: string) => {
    return filters.some(f => f.type === type && f.value === value);
  };

  // Handle search input
  const handleSearchInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    setSearchInput(e.target.value);
  };

  // Handle Enter key press in search input
  const handleSearchKeyDown = (e: KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'Enter' && searchInput.trim()) {
      // Add the search term to the list of search terms
      if (onSearch) {
        const newSearchTerms = [...searchTerms, searchInput.trim()];
        onSearch(newSearchTerms);
        setSearchInput(''); // Clear the input after adding
      }
    }
  };

  // Remove a search term
  const removeSearchTerm = (termToRemove: string) => {
    if (onSearch) {
      const newSearchTerms = searchTerms.filter(term => term !== termToRemove);
      onSearch(newSearchTerms);
    }
  };

  // Clear all search terms
  const clearSearchTerms = () => {
    if (onSearch) {
      onSearch([]);
    }
  };

  // Create a ProjectFilter object from a search term
  const createSearchFilter = (term: string): ProjectFilter => {
    return {
      type: 'search',
      value: term
    };
  };

  // Create a filter for My Projects
  const createMyProjectsFilter = (): ProjectFilter => {
    return {
      type: 'myprojects',
      value: 'true'
    };
  };

  // Handle logout
  const handleLogout = async () => {
    await signOut();
    // The redirect will be handled by the AuthContext
  };

  // Render classification button with appropriate styling
  const renderClassificationButton = (
    type: 'ahj' | 'utility' | 'financier',
    classification: string
  ) => {
    const isActive = isFilterActive(type, classification);
    
    return (
      <button
        key={`${type}-${classification}`}
        onClick={() => handleClassificationFilterChange(type, classification)}
        className={`px-3 py-1 rounded-full text-sm font-medium transition-colors ${
          isActive 
            ? `${getClassificationBadgeClass(classification)} ring-2 ring-white` 
            : 'bg-gray-800 text-gray-300 hover:bg-gray-700'
        }`}
      >
        {classification || 'Unknown'}
      </button>
    );
  };

  return (
    <div className="flex flex-col h-full">
      {/* Logo */}
      <div className="p-4 flex items-center">
        <Link href="/">
          <div className="flex items-center">
            <Image 
              src="/Aveyo-social-icon-BLK.jpg" 
              alt="Aveyo Logo" 
              width={40} 
              height={40}
              className="rounded-md" 
            />
            <h1 className="ml-3 text-xl font-semibold">Project Browser</h1>
          </div>
        </Link>
      </div>
      
      {/* Divider */}
      <div className="px-4 pb-2">
        <div className="border-t border-gray-800"></div>
      </div>
      
      {/* View Toggle */}
      <div className="p-4 pb-5">
        <div className="flex bg-gray-800 rounded-md p-1">
          <button
            onClick={() => onViewModeChange('map')}
            className={`flex items-center justify-center flex-1 px-4 py-2 rounded-md transition-colors ${
              viewMode === 'map' 
                ? 'bg-blue-600 text-white' 
                : 'bg-transparent text-gray-300 hover:bg-gray-700'
            }`}
          >
            <FiMap className="mr-2" />
            Map
          </button>
          <button
            onClick={() => onViewModeChange('list')}
            className={`flex items-center justify-center flex-1 px-4 py-2 rounded-md transition-colors ${
              viewMode === 'list' 
                ? 'bg-blue-600 text-white' 
                : 'bg-transparent text-gray-300 hover:bg-gray-700'
            }`}
          >
            <FiList className="mr-2" />
            List
          </button>
        </div>
      </div>
      <>
        {/* Search Area */}
        <div className="px-4 pb-4">
          <div className="relative">
            <FiSearch className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400" />
            <input
              type="text"
              placeholder="Search Area (press Enter to add)"
              className="w-full pl-10 pr-4 py-2 bg-gray-800 border border-gray-700 rounded-md text-white placeholder-gray-400"
              value={searchInput}
              onChange={handleSearchInputChange}
              onKeyDown={handleSearchKeyDown}
            />
          </div>
        </div>
        
        {/* Active Filters */}
        <div className="px-4 pb-4">
          <div className="flex flex-wrap gap-2">
            {/* Search Terms */}
            {searchTerms.map((term) => (
              <ActiveFilterChip
                key={`search-${term}`}
                label={term}
                type="search"
                onRemove={() => removeSearchTerm(term)}
              />
            ))}
            
            {/* Regular Filters */}
            {filters.map((filter) => {
              if (filter.type === 'search') return null; // Skip search filters as they're handled above
              if (filter.type === 'myprojects') {
                return (
                  <ActiveFilterChip
                    key={`myprojects-${filter.value}`}
                    label="My Projects"
                    type="myprojects"
                    onRemove={() => {
                      if (toggleShowOnlyMyProjects) {
                        toggleShowOnlyMyProjects();
                      }
                    }}
                  />
                );
              }
              
              // Format label based on filter type
              let label = filter.value;
              if (filter.type === 'ahj') {
                label = `AHJ ${filter.value}`;
              } else if (filter.type === 'utility') {
                label = `Utility ${filter.value}`;
              } else if (filter.type === 'financier') {
                label = `Financier ${filter.value}`;
              }
              
              return (
                <ActiveFilterChip
                  key={`${filter.type}-${filter.value}`}
                  label={label}
                  type={filter.type}
                  onRemove={() => removeFilter(filter)}
                />
              );
            })}
            
            {/* Clear All Button - only show if there are filters or search terms */}
            {(filters.length > 0 || searchTerms.length > 0) && (
              <button
                onClick={() => {
                  clearFilters();
                  clearSearchTerms();
                }}
                className="px-2 py-1 text-xs text-gray-300 hover:text-white"
              >
                Clear All
              </button>
            )}
          </div>
        </div>
        
        {/* Filter Sections */}
        <div className="px-4 flex-1 overflow-y-auto">
          {/* Utility Section */}
          <CollapsibleFilterSection title="Utility">
            <div className="space-y-2">
              {['A', 'B', 'C'].map(classification => renderClassificationButton('utility', classification))}
            </div>
          </CollapsibleFilterSection>
          
          {/* AHJ Section */}
          <CollapsibleFilterSection title="AHJ">
            <div className="space-y-2">
              {['A', 'B', 'C'].map(classification => renderClassificationButton('ahj', classification))}
            </div>
          </CollapsibleFilterSection>
        </div>
      </>
      
      {/* Bottom section with My Projects toggle and Logout */}
      <div className="mt-auto">
        {/* Divider */}
        <div className="px-4 py-2">
          <div className="border-t border-gray-800"></div>
        </div>
        
        {/* My Projects Toggle */}
        <div className="px-5 py-3 border-t border-gray-700">
          <ToggleOption
            label="Filter My Projects"
            isOn={Boolean(showOnlyMyProjects)}
            onToggle={toggleShowOnlyMyProjects || (() => {})}
          />
        </div>
        
        {/* Logout Button */}
        <div className="px-4 py-4">
          <button 
            onClick={handleLogout}
            className="w-full flex items-center justify-center px-4 py-2 rounded-md bg-red-600 hover:bg-red-700 text-white transition-colors"
          >
            <FiLogOut className="mr-2" />
            Logout
          </button>
        </div>
      </div>
    </div>
  );
};

export default ImprovedFilterPanel;
