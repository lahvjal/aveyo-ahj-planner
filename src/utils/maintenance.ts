/**
 * Maintenance Mode Configuration
 * 
 * This file controls whether the application is in maintenance mode.
 * When MAINTENANCE_MODE is true, all users will see the maintenance page.
 */

// Set this to true to enable maintenance mode
export const MAINTENANCE_MODE = true;

// Maintenance mode configuration
export const MAINTENANCE_CONFIG = {
  enabled: MAINTENANCE_MODE,
  title: "MyAveyo is Under Maintenance",
  message: "We're currently performing scheduled maintenance to improve your experience. Please check back shortly.",
  estimatedDuration: "We expect to be back online within the next few hours.",
  contactEmail: "support@myaveyo.com",
  // Add any IP addresses that should bypass maintenance mode (for admin access)
  bypassIPs: [] as string[]
};

/**
 * Check if maintenance mode is enabled
 */
export function isMaintenanceModeEnabled(): boolean {
  return MAINTENANCE_CONFIG.enabled;
}

/**
 * Check if an IP address should bypass maintenance mode
 */
export function shouldBypassMaintenance(ip?: string): boolean {
  if (!ip || !MAINTENANCE_CONFIG.enabled) return false;
  return MAINTENANCE_CONFIG.bypassIPs.includes(ip);
}

/**
 * Get the client IP from request headers
 */
export function getClientIP(request: any): string | undefined {
  // Try various headers that might contain the real IP
  const xForwardedFor = request.headers.get('x-forwarded-for');
  const xRealIP = request.headers.get('x-real-ip');
  const cfConnectingIP = request.headers.get('cf-connecting-ip');
  
  if (xForwardedFor) {
    // x-forwarded-for can contain multiple IPs, take the first one
    return xForwardedFor.split(',')[0].trim();
  }
  
  if (xRealIP) {
    return xRealIP;
  }
  
  if (cfConnectingIP) {
    return cfConnectingIP;
  }
  
  // Fallback to connection remote address (if available)
  return (request as any).ip;
}
