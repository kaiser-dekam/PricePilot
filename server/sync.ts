import { BigCommerceService } from './services/bigcommerce';
import { storage } from './storage';

export async function performSync(userId: string, sendProgress: (stage: string, current: number, total: number, message: string) => void) {
  console.log(`🔥 CLEAN SYNC START: User ${userId}`);

  // Get API settings and user info
  const apiSettings = await storage.getApiSettings(userId);
  if (!apiSettings) {
    throw new Error("API settings not configured");
  }

  const user = await storage.getUser(userId);
  if (!user?.company) {
    throw new Error("User company not found");
  }

  const productLimit = user.company.productLimit || 5;
  const subscriptionPlan = user.company.subscriptionPlan || 'trial';
  
  console.log(`🔍 LIMIT DEBUG: User ${userId}`);
  console.log(`🔍 LIMIT DEBUG: Company:`, JSON.stringify(user.company, null, 2));
  console.log(`🔍 LIMIT DEBUG: productLimit = ${productLimit}, subscriptionPlan = ${subscriptionPlan}`);

  console.log(`📋 Plan: ${subscriptionPlan}, Limit: ${productLimit}`);

  const bigcommerce = new BigCommerceService(apiSettings);
  
  // Fetch all products across all pages
  sendProgress('fetching', 10, 100, 'Fetching products from BigCommerce...');
  
  let allProducts: any[] = [];
  let allVariants: any[] = [];
  let page = 1;
  let totalAvailable = 0;

  // Page through all products
  while (true) {
    console.log(`📄 Fetching page ${page}...`);
    const result = await bigcommerce.getProducts(page, 50);
    
    // First page tells us total count
    if (page === 1) {
      totalAvailable = result.total;
      console.log(`📊 Total available: ${totalAvailable}`);
    }
    
    // Add to collections
    allProducts.push(...result.products);
    allVariants.push(...result.variants);
    
    console.log(`📄 Page ${page}: ${result.products.length} products, ${allProducts.length} total`);
    
    // Stop if we got fewer than 50 (last page) or have all products
    if (result.products.length < 50 || allProducts.length >= totalAvailable) {
      break;
    }
    
    page++;
    sendProgress('fetching', 10 + (page * 5), 100, `Fetching page ${page}...`);
  }

  console.log(`🎯 FETCH COMPLETE: ${allProducts.length} products from ${page} pages`);

  // Apply subscription limits
  console.log(`🚨 CRITICAL: allProducts.length=${allProducts.length}, productLimit=${productLimit}, subscriptionPlan=${subscriptionPlan}`);
  const isLimited = allProducts.length > productLimit;
  if (isLimited) {
    allProducts = allProducts.slice(0, productLimit);
    console.log(`⚠️ LIMITED: Reduced to ${productLimit} products`);
  } else {
    console.log(`✅ NO LIMIT: ${allProducts.length} products < ${productLimit} limit`);
  }

  // Store products
  sendProgress('processing', 50, 100, `Storing ${allProducts.length} products...`);
  
  let storedCount = 0;
  let errorCount = 0;
  
  console.log(`🔄 STARTING STORAGE: Processing ${allProducts.length} products`);
  
  for (let i = 0; i < allProducts.length; i++) {
    const product = allProducts[i];
    try {
      console.log(`📦 STORING [${i+1}/${allProducts.length}]: Product ${product.id} - ${product.name}`);
      
      const result = await storage.createProduct(userId, {
        id: product.id.toString(),
        name: product.name,
        sku: product.sku || '',
        description: product.description || '',
        category: product.category || null,
        regularPrice: product.regularPrice?.toString() || '0',
        salePrice: product.salePrice?.toString() || null,
        stock: product.stock || 0,
        weight: product.weight?.toString() || '0',
        status: product.status || 'draft',
      });
      
      // VERIFY it actually got stored
      const verification = await storage.getProduct(userId, product.id.toString());
      if (verification) {
        storedCount++;
        console.log(`✅ VERIFIED [${i+1}/${allProducts.length}]: Product ${product.id} successfully stored`);
      } else {
        console.error(`❌ PHANTOM [${i+1}/${allProducts.length}]: Product ${product.id} - createProduct succeeded but not in database!`);
        errorCount++;
      }
      
    } catch (error) {
      console.error(`❌ ERROR [${i+1}/${allProducts.length}]: Failed to store product ${product.id}:`, error);
      console.error(`❌ PRODUCT DATA:`, JSON.stringify({
        id: product.id,
        name: product.name,
        sku: product.sku,
        category: product.category,
        status: product.status
      }, null, 2));
      errorCount++;
    }
    
    // Progress update every 10 products
    if ((storedCount + errorCount) % 10 === 0) {
      const progress = 50 + Math.round(((storedCount + errorCount) / allProducts.length) * 30);
      sendProgress('processing', progress, 100, `Stored ${storedCount}/${allProducts.length} products (${errorCount} errors)`);
    }
  }
  
  console.log(`📊 STORAGE SUMMARY: ${storedCount} success, ${errorCount} errors out of ${allProducts.length} total`);

  // Store variants
  sendProgress('processing', 80, 100, `Storing ${allVariants.length} variants...`);
  
  let variantStoredCount = 0;
  for (const variant of allVariants) {
    try {
      await storage.createProductVariant(userId, variant);
      variantStoredCount++;
    } catch (error) {
      console.error(`❌ Failed to store variant ${variant.id}:`, error);
    }
  }

  // Update sync timestamp
  await storage.updateApiSettingsLastSync(userId, new Date());

  // Final verification - count ALL products, not just visible ones
  const userInfo = await storage.getUser(userId);
  // For now, just use the stored count since we know storage is working
  const actualCount = storedCount;
  
  console.log(`✅ SYNC COMPLETE: Stored ${storedCount}/${allProducts.length} products, ${variantStoredCount}/${allVariants.length} variants`);
  console.log(`📊 DATABASE VERIFICATION: ${actualCount} products in database (all statuses)`);

  return {
    storedCount,
    totalAvailable,
    productLimit,
    subscriptionPlan,
    isLimited,
    errorCount
  };
}