/**
 * Format distance in a user-friendly way
 * - Less than 0.1 miles: "< 0.1 mi"
 * - Less than 1 mile: "0.x mi" (1 decimal place)
 * - 1-10 miles: "x.x mi" (1 decimal place)
 * - Over 10 miles: "xx mi" (rounded to nearest mile)
 * - Over 100 miles: "xxx mi" (rounded to nearest 5 miles)
 * - 'empty' status: returns "No location"
 * - 'invalid' status: returns "Invalid location"
 * - Other invalid values: returns "Unknown"
 */
export function formatDistance(distance?: number, status?: string): string {
  // Handle status messages
  if (status === 'empty') {
    return 'No location';
  }
  
  if (status === 'invalid') {
    return '-';
  }
  
  // Handle invalid cases
  if (distance === undefined || distance === null) {
    return '-';
  }
  
  // Handle special values
  if (distance === Number.MAX_VALUE || 
      distance === Infinity || 
      isNaN(distance)) {
    return '-';
  }
  
  // Convert from kilometers to miles (our distance calculation uses km)
  const miles = distance * 0.621371;
  
  // Format based on distance ranges
  if (miles < 0.1) {
    return '< 0.1';
  } else if (miles < 1) {
    return `${miles.toFixed(1)}`;
  } else if (miles < 10) {
    return `${miles.toFixed(1)}`;
  } else if (miles < 100) {
    return `${Math.round(miles)}`;
  } else {
    // Round to nearest 5 miles for distances over 100 miles
    return `${Math.round(miles / 5) * 5}`;
  }
}
