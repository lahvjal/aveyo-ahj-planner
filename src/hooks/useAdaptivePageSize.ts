import { useState, useEffect, useRef } from 'react';

interface UseAdaptivePageSizeProps {
  totalItems: number;
  tableContainerRef: React.RefObject<HTMLDivElement | null>;
  rowHeight?: number;
  headerHeight?: number;
  paginationHeight?: number;
  buffer?: number;
}

interface UseAdaptivePageSizeResult {
  currentPage: number;
  setCurrentPage: (page: number) => void;
  itemsPerPage: number;
  totalPages: number;
  currentItems: number[];
  indexOfFirstItem: number;
  indexOfLastItem: number;
}

/**
 * A hook that dynamically calculates how many items can fit in a table
 * based on the container height, and handles pagination accordingly.
 */
export const useAdaptivePageSize = ({
  totalItems,
  tableContainerRef,
  rowHeight = 53, // Default height of a table row in pixels
  headerHeight = 43, // Default height of the table header in pixels
  paginationHeight = 60, // Default height of the pagination controls in pixels
  buffer = 10, // Buffer to prevent potential scrolling
}: UseAdaptivePageSizeProps): UseAdaptivePageSizeResult => {
  const [currentPage, setCurrentPage] = useState(1);
  const [itemsPerPage, setItemsPerPage] = useState(10); // Default value
  const previousHeightRef = useRef<number | null>(null);

  // Calculate how many items can fit in the container
  useEffect(() => {
    const calculateItemsPerPage = () => {
      if (!tableContainerRef.current) return;
      
      const containerHeight = tableContainerRef.current.clientHeight;
      
      // Skip recalculation if height hasn't changed
      if (previousHeightRef.current === containerHeight) return;
      previousHeightRef.current = containerHeight;
      
      // Calculate available height for rows
      const availableHeight = containerHeight - headerHeight - paginationHeight - buffer;
      
      // Calculate how many rows can fit
      const maxRows = Math.max(1, Math.floor(availableHeight / rowHeight));
      
      // Update items per page
      setItemsPerPage(maxRows);
      
      // Reset to page 1 when container size changes
      setCurrentPage(1);
    };

    // Calculate initially
    calculateItemsPerPage();
    
    // Set up resize observer to recalculate when container size changes
    const resizeObserver = new ResizeObserver(() => {
      calculateItemsPerPage();
    });
    
    if (tableContainerRef.current) {
      resizeObserver.observe(tableContainerRef.current);
    }
    
    // Clean up observer
    return () => {
      if (tableContainerRef.current) {
        resizeObserver.unobserve(tableContainerRef.current);
      }
    };
  }, [tableContainerRef, headerHeight, paginationHeight, rowHeight, buffer]);

  // Calculate pagination values
  const totalPages = Math.max(1, Math.ceil(totalItems / itemsPerPage));
  const safeCurrentPage = Math.min(currentPage, totalPages);
  
  // If current page is greater than total pages, adjust it
  useEffect(() => {
    if (currentPage > totalPages && totalPages > 0) {
      setCurrentPage(totalPages);
    }
  }, [currentPage, totalPages]);
  
  const indexOfLastItem = safeCurrentPage * itemsPerPage;
  const indexOfFirstItem = indexOfLastItem - itemsPerPage;
  
  // Create array of indices for current page items
  const currentItems = Array.from(
    { length: Math.min(itemsPerPage, totalItems - indexOfFirstItem) },
    (_, i) => indexOfFirstItem + i
  );

  return {
    currentPage: safeCurrentPage,
    setCurrentPage,
    itemsPerPage,
    totalPages,
    currentItems,
    indexOfFirstItem,
    indexOfLastItem: Math.min(indexOfLastItem, totalItems)
  };
};
