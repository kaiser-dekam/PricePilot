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

      // Debug: Log the first few categories to understand the structure
      console.log('Sample categories from BigCommerce API:', 
        JSON.stringify(categoriesResponse.data.data.slice(0, 3), null, 2));

      // Build a proper category hierarchy map
      const categoryMap = new Map(
        categoriesResponse.data.data.map((cat: BigCommerceCategory) => [cat.id, cat])
      );
      
      // Helper function to build full category path using BigCommerce hierarchy
      const buildCategoryPath = (categoryIds: number[]): string => {
        if (!categoryIds || categoryIds.length === 0) return '';
        
        // For products with multiple categories, we'll use the first one with a hierarchy
        // or just join them if no hierarchy is available
        const categoryPaths: string[] = [];
        
        for (const catId of categoryIds) {
          const category = categoryMap.get(catId) as BigCommerceCategory | undefined;
          if (category?.parent_category_list && category.parent_category_list.length > 0) {
            // Use parent_category_list for full hierarchy
            const fullPath = category.parent_category_list
              .map((id: number) => (categoryMap.get(id) as BigCommerceCategory | undefined)?.name)
              .filter(Boolean);
            if (fullPath.length > 0) {
              categoryPaths.push(fullPath.join(' > '));
            }
          } else if (category) {
            // Fallback to just category name for root categories
            categoryPaths.push(category.name);
          }
        }
        
        // Return the first (typically primary) category path, or join multiple paths
        return categoryPaths.length > 0 ? categoryPaths[0] : '';
      };

      const products: BigCommerceProductType[] = [];
      const variants: any[] = [];

      for (const bcProduct of productsResponse.data.data) {
        // Debug: Log category building for specific product
        if (bcProduct.sku === 'ES-STSB-0066') {
          console.log('=== DEBUGGING ES-STSB-0066 ===');
          console.log('Product categories (IDs):', bcProduct.categories);
          console.log('Available category objects:', bcProduct.categories.map((id: number) => categoryMap.get(id)));
          console.log('Built category path:', buildCategoryPath(bcProduct.categories));
          console.log('=============================');
        }
        
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
      
      // Helper function to build full category path using BigCommerce hierarchy
      const buildCategoryPath = (categoryIds: number[]): string => {
        if (!categoryIds || categoryIds.length === 0) return '';
        
        const categoryPaths: string[] = [];
        
        for (const catId of categoryIds) {
          const category = categoryMap.get(catId) as BigCommerceCategory | undefined;
          if (category?.parent_category_list && category.parent_category_list.length > 0) {
            // Use parent_category_list for full hierarchy
            const fullPath = category.parent_category_list
              .map((id: number) => (categoryMap.get(id) as BigCommerceCategory | undefined)?.name)
              .filter(Boolean);
            if (fullPath.length > 0) {
              categoryPaths.push(fullPath.join(' > '));
            }
          } else if (category) {
            // Fallback to just category name for root categories
            categoryPaths.push(category.name);
          }
        }
        
        return categoryPaths.length > 0 ? categoryPaths[0] : '';
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
