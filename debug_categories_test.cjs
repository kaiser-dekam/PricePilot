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

async function debugCategories() {
  try {
    console.log('=== Fetching BigCommerce Categories ===');
    const categoriesResponse = await makeRequest('/catalog/categories');
    const categories = categoriesResponse.data;
    
    console.log('Total categories found:', categories.length);
    console.log('\nFirst 3 categories:');
    categories.slice(0, 3).forEach(cat => {
      console.log(`\nID: ${cat.id}, Name: "${cat.name}"`);
      console.log(`  Parent ID: ${cat.parent_id || 'ROOT'}`);
      if (cat.parent_category_list) {
        console.log(`  parent_category_list: [${cat.parent_category_list.join(', ')}]`);
      } else {
        console.log(`  parent_category_list: undefined`);
      }
    });
    
    console.log('\n=== Looking for specific product ES-STSB-0066 ===');
    const productResponse = await makeRequest('/catalog/products?sku=ES-STSB-0066');
    
    if (productResponse.data && productResponse.data.length > 0) {
      const product = productResponse.data[0];
      console.log(`\nProduct found: "${product.name}"`);
      console.log(`Categories: [${product.categories.join(', ')}]`);
      
      // Look up category details
      for (const catId of product.categories) {
        const category = categories.find(c => c.id === catId);
        if (category) {
          console.log(`\n--- Category ${catId}: "${category.name}" ---`);
          console.log(`  Parent ID: ${category.parent_id || 'ROOT'}`);
          if (category.parent_category_list && category.parent_category_list.length > 0) {
            console.log(`  parent_category_list: [${category.parent_category_list.join(', ')}]`);
            console.log('  Full hierarchy:');
            const hierarchy = category.parent_category_list.map(id => {
              const parentCat = categories.find(c => c.id === id);
              return parentCat ? parentCat.name : `ID:${id}`;
            });
            console.log(`    ${hierarchy.join(' > ')} > ${category.name}`);
          } else {
            console.log(`  parent_category_list: ${category.parent_category_list || 'undefined'}`);
            console.log('  This appears to be a ROOT category');
          }
        } else {
          console.log(`Category ${catId}: NOT FOUND`);
        }
      }
    } else {
      console.log('Product ES-STSB-0066 not found');
    }
    
  } catch (error) {
    console.error('Error:', error.message);
    if (error.response) {
      console.error('Response:', error.response);
    }
  }
}

debugCategories();
