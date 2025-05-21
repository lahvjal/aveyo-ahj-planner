import React from 'react';
import { FiMapPin } from 'react-icons/fi';
import { EntityData } from '@/hooks/useEntities';
import { getClassificationBadgeClass, formatClassification } from '@/utils/classificationColors';
import { formatDistance } from '@/utils/formatters';

// Maximum value to consider as a valid distance (in miles)
// Any distance above this will be considered as "unknown"
const MAX_VALID_DISTANCE = Number.MAX_VALUE / 2; // Use a very high threshold to show most distances

interface EntityListItemProps {
  entity: EntityData;
  isSelected: boolean;
  isHighlighted?: boolean; // Add optional isHighlighted prop
  onSelect: (entity: EntityData) => void;
  onViewOnMap?: (entityName: string, entityType: 'ahj' | 'utility') => void;
  entityType: 'ahj' | 'utility';
  distance?: number; // Add optional distance prop
}

const EntityListItem: React.FC<EntityListItemProps> = ({
  entity,
  isSelected,
  isHighlighted = false,
  onSelect,
  onViewOnMap,
  entityType,
  distance
}) => {
  // Log entity data when component renders (only for the first entity to avoid spam)
  React.useEffect(() => {
    if (entity.id === 'first-entity-logged') return; // Skip if already logged
    
    // Mark as logged to prevent repeated logging
    Object.defineProperty(entity, 'id', {
      value: entity.id,
      writable: false,
      configurable: false
    });
  }, [entity, entityType]);
  
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
      <div className="px-0 py-4 whitespace-nowrap text-sm text-white overflow-hidden text-ellipsis text-center">
        <span className="truncate flex items-center gap-1">
          {entity.projectCount}
          <span className="text-gray-400 ml-1" style={{ fontSize: '8px' }}>P R J</span>
        </span>
      </div>
      <div className="px-6 py-4 whitespace-nowrap text-sm text-white overflow-hidden text-center">
        <span className={`inline-block px-2 py-0.5 rounded text-xs font-medium ${getClassificationBadgeClass(entity.classification)}`}>
          {formatClassification(entity.classification)}
        </span>
      </div>
      <div className="px-6 py-4 whitespace-nowrap text-sm text-white overflow-hidden text-ellipsis">
        <span className={`truncate flex items-center gap-1 ${(entity.latitude && entity.longitude && entity.distance !== undefined && entity.distance !== Infinity) ? '' : 'text-gray-500'}`}>
          {formatDistance(entity.distance, entity.coordStatus)}<span className="text-gray-400 ml-1" style={{ fontSize: '8px' }}>M I L</span>
        </span>
      </div>
      <div className="px-6 pr-6 py-4 whitespace-nowrap text-right text-sm font-medium">
        <button
          onClick={(e) => {
            e.stopPropagation();
            if (entity.latitude && entity.longitude && onViewOnMap) {
              onViewOnMap(entity.name, entityType);
            }
          }}
          className={`flex items-center justify-end ${entity.latitude && entity.longitude && onViewOnMap ? 'text-gray-300 hover:text-white' : 'text-gray-800 cursor-default'}`}
          disabled={!entity.latitude || !entity.longitude || !onViewOnMap}
        >
          <FiMapPin className="mr-1" />
          Map
        </button>
      </div>
    </div>
  );
};

export default EntityListItem;
