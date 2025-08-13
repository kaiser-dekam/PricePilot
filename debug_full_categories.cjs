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

async function debugFullCategories() {
  try {
    const categoriesResponse = await makeRequest('/catalog/categories');
    const categories = categoriesResponse.data;
    
    console.log('=== ALL CATEGORIES ===');
    categories.forEach(cat => {
      console.log(`ID: ${cat.id}, Name: "${cat.name}", Parent: ${cat.parent_id || 'ROOT'}`);
    });
    
    // Find category 27 (parent of Quick Attach)
    const cat27 = categories.find(c => c.id === 27);
    if (cat27) {
      console.log(`\n=== Category 27 Details ===`);
      console.log(`ID: 27, Name: "${cat27.name}", Parent: ${cat27.parent_id || 'ROOT'}`);
    }
    
    // Look for the complete hierarchy that should be: Attachments > Universal Quick Attach > Buckets > Smooth Buckets
    console.log('\n=== Looking for Universal Quick Attach hierarchy ===');
    
    // Find categories under Attachments (24)
    const attachmentChildren = categories.filter(c => c.parent_id === 24);
    console.log('Children of Attachments (24):');
    attachmentChildren.forEach(cat => {
      console.log(`  ID: ${cat.id}, Name: "${cat.name}"`);
    });
    
    // Check if there's a Universal category
    const universalCategories = categories.filter(c => 
      c.name.toLowerCase().includes('universal') || 
      c.name.toLowerCase().includes('quick attach')
    );
    console.log('\nCategories with "universal" or "quick attach":');
    universalCategories.forEach(cat => {
      console.log(`  ID: ${cat.id}, Name: "${cat.name}", Parent: ${cat.parent_id || 'ROOT'}`);
    });
    
  } catch (error) {
    console.error('Error:', error.message);
  }
}

debugFullCategories();
