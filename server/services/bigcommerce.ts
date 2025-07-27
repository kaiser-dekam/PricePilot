import axios, { AxiosInstance } from 'axios';
import { Product } from '@shared/schema';

export interface BigCommerceConfig {
  storeHash: string;
  accessToken: string;
  clientId: string;
}

export interface BigCommerceVariant {
  id: number;
  product_id: number;
  sku: string;
  price: string | null;
  sale_price: string | null;
  calculated_price: string;
  option_values: Array<{
    id: number;
    option_id: number;
    option_display_name: string;
    label: string;
  }>;
  inventory_level: number;
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
  variants?: BigCommerceVariant[];
}

export interface BigCommerceCategory {
  id: number;
  name: string;
  parent_id: number;
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
      timeout: 30000,
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

  async getProducts(page = 1, limit = 50): Promise<{ products: Product[]; total: number }> {
    try {
      console.log(`Fetching products from BigCommerce (page: ${page}, limit: ${limit})`);
      
      const [productsResponse, categoriesResponse] = await Promise.all([
        this.api.get('/catalog/products', {
          params: {
            page,
            limit,
            include: 'variants,images,custom_fields',
          },
        }),
        this.api.get('/catalog/categories'),
      ]);

      const categories = new Map(
        categoriesResponse.data.data.map((cat: BigCommerceCategory) => [cat.id, cat.name])
      );

      const products: Product[] = productsResponse.data.data.map((bcProduct: any) => ({
        id: bcProduct.id.toString(),
        name: bcProduct.name,
        sku: bcProduct.sku || '',
        description: bcProduct.description || '',
        category: bcProduct.categories.map((catId: number) => categories.get(catId)).filter(Boolean).join(' > '),
        regularPrice: bcProduct.price || '0',
        salePrice: bcProduct.sale_price || null,
        stock: bcProduct.inventory_level || 0,
        weight: bcProduct.weight || '0',
        status: bcProduct.is_visible ? 'published' : 'draft',
        lastUpdated: new Date(),
      }));

      return {
        products,
        total: productsResponse.data.meta.pagination.total,
      };
    } catch (error: any) {
      console.error('Error fetching products from BigCommerce:', error);
      throw new Error(`Failed to fetch products: ${error.response?.data?.title || error.message}`);
    }
  }

  async getProductVariants(productId: string): Promise<any[]> {
    try {
      console.log(`Fetching variants for product ${productId} from BigCommerce`);
      
      const response = await this.api.get(`/catalog/products/${productId}/variants`);
      return response.data.data || [];
    } catch (error: any) {
      console.error(`Error fetching variants for product ${productId}:`, error);
      if (error.response?.status === 404) {
        return []; // Product has no variants
      }
      throw new Error(`Failed to fetch variants: ${error.response?.data?.title || error.message}`);
    }
  }

  async updateProductVariant(productId: string, variantId: string, updates: { price?: string; sale_price?: string }): Promise<void> {
    try {
      console.log(`Updating variant ${variantId} for product ${productId} in BigCommerce`, updates);
      
      await this.api.put(`/catalog/products/${productId}/variants/${variantId}`, updates);
    } catch (error: any) {
      console.error(`Error updating variant ${variantId}:`, error);
      throw new Error(`Failed to update variant: ${error.response?.data?.title || error.message}`);
    }
  }

  async getProduct(id: string): Promise<Product | null> {
    try {
      const [productResponse, categoriesResponse] = await Promise.all([
        this.api.get(`/catalog/products/${id}`),
        this.api.get('/catalog/categories'),
      ]);

      const categories = new Map(
        categoriesResponse.data.data.map((cat: BigCommerceCategory) => [cat.id, cat.name])
      );

      const bcProduct: BigCommerceProduct = productResponse.data.data;

      return {
        id: bcProduct.id.toString(),
        name: bcProduct.name,
        sku: bcProduct.sku || '',
        description: bcProduct.description || '',
        category: bcProduct.categories.map((catId: number) => categories.get(catId)).filter(Boolean).join(' > '),
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

  async updateProduct(id: string, updates: { regularPrice?: string; salePrice?: string }): Promise<Product> {
    try {
      const updateData: any = {};
      
      if (updates.regularPrice !== undefined) {
        updateData.price = parseFloat(updates.regularPrice);
      }
      
      if (updates.salePrice !== undefined) {
        updateData.sale_price = updates.salePrice ? parseFloat(updates.salePrice) : '';
      }

      console.log(`Updating BigCommerce product ${id} with data:`, JSON.stringify(updateData, null, 2));
      
      const response = await this.api.put(`/catalog/products/${id}`, updateData);
      console.log(`BigCommerce API response:`, response.status, response.statusText);
      
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

  async getProductVariants(productId: string): Promise<BigCommerceVariant[]> {
    try {
      const response = await this.api.get(`/catalog/products/${productId}/variants`);
      return response.data.data || [];
    } catch (error: any) {
      console.error('Error fetching product variants from BigCommerce:', error);
      throw new Error(`Failed to fetch variants: ${error.response?.data?.title || error.message}`);
    }
  }

  async updateVariant(productId: string, variantId: string, updates: { regularPrice?: string; salePrice?: string }): Promise<void> {
    try {
      const updateData: any = {};
      
      if (updates.regularPrice !== undefined) {
        updateData.price = parseFloat(updates.regularPrice);
      }
      
      if (updates.salePrice !== undefined) {
        updateData.sale_price = updates.salePrice ? parseFloat(updates.salePrice) : '';
      }

      console.log(`Updating BigCommerce variant ${variantId} for product ${productId} with data:`, JSON.stringify(updateData, null, 2));
      
      const response = await this.api.put(`/catalog/products/${productId}/variants/${variantId}`, updateData);
      console.log(`BigCommerce API response:`, response.status, response.statusText);
      
    } catch (error: any) {
      console.error('Error updating variant in BigCommerce:', error);
      throw new Error(`Failed to update variant: ${error.response?.data?.title || error.message}`);
    }
  }
}
