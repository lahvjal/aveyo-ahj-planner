import React from 'react';
import { FiMapPin } from 'react-icons/fi';
import { EntityData } from '@/hooks/useEntities';
import { getClassificationBadgeClass, formatClassification } from '@/utils/classificationColors';
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
      className={`grid-cols-5-new hover:bg-[#1e1e1e] cursor-pointer ${
        isHighlighted ? 'border-l-4 border-blue-500 bg-blue-900/20' : ''
      }`}
      onClick={() => onSelect(entity)}
    >
      <div className="px-6 py-4 whitespace-nowrap text-sm text-white overflow-hidden text-ellipsis">
        <span className="truncate block">{entity.name}</span>
      </div>
      <div className="px-6 py-4 whitespace-nowrap text-sm text-white overflow-hidden text-ellipsis text-center">
        <span className="truncate block">{entity.projectCount}</span>
      </div>
      <div className="px-6 py-4 whitespace-nowrap text-sm text-white overflow-hidden text-center">
        <span className={`inline-block px-2 py-0.5 rounded text-xs font-medium ${getClassificationBadgeClass(entity.classification)}`}>
          {formatClassification(entity.classification)}
        </span>
      </div>
      <div className="px-6 py-4 whitespace-nowrap text-sm text-white overflow-hidden text-ellipsis">
        <span className={`truncate block ${entity.latitude && entity.longitude ? '' : 'text-gray-800'}`}>
          {formatDistance(entity.distance)}
        </span>
      </div>
      <div className="px-6 pr-6 py-4 whitespace-nowrap text-right text-sm font-medium">
        <button
          onClick={(e) => {
            e.stopPropagation();
            if (entity.latitude && entity.longitude) {
              onViewOnMap(entity.name, entityType);
            }
          }}
          className={`flex items-center justify-end ${entity.latitude && entity.longitude ? 'text-gray-300 hover:text-white' : 'text-gray-800 cursor-default'}`}
          disabled={!entity.latitude || !entity.longitude}
        >
          <FiMapPin className="mr-1" />
          Map
        </button>
      </div>
    </div>
  );
};

export default EntityListItem;
