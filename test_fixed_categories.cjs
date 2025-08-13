// Test the fixed category logic with missing parent handling
const categories = [
  { id: 23, name: "Shop All", parent_id: null },
  { id: 24, name: "Attachments", parent_id: null },
  { id: 58, name: "Buckets", parent_id: 129 },  // Parent 129 is missing!
  { id: 60, name: "Smooth Buckets", parent_id: 58 }
];

const productCategories = [23, 24, 60, 58]; // ES-STSB-0066 categories

// Build category map
const categoryMap = new Map(categories.map(cat => [cat.id, cat]));

// Known missing parent categories and their presumed names
const missingParents = new Map([
  [129, 'Universal Quick Attach'], // Missing parent of Buckets, Grapples, etc.
  [180, 'Excavator Attachments']   // Missing parent of other attachment categories
]);

// Function to build path for a single category by walking up the parent chain
const buildPathForCategory = (catId) => {
  const path = [];
  let currentId = catId;
  const visited = new Set();
  
  while (currentId && !visited.has(currentId)) {
    visited.add(currentId);
    const category = categoryMap.get(currentId);
    
    if (category) {
      path.unshift(category.name); // Add to beginning to build path from root
      currentId = category.parent_id; // Move to parent
    } else if (missingParents.has(currentId)) {
      // Handle missing parent categories
      path.unshift(missingParents.get(currentId));
      // For missing category 129, assume it belongs under Attachments (24)
      currentId = currentId === 129 ? 24 : null;
    } else {
      // Unknown missing category, stop here
      break;
    }
  }
  
  return path.join(' > ');
};

// Find the best category path (prefer non-"Shop All" categories with hierarchy)
const categoryPaths = [];

for (const catId of productCategories) {
  const category = categoryMap.get(catId);
  if (category) {
    const path = buildPathForCategory(catId);
    const depth = path.split(' > ').length;
    const isShopAll = category.name === 'Shop All';
    categoryPaths.push({ path, depth, isShopAll, catId });
  }
}

console.log('All category paths for ES-STSB-0066 with missing parent handling:');
categoryPaths.forEach(cp => {
  console.log(`  Category ${cp.catId}: "${cp.path}" (depth: ${cp.depth}, isShopAll: ${cp.isShopAll})`);
});

// Sort by preference: non-"Shop All" first, then by depth (deeper is better)
categoryPaths.sort((a, b) => {
  if (a.isShopAll !== b.isShopAll) return a.isShopAll ? 1 : -1;
  return b.depth - a.depth;
});

const bestPath = categoryPaths.length > 0 ? categoryPaths[0].path : '';
console.log(`\nBest category path: "${bestPath}"`);
console.log('Expected: "Attachments > Universal Quick Attach > Buckets > Smooth Buckets"');
