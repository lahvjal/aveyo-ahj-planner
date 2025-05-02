import React, { useState } from 'react';
import { FiChevronDown, FiChevronUp } from 'react-icons/fi';

interface CollapsibleFilterSectionProps {
  title: string;
  children: React.ReactNode;
  defaultOpen?: boolean;
}

const CollapsibleFilterSection: React.FC<CollapsibleFilterSectionProps> = ({ 
  title, 
  children,
  defaultOpen = false
}) => {
  const [isOpen, setIsOpen] = useState(defaultOpen);

  return (
    <div className="mb-4">
      <button
        onClick={() => setIsOpen(!isOpen)}
        className="w-full flex justify-between items-center px-4 py-3 bg-gray-800 hover:bg-gray-700 rounded-md text-white transition-colors"
      >
        <span className="font-medium">{title}</span>
        {isOpen ? <FiChevronUp /> : <FiChevronDown />}
      </button>
      
      {isOpen && (
        <div className="mt-2 p-2 bg-gray-900 rounded-md">
          {children}
        </div>
      )}
    </div>
  );
};

export default CollapsibleFilterSection;
