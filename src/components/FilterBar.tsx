import React from 'react';
import { FiX } from 'react-icons/fi';

interface Filter {
  id: string;
  type: 'county' | 'zip' | 'city' | 'class';
  value: string;
}

interface FilterBarProps {
  filters: Filter[];
  onRemoveFilter: (id: string) => void;
  onClearFilters: () => void;
}

const FilterBar: React.FC<FilterBarProps> = ({ 
  filters, 
  onRemoveFilter,
  onClearFilters
}) => {
  if (filters.length === 0) return null;
  
  return (
    <div className="flex items-center space-x-2 mb-4">
      <button 
        className="p-2 bg-[#1e1e1e] rounded-md text-white hover:bg-[#333333] transition-colors"
        onClick={onClearFilters}
      >
        <FiX size={18} />
      </button>
      
      {filters.map((filter) => (
        <div 
          key={filter.id}
          className="filter-tag"
          style={{ 
            backgroundColor: filter.type === 'class' && filter.value === 'A' 
              ? 'var(--class-a)' 
              : filter.type === 'class' && filter.value === 'B'
                ? 'var(--class-b)'
                : filter.type === 'class' && filter.value === 'C'
                  ? 'var(--class-c)'
                  : 'var(--primary)'
          }}
        >
          {filter.type === 'county' && `${filter.value} County`}
          {filter.type === 'zip' && filter.value}
          {filter.type === 'city' && filter.value}
          {filter.type === 'class' && `Class ${filter.value}${filter.value === 'A' ? ' (45 Day Eligible)' : ''}`}
          
          <button 
            onClick={() => onRemoveFilter(filter.id)}
            className="ml-2 text-white opacity-70 hover:opacity-100 transition-opacity"
          >
            <FiX size={14} />
          </button>
        </div>
      ))}
    </div>
  );
};

export default FilterBar;
