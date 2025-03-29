-- Create extension for UUID generation if not already available
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- Create AHJ table
CREATE TABLE IF NOT EXISTS public.ahjs (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  name TEXT NOT NULL,
  county TEXT,
  zip TEXT,
  classification TEXT,
  address TEXT,
  latitude DOUBLE PRECISION,
  longitude DOUBLE PRECISION,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT now()
);

-- Add RLS policies
ALTER TABLE public.ahjs ENABLE ROW LEVEL SECURITY;

-- Create policy to allow anonymous read access
CREATE POLICY "Allow anonymous read access" 
  ON public.ahjs
  FOR SELECT 
  TO anon
  USING (true);

-- Create policy to allow service role to insert/update
CREATE POLICY "Allow service role to insert/update" 
  ON public.ahjs
  FOR ALL 
  TO service_role
  USING (true)
  WITH CHECK (true);
