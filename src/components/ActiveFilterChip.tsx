import React from 'react';
import { FiX } from 'react-icons/fi';
import { getClassificationBadgeClass } from '@/utils/classificationColors';

interface ActiveFilterChipProps {
  label: string;
  type: string;
  onRemove: () => void;
}

const ActiveFilterChip: React.FC<ActiveFilterChipProps> = ({ label, type, onRemove }) => {
  // Get the classification from the label if it's a classification filter
  const getClassification = () => {
    if (type === 'ahj' || type === 'utility' || type === 'financier') {
      // Extract the classification from the label (e.g., "AHJ A" -> "A")
      const match = label.match(/\s([A-C])$/);
      return match ? match[1] : null;
    }
    return null;
  };

  const classification = getClassification();
  
  return (
    <div 
      className={`inline-flex items-center px-2 py-1 rounded-full text-sm ${
        classification 
          ? getClassificationBadgeClass(classification)
          : 'bg-gray-700 text-white'
      }`}
    >
      <span>{label}</span>
      <button 
        onClick={onRemove}
        className="ml-1 p-1 rounded-full hover:bg-gray-600 focus:outline-none"
        aria-label={`Remove ${label} filter`}
      >
        <FiX size={14} />
      </button>
    </div>
  );
};

export default ActiveFilterChip;
