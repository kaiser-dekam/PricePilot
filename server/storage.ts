import { 
  type ApiSettings, 
  type InsertApiSettings, 
  type Product, 
  type InsertProduct, 
  type ProductVariant, 
  type InsertProductVariant, 
  type WorkOrder, 
  type InsertWorkOrder, 
  type User, 
  type UpsertUser,
  apiSettings, 
  products, 
  productVariants, 
  workOrders, 
  users
} from "@shared/schema";
import { randomUUID } from "crypto";
import { drizzle } from "drizzle-orm/neon-http";
import { neon } from "@neondatabase/serverless";
import { eq, ilike, and, desc, count, or } from "drizzle-orm";

export interface IStorage {
  // User operations (simplified for Firebase)
  getUser(id: string): Promise<User | undefined>;
  getUserByEmail(email: string): Promise<User | undefined>;
  upsertUser(user: UpsertUser): Promise<User>;

  // API Settings
  getApiSettings(userId: string): Promise<ApiSettings | undefined>;
  saveApiSettings(userId: string, settings: InsertApiSettings): Promise<ApiSettings>;
  updateApiSettingsLastSync(userId: string, lastSyncAt: Date): Promise<void>;

  // Products
  getProducts(userId: string, filters?: { category?: string; search?: string; page?: number; limit?: number }): Promise<{ products: Product[]; total: number }>;
  getProduct(userId: string, id: string): Promise<Product | undefined>;
  createProduct(userId: string, product: InsertProduct & { id: string }): Promise<Product>;
  updateProduct(userId: string, id: string, updates: Partial<Product>): Promise<Product | undefined>;
  deleteProduct(userId: string, id: string): Promise<boolean>;
  clearUserProducts(userId: string): Promise<void>;

  // Product Variants
  getProductVariants(userId: string, productId: string): Promise<ProductVariant[]>;
  createProductVariant(userId: string, variant: InsertProductVariant & { id: string; productId: string }): Promise<ProductVariant>;
  updateProductVariant(userId: string, id: string, updates: Partial<ProductVariant>): Promise<ProductVariant | undefined>;
  deleteProductVariant(userId: string, id: string): Promise<boolean>;
  clearProductVariants(userId: string, productId: string): Promise<void>;

  // Work Orders
  getWorkOrders(userId: string, filters?: { archived?: boolean }): Promise<WorkOrder[]>;
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
    const [user] = await this.db.select().from(users).where(eq(users.id, id));
    return user;
  }

  async getUserByEmail(email: string): Promise<User | undefined> {
    const [user] = await this.db.select().from(users).where(eq(users.email, email));
    return user;
  }

  async upsertUser(userData: UpsertUser): Promise<User> {
    const [user] = await this.db
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
    return user;
  }

  // API Settings
  async getApiSettings(userId: string): Promise<ApiSettings | undefined> {
    const [settings] = await this.db
      .select()
      .from(apiSettings)
      .where(eq(apiSettings.userId, userId));
    return settings;
  }

  async saveApiSettings(userId: string, settings: InsertApiSettings): Promise<ApiSettings> {
    const [result] = await this.db
      .insert(apiSettings)
      .values({ ...settings, userId })
      .onConflictDoUpdate({
        target: apiSettings.userId,
        set: {
          ...settings,
          updatedAt: new Date(),
        },
      })
      .returning();
    return result;
  }

  async updateApiSettingsLastSync(userId: string, lastSyncAt: Date): Promise<void> {
    await this.db
      .update(apiSettings)
      .set({ lastSyncAt, updatedAt: new Date() })
      .where(eq(apiSettings.userId, userId));
  }

  // Products
  async getProducts(userId: string, filters?: { category?: string; search?: string; page?: number; limit?: number }): Promise<{ products: Product[]; total: number }> {
    const conditions = [eq(products.userId, userId)];
    
    if (filters?.category) {
      conditions.push(eq(products.category, filters.category));
    }
    
    if (filters?.search) {
      conditions.push(
        or(
          ilike(products.name, `%${filters.search}%`),
          ilike(products.id, `%${filters.search}%`),
          ilike(products.sku, `%${filters.search}%`)
        )!
      );
    }

    const whereClause = and(...conditions);

    // Get total count
    const [{ value: total }] = await this.db
      .select({ value: count() })
      .from(products)
      .where(whereClause);

    // Get paginated products
    const page = filters?.page || 1;
    const limit = filters?.limit || 20;
    const offset = (page - 1) * limit;

    const productList = await this.db
      .select()
      .from(products)
      .where(whereClause)
      .orderBy(desc(products.createdAt))
      .limit(limit)
      .offset(offset);

    return { products: productList, total };
  }

  async getProduct(userId: string, id: string): Promise<Product | undefined> {
    const [product] = await this.db
      .select()
      .from(products)
      .where(and(eq(products.userId, userId), eq(products.id, id)));
    return product;
  }

  async createProduct(userId: string, product: InsertProduct & { id: string }): Promise<Product> {
    const [result] = await this.db
      .insert(products)
      .values({ ...product, userId })
      .returning();
    return result;
  }

  async updateProduct(userId: string, id: string, updates: Partial<Product>): Promise<Product | undefined> {
    const [result] = await this.db
      .update(products)
      .set({ ...updates, updatedAt: new Date() })
      .where(and(eq(products.userId, userId), eq(products.id, id)))
      .returning();
    return result;
  }

  async deleteProduct(userId: string, id: string): Promise<boolean> {
    const result = await this.db
      .delete(products)
      .where(and(eq(products.userId, userId), eq(products.id, id)));
    return result.rowCount > 0;
  }

  async clearUserProducts(userId: string): Promise<void> {
    await this.db.delete(products).where(eq(products.userId, userId));
    await this.db.delete(productVariants).where(eq(productVariants.userId, userId));
  }

  // Product Variants
  async getProductVariants(userId: string, productId: string): Promise<ProductVariant[]> {
    return await this.db
      .select()
      .from(productVariants)
      .where(and(eq(productVariants.userId, userId), eq(productVariants.productId, productId)));
  }

  async createProductVariant(userId: string, variant: InsertProductVariant & { id: string; productId: string }): Promise<ProductVariant> {
    const [result] = await this.db
      .insert(productVariants)
      .values({ ...variant, userId })
      .returning();
    return result;
  }

  async updateProductVariant(userId: string, id: string, updates: Partial<ProductVariant>): Promise<ProductVariant | undefined> {
    const [result] = await this.db
      .update(productVariants)
      .set({ ...updates, updatedAt: new Date() })
      .where(and(eq(productVariants.userId, userId), eq(productVariants.id, id)))
      .returning();
    return result;
  }

  async deleteProductVariant(userId: string, id: string): Promise<boolean> {
    const result = await this.db
      .delete(productVariants)
      .where(and(eq(productVariants.userId, userId), eq(productVariants.id, id)));
    return result.rowCount > 0;
  }

  async clearProductVariants(userId: string, productId: string): Promise<void> {
    await this.db
      .delete(productVariants)
      .where(and(eq(productVariants.userId, userId), eq(productVariants.productId, productId)));
  }

  // Work Orders
  async getWorkOrders(userId: string, filters?: { archived?: boolean }): Promise<WorkOrder[]> {
    const conditions = [eq(workOrders.userId, userId)];
    
    if (filters?.archived !== undefined) {
      conditions.push(eq(workOrders.archived, filters.archived));
    }

    return await this.db
      .select()
      .from(workOrders)
      .where(and(...conditions))
      .orderBy(desc(workOrders.createdAt));
  }

  async getWorkOrder(userId: string, id: string): Promise<WorkOrder | undefined> {
    const [workOrder] = await this.db
      .select()
      .from(workOrders)
      .where(and(eq(workOrders.userId, userId), eq(workOrders.id, id)));
    return workOrder;
  }

  async createWorkOrder(userId: string, workOrder: InsertWorkOrder): Promise<WorkOrder> {
    const workOrderData = {
      ...workOrder,
      id: randomUUID(),
      userId,
      createdBy: userId,
    };

    const [result] = await this.db
      .insert(workOrders)
      .values(workOrderData)
      .returning();
    return result;
  }

  async updateWorkOrder(userId: string, id: string, updates: Partial<WorkOrder>): Promise<WorkOrder | undefined> {
    const [result] = await this.db
      .update(workOrders)
      .set({ ...updates, updatedAt: new Date() })
      .where(and(eq(workOrders.userId, userId), eq(workOrders.id, id)))
      .returning();
    return result;
  }

  async deleteWorkOrder(userId: string, id: string): Promise<boolean> {
    const result = await this.db
      .delete(workOrders)
      .where(and(eq(workOrders.userId, userId), eq(workOrders.id, id)));
    return result.rowCount > 0;
  }

  async getPendingWorkOrders(): Promise<WorkOrder[]> {
    return await this.db
      .select()
      .from(workOrders)
      .where(and(
        eq(workOrders.status, "scheduled"),
        // Check if scheduled time has passed
      ))
      .orderBy(workOrders.scheduledAt);
  }
}

export const storage = new DbStorage();