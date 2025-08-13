// Debug script to examine BigCommerce category structure
const axios = require('axios');

async function debugCategories() {
  // You'll need to replace these with your actual BigCommerce credentials
  const storeHash = 'your_store_hash';
  const accessToken = 'your_access_token';
  
  const api = axios.create({
    baseURL: `https://api.bigcommerce.com/stores/${storeHash}/v3`,
    headers: {
      'X-Auth-Token': accessToken,
      'Content-Type': 'application/json',
      'Accept': 'application/json',
    },
  });

  try {
    console.log('=== Fetching BigCommerce Categories ===');
    const categoriesResponse = await api.get('/catalog/categories');
    const categories = categoriesResponse.data.data;
    
    console.log('Total categories found:', categories.length);
    console.log('\nFirst 5 categories:');
    categories.slice(0, 5).forEach(cat => {
      console.log(`ID: ${cat.id}, Name: "${cat.name}", Parent: ${cat.parent_id || 'ROOT'}`);
      if (cat.parent_category_list) {
        console.log(`  parent_category_list: [${cat.parent_category_list.join(', ')}]`);
      }
    });
    
    console.log('\n=== Looking for specific product ES-STSB-0066 ===');
    const productResponse = await api.get('/catalog/products', {
      params: { sku: 'ES-STSB-0066' }
    });
    
    if (productResponse.data.data.length > 0) {
      const product = productResponse.data.data[0];
      console.log(`Product found: "${product.name}"`);
      console.log(`Categories: [${product.categories.join(', ')}]`);
      
      // Look up category details
      for (const catId of product.categories) {
        const category = categories.find(c => c.id === catId);
        if (category) {
          console.log(`\nCategory ${catId}: "${category.name}"`);
          console.log(`  Parent ID: ${category.parent_id || 'ROOT'}`);
          if (category.parent_category_list) {
            console.log(`  parent_category_list: [${category.parent_category_list.join(', ')}]`);
            console.log('  Full hierarchy:');
            const hierarchy = category.parent_category_list.map(id => {
              const parentCat = categories.find(c => c.id === id);
              return parentCat ? parentCat.name : `ID:${id}`;
            });
            console.log(`    ${hierarchy.join(' > ')}`);
          }
        } else {
          console.log(`Category ${catId}: NOT FOUND`);
        }
      }
    } else {
      console.log('Product ES-STSB-0066 not found');
    }
    
  } catch (error) {
    console.error('Error:', error.response?.data || error.message);
  }
}

debugCategories();