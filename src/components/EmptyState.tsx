import React from 'react';
import { FiAlertCircle, FiFilter, FiArrowLeft } from 'react-icons/fi';

interface EmptyStateProps {
  title: string;
  message: string;
  icon?: React.ReactNode;
  actionButton?: React.ReactNode;
  className?: string;
  isFilterResult?: boolean;
  onClearFilter?: () => void;
  entityType?: 'ahj' | 'utility';
  selectedEntityName?: string;
}

const EmptyState: React.FC<EmptyStateProps> = ({
  title,
  message,
  icon = <FiAlertCircle className="text-yellow-500 text-4xl mb-3 mx-auto" />,
  actionButton,
  className = '',
  isFilterResult = false,
  onClearFilter,
  entityType,
  selectedEntityName,
}) => {
  // Use a different icon if this is a filter result
  const displayIcon = isFilterResult ? 
    <FiFilter className="text-blue-400 text-4xl mb-3 mx-auto" /> : 
    icon;
  
  return (
    <div className={`flex items-center justify-center h-full w-full ${className}`}>
      <div className="bg-black bg-opacity-40 p-6 rounded-lg text-center max-w-md">
        {displayIcon}
        <h3 className="text-lg font-semibold text-white mb-2">{title}</h3>
        <p className="text-gray-300 text-sm">{message}</p>
        
        {/* Show clear filter button if this is a filter result */}
        {isFilterResult && onClearFilter && (
          <button 
            onClick={onClearFilter}
            className="mt-4 px-4 py-2 bg-blue-600 text-white rounded hover:bg-blue-700 transition-colors flex items-center justify-center mx-auto"
          >
            <FiArrowLeft className="mr-2" />
            {selectedEntityName ? 
              `Clear ${entityType?.toUpperCase()} Selection` : 
              'Clear Filters'}
          </button>
        )}
        
        {/* Show custom action button if provided */}
        {actionButton && <div className="mt-4">{actionButton}</div>}
      </div>
    </div>
  );
};

export default EmptyState;
