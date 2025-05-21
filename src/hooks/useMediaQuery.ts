import { useState, useEffect } from 'react';

/**
 * A hook that returns whether a given media query matches.
 * @param query The media query to check
 * @returns Boolean indicating if the media query matches
 */
const useMediaQuery = (query: string): boolean => {
  // Default to false for SSR
  const [matches, setMatches] = useState(false);

  useEffect(() => {
    // Create a media query list
    const mediaQuery = window.matchMedia(query);
    
    // Set the initial value
    setMatches(mediaQuery.matches);

    // Define a callback function to handle changes
    const handleChange = (event: MediaQueryListEvent) => {
      setMatches(event.matches);
    };

    // Add the event listener
    mediaQuery.addEventListener('change', handleChange);

    // Clean up the event listener when the component unmounts
    return () => {
      mediaQuery.removeEventListener('change', handleChange);
    };
  }, [query]);

  return matches;
};

export default useMediaQuery;
