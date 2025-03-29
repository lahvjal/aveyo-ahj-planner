const { createClient } = require('@supabase/supabase-js');
const fetch = require('node-fetch');
require('dotenv').config({ path: '.env.local' });

// Configuration - Get from environment variables
const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL;
const SUPABASE_ANON_KEY = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
const MAPBOX_ACCESS_TOKEN = process.env.NEXT_PUBLIC_MAPBOX_TOKEN;

// Check if required environment variables are set
if (!SUPABASE_URL || !SUPABASE_ANON_KEY || !MAPBOX_ACCESS_TOKEN) {
  console.error('Error: Required environment variables not set.');
  console.error('Please make sure the following are set in your .env.local file:');
  console.error('- NEXT_PUBLIC_SUPABASE_URL');
  console.error('- NEXT_PUBLIC_SUPABASE_ANON_KEY');
  console.error('- NEXT_PUBLIC_MAPBOX_TOKEN');
  process.exit(1);
}

// Initialize Supabase client
const supabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY);

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
      
      // Extract county information from context if available
      let county = '';
      if (feature.context) {
        const countyContext = feature.context.find(ctx => ctx.id.startsWith('district'));
        if (countyContext) {
          county = countyContext.text.replace(' County', '').trim();
        }
      }
      
      return { county };
    }
    
    return { county: '' };
  } catch (error) {
    console.error(`Error geocoding address "${address}":`, error);
    return { county: '' };
  }
}

// Function to update county data in Supabase
async function updateCountyData() {
  try {
    console.log('Starting county data update process...');
    
    // Fetch all AHJs from Supabase
    console.log('Fetching AHJs from Supabase...');
    const { data: ahjs, error } = await supabase
      .from('ahjs')
      .select('*');
    
    if (error) {
      throw error;
    }
    
    console.log(`Found ${ahjs.length} AHJs in Supabase`);
    
    // Count AHJs with empty county field
    const emptyCountyCount = ahjs.filter(ahj => !ahj.county || ahj.county.trim() === '').length;
    console.log(`Found ${emptyCountyCount} AHJs with empty county field`);
    
    if (emptyCountyCount === 0) {
      console.log('All AHJs already have county data. No updates needed.');
      return;
    }
    
    // Update each AHJ with empty county field
    console.log('Updating AHJs with missing county data...');
    let updatedCount = 0;
    
    for (let i = 0; i < ahjs.length; i++) {
      const ahj = ahjs[i];
      
      // Skip if county is already populated
      if (ahj.county && ahj.county.trim() !== '') {
        continue;
      }
      
      // Construct address for geocoding
      const addressQuery = [
        ahj.name,
        ahj.address,
        ahj.zip
      ].filter(Boolean).join(', ');
      
      console.log(`Geocoding (${i + 1}/${ahjs.length}): ${addressQuery}`);
      
      // Add delay to avoid rate limiting (every 5 items)
      if (updatedCount > 0 && updatedCount % 5 === 0) {
        console.log('Pausing for 1 second to avoid rate limiting...');
        await new Promise(resolve => setTimeout(resolve, 1000));
      }
      
      const { county } = await geocodeAddress(addressQuery, MAPBOX_ACCESS_TOKEN);
      
      if (county) {
        console.log(`Found county for ${ahj.name}: ${county}`);
        
        const { error: updateError } = await supabase
          .from('ahjs')
          .update({ county })
          .eq('id', ahj.id);
        
        if (updateError) {
          console.error(`Error updating county for AHJ ${ahj.name}:`, updateError);
        } else {
          updatedCount++;
        }
      } else {
        console.log(`Could not find county for ${ahj.name}`);
      }
    }
    
    console.log(`Updated county data for ${updatedCount} AHJs`);
    console.log('County data update completed successfully!');
  } catch (error) {
    console.error('Error in update process:', error);
    process.exit(1);
  }
}

// Run the update function
updateCountyData();
