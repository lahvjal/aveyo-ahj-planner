#!/usr/bin/env node

/**
 * SQL Runner Script for Supabase
 * 
 * This script allows you to run SQL commands against your Supabase database.
 * Usage: node run_sql.js <path-to-sql-file>
 * 
 * Example: node run_sql.js ./scripts/create_ahj_table.sql
 */

const { createClient } = require('@supabase/supabase-js');
const fs = require('fs');
const path = require('path');
require('dotenv').config({ path: '.env.local' });

// Get Supabase credentials from environment variables
const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY; // This is different from the anon key

// Check if credentials are set
if (!supabaseUrl || !supabaseServiceKey) {
  console.error('Error: Supabase credentials not found in environment variables.');
  console.error('Please make sure NEXT_PUBLIC_SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY are set in your .env.local file.');
  process.exit(1);
}

// Initialize Supabase client with service role key for admin privileges
const supabase = createClient(supabaseUrl, supabaseServiceKey);

// Get SQL file path from command line arguments
const sqlFilePath = process.argv[2];

if (!sqlFilePath) {
  console.error('Error: No SQL file specified.');
  console.error('Usage: node run_sql.js <path-to-sql-file>');
  process.exit(1);
}

// Read SQL file
try {
  const fullPath = path.resolve(process.cwd(), sqlFilePath);
  const sql = fs.readFileSync(fullPath, 'utf8');
  
  console.log(`Running SQL from: ${fullPath}`);
  
  // Execute SQL
  (async () => {
    try {
      const { data, error } = await supabase.rpc('exec_sql', { sql_query: sql });
      
      if (error) {
        console.error('Error executing SQL:', error);
        process.exit(1);
      }
      
      console.log('SQL executed successfully!');
      console.log('Result:', data);
    } catch (err) {
      console.error('Error:', err);
      process.exit(1);
    }
  })();
} catch (err) {
  console.error(`Error reading SQL file: ${err.message}`);
  process.exit(1);
}
