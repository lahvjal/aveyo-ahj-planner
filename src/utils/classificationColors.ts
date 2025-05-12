// Classification color constants for consistent styling across the application

// Badge background colors (Tailwind classes)
export const classificationBgColors = {
  A: 'bg-green-600',
  B: 'bg-blue-600',
  C: 'bg-orange-600',
  unknown: 'bg-gray-600'
};

// Badge text colors (Tailwind classes)
export const classificationTextColors = {
  A: 'text-white',
  B: 'text-white',
  C: 'text-white',
  unknown: 'text-white'
};

// Map pin colors (for mapbox markers)
export const classificationMapColors = {
  A: 'green',
  B: 'blue',
  C: 'orange',
  unknown: 'gray'
};

// Get badge class based on classification
export const getClassificationBadgeClass = (classification: string | undefined, isLight: boolean = false) => {
  const key = classification === 'A' || classification === 'B' || classification === 'C' 
    ? classification 
    : 'unknown';
  
  // Always return the standard colors, no more light version
  return `${classificationBgColors[key]} ${classificationTextColors[key]}`;
};

// Format classification for display
export const formatClassification = (classification: string | undefined): string => {
  if (!classification) return 'U';
  if (classification === 'A' || classification === 'B' || classification === 'C') return classification;
  return 'U';
};

// Get map color based on classification
export const getClassificationMapColor = (classification: string | undefined) => {
  const key = classification === 'A' || classification === 'B' || classification === 'C' 
    ? classification 
    : 'unknown';
  
  return classificationMapColors[key];
};
