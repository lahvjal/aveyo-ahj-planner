/**
 * Script to combine city boundaries from the geojson-us-city-boundaries repository
 * into a single optimized GeoJSON file for use in the AHJ Knock Planner application
 */

const fs = require('fs');
const path = require('path');
const glob = require('glob');

// Configuration
const REPO_PATH = path.join(__dirname, '..', 'temp', 'geojson-us-city-boundaries');
const OUTPUT_PATH = path.join(__dirname, '..', 'public', 'data', 'us-cities.json');
const MAX_CITIES = 5000; // Increased from 1000 to 5000 to include more cities
const SIMPLIFICATION_TOLERANCE = 0.0005; // Reduced to preserve more detail

// Prioritize specific states (in addition to major cities)
const PRIORITY_STATES = ['il', 'pa', 'ca']; // Illinois, Pennsylvania, California

// List of common AHJ cities to prioritize
const AHJ_CITIES = [
  // Major cities in Illinois
  'chicago', 'aurora', 'rockford', 'joliet', 'naperville', 'springfield', 'peoria', 
  'elgin', 'waukegan', 'cicero', 'champaign', 'bloomington', 'decatur', 'evanston',
  'schaumburg', 'bolingbrook', 'palatine', 'skokie', 'des-plaines', 'orland-park',
  'tinley-park', 'oak-lawn', 'berwyn', 'mount-prospect', 'normal', 'wheaton',
  'hoffman-estates', 'oak-park', 'glenview', 'lombard',
  
  // Major cities in Pennsylvania
  'philadelphia', 'pittsburgh', 'allentown', 'erie', 'reading', 'scranton', 
  'bethlehem', 'lancaster', 'harrisburg', 'altoona', 'york', 'state-college',
  'wilkes-barre', 'chester', 'williamsport', 'monroeville', 'lebanon', 'easton',
  'hazleton', 'pottstown', 'west-chester', 'johnstown', 'norristown', 'mckeesport',
  'chambersburg', 'carlisle', 'west-mifflin', 'hermitage', 'new-castle', 'butler',
  
  // Major cities in California
  'los-angeles', 'san-diego', 'san-jose', 'san-francisco', 'fresno', 'sacramento',
  'long-beach', 'oakland', 'bakersfield', 'anaheim', 'santa-ana', 'riverside',
  'stockton', 'chula-vista', 'irvine', 'fremont', 'san-bernardino', 'modesto',
  'fontana', 'oxnard', 'moreno-valley', 'huntington-beach', 'glendale', 'santa-clarita',
  'garden-grove', 'oceanside', 'rancho-cucamonga', 'santa-rosa', 'ontario', 'elk-grove',
  'corona', 'lancaster', 'palmdale', 'salinas', 'hayward', 'pomona', 'sunnyvale',
  'escondido', 'torrance', 'pasadena', 'orange', 'fullerton', 'thousand-oaks',
  'visalia', 'roseville', 'concord', 'simi-valley', 'santa-clara', 'victorville',
  'vallejo', 'berkeley', 'el-monte', 'downey', 'costa-mesa', 'carlsbad', 'fairfield',
  'ventura', 'richmond', 'murrieta', 'antioch', 'temecula', 'norwalk', 'daly-city',
  'burbank', 'el-cajon', 'rialto', 'vista', 'vacaville', 'compton', 'mission-viejo',
  'carson', 'hesperia', 'santa-monica', 'westminster', 'redding', 'santa-barbara',
  'chico', 'newport-beach', 'san-leandro', 'san-marcos', 'whittier', 'hawthorne',
  'citrus-heights', 'alhambra', 'tracy', 'livermore', 'buena-park', 'lakewood',
  'merced', 'hemet', 'chino', 'indio', 'redwood-city', 'newport-beach'
];

// Function to simplify a GeoJSON polygon by reducing the number of points
function simplifyPolygon(coordinates, tolerance = SIMPLIFICATION_TOLERANCE) {
  // This is a very basic simplification algorithm
  // For production use, consider using a proper library like Turf.js
  if (!Array.isArray(coordinates) || coordinates.length === 0) return coordinates;
  
  // For each ring in the polygon
  return coordinates.map(ring => {
    if (!Array.isArray(ring) || ring.length <= 4) return ring; // Don't simplify if too few points
    
    // Keep first and last point (they should be the same in a valid polygon)
    const result = [ring[0]];
    
    // Skip points that are too close to the previous point
    for (let i = 1; i < ring.length - 1; i++) {
      const prevPoint = result[result.length - 1];
      const currentPoint = ring[i];
      
      // Calculate distance between points (simplified - not accounting for Earth's curvature)
      const distance = Math.sqrt(
        Math.pow(currentPoint[0] - prevPoint[0], 2) + 
        Math.pow(currentPoint[1] - prevPoint[1], 2)
      );
      
      // Only add the point if it's far enough from the previous point
      if (distance > tolerance) {
        result.push(currentPoint);
      }
    }
    
    // Add the last point
    if (ring.length > 1) {
      result.push(ring[ring.length - 1]);
    }
    
    return result;
  });
}

// Get state name from FIPS code
function getStateFromFips(fips) {
  const statesByFips = {
    '01': 'AL', '02': 'AK', '04': 'AZ', '05': 'AR', '06': 'CA', '08': 'CO', '09': 'CT',
    '10': 'DE', '11': 'DC', '12': 'FL', '13': 'GA', '15': 'HI', '16': 'ID', '17': 'IL',
    '18': 'IN', '19': 'IA', '20': 'KS', '21': 'KY', '22': 'LA', '23': 'ME', '24': 'MD',
    '25': 'MA', '26': 'MI', '27': 'MN', '28': 'MS', '29': 'MO', '30': 'MT', '31': 'NE',
    '32': 'NV', '33': 'NH', '34': 'NJ', '35': 'NM', '36': 'NY', '37': 'NC', '38': 'ND',
    '39': 'OH', '40': 'OK', '41': 'OR', '42': 'PA', '44': 'RI', '45': 'SC', '46': 'SD',
    '47': 'TN', '48': 'TX', '49': 'UT', '50': 'VT', '51': 'VA', '53': 'WA', '54': 'WV',
    '55': 'WI', '56': 'WY'
  };
  return statesByFips[fips] || '';
}

// Convert state abbreviation to full name
function getFullStateName(abbr) {
  const stateNames = {
    'AL': 'Alabama', 'AK': 'Alaska', 'AZ': 'Arizona', 'AR': 'Arkansas', 'CA': 'California',
    'CO': 'Colorado', 'CT': 'Connecticut', 'DE': 'Delaware', 'FL': 'Florida', 'GA': 'Georgia',
    'HI': 'Hawaii', 'ID': 'Idaho', 'IL': 'Illinois', 'IN': 'Indiana', 'IA': 'Iowa',
    'KS': 'Kansas', 'KY': 'Kentucky', 'LA': 'Louisiana', 'ME': 'Maine', 'MD': 'Maryland',
    'MA': 'Massachusetts', 'MI': 'Michigan', 'MN': 'Minnesota', 'MS': 'Mississippi', 'MO': 'Missouri',
    'MT': 'Montana', 'NE': 'Nebraska', 'NV': 'Nevada', 'NH': 'New Hampshire', 'NJ': 'New Jersey',
    'NM': 'New Mexico', 'NY': 'New York', 'NC': 'North Carolina', 'ND': 'North Dakota', 'OH': 'Ohio',
    'OK': 'Oklahoma', 'OR': 'Oregon', 'PA': 'Pennsylvania', 'RI': 'Rhode Island', 'SC': 'South Carolina',
    'SD': 'South Dakota', 'TN': 'Tennessee', 'TX': 'Texas', 'UT': 'Utah', 'VT': 'Vermont',
    'VA': 'Virginia', 'WA': 'Washington', 'WV': 'West Virginia', 'WI': 'Wisconsin', 'WY': 'Wyoming',
    'DC': 'District of Columbia'
  };
  return stateNames[abbr] || abbr;
}

// Main function to combine city boundaries
async function combineCityBoundaries() {
  console.log('Starting to combine city boundaries...');
  
  // Find all city GeoJSON files
  const citiesDir = path.join(REPO_PATH, 'cities');
  const pattern = path.join(citiesDir, '**', '*.json');
  
  console.log(`Searching for city boundary files in: ${citiesDir}`);
  const files = glob.sync(pattern);
  console.log(`Found ${files.length} city boundary files`);
  
  // Prioritize major cities first
  const majorCities = [
    'los-angeles', 'new-york', 'chicago', 'houston', 'phoenix', 'philadelphia',
    'san-antonio', 'san-diego', 'dallas', 'san-jose', 'austin', 'jacksonville',
    'fort-worth', 'columbus', 'charlotte', 'indianapolis', 'seattle', 'denver',
    'washington', 'boston', 'nashville', 'portland', 'las-vegas', 'detroit',
    'salt-lake-city', 'provo', 'orem', 'ogden', 'sandy', 'west-valley-city'
  ];
  
  // Sort files to prioritize major cities and priority states
  const sortedFiles = files.sort((a, b) => {
    const fileNameA = path.basename(a, '.json');
    const fileNameB = path.basename(b, '.json');
    
    // Check if file is from a priority state
    const stateA = a.split('/').slice(-2)[0].toLowerCase();
    const stateB = b.split('/').slice(-2)[0].toLowerCase();
    
    const isAMajor = majorCities.includes(fileNameA);
    const isBMajor = majorCities.includes(fileNameB);
    const isAPriorityState = PRIORITY_STATES.includes(stateA);
    const isBPriorityState = PRIORITY_STATES.includes(stateB);
    const isACommonAHJCity = AHJ_CITIES.includes(fileNameA);
    const isBCommonAHJCity = AHJ_CITIES.includes(fileNameB);
    
    // Major cities come first
    if (isAMajor && !isBMajor) return -1;
    if (!isAMajor && isBMajor) return 1;
    
    // Then common AHJ cities
    if (isACommonAHJCity && !isBCommonAHJCity) return -1;
    if (!isACommonAHJCity && isBCommonAHJCity) return 1;
    
    // Then priority states
    if (isAPriorityState && !isBPriorityState) return -1;
    if (!isAPriorityState && isBPriorityState) return 1;
    
    // Then alphabetical
    return 0;
  });
  
  // Limit the number of files to process
  const filesToProcess = sortedFiles.slice(0, MAX_CITIES);
  console.log(`Processing ${filesToProcess.length} city boundary files`);
  
  // Combine the GeoJSON files
  const combinedGeoJSON = {
    type: 'FeatureCollection',
    features: []
  };
  
  // Process each file
  for (const file of filesToProcess) {
    try {
      // Extract state and city from the file path
      const pathParts = file.split('/');
      const fileName = pathParts[pathParts.length - 1];
      const stateAbbr = pathParts[pathParts.length - 2].toUpperCase();
      const cityName = fileName.replace('.json', '').replace(/-/g, ' ');
      
      // Read and parse the GeoJSON file
      const fileContent = fs.readFileSync(file, 'utf8');
      const cityGeoJSON = JSON.parse(fileContent);
      
      // Check if it's a valid FeatureCollection with features
      if (!cityGeoJSON.features || !Array.isArray(cityGeoJSON.features) || cityGeoJSON.features.length === 0) {
        console.log(`Skipping invalid GeoJSON (no features): ${file}`);
        continue;
      }
      
      // Get the first feature (assuming it's the city boundary)
      const cityFeature = cityGeoJSON.features[0];
      
      // Check if it has valid geometry
      if (!cityFeature.geometry || !cityFeature.geometry.coordinates) {
        console.log(`Skipping invalid GeoJSON (no geometry): ${file}`);
        continue;
      }
      
      // Extract properties we need
      const properties = cityFeature.properties || {};
      const name = properties.NAME || cityName;
      const stateFips = properties.STATEFP || '';
      const state = getStateFromFips(stateFips) || stateAbbr;
      const fullStateName = getFullStateName(state);
      
      // Create a properly formatted city name (Title Case)
      const formattedCityName = name
        .split(' ')
        .map(word => word.charAt(0).toUpperCase() + word.slice(1).toLowerCase())
        .join(' ');
      
      // Simplify the geometry to reduce file size
      const simplifiedCoordinates = simplifyPolygon(cityFeature.geometry.coordinates);
      
      // Create a feature with the simplified geometry
      const feature = {
        type: 'Feature',
        properties: {
          NAME: formattedCityName,
          STATE: state,
          STATEFP: stateFips,
          FULLSTATE: fullStateName,
          DISPLAY_NAME: `${formattedCityName}, ${state}`
        },
        geometry: {
          type: cityFeature.geometry.type,
          coordinates: simplifiedCoordinates
        }
      };
      
      // Add the feature to the combined GeoJSON
      combinedGeoJSON.features.push(feature);
      
      if (combinedGeoJSON.features.length % 50 === 0) {
        console.log(`Processed ${combinedGeoJSON.features.length} cities...`);
      }
    } catch (error) {
      console.error(`Error processing file ${file}:`, error.message);
    }
  }
  
  console.log(`Successfully combined ${combinedGeoJSON.features.length} city boundaries`);
  
  // Write the combined GeoJSON to a file
  fs.writeFileSync(OUTPUT_PATH, JSON.stringify(combinedGeoJSON));
  console.log(`Combined city boundaries saved to: ${OUTPUT_PATH}`);
  
  // Calculate file size
  const stats = fs.statSync(OUTPUT_PATH);
  const fileSizeMB = stats.size / (1024 * 1024);
  console.log(`File size: ${fileSizeMB.toFixed(2)} MB`);
}

// Run the main function
combineCityBoundaries().catch(error => {
  console.error('Error combining city boundaries:', error);
  process.exit(1);
});
