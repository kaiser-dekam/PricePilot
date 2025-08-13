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

  async getProducts(page = 1, limit = 50): Promise<{ products: BigCommerceProductType[]; total: number; variants: any[] }> {
    try {
      console.log(`Fetching products from BigCommerce (page: ${page}, limit: ${limit})`);
      
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



      // Build a proper category hierarchy map
      const categoryMap = new Map(
        categoriesResponse.data.data.map((cat: BigCommerceCategory) => [cat.id, cat])
      );
      
      // Helper function to build full category path by traversing parent_id relationships
      const buildCategoryPath = (categoryIds: number[]): string => {
        if (!categoryIds || categoryIds.length === 0) return '';
        
        // Known missing parent categories and their presumed names
        const missingParents = new Map([
          [129, 'Universal Quick Attach'], // Missing parent of Buckets, Grapples, etc.
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
            } else if (missingParents.has(currentId)) {
              // Handle missing parent categories
              path.unshift(missingParents.get(currentId)!);
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

      return {
        products,
        variants,
        total: productsResponse.data.meta.pagination.total,
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
        const missingParents = new Map([
          [129, 'Universal Quick Attach'], // Missing parent of Buckets, Grapples, etc.
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
            } else if (missingParents.has(currentId)) {
              // Handle missing parent categories
              path.unshift(missingParents.get(currentId)!);
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
