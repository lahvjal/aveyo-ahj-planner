-- Create extension for UUID generation if not already available
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- Create AHJ table if it doesn't exist
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

-- Add RLS policies for AHJs table
ALTER TABLE public.ahjs ENABLE ROW LEVEL SECURITY;

-- Create policy to allow anonymous read access to AHJs
CREATE POLICY "Allow anonymous read access to AHJs" 
  ON public.ahjs
  FOR SELECT 
  TO anon
  USING (true);

-- Create knock_plans table if it doesn't exist (for future use)
CREATE TABLE IF NOT EXISTS public.knock_plans (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  name TEXT NOT NULL,
  description TEXT,
  created_by TEXT,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT now()
);

-- Add RLS policies for knock_plans table
ALTER TABLE public.knock_plans ENABLE ROW LEVEL SECURITY;

-- Create policy to allow anonymous read access to knock_plans
CREATE POLICY "Allow anonymous read access to knock_plans" 
  ON public.knock_plans
  FOR SELECT 
  TO anon
  USING (true);

-- Create knock_plan_items table to store AHJs in a knock plan (for future use)
CREATE TABLE IF NOT EXISTS public.knock_plan_items (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  knock_plan_id UUID NOT NULL REFERENCES public.knock_plans(id) ON DELETE CASCADE,
  ahj_id UUID NOT NULL REFERENCES public.ahjs(id) ON DELETE CASCADE,
  notes TEXT,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT now(),
  UNIQUE(knock_plan_id, ahj_id)
);

-- Add RLS policies for knock_plan_items table
ALTER TABLE public.knock_plan_items ENABLE ROW LEVEL SECURITY;

-- Create policy to allow anonymous read access to knock_plan_items
CREATE POLICY "Allow anonymous read access to knock_plan_items" 
  ON public.knock_plan_items
  FOR SELECT 
  TO anon
  USING (true);
