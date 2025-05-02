// Get the Mapbox token from environment variables
export const getMapboxToken = (): string => {
  // Try to get token from environment variables
  const token = process.env.NEXT_PUBLIC_MAPBOX_TOKEN;
  
  // If token is not found in environment variables, use a default token for development
  if (!token) {
    console.warn('Mapbox token not found in environment variables. Using default development token.');
    // This is a temporary solution - in production, this should be set in .env.local
    return 'pk.eyJ1IjoiYXZleW8iLCJhIjoiY2xzNjdmcnk0MDZ2YTJrcGF5aWVqMnA5aSJ9.Ry9JcGmwYjVYW1iOYHOBMQ';
  }
  
  return token;
};
