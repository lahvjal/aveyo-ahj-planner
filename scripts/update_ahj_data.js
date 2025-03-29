const XLSX = require('xlsx');
const { createClient } = require('@supabase/supabase-js');
const fetch = require('node-fetch');
const fs = require('fs');
require('dotenv').config({ path: '.env.local' });

// Configuration - Get from environment variables
const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL;
const SUPABASE_ANON_KEY = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
const MAPBOX_ACCESS_TOKEN = process.env.NEXT_PUBLIC_MAPBOX_TOKEN;
const EXCEL_FILE_PATH = process.argv[2] || './data/Classifications Database - AHJ_Utility.xlsx';

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
  console.error('Usage: node update_ahj_data.js [path-to-excel-file]');
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

// Function to parse Excel file and create a map of AHJ data
async function parseExcelFile(filePath) {
  try {
    const workbook = XLSX.readFile(filePath);
    const sheetName = workbook.SheetNames[0];
    const worksheet = workbook.Sheets[sheetName];
    
    // Convert to JSON
    const jsonData = XLSX.utils.sheet_to_json(worksheet);
    
    console.log(`Found ${jsonData.length} rows in Excel file`);
    
    // Create a map of AHJ data by name for easy lookup
    const ahjMap = new Map();
    
    jsonData.forEach((row, index) => {
      const name = row.name || row.Name || row.AHJ || row['AHJ Name'] || `Unknown AHJ ${index + 1}`;
      const mailingAddress = row['mailing address'] || row['Mailing Address'] || row.address || row.Address || '';
      const classification = row['eligible for classification'] || row['Eligible for Classification'] || row.classification || row.Classification || row['Class'] || row['Class Status'] || '';
      
      ahjMap.set(name.toLowerCase(), {
        name,
        mailingAddress,
        classification,
        rawRow: row // Keep the raw row for additional data if needed
      });
    });
    
    return ahjMap;
  } catch (error) {
    console.error('Error parsing Excel file:', error);
    throw error;
  }
}

// Function to update AHJ data in Supabase
async function updateAHJData() {
  try {
    console.log('Starting AHJ data update process...');
    console.log(`Excel file: ${EXCEL_FILE_PATH}`);
    
    // Parse Excel file and create a map of AHJ data
    console.log('Parsing Excel file...');
    const ahjMap = await parseExcelFile(EXCEL_FILE_PATH);
    
    // Fetch all AHJs from Supabase
    console.log('Fetching AHJs from Supabase...');
    const { data: ahjs, error } = await supabase
      .from('ahjs')
      .select('*');
    
    if (error) {
      throw error;
    }
    
    console.log(`Found ${ahjs.length} AHJs in Supabase`);
    
    // Update each AHJ with data from Excel
    console.log('Updating AHJs with data from Excel...');
    let updatedCount = 0;
    let geocodedCount = 0;
    
    for (let i = 0; i < ahjs.length; i++) {
      const ahj = ahjs[i];
      const excelData = ahjMap.get(ahj.name.toLowerCase());
      
      if (excelData) {
        // Prepare update data
        const updateData = {};
        let needsUpdate = false;
        
        // Update classification if needed
        const mappedClassification = mapClassification(excelData.classification);
        if (mappedClassification && (!ahj.classification || ahj.classification !== mappedClassification)) {
          updateData.classification = mappedClassification;
          needsUpdate = true;
        }
        
        // Update address if needed
        if (excelData.mailingAddress && (!ahj.address || ahj.address !== excelData.mailingAddress)) {
          updateData.address = excelData.mailingAddress;
          needsUpdate = true;
        }
        
        // Extract zip from address if needed
        const extractedZip = extractZipCode(excelData.mailingAddress);
        if (extractedZip && (!ahj.zip || ahj.zip !== extractedZip)) {
          updateData.zip = extractedZip;
          needsUpdate = true;
        }
        
        // If we need to update and the coordinates are missing, geocode the address
        if (needsUpdate && (!ahj.latitude || !ahj.longitude)) {
          console.log(`Geocoding (${i + 1}/${ahjs.length}): ${ahj.name}`);
          
          // Add delay to avoid rate limiting (every 5 items)
          if (geocodedCount > 0 && geocodedCount % 5 === 0) {
            console.log('Pausing for 1 second to avoid rate limiting...');
            await new Promise(resolve => setTimeout(resolve, 1000));
          }
          
          const addressQuery = [
            ahj.name,
            updateData.address || ahj.address,
            ahj.county ? `${ahj.county} County` : '',
            updateData.zip || ahj.zip
          ].filter(Boolean).join(', ');
          
          const { latitude, longitude, county, zip } = await geocodeAddress(addressQuery, MAPBOX_ACCESS_TOKEN);
          
          if (latitude && longitude) {
            updateData.latitude = latitude;
            updateData.longitude = longitude;
          }
          
          if (county && !ahj.county) {
            updateData.county = county;
          }
          
          if (zip && !updateData.zip && !ahj.zip) {
            updateData.zip = zip;
          }
          
          geocodedCount++;
        }
        
        // Update AHJ in Supabase if needed
        if (Object.keys(updateData).length > 0) {
          console.log(`Updating AHJ ${i + 1}/${ahjs.length}: ${ahj.name}`);
          
          const { error: updateError } = await supabase
            .from('ahjs')
            .update(updateData)
            .eq('id', ahj.id);
          
          if (updateError) {
            console.error(`Error updating AHJ ${ahj.name}:`, updateError);
          } else {
            updatedCount++;
          }
        }
      }
    }
    
    console.log(`Updated ${updatedCount} AHJs with data from Excel`);
    console.log(`Geocoded ${geocodedCount} AHJs`);
    console.log('AHJ data update completed successfully!');
  } catch (error) {
    console.error('Error in update process:', error);
    process.exit(1);
  }
}

// Run the update function
updateAHJData();
