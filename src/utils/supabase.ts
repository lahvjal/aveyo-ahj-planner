import { createClient } from '@supabase/supabase-js';

// Get Supabase URL and anon key from environment variables
const supabaseUrl = 'https://ugolpzpaykhrumlwcpue.supabase.co';
const supabaseAnonKey = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InVnb2xwenBheWtocnVtbHdjcHUlIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NDQwNDYxMjQsImV4cCI6MjA1OTYyMjEyNH0.6QBjm_II-N1NcZQnzeF5QXwDWMUp8s4zuHX5AXgRdG0';

// Create Supabase client
export const supabase = createClient(supabaseUrl, supabaseAnonKey);
