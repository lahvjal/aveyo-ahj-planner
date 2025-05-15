export interface AHJ {
  id: string;
  name: string;
  county: string;
  zip: string;
  classification: 'A' | 'B' | 'C' | null;
  latitude?: number;
  longitude?: number;
}

export interface Filter {
  id: string;
  type: 'county' | 'zip' | 'city' | 'class';
  value: string;
}

export interface ExcelAHJData {
  name: string;
  county: string;
  zip: string;
  classification: string;
  address?: string;
}

// New interfaces for Project Browser pivot
export interface Project {
  id: string;
  address: string;
  latitude?: number;
  longitude?: number;
  ahj: {
    id?: string;
    name: string;
    classification: string;
  };
  utility: {
    id?: string;
    name: string;
    classification?: string;
  };
  financier: {
    id?: string;
    name: string;
    classification?: string;
  };
  status?: string;
  city?: string;
  state?: string;
  zip?: string;
  county?: string;
  // New fields for 45 Day Program features
  milestone?: string;
  qualifies45Day?: string | boolean;
  isMasked?: boolean;
  rep_id?: string | null;
  contract_signed_date?: string;
  customer_name?: string;
  ahj_item_id: string;
  utility_company_item_id: string
}

/**
 * Defines the source of a filter to track how it was created
 * - 'manual': User manually added the filter from the filter panel
 * - 'entity-selection': Filter was created by selecting an entity in the EntityListView
 * - 'search': Filter was created from a search query
 */
export type FilterSource = 'manual' | 'entity-selection' | 'search';

/**
 * Enhanced Project Filter interface that supports entity selection tracking
 * This allows us to distinguish between regular filters and those created from entity selections
 */
export interface ProjectFilter {
  /** The type of filter (e.g., 'ahj', 'utility', 'financier', '45day', 'search', 'myprojects') */
  type: 'ahj' | 'utility' | 'financier' | '45day' | 'search' | 'myprojects';
  
  /** The display value of the filter (e.g., entity name, state name) */
  value: string;
  
  /** 
   * Tracks how this filter was created 
   * @default 'manual'
   */
  filterSource?: FilterSource;
  
  /** 
   * For entity-selection filters, stores the ID of the selected entity
   * This allows us to highlight the correct entity in the entity lists
   * and show the entity pin on the map
   */
  entityId?: string;
  
  /**
   * Optional metadata for additional filter properties
   * Useful for storing extra information like coordinates for map pins
   */
  metadata?: Record<string, any>;
  
  /**
   * Unique identifier for the filter
   * Used for removing specific filters
   */
  id?: string;
  
  /**
   * Human-readable label for the filter
   * Used for displaying in the UI
   */
  label?: string;
  
  /**
   * Specifies the entity type for entity filters
   * Used to determine which entity list the filter applies to
   */
  entityType?: 'ahj' | 'utility';
}

/**
 * Filter state structure used in the DataContext
 */
export interface FilterState {
  projectFilters: ProjectFilter[];
  entityFilters: ProjectFilter[];
}

/**
 * Props for the ImprovedFilterPanel component
 */
export interface ImprovedFilterPanelProps {
  filters: FilterState;
  addFilter: (filter: ProjectFilter) => void;
  removeFilter: (filterId: string, isEntityFilter?: boolean) => void;
  clearFilters: () => void;
  onSearch?: (terms: string) => void;
  searchTerms?: string;
  showOnlyMyProjects?: boolean;
  toggleShowOnlyMyProjects?: () => void;
}

/**
 * Props for the EntityListView component
 */
export interface EntityListViewProps {
  projects: Project[];
  userLocation?: { latitude: number; longitude: number } | null;
  onViewOnMap: (entityName: string, entityType: 'ahj' | 'utility') => void;
  onAddFilter: (filter: ProjectFilter) => void;
  onRemoveFilter: (filterId: string, isEntityFilter?: boolean) => void;
  filters: FilterState;
}

