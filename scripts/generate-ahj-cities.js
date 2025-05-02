/**
 * Script to generate a city boundaries GeoJSON file that only includes
 * cities corresponding to AHJs in the Supabase database
 */

const fs = require('fs');
const path = require('path');
const glob = require('glob');
const dotenv = require('dotenv');

// Load environment variables from .env.local
const envPath = path.resolve(__dirname, '..', '.env.local');
dotenv.config({ path: envPath });

console.log('Loaded environment from:', envPath);
console.log('Supabase URL exists:', !!process.env.NEXT_PUBLIC_SUPABASE_URL);
console.log('Supabase Key exists:', !!process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY);

const { createClient } = require('@supabase/supabase-js');

// Supabase configuration
const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

if (!supabaseUrl || !supabaseAnonKey) {
  console.error('Supabase credentials not found in environment variables');
  process.exit(1);
}

const supabase = createClient(supabaseUrl, supabaseAnonKey);

// Configuration
const REPO_PATH = path.join(__dirname, '..', 'temp', 'geojson-us-city-boundaries');
const OUTPUT_PATH = path.join(__dirname, '..', 'public', 'data', 'ahj-cities.json');
const SIMPLIFICATION_TOLERANCE = 0.0005; // Reduced to preserve more detail

// Priority cities that should always be included
const PRIORITY_CITIES = [
  'los-angeles', 'new-york', 'chicago', 'houston', 'phoenix', 'philadelphia',
  'san-antonio', 'san-diego', 'dallas', 'san-jose', 'austin', 'jacksonville',
  'fort-worth', 'columbus', 'charlotte', 'indianapolis', 'seattle', 'denver',
  'washington', 'boston', 'nashville', 'portland', 'las-vegas', 'detroit',
  'salt-lake-city', 'provo', 'orem', 'ogden', 'sandy', 'west-valley-city'
];

// Priority states
const PRIORITY_STATES = ['il', 'pa', 'ca']; // Illinois, Pennsylvania, California

// Function to simplify a GeoJSON polygon by reducing the number of points
function simplifyPolygon(coordinates, tolerance = SIMPLIFICATION_TOLERANCE) {
  // This is a very basic simplification algorithm
  // For more complex needs, consider using a library like Turf.js
  if (!Array.isArray(coordinates)) return coordinates;
  
  if (Array.isArray(coordinates[0]) && !Array.isArray(coordinates[0][0])) {
    // This is an array of points (a single ring)
    if (coordinates.length <= 5) return coordinates; // Don't simplify very small polygons
    
    const simplified = [coordinates[0]]; // Always keep the first point
    
    for (let i = 1; i < coordinates.length - 1; i++) {
      const prev = coordinates[i - 1];
      const curr = coordinates[i];
      const next = coordinates[i + 1];
      
      // Calculate distance between current point and line from prev to next
      const distance = pointToLineDistance(curr, prev, next);
      
      // If the distance is greater than tolerance, keep the point
      if (distance > tolerance) {
        simplified.push(curr);
      }
    }
    
    simplified.push(coordinates[coordinates.length - 1]); // Always keep the last point
    return simplified;
  } else {
    // This is an array of arrays (multiple rings or polygons)
    return coordinates.map(coord => simplifyPolygon(coord, tolerance));
  }
}

// Calculate distance from a point to a line segment
function pointToLineDistance(point, lineStart, lineEnd) {
  const x = point[0];
  const y = point[1];
  const x1 = lineStart[0];
  const y1 = lineStart[1];
  const x2 = lineEnd[0];
  const y2 = lineEnd[1];
  
  const A = x - x1;
  const B = y - y1;
  const C = x2 - x1;
  const D = y2 - y1;
  
  const dot = A * C + B * D;
  const lenSq = C * C + D * D;
  let param = -1;
  
  if (lenSq !== 0) param = dot / lenSq;
  
  let xx, yy;
  
  if (param < 0) {
    xx = x1;
    yy = y1;
  } else if (param > 1) {
    xx = x2;
    yy = y2;
  } else {
    xx = x1 + param * C;
    yy = y1 + param * D;
  }
  
  const dx = x - xx;
  const dy = y - yy;
  
  return Math.sqrt(dx * dx + dy * dy);
}

// Function to normalize city names for comparison
function normalizeName(name) {
  return name.toLowerCase()
    .replace(/[^a-z0-9]/g, '') // Remove non-alphanumeric characters
    .replace(/\s+/g, ''); // Remove spaces
}

// Main function to generate city boundaries for AHJs
async function generateAHJCityBoundaries() {
  console.log('Starting to generate city boundaries for AHJs...');
  
  // Fetch AHJs from Supabase
  console.log('Fetching AHJs from Supabase...');
  const { data: ahjs, error } = await supabase
    .from('ahjs')
    .select('*');
  
  if (error) {
    console.error('Error fetching AHJs:', error);
    return;
  }
  
  console.log(`Found ${ahjs.length} AHJs in the database`);
  
  // Extract city names from AHJs
  const ahjCities = new Set();
  ahjs.forEach(ahj => {
    // The AHJ name often contains the city name
    const ahjName = ahj.name;
    
    // Extract potential city name from AHJ name
    // This is a simple approach - you might need to refine this based on your data
    const cityMatch = ahjName.match(/^([^,]+)/);
    if (cityMatch && cityMatch[1]) {
      ahjCities.add(cityMatch[1].trim());
    }
  });
  
  console.log(`Extracted ${ahjCities.size} potential city names from AHJs`);
  
  // Find all city GeoJSON files
  const citiesDir = path.join(REPO_PATH, 'cities');
  const pattern = path.join(citiesDir, '**', '*.json');
  
  console.log(`Searching for city boundary files in: ${citiesDir}`);
  const files = glob.sync(pattern);
  console.log(`Found ${files.length} city boundary files`);
  
  // Normalize AHJ city names for comparison
  const normalizedAHJCities = Array.from(ahjCities).map(city => ({
    original: city,
    normalized: normalizeName(city)
  }));
  
  // Filter and sort files to prioritize AHJ cities, then major cities, then priority states
  const matchedFiles = [];
  const priorityFiles = [];
  const priorityStateFiles = [];
  const otherFiles = [];
  
  files.forEach(file => {
    const fileName = path.basename(file, '.json');
    const stateName = file.split('/').slice(-2)[0].toLowerCase();
    
    // Check if this file matches an AHJ city
    const isAHJCity = normalizedAHJCities.some(city => 
      normalizeName(fileName).includes(city.normalized) || 
      city.normalized.includes(normalizeName(fileName))
    );
    
    if (isAHJCity) {
      matchedFiles.push(file);
    } else if (PRIORITY_CITIES.includes(fileName)) {
      priorityFiles.push(file);
    } else if (PRIORITY_STATES.includes(stateName)) {
      priorityStateFiles.push(file);
    } else {
      otherFiles.push(file);
    }
  });
  
  console.log(`Found ${matchedFiles.length} files matching AHJ cities`);
  console.log(`Found ${priorityFiles.length} priority city files`);
  console.log(`Found ${priorityStateFiles.length} files from priority states`);
  
  // Combine all files with appropriate priority
  const sortedFiles = [
    ...matchedFiles,
    ...priorityFiles,
    ...priorityStateFiles,
    ...otherFiles
  ];
  
  // Initialize combined GeoJSON
  const combinedGeoJSON = {
    type: 'FeatureCollection',
    features: []
  };
  
  // Process files
  console.log(`Processing city boundary files...`);
  let processedCount = 0;
  
  // Process all AHJ city matches first
  for (let i = 0; i < matchedFiles.length; i++) {
    const file = matchedFiles[i];
    try {
      const data = JSON.parse(fs.readFileSync(file, 'utf8'));
      
      // Handle different GeoJSON structures
      if (data.type === 'FeatureCollection') {
        data.features.forEach(feature => {
          // Simplify the geometry to reduce file size
          if (feature.geometry && feature.geometry.coordinates) {
            feature.geometry.coordinates = simplifyPolygon(feature.geometry.coordinates);
          }
          combinedGeoJSON.features.push(feature);
        });
      } else if (data.type === 'Feature') {
        // Simplify the geometry to reduce file size
        if (data.geometry && data.geometry.coordinates) {
          data.geometry.coordinates = simplifyPolygon(data.geometry.coordinates);
        }
        combinedGeoJSON.features.push(data);
      }
      
      processedCount++;
      if (processedCount % 50 === 0) {
        console.log(`Processed ${processedCount} cities...`);
      }
    } catch (err) {
      console.error(`Error processing file ${file}:`, err);
    }
  }
  
  // Add priority cities if they weren't already included
  const remainingCount = 500 - processedCount; // Cap at 500 total cities
  const additionalFiles = [...priorityFiles, ...priorityStateFiles, ...otherFiles].slice(0, remainingCount);
  
  for (let i = 0; i < additionalFiles.length; i++) {
    const file = additionalFiles[i];
    try {
      const data = JSON.parse(fs.readFileSync(file, 'utf8'));
      
      // Handle different GeoJSON structures
      if (data.type === 'FeatureCollection') {
        data.features.forEach(feature => {
          // Simplify the geometry to reduce file size
          if (feature.geometry && feature.geometry.coordinates) {
            feature.geometry.coordinates = simplifyPolygon(feature.geometry.coordinates);
          }
          combinedGeoJSON.features.push(feature);
        });
      } else if (data.type === 'Feature') {
        // Simplify the geometry to reduce file size
        if (data.geometry && data.geometry.coordinates) {
          data.geometry.coordinates = simplifyPolygon(data.geometry.coordinates);
        }
        combinedGeoJSON.features.push(data);
      }
      
      processedCount++;
      if (processedCount % 50 === 0) {
        console.log(`Processed ${processedCount} cities...`);
      }
    } catch (err) {
      console.error(`Error processing file ${file}:`, err);
    }
  }
  
  console.log(`Successfully combined ${processedCount} city boundaries`);
  
  // Write combined GeoJSON to file
  fs.writeFileSync(OUTPUT_PATH, JSON.stringify(combinedGeoJSON));
  
  // Get file size in MB
  const stats = fs.statSync(OUTPUT_PATH);
  const fileSizeMB = (stats.size / (1024 * 1024)).toFixed(2);
  
  console.log(`Combined city boundaries saved to: ${OUTPUT_PATH}`);
  console.log(`File size: ${fileSizeMB} MB`);
}

// Run the script
generateAHJCityBoundaries()
  .catch(err => {
    console.error('Error generating AHJ city boundaries:', err);
    process.exit(1);
  });
