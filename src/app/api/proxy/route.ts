// Disabled for static export mode. See Cascade Step 26 build error.

export const dynamic = undefined;

/**
 * API route to proxy requests to external services to avoid CORS issues
 * This route is no longer needed for city boundaries as we now use local GeoJSON data
 * from the geojson-us-city-boundaries GitHub repository.
 * 
 * @param request The incoming request
 * @returns Response from the external service
 */
// export async function GET(request: NextRequest) {
//   // Get the URL to proxy from the query parameters
//   const url = request.nextUrl.searchParams.get('url');
  
//   // Return 400 if no URL is provided
//   if (!url) {
//     return NextResponse.json({ error: 'No URL provided' }, { status: 400 });
//   }
  
//   try {
//     // Validate the URL to ensure it's from a trusted source
//     const validDomains = [
//       'services.arcgis.com'
//     ];
    
//     const urlObj = new URL(url);
//     if (!validDomains.some(domain => urlObj.hostname.includes(domain))) {
//       return NextResponse.json(
//         { error: 'URL not allowed. Only approved APIs are permitted.' }, 
//         { status: 403 }
//       );
//     }
    
//     // Fetch data from the external service
//     const response = await fetch(url, {
//       headers: {
//         'User-Agent': 'AHJ-Knock-Planner/1.0'
//       }
//     });
    
//     // Get the response data
//     const data = await response.json();
    
//     // Return the data
//     return NextResponse.json(data);
//   } catch (error) {
//     console.error('Proxy error:', error);
//     return NextResponse.json(
//       { error: 'Failed to fetch data from the provided URL' }, 
//       { status: 500 }
//     );
//   }
// }
