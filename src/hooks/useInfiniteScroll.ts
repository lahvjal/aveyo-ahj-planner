import { useState, useEffect, useRef, useCallback } from 'react';

interface UseInfiniteScrollProps<T> {
  items: T[];
  initialItemsToLoad?: number;
  loadMoreStep?: number;
  threshold?: number;
}

interface UseInfiniteScrollResult<T> {
  visibleItems: T[];
  containerRef: React.RefObject<HTMLDivElement | null>;
  isLoading: boolean;
  hasMore: boolean;
  loadedCount: number;
}

/**
 * A hook that implements infinite scrolling for any array of items
 */
export function useInfiniteScroll<T>({
  items,
  initialItemsToLoad = 20,
  loadMoreStep = 10,
  threshold = 200
}: UseInfiniteScrollProps<T>): UseInfiniteScrollResult<T> {
  const [loadedCount, setLoadedCount] = useState(initialItemsToLoad);
  const [isLoading, setIsLoading] = useState(false);
  const containerRef = useRef<HTMLDivElement | null>(null);
  
  // Get visible items
  const visibleItems = items.slice(0, loadedCount);
  
  // Check if there are more items to load
  const hasMore = loadedCount < items.length;
  
  // Function to load more items
  const loadMore = useCallback(() => {
    if (isLoading || !hasMore) return;
    
    setIsLoading(true);
    
    // Simulate loading delay (remove in production)
    setTimeout(() => {
      setLoadedCount(prev => Math.min(prev + loadMoreStep, items.length));
      setIsLoading(false);
    }, 300);
  }, [isLoading, hasMore, items.length, loadMoreStep]);
  
  // Handle scroll event
  useEffect(() => {
    const handleScroll = () => {
      if (!containerRef.current || isLoading || !hasMore) return;
      
      const { scrollTop, scrollHeight, clientHeight } = containerRef.current;
      
      // If scrolled near the bottom, load more items
      if (scrollHeight - scrollTop - clientHeight < threshold) {
        loadMore();
      }
    };
    
    const currentContainer = containerRef.current;
    if (currentContainer) {
      currentContainer.addEventListener('scroll', handleScroll);
    }
    
    return () => {
      if (currentContainer) {
        currentContainer.removeEventListener('scroll', handleScroll);
      }
    };
  }, [loadMore, isLoading, hasMore, threshold]);
  
  // Reset loaded count when items change (e.g., due to filtering)
  useEffect(() => {
    setLoadedCount(initialItemsToLoad);
  }, [items, initialItemsToLoad]);
  
  return {
    visibleItems,
    containerRef,
    isLoading,
    hasMore,
    loadedCount
  };
}
