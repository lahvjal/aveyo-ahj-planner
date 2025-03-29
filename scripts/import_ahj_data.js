const XLSX = require('xlsx');
const { createClient } = require('@supabase/supabase-js');
const fetch = require('node-fetch');
const fs = require('fs');
const path = require('path');
require('dotenv').config({ path: '.env.local' });

// Configuration - Get from environment variables
const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL;
const SUPABASE_ANON_KEY = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
const MAPBOX_ACCESS_TOKEN = process.env.NEXT_PUBLIC_MAPBOX_TOKEN;
const EXCEL_FILE_PATH = process.argv[2] || './data/ahj_data.xlsx'; // Allow passing file path as argument

// Check if required environment variables are set
if (!SUPABASE_URL || !SUPABASE_ANON_KEY || !MAPBOX_ACCESS_TOKEN) {
  console.error('Error: Required environment variables not set.');
  console.error('Please make sure the following are set in your .env.local file:');
  console.error('- NEXT_PUBLIC_SUPABASE_URL');
  console.error('- NEXT_PUBLIC_SUPABASE_ANON_KEY');
  console.error('- NEXT_PUBLIC_MAPBOX_TOKEN');
  process.exit(1);
}

// Check if Excel file exists
if (!fs.existsSync(EXCEL_FILE_PATH)) {
  console.error(`Error: Excel file not found at ${EXCEL_FILE_PATH}`);
  console.error('Usage: node import_ahj_data.js [path-to-excel-file]');
  console.error('If no file path is provided, the script will look for ./data/ahj_data.xlsx');
  process.exit(1);
}

// Initialize Supabase client
const supabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY);

// Function to extract zip code from address
function extractZipCode(address) {
  if (!address) return '';
  
  // Look for 5-digit zip code pattern
  const zipMatch = address.match(/\b\d{5}\b/);
  if (zipMatch) return zipMatch[0];
  
  // Look for 5+4 digit zip code pattern and extract just the first 5
  const zipPlusMatch = address.match(/\b(\d{5})-\d{4}\b/);
  if (zipPlusMatch) return zipPlusMatch[1];
  
  return '';
}

// Function to parse Excel file
async function parseExcelFile(filePath) {
  try {
    const workbook = XLSX.readFile(filePath);
    const sheetName = workbook.SheetNames[0];
    const worksheet = workbook.Sheets[sheetName];
    
    // Convert to JSON
    const jsonData = XLSX.utils.sheet_to_json(worksheet);
    
    console.log(`Found ${jsonData.length} rows in Excel file`);
    
    // Map to our data structure
    const ahjs = jsonData.map((row, index) => {
      // Try different possible column names for each field
      const name = row.name || row.Name || row.AHJ || row['AHJ Name'] || `Unknown AHJ ${index + 1}`;
      const county = row.county || row.County || '';
      const mailingAddress = row['mailing address'] || row['Mailing Address'] || row.address || row.Address || '';
      const classification = row['eligible for classification'] || row['Eligible for Classification'] || row.classification || row.Classification || row['Class'] || row['Class Status'] || '';
      
      // Extract zip code from address if available
      const zip = row.zip || row.Zip || row['Zip Code'] || row.ZipCode || extractZipCode(mailingAddress) || '';
      
      return {
        name,
        county,
        zip,
        classification,
        address: mailingAddress,
      };
    });
    
    return ahjs;
  } catch (error) {
    console.error('Error parsing Excel file:', error);
    throw error;
  }
}

// Function to geocode an address using Mapbox
async function geocodeAddress(address, mapboxToken) {
  try {
    const response = await fetch(
      `https://api.mapbox.com/geocoding/v5/mapbox.places/${encodeURIComponent(address)}.json?access_token=${mapboxToken}&limit=1&types=address,place,region,postcode`
    );
    
    if (!response.ok) {
      throw new Error(`Geocoding failed: ${response.statusText}`);
    }
    
    const data = await response.json();
    
    if (data.features && data.features.length > 0) {
      const feature = data.features[0];
      const [longitude, latitude] = feature.center;
      
      // Extract county information from context if available
      let county = '';
      if (feature.context) {
        const countyContext = feature.context.find(ctx => ctx.id.startsWith('district'));
        if (countyContext) {
          county = countyContext.text.replace(' County', '').trim();
        }
      }
      
      // Extract zip code if not already available
      let zip = '';
      if (feature.context) {
        const postalContext = feature.context.find(ctx => ctx.id.startsWith('postcode'));
        if (postalContext) {
          zip = postalContext.text.trim();
        }
      }
      
      return { latitude, longitude, county, zip };
    }
    
    return { latitude: null, longitude: null, county: '', zip: '' };
  } catch (error) {
    console.error(`Error geocoding address "${address}":`, error);
    return { latitude: null, longitude: null, county: '', zip: '' };
  }
}

// Function to geocode all addresses
async function geocodeAddresses(ahjs, mapboxToken) {
  const geocodedAHJs = [];
  
  console.log(`Geocoding ${ahjs.length} addresses...`);
  
  for (let i = 0; i < ahjs.length; i++) {
    const ahj = ahjs[i];
    
    // Construct address for geocoding
    const addressQuery = [
      ahj.name,
      ahj.address,
      ahj.county ? `${ahj.county} County` : '',
      ahj.zip
    ].filter(Boolean).join(', ');
    
    console.log(`Geocoding (${i + 1}/${ahjs.length}): ${addressQuery}`);
    
    // Add delay to avoid rate limiting
    if (i > 0 && i % 5 === 0) {
      console.log('Pausing for 1 second to avoid rate limiting...');
      await new Promise(resolve => setTimeout(resolve, 1000));
    }
    
    const { latitude, longitude, county: mapboxCounty, zip: mapboxZip } = await geocodeAddress(addressQuery, mapboxToken);
    
    geocodedAHJs.push({
      name: ahj.name,
      county: ahj.county || mapboxCounty, // Use existing county or Mapbox county
      zip: ahj.zip || mapboxZip, // Use existing zip or Mapbox zip
      classification: mapClassification(ahj.classification),
      address: ahj.address,
      latitude,
      longitude
    });
  }
  
  return geocodedAHJs;
}

// Helper function to map classification strings
function mapClassification(classification) {
  if (!classification) return null;
  
  const classStr = classification.toString().trim().toUpperCase();
  
  // Check for variations of "Yes" or "Eligible" to map to Class A
  if (classStr === 'A' || classStr === 'CLASS A' || 
      classStr === 'YES' || classStr === 'Y' || 
      classStr === 'ELIGIBLE' || classStr === 'TRUE' || 
      classStr === '1') {
    return 'A';
  } 
  // Check for variations of "No" or "Not Eligible" to map to Class B
  else if (classStr === 'B' || classStr === 'CLASS B' || 
           classStr === 'NO' || classStr === 'N' || 
           classStr === 'NOT ELIGIBLE' || classStr === 'FALSE' || 
           classStr === '0') {
    return 'B';
  } 
  else if (classStr === 'C' || classStr === 'CLASS C') {
    return 'C';
  }
  
  return null;
}

// Function to insert data into Supabase
async function insertDataToSupabase(ahjs) {
  try {
    console.log(`Inserting ${ahjs.length} AHJs into Supabase...`);
    
    // Insert in batches to avoid request size limitations
    const batchSize = 50;
    const batches = Math.ceil(ahjs.length / batchSize);
    
    for (let i = 0; i < batches; i++) {
      const start = i * batchSize;
      const end = Math.min(start + batchSize, ahjs.length);
      const batch = ahjs.slice(start, end);
      
      console.log(`Inserting batch ${i + 1}/${batches} (${batch.length} items)...`);
      
      const { data, error } = await supabase
        .from('ahjs')
        .insert(batch);
      
      if (error) {
        throw error;
      }
    }
    
    console.log(`Successfully inserted ${ahjs.length} AHJs into Supabase`);
  } catch (error) {
    console.error('Error inserting data into Supabase:', error);
    throw error;
  }
}

// Main function
async function main() {
  try {
    console.log('Starting AHJ data import process...');
    console.log(`Excel file: ${EXCEL_FILE_PATH}`);
    console.log(`Supabase URL: ${SUPABASE_URL}`);
    
    // Parse Excel file
    console.log(`Parsing Excel file: ${EXCEL_FILE_PATH}`);
    const ahjs = await parseExcelFile(EXCEL_FILE_PATH);
    console.log(`Found ${ahjs.length} AHJs in Excel file`);
    
    // Geocode addresses
    console.log('Geocoding addresses...');
    const geocodedAHJs = await geocodeAddresses(ahjs, MAPBOX_ACCESS_TOKEN);
    
    // Insert data into Supabase
    console.log('Inserting data into Supabase...');
    await insertDataToSupabase(geocodedAHJs);
    
    console.log('AHJ data import completed successfully!');
  } catch (error) {
    console.error('Error in main process:', error);
    process.exit(1);
  }
}

// Run the main function
main();
