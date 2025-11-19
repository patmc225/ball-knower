/**
 * Base Path Configuration
 * 
 * This file centralizes the base path configuration for the application.
 * 
 * For GitHub Pages deployment at patmc225.github.io/ball-knower:
 * - The homepage field in package.json is set to: "https://patmc225.github.io/ball-knower"
 * - Create React App automatically uses this for building assets
 * 
 * For local development:
 * - The app runs at localhost:3000 without a base path
 * 
 * Usage:
 * - For static assets in HTML: Use %PUBLIC_URL% prefix
 * - For React Router: Import BASE_PATH for the basename prop
 * - For dynamic asset references: Use getAssetPath() helper
 */

// Base path for React Router
// In production, CRA will use the homepage field from package.json
// In development, this will be empty
export const BASE_PATH = process.env.PUBLIC_URL || '';

/**
 * Helper function to get the full path for an asset
 * @param {string} path - Relative path to the asset (e.g., '/nba.png')
 * @returns {string} - Full path including base path
 */
export const getAssetPath = (path) => {
  // Remove leading slash if present to avoid double slashes
  const cleanPath = path.startsWith('/') ? path.slice(1) : path;
  return `${BASE_PATH}/${cleanPath}`;
};

/**
 * Helper function to get the public URL
 * @returns {string} - The public URL (base path)
 */
export const getPublicUrl = () => {
  return BASE_PATH;
};

