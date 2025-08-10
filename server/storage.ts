import { 
  type ApiSettings, type InsertApiSettings, 
  type Product, type InsertProduct, 
  type WorkOrder, type InsertWorkOrder, 
  type User, type UpsertUser,
  type Company, type InsertCompany,
  apiSettings, products, workOrders, users, companies 
} from "@shared/schema";
import { randomUUID } from "crypto";
import { drizzle } from "drizzle-orm/neon-http";
import { neon } from "@neondatabase/serverless";
import { eq, ilike, and, desc, count } from "drizzle-orm";

export interface IStorage {
  // User operations
  getUser(id: string): Promise<(User & { company?: Company }) | undefined>;
  upsertUser(user: UpsertUser & { companyId?: string }): Promise<User>;
  
  // Company operations
  createCompany(company: InsertCompany): Promise<Company>;
  getCompany(id: string): Promise<Company | undefined>;
  updateCompanySubscription(companyId: string, updates: { subscriptionPlan: string; productLimit: number }): Promise<void>;
  
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
  async getUser(id: string): Promise<(User & { company?: Company }) | undefined> {
    console.log('Looking up user with ID:', id);
    const result = await this.db
      .select()
      .from(users)
      .leftJoin(companies, eq(users.companyId, companies.id))
      .where(eq(users.id, id))
      .limit(1);
    
    if (result.length === 0) return undefined;
    
    const user = {
      ...result[0].users,
      company: result[0].companies || undefined
    };
    
    console.log('Found user:', {
      id: user.id,
      companyId: user.companyId,
      role: user.role
    });
    
    return user;
  }

  async upsertUser(userData: UpsertUser & { companyId?: string }): Promise<User> {
    console.log('Creating/updating user:', userData.id, userData.email);
    
    // If no companyId provided, create a new company for this user
    let companyId = userData.companyId;
    if (!companyId) {
      const company = await this.createCompany({
        name: userData.email?.split('@')[0] || 'Company'
      });
      companyId = company.id;
    }

    const result = await this.db
      .insert(users)
      .values({
        ...userData,
        companyId,
        role: userData.role || 'owner',
      })
      .onConflictDoUpdate({
        target: users.id,
        set: {
          email: userData.email,
          firstName: userData.firstName,
          lastName: userData.lastName,
          profileImageUrl: userData.profileImageUrl,
          updatedAt: new Date(),
        },
      })
      .returning();
    
    console.log('User upserted successfully');
    return result[0];
  }

  // Company operations
  async createCompany(companyData: InsertCompany): Promise<Company> {
    const result = await this.db
      .insert(companies)
      .values(companyData)
      .returning();
    return result[0];
  }

  async getCompany(id: string): Promise<Company | undefined> {
    const result = await this.db
      .select()
      .from(companies)
      .where(eq(companies.id, id))
      .limit(1);
    
    if (result.length === 0) return undefined;
    
    console.log('Found company:', { id: result[0].id, name: result[0].name });
    return result[0];
  }

  async updateCompanySubscription(companyId: string, updates: { subscriptionPlan: string; productLimit: number }): Promise<void> {
    await this.db
      .update(companies)
      .set({
        subscriptionPlan: updates.subscriptionPlan,
        productLimit: updates.productLimit,
        updatedAt: new Date(),
      })
      .where(eq(companies.id, companyId));
  }

  // API Settings
  async getApiSettings(userId: string): Promise<ApiSettings | undefined> {
    const user = await this.getUser(userId);
    if (!user?.companyId) return undefined;
    
    const result = await this.db.select().from(apiSettings).where(eq(apiSettings.companyId, user.companyId)).limit(1);
    return result[0];
  }

  async saveApiSettings(userId: string, settings: InsertApiSettings): Promise<ApiSettings> {
    const user = await this.getUser(userId);
    if (!user?.companyId) {
      throw new Error("User not associated with a company");
    }
    
    // Delete existing settings for this company and insert new ones
    await this.db.delete(apiSettings).where(eq(apiSettings.companyId, user.companyId));
    const result = await this.db.insert(apiSettings).values({
      ...settings,
      companyId: user.companyId,
    }).returning();
    return result[0];
  }

  async updateApiSettingsLastSync(userId: string, lastSyncAt: Date): Promise<void> {
    const user = await this.getUser(userId);
    if (!user?.companyId) return;
    
    await this.db
      .update(apiSettings)
      .set({ lastSyncAt })
      .where(eq(apiSettings.companyId, user.companyId));
  }

  // Products
  async getProducts(userId: string, filters?: { category?: string; search?: string; page?: number; limit?: number }): Promise<{ products: Product[]; total: number }> {
    const user = await this.getUser(userId);
    if (!user?.companyId) {
      return { products: [], total: 0 };
    }
    
    console.log('Getting products for company:', user.companyId);
    
    const page = filters?.page || 1;
    const limit = filters?.limit || 50;
    const offset = (page - 1) * limit;

    // Build where conditions
    const conditions = [eq(products.companyId, user.companyId)];
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
    
    console.log(`Total products in DB for company ${user.companyId}:`, total);

    // Get products
    const result = await this.db
      .select()
      .from(products)
      .where(whereClause)
      .orderBy(desc(products.lastUpdated))
      .limit(limit)
      .offset(offset);
    
    console.log(`Query returned ${result.length} products, total count: ${total}`);

    return { products: result, total };
  }

  async getProduct(userId: string, id: string): Promise<Product | undefined> {
    const user = await this.getUser(userId);
    if (!user?.companyId) return undefined;
    
    const result = await this.db.select().from(products).where(and(eq(products.companyId, user.companyId), eq(products.id, id)));
    return result[0];
  }

  async createProduct(userId: string, product: InsertProduct & { id: string }): Promise<Product> {
    const user = await this.getUser(userId);
    if (!user?.companyId) {
      throw new Error("User not associated with a company");
    }
    
    const result = await this.db
      .insert(products)
      .values({
        ...product,
        companyId: user.companyId,
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
    const user = await this.getUser(userId);
    if (!user?.companyId) return undefined;
    
    const result = await this.db
      .update(products)
      .set({
        ...updates,
        lastUpdated: new Date(),
      })
      .where(and(eq(products.companyId, user.companyId), eq(products.id, id)))
      .returning();
    return result[0];
  }

  async deleteProduct(userId: string, id: string): Promise<boolean> {
    const user = await this.getUser(userId);
    if (!user?.companyId) return false;
    
    const result = await this.db.delete(products).where(and(eq(products.companyId, user.companyId), eq(products.id, id)));
    return result.rowCount > 0;
  }

  async clearUserProducts(userId: string): Promise<void> {
    const user = await this.getUser(userId);
    if (!user?.companyId) return;
    
    await this.db.delete(products).where(eq(products.companyId, user.companyId));
  }

  // Work Orders
  async getWorkOrders(userId: string): Promise<WorkOrder[]> {
    const user = await this.getUser(userId);
    if (!user?.companyId) return [];
    
    const result = await this.db
      .select()
      .from(workOrders)
      .where(eq(workOrders.companyId, user.companyId))
      .orderBy(desc(workOrders.createdAt));
    return result;
  }

  async getWorkOrder(userId: string, id: string): Promise<WorkOrder | undefined> {
    const user = await this.getUser(userId);
    if (!user?.companyId) return undefined;
    
    const result = await this.db.select().from(workOrders).where(and(eq(workOrders.companyId, user.companyId), eq(workOrders.id, id)));
    return result[0];
  }

  async createWorkOrder(userId: string, workOrder: InsertWorkOrder): Promise<WorkOrder> {
    const user = await this.getUser(userId);
    if (!user?.companyId) {
      throw new Error("User not associated with a company");
    }
    
    const result = await this.db.insert(workOrders).values({
      ...workOrder,
      companyId: user.companyId,
      createdBy: userId,
    } as any).returning();
    return result[0];
  }

  async updateWorkOrder(userId: string, id: string, updates: Partial<WorkOrder>): Promise<WorkOrder | undefined> {
    const user = await this.getUser(userId);
    if (!user?.companyId) return undefined;
    
    const result = await this.db
      .update(workOrders)
      .set(updates)
      .where(and(eq(workOrders.companyId, user.companyId), eq(workOrders.id, id)))
      .returning();
    return result[0];
  }

  async deleteWorkOrder(userId: string, id: string): Promise<boolean> {
    const user = await this.getUser(userId);
    if (!user?.companyId) return false;
    
    const result = await this.db.delete(workOrders).where(and(eq(workOrders.companyId, user.companyId), eq(workOrders.id, id)));
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

// Use database storage
export const storage = new DbStorage();