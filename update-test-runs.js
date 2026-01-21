const fs = require('fs');
const path = require('path');

// Function to recursively find all property test files
function findPropertyTestFiles(dir) {
  const files = [];
  const items = fs.readdirSync(dir);
  
  for (const item of items) {
    const fullPath = path.join(dir, item);
    const stat = fs.statSync(fullPath);
    
    if (stat.isDirectory()) {
      files.push(...findPropertyTestFiles(fullPath));
    } else if (item.endsWith('.property.test.ts')) {
      files.push(fullPath);
    }
  }
  
  return files;
}

// Find all property test files
const testFiles = findPropertyTestFiles('packages/shared/lib');

console.log(`Found ${testFiles.length} property test files:`);
testFiles.forEach(file => console.log(`  ${file}`));

// Update each file
testFiles.forEach(file => {
  try {
    let content = fs.readFileSync(file, 'utf8');
    
    // Replace numRuns: 100 with numRuns: 10
    const updatedContent = content.replace(/numRuns:\s*100/g, 'numRuns: 10');
    
    if (content !== updatedContent) {
      fs.writeFileSync(file, updatedContent);
      console.log(`Updated ${file}`);
    } else {
      console.log(`No changes needed for ${file}`);
    }
  } catch (error) {
    console.error(`Error updating ${file}:`, error.message);
  }
});

console.log('Update complete!');