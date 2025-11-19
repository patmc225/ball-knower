const fs = require('fs');
const path = require('path');

// Source and destination directories
const sourceDir = path.join(__dirname, 'backend');
const destDir = path.join(__dirname, 'public', 'backend');

// Create destination directory if it doesn't exist
if (!fs.existsSync(destDir)) {
  fs.mkdirSync(destDir, { recursive: true });
  console.log(`Created directory: ${destDir}`);
}

// List of files to copy
const filesToCopy = [
  'games.json',
  'players.json',
  'users.json',
  'popularity.json'
];

// Copy each file
filesToCopy.forEach(file => {
  const sourcePath = path.join(sourceDir, file);
  const destPath = path.join(destDir, file);
  
  try {
    if (fs.existsSync(sourcePath)) {
      fs.copyFileSync(sourcePath, destPath);
      console.log(`Copied ${file} to public/backend/`);
    } else {
      console.warn(`Warning: Source file ${sourcePath} does not exist`);
    }
  } catch (err) {
    console.error(`Error copying ${file}:`, err);
  }
});

console.log('Backend files copied successfully!'); 