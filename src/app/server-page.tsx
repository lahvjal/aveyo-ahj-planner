/**
 * server-page.tsx
 * 
 * Server component that fetches data from Supabase and passes it to client components.
 * This component is the entry point for the application and handles all server-side
 * data fetching and processing.
 */

import { getFilteredData } from '@/server/ServerDataService';
import { parseFilters } from '@/utils/parseFilters';
import ClientHomePage from '@/client-pages/ClientHomePage';
import { cookies } from 'next/headers';
import { createServerComponentClient } from '@supabase/auth-helpers-nextjs';

export default async function ServerPage({ searchParams }: { searchParams: any }) {
  // Get user session from cookies for access control
  const cookieStore = cookies();
  const supabase = createServerComponentClient({ cookies: () => cookieStore });
  
  // Get user session
  const { data: { session } } = await supabase.auth.getSession();
  
  // Get user profile if session exists
  let userProfile = null;
  if (session?.user?.id) {
    const { data: profileData } = await supabase
      .from('profiles')
      .select('*')
      .eq('id', session.user.id)
      .single();
    
    if (profileData) {
      userProfile = {
        ...profileData,
        isAdmin: profileData.role === 'admin'
      };
    }
  }
  
  // Parse filters from URL parameters
  const filters = await parseFilters(searchParams);
  
  try {
    // Fetch filtered data based on URL parameters
    const data = await getFilteredData(filters, userProfile);
    
    // Create a serializable version of the data
    // This is necessary because the data might contain circular references
    const serializedData = {
      projects: data.projects,
      ahjs: data.ahjs,
      utilities: data.utilities,
      financiers: data.financiers,
      filters,
      userProfile
    };
    
    // Embed the data in a hidden div for client-side hydration
    // This will be picked up by the client component
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
    console.error('Error in ServerPage:', error);
    
    // Return the ClientHomePage with error state
    return (
      <ClientHomePage 
        serverData={{
          projects: [],
          ahjs: [],
          utilities: [],
          financiers: [],
          filters: [],
          error: 'Failed to load data from server',
          userProfile
        }} 
      />
    );
  }
}
