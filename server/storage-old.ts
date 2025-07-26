import { type ApiSettings, type InsertApiSettings, type Product, type InsertProduct, type WorkOrder, type InsertWorkOrder, type User, type UpsertUser, apiSettings, products, workOrders, users } from "@shared/schema";
import { randomUUID } from "crypto";
import { drizzle } from "drizzle-orm/neon-http";
import { neon } from "@neondatabase/serverless";
import { eq, ilike, and, desc, count } from "drizzle-orm";

export interface IStorage {
  // User operations
  getUser(id: string): Promise<User | undefined>;
  upsertUser(user: UpsertUser): Promise<User>;
  
  // API Settings
  getApiSettings(userId: string): Promise<ApiSettings | undefined>;
  saveApiSettings(userId: string, settings: InsertApiSettings): Promise<ApiSettings>;
  
  // Products
  getProducts(userId: string, filters?: { category?: string; search?: string; page?: number; limit?: number }): Promise<{ products: Product[]; total: number }>;
  getProduct(userId: string, id: string): Promise<Product | undefined>;
  createProduct(userId: string, product: InsertProduct & { id: string }): Promise<Product>;
  updateProduct(userId: string, id: string, updates: Partial<Product>): Promise<Product | undefined>;
  deleteProduct(userId: string, id: string): Promise<boolean>;
  
  // Work Orders
  getWorkOrders(userId: string): Promise<WorkOrder[]>;
  getWorkOrder(userId: string, id: string): Promise<WorkOrder | undefined>;
  createWorkOrder(userId: string, workOrder: InsertWorkOrder): Promise<WorkOrder>;
  updateWorkOrder(userId: string, id: string, updates: Partial<WorkOrder>): Promise<WorkOrder | undefined>;
  deleteWorkOrder(userId: string, id: string): Promise<boolean>;
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

// Database storage implementation
export class DbStorage implements IStorage {
  private db;

  constructor() {
    if (!process.env.DATABASE_URL) {
      throw new Error("DATABASE_URL environment variable is required");
    }
    const sql = neon(process.env.DATABASE_URL);
    this.db = drizzle(sql);
  }

  // User operations
  async getUser(id: string): Promise<User | undefined> {
    const result = await this.db.select().from(users).where(eq(users.id, id));
    return result[0];
  }

  async upsertUser(userData: UpsertUser): Promise<User> {
    const result = await this.db
      .insert(users)
      .values(userData)
      .onConflictDoUpdate({
        target: users.id,
        set: {
          ...userData,
          updatedAt: new Date(),
        },
      })
      .returning();
    return result[0];
  }

  // API Settings
  async getApiSettings(userId: string): Promise<ApiSettings | undefined> {
    const result = await this.db.select().from(apiSettings).where(eq(apiSettings.userId, userId)).limit(1);
    return result[0];
  }

  async saveApiSettings(userId: string, settings: InsertApiSettings): Promise<ApiSettings> {
    // Delete existing settings for this user and insert new ones
    await this.db.delete(apiSettings).where(eq(apiSettings.userId, userId));
    const result = await this.db.insert(apiSettings).values({
      ...settings,
      userId,
    }).returning();
    return result[0];
  }

  // Products
  async getProducts(filters?: { category?: string; search?: string; page?: number; limit?: number }): Promise<{ products: Product[]; total: number }> {
    const page = filters?.page || 1;
    const limit = filters?.limit || 50;
    const offset = (page - 1) * limit;

    // Build where conditions
    const conditions = [];
    if (filters?.category && filters.category !== "all") {
      conditions.push(eq(products.category, filters.category));
    }
    if (filters?.search) {
      conditions.push(
        ilike(products.name, `%${filters.search}%`)
      );
    }

    const whereClause = conditions.length > 0 ? and(...conditions) : undefined;

    // Get total count
    const totalResult = await this.db
      .select({ count: count() })
      .from(products)
      .where(whereClause);
    const total = totalResult[0].count;

    // Get products
    const result = await this.db
      .select()
      .from(products)
      .where(whereClause)
      .orderBy(desc(products.lastUpdated))
      .limit(limit)
      .offset(offset);

    return { products: result, total };
  }

  async getProduct(id: string): Promise<Product | undefined> {
    const result = await this.db.select().from(products).where(eq(products.id, id));
    return result[0];
  }

  async createProduct(product: InsertProduct & { id: string }): Promise<Product> {
    const result = await this.db
      .insert(products)
      .values({
        ...product,
        lastUpdated: new Date(),
      })
      .onConflictDoUpdate({
        target: products.id,
        set: {
          name: product.name,
          sku: product.sku,
          description: product.description,
          category: product.category,
          regularPrice: product.regularPrice,
          salePrice: product.salePrice,
          stock: product.stock,
          weight: product.weight,
          status: product.status,
          lastUpdated: new Date(),
        },
      })
      .returning();
    return result[0];
  }

  async updateProduct(id: string, updates: Partial<Product>): Promise<Product | undefined> {
    const result = await this.db
      .update(products)
      .set({
        ...updates,
        lastUpdated: new Date(),
      })
      .where(eq(products.id, id))
      .returning();
    return result[0];
  }

  async deleteProduct(id: string): Promise<boolean> {
    const result = await this.db.delete(products).where(eq(products.id, id));
    return result.rowCount > 0;
  }

  // Work Orders
  async getWorkOrders(): Promise<WorkOrder[]> {
    const result = await this.db
      .select()
      .from(workOrders)
      .orderBy(desc(workOrders.createdAt));
    return result;
  }

  async getWorkOrder(id: string): Promise<WorkOrder | undefined> {
    const result = await this.db.select().from(workOrders).where(eq(workOrders.id, id));
    return result[0];
  }

  async createWorkOrder(workOrder: InsertWorkOrder): Promise<WorkOrder> {
    const result = await this.db.insert(workOrders).values(workOrder).returning();
    return result[0];
  }

  async updateWorkOrder(id: string, updates: Partial<WorkOrder>): Promise<WorkOrder | undefined> {
    const result = await this.db
      .update(workOrders)
      .set(updates)
      .where(eq(workOrders.id, id))
      .returning();
    return result[0];
  }

  async deleteWorkOrder(id: string): Promise<boolean> {
    const result = await this.db.delete(workOrders).where(eq(workOrders.id, id));
    return result.rowCount > 0;
  }

  async getPendingWorkOrders(): Promise<WorkOrder[]> {
    const result = await this.db
      .select()
      .from(workOrders)
      .where(eq(workOrders.status, "pending"));
    return result;
  }
}

// Use database storage in production, memory storage for development/testing
export const storage = process.env.DATABASE_URL ? new DbStorage() : new MemStorage();
