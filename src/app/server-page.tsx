/**
 * server-page.tsx
 * 
 * Server component that fetches data from Supabase and passes it to client components.
 * This component is the entry point for the application and handles all server-side
 * data fetching and processing.
 */

// Force dynamic rendering since we use cookies for authentication
export const dynamic = 'force-dynamic';

import { getFilteredData } from '@/server/ServerDataService';
import { parseFilters } from '@/utils/parseFilters';
import ClientHomePage from '@/client-pages/ClientHomePage';
import { ProjectFilter } from '@/utils/types';
import { createClient } from '@/utils/supabase/server';

export default async function ServerPage({ searchParams }: { searchParams: any }) {
  console.log('[ServerPage] Rendering server page');
  
  // Initialize variables to track state
  let session = null;
  let userProfile = null;
  let filters: ProjectFilter[] = [];
  let error = null;
  
  try {
    // Get user session using our server-side Supabase client
    const supabase = await createClient();
    
    console.log('[ServerPage] Getting user session');
    // Get user session
    const sessionResponse = await supabase.auth.getSession();
    session = sessionResponse.data.session;
    
    // Get user profile if session exists
    if (session?.user?.id) {
      console.log('[ServerPage] User authenticated, fetching profile');
      
      // Try to get profile from profiles table
      const { data: profileData, error: profileError } = await supabase
        .from('profiles')
        .select('*')
        .eq('id', session.user.id)
        .single();
      
      if (profileError) {
        console.warn('[ServerPage] Error fetching from profiles table:', profileError.message);
        
        // Try to get profile from users table as fallback
        const { data: userData, error: userError } = await supabase
          .from('users')
          .select('*')
          .eq('id', session.user.id)
          .single();
        
        if (userError) {
          console.error('[ServerPage] Error fetching user profile:', userError.message);
        } else if (userData) {
          userProfile = {
            ...userData,
            isAdmin: userData.role === 'admin'
          };
          console.log('[ServerPage] User profile fetched from users table');
        }
      } else if (profileData) {
        userProfile = {
          ...profileData,
          isAdmin: profileData.role === 'admin'
        };
        console.log('[ServerPage] User profile fetched from profiles table');
      }
    } else {
      console.log('[ServerPage] No authenticated user');
    }
    
    // Parse filters from URL parameters
    filters = await parseFilters(searchParams);
    console.log('[ServerPage] Parsed filters:', filters.length);
    
    // Fetch filtered data based on URL parameters
    const data = await getFilteredData(filters, userProfile);
    console.log('[ServerPage] Data fetched successfully');
    
    // Create a serializable version of the data
    const serializedData = {
      projects: data.projects || [],
      ahjs: data.ahjs || [],
      utilities: data.utilities || [],
      financiers: data.financiers || [],
      filters,
      userProfile
    };
    
    // Embed the data in a hidden div for client-side hydration
    return (
      <>
        <script
          id="server-data"
          type="application/json"
          dangerouslySetInnerHTML={{
            __html: JSON.stringify(serializedData)
          }}
        />
        <ClientHomePage serverData={serializedData} />
      </>
    );
  } catch (error) {
    console.error('[ServerPage] Error:', error);
    
    // Return the ClientHomePage with error state
    return (
      <ClientHomePage 
        serverData={{
          projects: [],
          ahjs: [],
          utilities: [],
          financiers: [],
          filters: filters || [],
          error: 'Failed to load data from server',
          userProfile
        }} 
      />
    );
  }
}
