/**
 * parseFilters.ts
 * 
 * Utility functions for parsing URL parameters into filter objects
 * and converting filter objects to URL parameters.
 */

import { ProjectFilter } from './types';

/**
 * Parse URL search parameters into filter objects
 * @param searchParams URL search parameters
 * @returns Array of filter objects with unique IDs
 */
export async function parseFilters(searchParams: any) {
  const filters: ProjectFilter[] = [];

  // Await the searchParams before accessing its properties
  const params = await searchParams;

  // Parse search filter
  if (params.search) {
    filters.push({
      id: `search-${Date.now()}`,
      type: 'search',
      value: params.search,
      label: `Search: ${params.search}`
    });
  }

  // Parse AHJ filter
  if (params.ahj) {
    filters.push({
      id: `ahj-${params.ahj}`,
      type: 'ahj',
      value: params.ahj,
      label: `AHJ: ${params.ahj}`
    });
  }

  // Parse Utility filter
  if (params.utility) {
    filters.push({
      id: `utility-${params.utility}`,
      type: 'utility',
      value: params.utility,
      label: `Utility: ${params.utility}`
    });
  }

  // Parse Financier filter
  if (params.financier) {
    filters.push({
      id: `financier-${params.financier}`,
      type: 'financier',
      value: params.financier,
      label: `Financier: ${params.financier}`
    });
  }

  // Parse Classification filter
  if (params.classification && params.entityType) {
    filters.push({
      id: `class-${params.entityType}-${params.classification}`,
      type: 'class',
      value: params.classification,
      entityType: params.entityType,
      label: `${params.entityType.toUpperCase()} Class: ${params.classification}`
    });
  }

  // Parse 45-day qualification filter
  if (params.qualified45Day === 'true') {
    filters.push({
      id: '45day',
      type: '45day',
      value: 'true',
      label: '45-Day Qualified'
    });
  }

  // Parse My Projects filter
  if (params.myProjects) {
    filters.push({
      id: 'myprojects',
      type: 'myprojects',
      value: params.myProjects,
      label: 'My Projects'
    });
  }

  return filters;
}

/**
 * Convert filter objects to URL search parameters
 * @param filters Array of filter objects
 * @returns URL search parameters object
 */
export function filtersToUrlParams(filters: ProjectFilter[]) {
  const params: Record<string, string> = {};

  filters.forEach(filter => {
    switch (filter.type) {
      case 'search':
        params.search = filter.value;
        break;
      case 'ahj':
        params.ahj = filter.value;
        break;
      case 'utility':
        params.utility = filter.value;
        break;
      case 'financier':
        params.financier = filter.value;
        break;
      case 'class':
        params.classification = filter.value;
        // Only set entityType if it exists
        if (filter.entityType) {
          params.entityType = filter.entityType;
        }
        break;
      case '45day':
        params.qualified45Day = 'true';
        break;
      case 'myprojects':
        params.myProjects = filter.value;
        break;
    }
  });

  return params;
}

/**
 * Create a URL with filters applied
 * @param baseUrl Base URL
 * @param filters Array of filter objects
 * @returns URL string with filters as query parameters
 */
export function createUrlWithFilters(baseUrl: string, filters: ProjectFilter[]) {
  const params = filtersToUrlParams(filters);
  const searchParams = new URLSearchParams();
  
  Object.entries(params).forEach(([key, value]) => {
    if (value !== undefined) {
      searchParams.append(key, value);
    }
  });
  
  const queryString = searchParams.toString();
  return queryString ? `${baseUrl}?${queryString}` : baseUrl;
}
