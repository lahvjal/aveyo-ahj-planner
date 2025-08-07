// This file re-exports the server component as the default page
// This makes the server component the entry point for the application

// Force dynamic rendering since we use cookies for authentication
export const dynamic = 'force-dynamic';

export { default } from './server-page';