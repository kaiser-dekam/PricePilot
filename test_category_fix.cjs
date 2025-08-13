// Test the new category logic with the actual ES-STSB-0066 data
const categories = [
  { id: 23, name: "Shop All", parent_id: null },
  { id: 24, name: "Attachments", parent_id: null },
  { id: 58, name: "Buckets", parent_id: 24 },  // Parent is Attachments
  { id: 60, name: "Smooth Buckets", parent_id: 58 }  // Parent is Buckets
];

const productCategories = [23, 24, 60, 58]; // ES-STSB-0066 categories

// Build category map
const categoryMap = new Map(categories.map(cat => [cat.id, cat]));

// Function to build path for a single category by walking up the parent chain
const buildPathForCategory = (catId) => {
  const path = [];
  let currentId = catId;
  const visited = new Set();
  
  while (currentId && !visited.has(currentId)) {
    visited.add(currentId);
    const category = categoryMap.get(currentId);
    
    if (!category) break;
    
    path.unshift(category.name); // Add to beginning to build path from root
    currentId = category.parent_id; // Move to parent
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

console.log('All category paths for ES-STSB-0066:');
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
