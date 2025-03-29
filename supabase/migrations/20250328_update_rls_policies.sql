-- Update RLS policies for the ahjs table to allow insert operations
DROP POLICY IF EXISTS "Allow anonymous read access to AHJs" ON public.ahjs;

-- Create policy to allow anonymous read access to AHJs
CREATE POLICY "Allow anonymous read access to AHJs" 
  ON public.ahjs
  FOR SELECT 
  TO anon
  USING (true);

-- Create policy to allow anonymous insert access to AHJs
CREATE POLICY "Allow anonymous insert access to AHJs" 
  ON public.ahjs
  FOR INSERT 
  TO anon
  WITH CHECK (true);

-- Update RLS policies for knock_plans table
DROP POLICY IF EXISTS "Allow anonymous read access to knock_plans" ON public.knock_plans;

-- Create policy to allow anonymous read access to knock_plans
CREATE POLICY "Allow anonymous read access to knock_plans" 
  ON public.knock_plans
  FOR SELECT 
  TO anon
  USING (true);

-- Create policy to allow anonymous insert access to knock_plans
CREATE POLICY "Allow anonymous insert access to knock_plans" 
  ON public.knock_plans
  FOR INSERT 
  TO anon
  WITH CHECK (true);

-- Update RLS policies for knock_plan_items table
DROP POLICY IF EXISTS "Allow anonymous read access to knock_plan_items" ON public.knock_plan_items;

-- Create policy to allow anonymous read access to knock_plan_items
CREATE POLICY "Allow anonymous read access to knock_plan_items" 
  ON public.knock_plan_items
  FOR SELECT 
  TO anon
  USING (true);

-- Create policy to allow anonymous insert access to knock_plan_items
CREATE POLICY "Allow anonymous insert access to knock_plan_items" 
  ON public.knock_plan_items
  FOR INSERT 
  TO anon
  WITH CHECK (true);
