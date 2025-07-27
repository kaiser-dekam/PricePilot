import axios, { AxiosInstance } from 'axios';

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

  async getProducts(page = 1, limit = 50): Promise<{ products: BigCommerceProduct[]; total: number }> {
    try {
      console.log(`Fetching products from BigCommerce (page: ${page}, limit: ${limit})`);
      
      const response = await this.api.get('/catalog/products', {
        params: {
          page,
          limit,
          include: 'variants,images',
        },
      });

      const products = response.data.data as BigCommerceProduct[];
      
      return {
        products: products,
        total: response.data.meta.pagination.total,
      };
    } catch (error: any) {
      console.error('Error fetching products from BigCommerce:', error);
      throw new Error(`Failed to fetch products: ${error.response?.data?.title || error.message}`);
    }
  }

  async getCategories(): Promise<BigCommerceCategory[]> {
    try {
      const response = await this.api.get('/catalog/categories');
      return response.data.data as BigCommerceCategory[];
    } catch (error: any) {
      console.error('Error fetching categories from BigCommerce:', error);
      return [];
    }
  }

  async getProductVariants(productId: string | number): Promise<BigCommerceVariant[]> {
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

  async updateProduct(productId: string | number, updates: { price?: number; sale_price?: number }): Promise<void> {
    try {
      console.log(`Updating product ${productId} in BigCommerce`, updates);
      
      await this.api.put(`/catalog/products/${productId}`, updates);
    } catch (error: any) {
      console.error(`Error updating product ${productId}:`, error);
      throw new Error(`Failed to update product: ${error.response?.data?.title || error.message}`);
    }
  }

  async updateProductVariant(productId: string | number, variantId: string | number, updates: { price?: number; sale_price?: number }): Promise<void> {
    try {
      console.log(`Updating variant ${variantId} for product ${productId} in BigCommerce`, updates);
      
      await this.api.put(`/catalog/products/${productId}/variants/${variantId}`, updates);
    } catch (error: any) {
      console.error(`Error updating variant ${variantId}:`, error);
      throw new Error(`Failed to update variant: ${error.response?.data?.title || error.message}`);
    }
  }
}