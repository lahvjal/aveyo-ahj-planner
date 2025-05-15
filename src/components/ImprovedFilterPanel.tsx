import React, { useState, KeyboardEvent } from 'react';
import Image from 'next/image';
import Link from 'next/link';
import { ProjectFilter, ImprovedFilterPanelProps } from '@/utils/types';
import CollapsibleFilterSection from './CollapsibleFilterSection';
import ActiveFilterChip from './ActiveFilterChip';
import { FiMap, FiList, FiSearch, FiLogOut } from 'react-icons/fi';
import { useAuth } from '@/utils/AuthContext';
import { getClassificationBadgeClass, formatClassification } from '@/utils/classificationColors';
import ToggleOption from './ToggleOption';

const ImprovedFilterPanel: React.FC<ImprovedFilterPanelProps> = ({
  filters,
  addFilter,
  removeFilter,
  clearFilters,
  onSearch,
  searchTerms = '',
  showOnlyMyProjects,
  toggleShowOnlyMyProjects,
}) => {
  const [searchInput, setSearchInput] = useState('');
  const { signOut, userProfile } = useAuth();

  // Handle classification filter change
  const handleClassificationFilterChange = (
    type: 'ahj' | 'utility' | 'financier' | '45day',
    value: string
  ) => {
    // Toggle the filter - if it's already active, remove it
    if (isFilterActive(type, value)) {
      // Find the filter in either projectFilters or entityFilters
      const allFilters = [...filters.projectFilters, ...filters.entityFilters];
      const filterToRemove = allFilters.find(f => f.type === type && f.value === value);
      if (filterToRemove && filterToRemove.id) {
        removeFilter(filterToRemove.id);
      }
    } else {
      // Add the filter
      addFilter({ type, value });
    }
  };

  // Check if a filter is active
  const isFilterActive = (type: string, value: string) => {
    // Check in both projectFilters and entityFilters
    const allFilters = [...filters.projectFilters, ...filters.entityFilters];
    return allFilters.some(f => f.type === type && f.value === value);
  };

  // Handle search input
  const handleSearchInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    setSearchInput(e.target.value);
  };

  // Handle Enter key press in search input
  const handleSearchKeyDown = (e: KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'Enter' && searchInput.trim()) {
      // Add the search term
      if (onSearch) {
        onSearch(searchInput.trim());
        setSearchInput(''); // Clear the input after adding
      }
    }
  };

  // Remove a search term
  const removeSearchTerm = (termToRemove: string) => {
    if (onSearch) {
      onSearch(''); // Clear the search term
    }
  };

  // Clear all search terms
  const clearSearchTerms = () => {
    if (onSearch) {
      onSearch('');
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
    type: 'ahj' | 'utility' | 'financier' | '45day',
    classification: string,
    label: string
  ) => {
    const isActive = isFilterActive(type, classification);
    const badgeClass = getClassificationBadgeClass(classification);
    
    return (
      <button
        className={`px-3 py-1 rounded-md text-sm ${
          isActive ? 'ring-2 ring-white' : 'opacity-80 hover:opacity-100'
        } ${badgeClass}`}
        onClick={() => handleClassificationFilterChange(type, classification)}
      >
        {label}
      </button>
    );
  };

  return (
    <div className="h-full flex flex-col bg-gray-900 text-white">
      {/* Logo and App Title */}
      <div className="p-4 border-b border-gray-700 flex items-center justify-center">
        <Image
          src="/aveyo-logo.svg"
          alt="Aveyo Logo"
          width={40}
          height={40}
          className="mr-2"
        />
        <h1 className="text-xl font-bold">AHJ Knock Planner</h1>
      </div>
      
      {/* Search Bar */}
      <div className="p-4 border-b border-gray-700">
        <div className="relative">
          <input
            type="text"
            placeholder="Search projects..."
            className="w-full bg-gray-800 text-white px-4 py-2 rounded-md pl-10"
            value={searchInput}
            onChange={handleSearchInputChange}
            onKeyDown={handleSearchKeyDown}
          />
          <FiSearch className="absolute left-3 top-3 text-gray-400" />
        </div>
      </div>
      
      {/* Active Filters */}
      <div className="px-4 pb-4">
        <div className="flex flex-wrap gap-2">
          {/* Search Terms */}
          {typeof searchTerms === 'string' && searchTerms.trim() !== '' && (
            <ActiveFilterChip
              key={`search-${searchTerms}`}
              label={searchTerms}
              type="search"
              onRemove={() => removeSearchTerm(searchTerms)}
            />
          )}
          
          {/* Project Filters */}
          {filters.projectFilters.map((filter) => {
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
            
            // Use the filter value directly as the label
            return (
              <ActiveFilterChip
                key={`${filter.type}-${filter.value}`}
                label={filter.value || filter.type}
                type={filter.type}
                onRemove={() => filter.id && removeFilter(filter.id)}
              />
            );
          })}
          
          {/* Entity Filters */}
          {filters.entityFilters.map((filter) => (
            <ActiveFilterChip
              key={`${filter.type}-${filter.value}`}
              label={filter.value || filter.type}
              type={filter.type}
              onRemove={() => filter.id && removeFilter(filter.id, true)}
            />
          ))}
          
          {/* Clear All Button - only show if there are filters or search terms */}
          {(filters.projectFilters.length > 0 || filters.entityFilters.length > 0 || (typeof searchTerms === 'string' && searchTerms.trim() !== '')) && (
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
            <div className="flex flex-wrap gap-2">
              {renderClassificationButton('utility', 'A', 'Class A')}
              {renderClassificationButton('utility', 'B', 'Class B')}
              {renderClassificationButton('utility', 'C', 'Class C')}
            </div>
          </div>
        </CollapsibleFilterSection>
        
        {/* AHJ Section */}
        <CollapsibleFilterSection title="AHJ">
          <div className="space-y-2">
            <div className="flex flex-wrap gap-2">
              {renderClassificationButton('ahj', 'A', 'Class A')}
              {renderClassificationButton('ahj', 'B', 'Class B')}
              {renderClassificationButton('ahj', 'C', 'Class C')}
            </div>
          </div>
        </CollapsibleFilterSection>
        
        {/* Financier Section */}
        <CollapsibleFilterSection title="Financier">
          <div className="space-y-2">
            <div className="flex flex-wrap gap-2">
              {renderClassificationButton('financier', 'A', 'Class A')}
              {renderClassificationButton('financier', 'B', 'Class B')}
              {renderClassificationButton('financier', 'C', 'Class C')}
            </div>
          </div>
        </CollapsibleFilterSection>
        
        {/* 45-Day Program Section */}
        <CollapsibleFilterSection title="45-Day Program">
          <div className="space-y-2">
            <div className="flex flex-wrap gap-2">
              <button
                className={`px-3 py-1 rounded-md text-sm ${
                  isFilterActive('45day', 'true') 
                    ? 'bg-green-600 ring-2 ring-white' 
                    : 'bg-green-800 opacity-80 hover:opacity-100'
                }`}
                onClick={() => handleClassificationFilterChange('45day', 'true')}
              >
                Qualified
              </button>
              <button
                className={`px-3 py-1 rounded-md text-sm ${
                  isFilterActive('45day', 'false') 
                    ? 'bg-red-600 ring-2 ring-white' 
                    : 'bg-red-800 opacity-80 hover:opacity-100'
                }`}
                onClick={() => handleClassificationFilterChange('45day', 'false')}
              >
                Not Qualified
              </button>
            </div>
          </div>
        </CollapsibleFilterSection>
      </div>
      
      {/* Logout Button */}
      <div className="p-4 border-t border-gray-700">
        <button 
          onClick={handleLogout}
          className="flex items-center text-gray-400 hover:text-white"
        >
          <FiLogOut className="mr-2" />
          Logout
        </button>
      </div>
    </div>
  );
};

export default ImprovedFilterPanel;
