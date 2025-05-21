import { supabase } from '@/utils/supabaseClient';
import { NextResponse } from 'next/server';

export async function POST(request: Request) {
  try {
    // Parse the request body
    const { salesRepId } = await request.json();
    
    if (!salesRepId) {
      return NextResponse.json({ valid: false, error: 'Sales Rep ID is required' }, { status: 400 });
    }
    
    // Convert to string and trim for consistent comparison
    const salesRepIdStr = String(salesRepId).trim();
    
    // Connect to Supabase and validate the single ID
    const { data, error } = await supabase
      .from('sales_reps')
      .select('rep_id')
      .eq('rep_id', salesRepIdStr);
    
    if (error) {
      console.error('Supabase error validating rep ID:', error);
      return NextResponse.json({ valid: false, error: 'Database error' }, { status: 500 });
    }
    
    // Check if we found a matching rep ID
    const isValid = data && data.length > 0;
    
    return NextResponse.json({ valid: isValid });
  } catch (err) {
    console.error('Error in validate-rep-id API:', err);
    return NextResponse.json({ valid: false, error: 'Server error' }, { status: 500 });
  }
}
