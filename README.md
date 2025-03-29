# AHJ Knock Planner

A map-based tool for solar sales representatives to identify qualified AHJ zones using an Excel data upload. This application helps sales reps identify Class A, B, and C AHJs for the "45 Days to Pay" initiative.

## Features

- Upload AHJ data from Excel files
- Search and filter AHJs by name, county, zip code, and classification
- View AHJs on an interactive map with color-coded markers
- Display county and city boundaries
- View detailed information about each AHJ
- Switch between list and map views

## Setup

1. Clone this repository
2. Install dependencies:
   ```bash
   npm install
   # or
   yarn install
   ```
3. Create a `.env.local` file in the root directory with your Mapbox access token:
   ```
   NEXT_PUBLIC_MAPBOX_TOKEN=your_mapbox_access_token_here
   ```
   You can obtain a Mapbox access token by signing up at [mapbox.com](https://www.mapbox.com/)

## Running the Application

Start the development server:

```bash
npm run dev
# or
yarn dev
```

Open [http://localhost:3000](http://localhost:3000) with your browser to see the application.

## Using the Application

1. **Home Page**:
   - Upload your AHJ Excel file using the "Upload AHJ Data" button
   - The file should contain columns for AHJ name, county, zip code, and classification
   - After uploading, you'll see a table of AHJs with pagination
   - Use the search bar to filter AHJs by name, county, or zip code
   - Click "View on Map" to see a specific AHJ on the map

2. **Map Page**:
   - View all AHJs as markers on the map
   - Blue markers represent Class A AHJs (faster permitting)
   - Orange markers represent Class B AHJs
   - Red markers represent Class C AHJs
   - Gray markers represent unclassified AHJs
   - Click on a marker to see detailed information about the AHJ
   - Use the search and filter options to narrow down the displayed AHJs

## Excel File Format

The application expects an Excel file with the following columns:
- AHJ Name
- County
- Zip Code
- Classification (A, B, C, or blank)
- Address (for geocoding)

## Technologies Used

- Next.js 14
- React
- TypeScript
- Tailwind CSS
- Mapbox GL JS
- xlsx library for Excel parsing

## Development

This project uses:
- [`next/font`](https://nextjs.org/docs/app/building-your-application/optimizing/fonts) for font optimization
- TypeScript for type safety
- Tailwind CSS for styling
- Mapbox GL JS for mapping functionality

## Deployment

The application can be deployed on Vercel or any other platform that supports Next.js applications.

```bash
npm run build
# or
yarn build
```
