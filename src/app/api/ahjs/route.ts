import { NextResponse } from 'next/server';
import { supabase } from '@/utils/supabaseClient';

// These are required for static export with API routes
export const dynamic = 'force-static';
export const revalidate = false;

export async function GET() {
  try {
    const { data, error } = await supabase
      .from('ahjs')
      .select('*');
    
    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 });
    }
    
    return NextResponse.json(data);
  } catch (error) {
    console.error('Error fetching AHJs:', error);
    return NextResponse.json({ error: 'Failed to fetch AHJs' }, { status: 500 });
  }
}
