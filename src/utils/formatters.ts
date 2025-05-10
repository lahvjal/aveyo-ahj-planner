/**
 * Format distance in a user-friendly way
 * - Less than 0.1 miles: "< 0.1 miles"
 * - Less than 1 mile: "0.x miles" (1 decimal place)
 * - 1-10 miles: "x.x miles" (1 decimal place)
 * - Over 10 miles: "xx miles" (rounded to nearest mile)
 * - Over 100 miles: "xxx miles" (rounded to nearest 5 miles)
 */
export function formatDistance(distance?: number): string {
  if (distance === undefined || distance === null) {
    return 'N/A';
  }
  
  if (distance === Number.MAX_VALUE || distance === Infinity) {
    return 'Unknown';
  }
  
  if (distance < 0.1) {
    return '< 0.1 mi';
  } else if (distance < 1) {
    return `${distance.toFixed(1)} mi`;
  } else if (distance < 10) {
    return `${distance.toFixed(1)} mi`;
  } else if (distance < 100) {
    return `${Math.round(distance)} mi`;
  } else {
    // Round to nearest 5 miles for distances over 100 miles
    return `${Math.round(distance / 5) * 5} mi`;
  }
}
