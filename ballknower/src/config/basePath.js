/**
 * Base Path Configuration
 * 
 * This file centralizes the base path configuration for the application.
 * 
 * For deployment at ballknower.co:
 * - The homepage field in package.json is set to: "https://ballknower.co"
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
// Since the new homepage is the root of the domain, BASE_PATH should be empty.
// Previously for github pages at /ball-knower, it was /ball-knower (implicitly handled by PUBLIC_URL often, but we explicity use it).
// Now it's root, so PUBLIC_URL will likely be empty string or /.
export const BASE_PATH = process.env.PUBLIC_URL || '';

/**
 * Helper function to get the full path for an asset
 * @param {string} path - Relative path to the asset (e.g., '/nba.png')
 * @returns {string} - Full path including base path
 */
export const getAssetPath = (path) => {
  // Remove leading slash if present to avoid double slashes
  const cleanPath = path.startsWith('/') ? path.slice(1) : path;
  // If BASE_PATH is empty, just return /path, otherwise /base/path
  return BASE_PATH ? `${BASE_PATH}/${cleanPath}` : `/${cleanPath}`;
};

/**
 * Helper function to get the public URL
 * @returns {string} - The public URL (base path)
 */
export const getPublicUrl = () => {
  return BASE_PATH;
};
