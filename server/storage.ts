import { type ApiSettings, type InsertApiSettings, type Product, type InsertProduct, type WorkOrder, type InsertWorkOrder } from "@shared/schema";
import { randomUUID } from "crypto";

export interface IStorage {
  // API Settings
  getApiSettings(): Promise<ApiSettings | undefined>;
  saveApiSettings(settings: InsertApiSettings): Promise<ApiSettings>;
  
  // Products
  getProducts(filters?: { category?: string; search?: string; page?: number; limit?: number }): Promise<{ products: Product[]; total: number }>;
  getProduct(id: string): Promise<Product | undefined>;
  createProduct(product: InsertProduct & { id: string }): Promise<Product>;
  updateProduct(id: string, updates: Partial<Product>): Promise<Product | undefined>;
  deleteProduct(id: string): Promise<boolean>;
  
  // Work Orders
  getWorkOrders(): Promise<WorkOrder[]>;
  getWorkOrder(id: string): Promise<WorkOrder | undefined>;
  createWorkOrder(workOrder: InsertWorkOrder): Promise<WorkOrder>;
  updateWorkOrder(id: string, updates: Partial<WorkOrder>): Promise<WorkOrder | undefined>;
  deleteWorkOrder(id: string): Promise<boolean>;
  getPendingWorkOrders(): Promise<WorkOrder[]>;
}

export class MemStorage implements IStorage {
  private apiSettings: ApiSettings | undefined;
  private products: Map<string, Product>;
  private workOrders: Map<string, WorkOrder>;

  constructor() {
    this.products = new Map();
    this.workOrders = new Map();
  }

  // API Settings
  async getApiSettings(): Promise<ApiSettings | undefined> {
    return this.apiSettings;
  }

  async saveApiSettings(settings: InsertApiSettings): Promise<ApiSettings> {
    const apiSettings: ApiSettings = {
      ...settings,
      id: randomUUID(),
      createdAt: new Date(),
    };
    this.apiSettings = apiSettings;
    return apiSettings;
  }

  // Products
  async getProducts(filters?: { category?: string; search?: string; page?: number; limit?: number }): Promise<{ products: Product[]; total: number }> {
    let filtered = Array.from(this.products.values());

    if (filters?.category) {
      filtered = filtered.filter(p => p.category?.toLowerCase().includes(filters.category!.toLowerCase()));
    }

    if (filters?.search) {
      const search = filters.search.toLowerCase();
      filtered = filtered.filter(p => 
        p.name.toLowerCase().includes(search) || 
        p.sku?.toLowerCase().includes(search) ||
        p.description?.toLowerCase().includes(search)
      );
    }

    const total = filtered.length;
    const page = filters?.page || 1;
    const limit = filters?.limit || 20;
    const start = (page - 1) * limit;
    const products = filtered.slice(start, start + limit);

    return { products, total };
  }

  async getProduct(id: string): Promise<Product | undefined> {
    return this.products.get(id);
  }

  async createProduct(product: InsertProduct & { id: string }): Promise<Product> {
    const newProduct: Product = {
      ...product,
      description: product.description || null,
      sku: product.sku || null,
      category: product.category || null,
      regularPrice: product.regularPrice || null,
      salePrice: product.salePrice || null,
      stock: product.stock || null,
      weight: product.weight || null,
      status: product.status || null,
      lastUpdated: new Date(),
    };
    this.products.set(newProduct.id, newProduct);
    return newProduct;
  }

  async updateProduct(id: string, updates: Partial<Product>): Promise<Product | undefined> {
    const product = this.products.get(id);
    if (!product) return undefined;

    const updatedProduct: Product = {
      ...product,
      ...updates,
      lastUpdated: new Date(),
    };
    this.products.set(id, updatedProduct);
    return updatedProduct;
  }

  async deleteProduct(id: string): Promise<boolean> {
    return this.products.delete(id);
  }

  // Work Orders
  async getWorkOrders(): Promise<WorkOrder[]> {
    return Array.from(this.workOrders.values()).sort((a, b) => 
      new Date(b.createdAt!).getTime() - new Date(a.createdAt!).getTime()
    );
  }

  async getWorkOrder(id: string): Promise<WorkOrder | undefined> {
    return this.workOrders.get(id);
  }

  async createWorkOrder(workOrder: InsertWorkOrder): Promise<WorkOrder> {
    const id = randomUUID();
    const newWorkOrder: WorkOrder = {
      ...workOrder,
      id,
      status: "pending",
      createdAt: new Date(),
      executedAt: null,
      error: null,
      newRegularPrice: workOrder.newRegularPrice || null,
      newSalePrice: workOrder.newSalePrice || null,
      scheduledAt: workOrder.scheduledAt || null,
      executeImmediately: workOrder.executeImmediately || false,
    };
    this.workOrders.set(id, newWorkOrder);
    return newWorkOrder;
  }

  async updateWorkOrder(id: string, updates: Partial<WorkOrder>): Promise<WorkOrder | undefined> {
    const workOrder = this.workOrders.get(id);
    if (!workOrder) return undefined;

    const updatedWorkOrder: WorkOrder = {
      ...workOrder,
      ...updates,
    };
    this.workOrders.set(id, updatedWorkOrder);
    return updatedWorkOrder;
  }

  async deleteWorkOrder(id: string): Promise<boolean> {
    return this.workOrders.delete(id);
  }

  async getPendingWorkOrders(): Promise<WorkOrder[]> {
    return Array.from(this.workOrders.values()).filter(wo => wo.status === "pending");
  }
}

export const storage = new MemStorage();
