import axios, { AxiosInstance } from 'axios';
import { BigCommerceProduct as BigCommerceProductType } from '@shared/schema';

export interface BigCommerceConfig {
  storeHash: string;
  accessToken: string;
  clientId: string;
}

export interface BigCommerceProduct {
  id: number;
  name: string;
  sku: string;
  description: string;
  categories: number[];
  price: string;
  sale_price: string;
  inventory_level: number;
  weight: string;
  is_visible: boolean;
}

export interface BigCommerceCategory {
  id: number;
  name: string;
  parent_id: number;
  parent_category_list?: number[];
}

export class BigCommerceService {
  private api: AxiosInstance;
  private config: BigCommerceConfig;

  constructor(config: BigCommerceConfig) {
    this.config = config;
    this.api = axios.create({
      baseURL: `https://api.bigcommerce.com/stores/${config.storeHash}/v3`,
      headers: {
        'X-Auth-Token': config.accessToken,
        'X-Auth-Client': config.clientId,
        'Content-Type': 'application/json',
        'Accept': 'application/json',
      },
      timeout: 60000, // Increased timeout to 60 seconds
    });
  }

  async testConnection(): Promise<boolean> {
    try {
      await this.api.get('/catalog/products?limit=1');
      return true;
    } catch (error) {
      console.error('BigCommerce connection test failed:', error);
      return false;
    }
  }

  async getProductCount(): Promise<number> {
    try {
      console.log('Fetching product count from BigCommerce...');
      const response = await this.api.get('/catalog/products', {
        params: {
          limit: 1, // Only fetch 1 product to get pagination metadata
        },
      });
      return response.data.meta.pagination.total;
    } catch (error: any) {
      console.error('Error fetching product count from BigCommerce:', error);
      throw new Error(`Failed to fetch product count: ${error.response?.data?.title || error.message}`);
    }
  }

  async getProducts(page = 1, limit = 50): Promise<{ products: BigCommerceProductType[]; total: number; variants: any[]; rawData?: any }> {
    try {
      console.log(`Fetching products from BigCommerce (page: ${page}, limit: ${limit})`);
      console.log('🔍 DEBUG: getProducts method called');
      
      const [productsResponse, categoriesResponse] = await Promise.all([
        this.api.get('/catalog/products', {
          params: {
            page,
            limit,
            include: 'variants,images',
          },
        }),
        this.api.get('/catalog/categories'),
      ]);

      console.log(`Found ${categoriesResponse.data.data.length} categories from BigCommerce`);
      
      // Check for product ID 407 specifically
      const productsData = productsResponse.data.data;
      const product407 = productsData.find((product: any) => product.id === 407);
      if (product407) {
        console.log('🎯 PRODUCT 407 RAW DATA:');
        console.log(JSON.stringify(product407, null, 2));
        console.log('🎯 PRODUCT 407 CATEGORIES:', product407.categories);
        
        // Show category details for product 407
        if (product407.categories && product407.categories.length > 0) {
          console.log('🎯 PRODUCT 407 CATEGORY DETAILS:');
          product407.categories.forEach((catId: number) => {
            const category = categoriesResponse.data.data.find((cat: BigCommerceCategory) => cat.id === catId);
            if (category) {
              console.log(`  Category ${catId}: "${category.name}" (parent: ${category.parent_id})`);
            } else {
              console.log(`  Category ${catId}: NOT FOUND in categories response`);
            }
          });
        }
      } else {
        console.log('🔍 Product ID 407 not found in this page');
      }
      
      // Log categories that might be related to Mini Bobcat
      const miniCategories = categoriesResponse.data.data.filter((cat: BigCommerceCategory) => 
        cat.name.toLowerCase().includes('mini') || cat.name.toLowerCase().includes('bobcat')
      );
      if (miniCategories.length > 0) {
        console.log('Found Mini/Bobcat categories:', miniCategories.map((cat: BigCommerceCategory) => 
          `${cat.id}: ${cat.name} (parent: ${cat.parent_id})`
        ));
      } else {
        console.log('No Mini/Bobcat categories found in BigCommerce response');
      }
      
      // Log all attachment categories and their children to help debug hierarchy
      const attachmentCategories = categoriesResponse.data.data.filter((cat: BigCommerceCategory) => 
        cat.name.toLowerCase().includes('attachment') || cat.parent_id === 24
      );
      console.log('Attachment-related categories found:', attachmentCategories.map((cat: BigCommerceCategory) => 
        `${cat.id}: ${cat.name} (parent: ${cat.parent_id})`
      ));
      
      // Find categories that are children of Attachments (parent_id === 24)
      const attachmentChildren = categoriesResponse.data.data.filter((cat: BigCommerceCategory) => cat.parent_id === 24);
      console.log('Direct children of Attachments category (parent_id 24):', 
        attachmentChildren.map((cat: BigCommerceCategory) => `${cat.id}: ${cat.name}`)
      );
      
      // Log all category names for complete debugging
      console.log('All BigCommerce category names:', 
        categoriesResponse.data.data.map((cat: BigCommerceCategory) => cat.name).sort().join(', ')
      );

      // Build a proper category hierarchy map
      const categoryMap = new Map(
        categoriesResponse.data.data.map((cat: BigCommerceCategory) => [cat.id, cat])
      );
      
      // Helper function to build full category path by traversing parent_id relationships
      const buildCategoryPath = (categoryIds: number[]): string => {
        if (!categoryIds || categoryIds.length === 0) return '';
        
        // Known missing parent categories and their presumed names
        const missingCategories = new Map([
          [129, 'Universal Quick Attach'], [136, 'Mini Bobcat'], [141, 'Smooth Buckets'], // Missing categories found in product analysis
          [180, 'Excavator Attachments']   // Missing parent of other attachment categories
        ]);
        
        // Function to build path for a single category by walking up the parent chain
        const buildPathForCategory = (catId: number): string => {
          const path: string[] = [];
          let currentId = catId;
          const visited = new Set<number>(); // Prevent infinite loops
          
          while (currentId && !visited.has(currentId)) {
            visited.add(currentId);
            const category = categoryMap.get(currentId) as BigCommerceCategory | undefined;
            
            if (category) {
              path.unshift(category.name); // Add to beginning to build path from root
              currentId = category.parent_id; // Move to parent
            } else if (missingCategories.has(currentId)) {
              // Handle missing parent categories
              path.unshift(missingCategories.get(currentId)!);
              // For missing category 129, assume it belongs under Attachments (24)
              currentId = currentId === 129 ? 24 : (currentId === 136 ? 24 : (currentId === 141 ? 136 : 0));
            } else {
              // Unknown missing category, stop here
              break;
            }
          }
          
          return path.join(' > ');
        };
        
        // Find the best category path (prefer non-"Shop All" categories with hierarchy)
        const categoryPaths: { path: string; depth: number; isShopAll: boolean }[] = [];
        
        for (const catId of categoryIds) {
          const category = categoryMap.get(catId) as BigCommerceCategory | undefined;
          if (category) {
            const path = buildPathForCategory(catId);
            const depth = path.split(' > ').length;
            const isShopAll = category.name === 'Shop All';
            categoryPaths.push({ path, depth, isShopAll });
          }
        }
        
        if (categoryPaths.length === 0) return '';
        
        // Sort by preference: non-"Shop All" first, then by depth (deeper is better)
        categoryPaths.sort((a, b) => {
          if (a.isShopAll !== b.isShopAll) return a.isShopAll ? 1 : -1;
          return b.depth - a.depth;
        });
        
        return categoryPaths[0].path;
      };

      const products: BigCommerceProductType[] = [];
      const variants: any[] = [];

      for (const bcProduct of productsResponse.data.data) {

        
        const product = {
          id: bcProduct.id.toString(),
          name: bcProduct.name,
          sku: bcProduct.sku || '',
          description: bcProduct.description || '',
          category: buildCategoryPath(bcProduct.categories),
          regularPrice: bcProduct.price || '0',
          salePrice: bcProduct.sale_price || null,
          stock: bcProduct.inventory_level || 0,
          weight: bcProduct.weight || '0',
          status: bcProduct.is_visible ? 'published' : 'draft',
          lastUpdated: new Date(),
        };
        
        products.push(product);

        // Process variants if included in response
        if (bcProduct.variants && bcProduct.variants.length > 0) {
          const productVariants = bcProduct.variants.map((variant: any) => ({
            id: variant.id.toString(),
            productId: bcProduct.id.toString(),
            variantSku: variant.sku || '',
            regularPrice: variant.price || '0',
            salePrice: variant.sale_price || null,
            stock: variant.inventory_level || 0,
            weight: variant.weight || '0',
            optionValues: variant.option_values?.reduce((acc: any, opt: any) => {
              acc[opt.option_display_name] = opt.label;
              return acc;
            }, {}) || {},
            lastUpdated: new Date(),
          }));
          
          variants.push(...productVariants);
        }
      }

      // Prepare comprehensive raw data for debugging (only on first page to avoid large payloads)
      const rawData = page === 1 ? {
        page: page,
        totalProducts: products.length,
        totalVariants: variants.length,
        allProducts: productsResponse.data.data.map((p: any) => ({
          id: p.id,
          name: p.name,
          sku: p.sku,
          categories: p.categories,
          price: p.price,
          sale_price: p.sale_price,
          inventory_level: p.inventory_level,
          is_visible: p.is_visible,
          weight: p.weight,
          description: p.description ? p.description.substring(0, 100) + '...' : ''
        })),
        allVariants: variants.map((v: any) => ({
          id: v.id,
          productId: v.productId,
          variantSku: v.variantSku,
          regularPrice: v.regularPrice,
          salePrice: v.salePrice,
          stock: v.stock,
          optionValues: v.optionValues
        })),
        allCategories: categoriesResponse.data.data.map((cat: any) => ({
          id: cat.id,
          name: cat.name,
          parent_id: cat.parent_id
        })),
        apiResponseMeta: {
          productsPagination: productsResponse.data.meta,
          categoriesTotal: categoriesResponse.data.data.length
        },
        product407Found: productsResponse.data.data.find((p: any) => p.id === 407) ? true : false
      } : undefined;

      return {
        products,
        variants,
        total: productsResponse.data.meta.pagination.total,
        rawData
      };
    } catch (error: any) {
      console.error('Error fetching products from BigCommerce:', error);
      throw new Error(`Failed to fetch products: ${error.response?.data?.title || error.message}`);
    }
  }

  async getProduct(id: string): Promise<BigCommerceProductType | null> {
    try {
      const [productResponse, categoriesResponse] = await Promise.all([
        this.api.get(`/catalog/products/${id}`),
        this.api.get('/catalog/categories'),
      ]);

      // Build a proper category hierarchy map
      const categoryMap = new Map(
        categoriesResponse.data.data.map((cat: BigCommerceCategory) => [cat.id, cat])
      );
      
      // Helper function to build full category path by traversing parent_id relationships
      const buildCategoryPath = (categoryIds: number[]): string => {
        if (!categoryIds || categoryIds.length === 0) return '';
        
        // Known missing parent categories and their presumed names
        const missingCategories = new Map([
          [129, 'Universal Quick Attach'], [136, 'Mini Bobcat'], [141, 'Smooth Buckets'], // Missing categories found in product analysis
          [180, 'Excavator Attachments']   // Missing parent of other attachment categories
        ]);
        
        // Function to build path for a single category by walking up the parent chain
        const buildPathForCategory = (catId: number): string => {
          const path: string[] = [];
          let currentId = catId;
          const visited = new Set<number>(); // Prevent infinite loops
          
          while (currentId && !visited.has(currentId)) {
            visited.add(currentId);
            const category = categoryMap.get(currentId) as BigCommerceCategory | undefined;
            
            if (category) {
              path.unshift(category.name); // Add to beginning to build path from root
              currentId = category.parent_id; // Move to parent
            } else if (missingCategories.has(currentId)) {
              // Handle missing parent categories
              path.unshift(missingCategories.get(currentId)!);
              // For missing category 129, assume it belongs under Attachments (24)
              currentId = currentId === 129 ? 24 : (currentId === 136 ? 24 : (currentId === 141 ? 136 : 0));
            } else {
              // Unknown missing category, stop here
              break;
            }
          }
          
          return path.join(' > ');
        };
        
        // Find the best category path (prefer non-"Shop All" categories with hierarchy)
        const categoryPaths: { path: string; depth: number; isShopAll: boolean }[] = [];
        
        for (const catId of categoryIds) {
          const category = categoryMap.get(catId) as BigCommerceCategory | undefined;
          if (category) {
            const path = buildPathForCategory(catId);
            const depth = path.split(' > ').length;
            const isShopAll = category.name === 'Shop All';
            categoryPaths.push({ path, depth, isShopAll });
          }
        }
        
        if (categoryPaths.length === 0) return '';
        
        // Sort by preference: non-"Shop All" first, then by depth (deeper is better)
        categoryPaths.sort((a, b) => {
          if (a.isShopAll !== b.isShopAll) return a.isShopAll ? 1 : -1;
          return b.depth - a.depth;
        });
        
        return categoryPaths[0].path;
      };

      const bcProduct: BigCommerceProduct = productResponse.data.data;

      return {
        id: bcProduct.id.toString(),
        name: bcProduct.name,
        sku: bcProduct.sku || '',
        description: bcProduct.description || '',
        category: buildCategoryPath(bcProduct.categories),
        regularPrice: bcProduct.price || '0',
        salePrice: bcProduct.sale_price || null,
        stock: bcProduct.inventory_level || 0,
        weight: bcProduct.weight || '0',
        status: bcProduct.is_visible ? 'published' : 'draft',
        lastUpdated: new Date(),
      };
    } catch (error: any) {
      console.error('Error fetching product from BigCommerce:', error);
      if (error.response?.status === 404) {
        return null;
      }
      throw new Error(`Failed to fetch product: ${error.response?.data?.title || error.message}`);
    }
  }

  async updateProduct(id: string, updates: { regularPrice?: string; salePrice?: string }): Promise<BigCommerceProductType> {
    try {
      const updateData: any = {};
      
      if (updates.regularPrice !== undefined) {
        updateData.price = parseFloat(updates.regularPrice);
      }
      
      if (updates.salePrice !== undefined) {
        if (updates.salePrice && updates.salePrice.toString().trim() !== '') {
          updateData.sale_price = parseFloat(updates.salePrice.toString());
        } else {
          // To clear sale price, we need to set it to 0 (BigCommerce doesn't accept null or empty string)
          updateData.sale_price = 0;
        }
      }

      console.log(`BigCommerce API - Updating product ${id} with payload:`, updateData);
      await this.api.put(`/catalog/products/${id}`, updateData);
      console.log(`BigCommerce API - Successfully updated product ${id}`);
      
      const updatedProduct = await this.getProduct(id);
      if (!updatedProduct) {
        throw new Error('Product not found after update');
      }
      
      return updatedProduct;
    } catch (error: any) {
      console.error('Error updating product in BigCommerce:', error);
      throw new Error(`Failed to update product: ${error.response?.data?.title || error.message}`);
    }
  }

  async updateMultipleProducts(updates: Array<{ id: string; regularPrice?: string; salePrice?: string }>): Promise<void> {
    const batchSize = 10; // BigCommerce API rate limiting
    
    for (let i = 0; i < updates.length; i += batchSize) {
      const batch = updates.slice(i, i + batchSize);
      const promises = batch.map(update => this.updateProduct(update.id, update));
      
      try {
        await Promise.all(promises);
      } catch (error) {
        console.error(`Error updating batch ${i / batchSize + 1}:`, error);
        throw error;
      }
      
      // Rate limiting delay
      if (i + batchSize < updates.length) {
        await new Promise(resolve => setTimeout(resolve, 1000));
      }
    }
  }

  async getProductVariants(productId: string): Promise<any[]> {
    try {
      console.log(`Fetching variants for product ${productId} from BigCommerce`);
      const response = await this.api.get(`/catalog/products/${productId}/variants`);
      
      return response.data.data.map((variant: any) => ({
        id: variant.id.toString(),
        productId: productId,
        variantSku: variant.sku || '',
        regularPrice: variant.price || '0',
        salePrice: variant.sale_price || null,
        stock: variant.inventory_level || 0,
        weight: variant.weight || '0',
        optionValues: variant.option_values?.reduce((acc: any, opt: any) => {
          acc[opt.option_display_name] = opt.label;
          return acc;
        }, {}) || {},
        lastUpdated: new Date(),
      }));
    } catch (error: any) {
      console.error(`Error fetching variants for product ${productId}:`, error);
      if (error.response?.status === 404) {
        return []; // Product has no variants
      }
      throw new Error(`Failed to fetch variants: ${error.response?.data?.title || error.message}`);
    }
  }
}
