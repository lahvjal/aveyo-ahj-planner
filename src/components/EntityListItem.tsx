import React from 'react';
import { FiMapPin } from 'react-icons/fi';
import { EntityData } from '@/hooks/useEntities';
import { getClassificationBadgeClass } from '@/utils/classificationColors';
import { formatDistance } from '@/utils/formatters';

interface EntityListItemProps {
  entity: EntityData;
  isSelected: boolean;
  isHighlighted?: boolean; // Add optional isHighlighted prop
  onSelect: (entity: EntityData) => void;
  onViewOnMap: (entityName: string, entityType: 'ahj' | 'utility') => void;
  entityType: 'ahj' | 'utility';
}

const EntityListItem: React.FC<EntityListItemProps> = ({
  entity,
  isSelected,
  isHighlighted = false,
  onSelect,
  onViewOnMap,
  entityType
}) => {
  return (
    <div 
      className={`grid grid-cols-5 hover:bg-[#1e1e1e] cursor-pointer ${
        isHighlighted ? 'border-l-4 border-blue-500 bg-blue-900/20' : ''
      }`}
      onClick={() => onSelect(entity)}
    >
      <div className="px-6 py-4 whitespace-nowrap text-sm text-white overflow-hidden text-ellipsis">
        <span className="truncate block">{entity.name}</span>
      </div>
      <div className="px-6 py-4 whitespace-nowrap text-sm text-white overflow-hidden text-ellipsis">
        <span className="truncate block">{entity.projectCount}</span>
      </div>
      <div className="px-6 py-4 whitespace-nowrap text-sm text-white overflow-hidden">
        <span className={`inline-block px-2 py-0.5 rounded text-xs font-medium ${getClassificationBadgeClass(entity.classification)}`}>
          {entity.classification || 'Unknown'}
        </span>
      </div>
      <div className="px-6 py-4 whitespace-nowrap text-sm text-white overflow-hidden text-ellipsis">
        <span className="truncate block">{formatDistance(entity.distance)}</span>
      </div>
      <div className="px-6 py-4 whitespace-nowrap text-right text-sm font-medium">
        <button
          onClick={(e) => {
            e.stopPropagation();
            onViewOnMap(entity.name, entityType);
          }}
          className="text-gray-300 hover:text-white flex items-center justify-end"
        >
          <FiMapPin className="mr-1" />
          Map
        </button>
      </div>
    </div>
  );
};

export default EntityListItem;
