const https = require('https');

const storeHash = 'sjyq1bgqco';
const accessToken = 'm5rr6sw59ypqxzi1uc1yhpncj7fj8tm';

function makeRequest(path) {
  return new Promise((resolve, reject) => {
    const options = {
      hostname: 'api.bigcommerce.com',
      port: 443,
      path: `/stores/${storeHash}/v3${path}`,
      method: 'GET',
      headers: {
        'X-Auth-Token': accessToken,
        'Content-Type': 'application/json',
        'Accept': 'application/json',
      }
    };

    const req = https.request(options, (res) => {
      let data = '';
      res.on('data', (chunk) => data += chunk);
      res.on('end', () => {
        try {
          resolve(JSON.parse(data));
        } catch (err) {
          reject(err);
        }
      });
    });

    req.on('error', reject);
    req.end();
  });
}

async function debugMissingCategory() {
  try {
    console.log('=== Fetching ALL BigCommerce Categories ===');
    const categoriesResponse = await makeRequest('/catalog/categories');
    const categories = categoriesResponse.data;
    
    console.log('Total categories found:', categories.length);
    
    // Find categories that might be "Universal Quick Attach"
    const universalCategories = categories.filter(cat => 
      cat.name.toLowerCase().includes('universal') || 
      cat.name.toLowerCase().includes('quick') ||
      cat.id === 129 // The missing category ID from our debug
    );
    
    console.log('\n=== Categories containing "Universal" or "Quick" or ID 129 ===');
    universalCategories.forEach(cat => {
      console.log(`ID: ${cat.id}, Name: "${cat.name}", Parent: ${cat.parent_id || 'ROOT'}`);
    });
    
    // Let's look at the specific categories from ES-STSB-0066: [23, 24, 60, 129, 58]
    const productCategoryIds = [23, 24, 60, 129, 58];
    console.log('\n=== Categories for ES-STSB-0066 ===');
    
    productCategoryIds.forEach(catId => {
      const category = categories.find(c => c.id === catId);
      if (category) {
        console.log(`ID: ${catId}, Name: "${category.name}", Parent: ${category.parent_id || 'ROOT'}`);
      } else {
        console.log(`ID: ${catId}, NOT FOUND IN API RESPONSE`);
      }
    });
    
    // Build the complete hierarchy for each category
    console.log('\n=== Building hierarchy for each category ===');
    
    const buildPathForCategory = (catId) => {
      const path = [];
      let currentId = catId;
      const visited = new Set();
      
      while (currentId && !visited.has(currentId)) {
        visited.add(currentId);
        const category = categories.find(c => c.id === currentId);
        
        if (!category) {
          path.unshift(`MISSING_ID_${currentId}`);
          break;
        }
        
        path.unshift(category.name);
        currentId = category.parent_id;
      }
      
      return path.join(' > ');
    };
    
    productCategoryIds.forEach(catId => {
      const path = buildPathForCategory(catId);
      console.log(`Category ${catId}: ${path}`);
    });
    
  } catch (error) {
    console.error('Error:', error.message);
  }
}

debugMissingCategory();
