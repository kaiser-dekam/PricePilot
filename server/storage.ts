import { type ApiSettings, type InsertApiSettings, type Product, type InsertProduct, type WorkOrder, type InsertWorkOrder, type User, type UpsertUser, apiSettings, products, workOrders, users } from "@shared/schema";
import { randomUUID } from "crypto";
import { drizzle } from "drizzle-orm/neon-http";
import { neon } from "@neondatabase/serverless";
import { eq, ilike, and, desc, count } from "drizzle-orm";

export interface IStorage {
  // User operations
  getUser(id: string): Promise<User | undefined>;
  getUserByEmail(email: string): Promise<User | undefined>;
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
  clearUserProducts(userId: string): Promise<void>;
  
  // Work Orders
  getWorkOrders(userId: string): Promise<WorkOrder[]>;
  getWorkOrder(userId: string, id: string): Promise<WorkOrder | undefined>;
  createWorkOrder(userId: string, workOrder: InsertWorkOrder): Promise<WorkOrder>;
  updateWorkOrder(userId: string, id: string, updates: Partial<WorkOrder>): Promise<WorkOrder | undefined>;
  deleteWorkOrder(userId: string, id: string): Promise<boolean>;
  getPendingWorkOrders(): Promise<WorkOrder[]>;
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

  async getUserByEmail(email: string): Promise<User | undefined> {
    const result = await this.db.select().from(users).where(eq(users.email, email));
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

  async updateApiSettingsLastSync(userId: string, lastSyncAt: Date): Promise<void> {
    await this.db
      .update(apiSettings)
      .set({ lastSyncAt })
      .where(eq(apiSettings.userId, userId));
  }

  // Products
  async getProducts(userId: string, filters?: { category?: string; search?: string; page?: number; limit?: number }): Promise<{ products: Product[]; total: number }> {
    const page = filters?.page || 1;
    const limit = filters?.limit || 50;
    const offset = (page - 1) * limit;

    // Build where conditions
    const conditions = [eq(products.userId, userId)];
    if (filters?.category && filters.category !== "all") {
      conditions.push(eq(products.category, filters.category));
    }
    if (filters?.search) {
      conditions.push(
        ilike(products.name, `%${filters.search}%`)
      );
    }

    const whereClause = and(...conditions);

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

  async getProduct(userId: string, id: string): Promise<Product | undefined> {
    const result = await this.db.select().from(products).where(and(eq(products.userId, userId), eq(products.id, id)));
    return result[0];
  }

  async createProduct(userId: string, product: InsertProduct & { id: string }): Promise<Product> {
    const result = await this.db
      .insert(products)
      .values({
        ...product,
        userId,
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

  async updateProduct(userId: string, id: string, updates: Partial<Product>): Promise<Product | undefined> {
    const result = await this.db
      .update(products)
      .set({
        ...updates,
        lastUpdated: new Date(),
      })
      .where(and(eq(products.userId, userId), eq(products.id, id)))
      .returning();
    return result[0];
  }

  async deleteProduct(userId: string, id: string): Promise<boolean> {
    const result = await this.db.delete(products).where(and(eq(products.userId, userId), eq(products.id, id)));
    return result.rowCount > 0;
  }

  async clearUserProducts(userId: string): Promise<void> {
    await this.db.delete(products).where(eq(products.userId, userId));
  }

  // Work Orders
  async getWorkOrders(userId: string, includeArchived: boolean = false): Promise<WorkOrder[]> {
    const conditions = [eq(workOrders.userId, userId)];
    if (!includeArchived) {
      conditions.push(eq(workOrders.archived, false));
    }
    
    const result = await this.db
      .select()
      .from(workOrders)
      .where(and(...conditions))
      .orderBy(desc(workOrders.createdAt));
    return result;
  }

  async getWorkOrder(userId: string, id: string): Promise<WorkOrder | undefined> {
    const result = await this.db.select().from(workOrders).where(and(eq(workOrders.userId, userId), eq(workOrders.id, id)));
    return result[0];
  }

  async createWorkOrder(userId: string, workOrder: InsertWorkOrder): Promise<WorkOrder> {
    const result = await this.db.insert(workOrders).values({
      ...workOrder,
      userId,
    } as any).returning();
    return result[0];
  }

  async updateWorkOrder(userId: string, id: string, updates: Partial<WorkOrder>): Promise<WorkOrder | undefined> {
    const result = await this.db
      .update(workOrders)
      .set(updates)
      .where(and(eq(workOrders.userId, userId), eq(workOrders.id, id)))
      .returning();
    return result[0];
  }

  async deleteWorkOrder(userId: string, id: string): Promise<boolean> {
    const result = await this.db.delete(workOrders).where(and(eq(workOrders.userId, userId), eq(workOrders.id, id)));
    return result.rowCount > 0;
  }

  async archiveWorkOrder(userId: string, id: string): Promise<boolean> {
    const result = await this.db
      .update(workOrders)
      .set({ archived: true })
      .where(and(eq(workOrders.userId, userId), eq(workOrders.id, id)))
      .returning();
    return result.length > 0;
  }

  async unarchiveWorkOrder(userId: string, id: string): Promise<boolean> {
    const result = await this.db
      .update(workOrders)
      .set({ archived: false })
      .where(and(eq(workOrders.userId, userId), eq(workOrders.id, id)))
      .returning();
    return result.length > 0;
  }

  async getPendingWorkOrders(): Promise<WorkOrder[]> {
    const result = await this.db
      .select()
      .from(workOrders)
      .where(eq(workOrders.status, "pending"));
    return result;
  }
}

// Use database storage
export const storage = new DbStorage();