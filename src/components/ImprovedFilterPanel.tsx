import React, { useState, KeyboardEvent, useEffect } from 'react';
import Image from 'next/image';
import Link from 'next/link';
import { ProjectFilter, ImprovedFilterPanelProps } from '@/utils/types';
import CollapsibleFilterSection from './CollapsibleFilterSection';
import ActiveFilterChip from './ActiveFilterChip';
import { FiMap, FiList, FiSearch, FiLogOut, FiX, FiFilter, FiFileText } from 'react-icons/fi';
import { useAuth } from '@/utils/AuthContext';
import { getClassificationBadgeClass, formatClassification } from '@/utils/classificationColors';
import ToggleOption from './ToggleOption';

interface ImprovedFilterPanelExtendedProps extends ImprovedFilterPanelProps {
  isCollapsed?: boolean;
  onToggleCollapse?: () => void;
  isMobile?: boolean;
}

const ImprovedFilterPanel: React.FC<ImprovedFilterPanelExtendedProps> = ({
  filters,
  addFilter,
  removeFilter,
  clearFilters,
  onSearch,
  searchTerms = '',
  showOnlyMyProjects,
  toggleShowOnlyMyProjects,
  isCollapsed = false,
  onToggleCollapse,
  isMobile = false,
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
      // Find the filter in the consolidated filters array
      const filterToRemove = filters.filters.find(f => f.type === type && f.value === value);
      if (filterToRemove && filterToRemove.id) {
        removeFilter(filterToRemove.id);
      }
    } else {
      // Add the filter
      addFilter({ 
        type, 
        value,
        label: `${type.toUpperCase()}: ${value}`
      });
    }
  };

  // Check if a filter is active
  const isFilterActive = (type: string, value: string) => {
    // Check in the consolidated filters array
    return filters.filters.some(f => f.type === type && f.value === value);
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

  // Handle window resize to detect mobile view
  useEffect(() => {
    const handleResize = () => {
      // This is just for demonstration - the actual mobile detection is passed as a prop
      // You could implement actual resize detection here if needed
    };

    window.addEventListener('resize', handleResize);
    return () => window.removeEventListener('resize', handleResize);
  }, []);

  // If the panel is collapsed on mobile, show a minimal version
  if (isMobile && isCollapsed) {
    return (
      <div className="fixed inset-0 z-50 pointer-events-none">
        <div className="absolute bottom-20 right-4 pointer-events-auto">
          <button
            onClick={onToggleCollapse}
            className="bg-blue-500 text-white p-3 rounded-full shadow-lg"
            aria-label="Open filters"
          >
            <FiFilter size={20} />
          </button>
        </div>
      </div>
    );
  }

  // Full panel view (desktop or expanded mobile)
  return (
    <div 
      className={`h-full flex flex-col bg-gray-900 text-white ${
        isMobile ? 'fixed inset-0 z-50' : ''
      }`}
    >
      {/* Header with logo and close button for mobile */}
      <div className="p-4 border-b border-gray-700 flex items-center justify-between">
        <div className="flex items-center">
          <Image
            src="/aveyo-logo.svg"
            alt="Aveyo Logo"
            width={40}
            height={40}
            className="mr-2"
          />
          <h1 className="text-xl font-bold">AHJ Knock Planner</h1>
        </div>
        
        {/* Close button only on mobile */}
        {isMobile && onToggleCollapse && (
          <button
            onClick={onToggleCollapse}
            className="text-gray-400 hover:text-white"
            aria-label="Close filters"
          >
            <FiX size={24} />
          </button>
        )}
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
      <div className="px-4 pb-4 pt-4">
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
          
          {/* All Filters */}
          {filters.filters.map((filter) => {
            if (filter.type === 'search') return null; // Skip search filters as they're handled above
            if (filter.type === 'myprojects') {
              return (
                <ActiveFilterChip
                  key={filter.id || `myprojects-${filter.value}`}
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
            
            return (
              <ActiveFilterChip
                key={filter.id || `${filter.type}-${filter.value}`}
                label={filter.label || `${filter.type}: ${filter.value}`}
                type={filter.type}
                onRemove={() => removeFilter(filter.id || '')}
              />
            );
          })}
          
          {/* Clear All button */}
          {(filters.filters.length > 0 || searchTerms) && (
            <button 
              onClick={() => {
                clearFilters();
                clearSearchTerms();
              }}
              className="text-xs text-blue-400 hover:text-blue-300"
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
        {/* <CollapsibleFilterSection title="Financier">
          <div className="space-y-2">
            <div className="flex flex-wrap gap-2">
              {renderClassificationButton('financier', 'A', 'Class A')}
              {renderClassificationButton('financier', 'B', 'Class B')}
              {renderClassificationButton('financier', 'C', 'Class C')}
            </div>
          </div>
        </CollapsibleFilterSection> */}
        
        {/* 45-Day Program Section */}
        {/* <CollapsibleFilterSection title="45-Day Program">
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
        </CollapsibleFilterSection> */}
      </div>
      
      {/* 45 Day Timeline PDF Link */}
      <div className="p-4 border-t border-gray-700">
        <a 
          href="/45 DAYS TO PAY TIMELINE.pdf" 
          target="_blank" 
          rel="noopener noreferrer"
          className="flex items-center text-blue-400 hover:text-blue-300"
        >
          <FiFileText className="mr-2" />
          45 Days to Pay Timeline
        </a>
      </div>
      
      {/* Logout Button */}
      <div className="p-4 border-t border-gray-700">
        <div className="flex justify-between items-center">
          <button 
            onClick={handleLogout}
            className="flex items-center text-gray-400 hover:text-white"
          >
            <FiLogOut className="mr-2" />
            Logout
          </button>
          
          {/* Done button for mobile */}
          {isMobile && onToggleCollapse && (
            <button
              onClick={onToggleCollapse}
              className="px-4 py-2 bg-blue-500 text-white rounded-md hover:bg-blue-600"
            >
              Done
            </button>
          )}
        </div>
      </div>
    </div>
  );
};

export default ImprovedFilterPanel;
