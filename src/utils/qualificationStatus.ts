/**
 * Maps qualification status text values from Podio to display values
 * 
 * Podio values: "Eligible", "Ineligible", "Revoked", "Opted Out", "Pending Review", "Unknown"
 * Display values: "Yes", "No", "Pending"
 */

export type QualificationStatus = 'Yes' | 'No' | 'Pending';

export function mapQualificationStatus(status: string | boolean | null | undefined): QualificationStatus {
  if (status === null || status === undefined) {
    return 'No';
  }
  
  // Handle boolean values for backward compatibility
  if (typeof status === 'boolean') {
    return status ? 'Yes' : 'No';
  }
  
  // Handle string values from Podio
  const normalizedStatus = status.toLowerCase().trim();
  
  if (normalizedStatus === 'eligible') {
    return 'Yes';
  } else if (normalizedStatus === 'pending review') {
    return 'Pending';
  } else {
    // ineligible, revoked, opted out, unknown, or any other value
    return 'No';
  }
}

/**
 * Checks if a project qualifies for 45-day program based on its qualification status
 * @param statusOrProject - Either a qualification status string/boolean or a Project object
 */
export function isQualified(statusOrProject: string | boolean | null | undefined | any): boolean {
  // If it's a Project object, extract the qualifies_45_day field
  if (statusOrProject && typeof statusOrProject === 'object' && 'qualifies_45_day' in statusOrProject) {
    return mapQualificationStatus(statusOrProject.qualifies_45_day) === 'Yes';
  }
  
  // Otherwise, treat it as a direct status value
  return mapQualificationStatus(statusOrProject) === 'Yes';
}

/**
 * Checks if a project's qualification status is pending
 * @param statusOrProject - Either a qualification status string/boolean or a Project object
 */
export function isPending(statusOrProject: string | boolean | null | undefined | any): boolean {
  // If it's a Project object, extract the qualifies_45_day field
  if (statusOrProject && typeof statusOrProject === 'object' && 'qualifies_45_day' in statusOrProject) {
    return mapQualificationStatus(statusOrProject.qualifies_45_day) === 'Pending';
  }
  
  // Otherwise, treat it as a direct status value
  return mapQualificationStatus(statusOrProject) === 'Pending';
}
