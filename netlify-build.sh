#!/bin/bash
# Build the Next.js application
npm run build

# Create the necessary directories for the standalone output
mkdir -p .next/standalone/.next

# Copy static files and public directory to the standalone output
cp -r .next/static .next/standalone/.next/
cp -r public .next/standalone/

echo "Build completed successfully!"
