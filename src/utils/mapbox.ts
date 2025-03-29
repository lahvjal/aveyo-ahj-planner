// Get the Mapbox token from environment variables
export const getMapboxToken = (): string => {
  const token = process.env.NEXT_PUBLIC_MAPBOX_TOKEN;
  
  if (!token) {
    console.warn('Mapbox token not found in environment variables. Please add it to .env.local file.');
    return '';
  }
  
  return token;
};
