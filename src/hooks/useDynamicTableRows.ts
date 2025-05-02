import { useState, useEffect, useRef } from 'react';

interface UseDynamicTableRowsProps {
  containerRef: React.RefObject<HTMLElement | null>;
  totalItems: any[] | number;
  rowHeight: number;
  headerHeight: number;
  paginationHeight: number;
  extraPadding?: number;
  minRows?: number; // Minimum number of rows to display
}

interface UseDynamicTableRowsResult<T> {
  itemsPerPage: number;
  currentPage: number;
  setCurrentPage: (page: number) => void;
  totalPages: number;
  visibleItems: T[];
  startIndex: number;
  endIndex: number;
  availableHeight: number;
}

/**
 * A hook that calculates how many table rows can fit in a container
 * and handles pagination accordingly.
 */
export function useDynamicTableRows<T>({
  containerRef,
  totalItems,
  rowHeight,
  headerHeight,
  paginationHeight,
  extraPadding = 0,
  minRows = 10, // Default minimum rows
}: UseDynamicTableRowsProps): UseDynamicTableRowsResult<T> {
  const [itemsPerPage, setItemsPerPage] = useState(minRows);
  const [currentPage, setCurrentPage] = useState(1);
  const [availableHeight, setAvailableHeight] = useState(0);
  const resizeObserverRef = useRef<ResizeObserver | null>(null);
  
  // Get the actual number of items
  const itemCount = Array.isArray(totalItems) ? totalItems.length : 
                   typeof totalItems === 'number' ? totalItems : 0;
  
  // Calculate total pages
  const totalPages = Math.max(1, Math.ceil(itemCount / itemsPerPage));
  
  // Ensure current page is valid
  const validCurrentPage = Math.min(currentPage, totalPages);
  if (validCurrentPage !== currentPage) {
    setCurrentPage(validCurrentPage);
  }
  
  // Calculate start and end indices
  const startIndex = (validCurrentPage - 1) * itemsPerPage;
  const endIndex = Math.min(startIndex + itemsPerPage, itemCount);
  
  // Get visible items if an array was provided
  const visibleItems = Array.isArray(totalItems) 
    ? totalItems.slice(startIndex, endIndex) as unknown as T[]
    : [] as T[];

  // Calculate how many rows can fit in the container
  useEffect(() => {
    const calculateRowsPerPage = () => {
      if (!containerRef.current) return;
      
      // Get container height
      const height = containerRef.current.clientHeight;
      setAvailableHeight(height);
      
      // Calculate available space for rows
      const availableSpace = height - headerHeight - paginationHeight - extraPadding;
      
      // Calculate how many rows can fit
      const calculatedRows = Math.max(minRows, Math.floor(availableSpace / rowHeight));
      
      console.log('Container height:', height);
      console.log('Available space:', availableSpace);
      console.log('Calculated rows:', calculatedRows);
      
      // Update state if changed
      if (calculatedRows !== itemsPerPage) {
        setItemsPerPage(calculatedRows);
      }
    };

    // Initial calculation
    calculateRowsPerPage();
    
    // Set up resize observer
    if (!resizeObserverRef.current) {
      resizeObserverRef.current = new ResizeObserver(() => {
        calculateRowsPerPage();
      });
      
      if (containerRef.current) {
        resizeObserverRef.current.observe(containerRef.current);
      }
    }
    
    // Cleanup
    return () => {
      if (resizeObserverRef.current) {
        resizeObserverRef.current.disconnect();
        resizeObserverRef.current = null;
      }
    };
  }, [containerRef, headerHeight, paginationHeight, rowHeight, extraPadding, minRows]);

  return {
    itemsPerPage,
    currentPage: validCurrentPage,
    setCurrentPage,
    totalPages,
    visibleItems,
    startIndex,
    endIndex,
    availableHeight
  };
}
