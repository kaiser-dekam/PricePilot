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
  type Company,
  type InsertCompany,
  type CompanyInvitation,
  type InsertCompanyInvitation,
  apiSettings, 
  products, 
  productVariants, 
  workOrders, 
  users,
  companies,
  companyInvitations
} from "@shared/schema";
import { randomUUID } from "crypto";
import { drizzle } from "drizzle-orm/neon-http";
import { neon } from "@neondatabase/serverless";
import { eq, ilike, and, desc, count, or } from "drizzle-orm";

export interface IStorage {
  // Company operations
  getCompany(id: string): Promise<Company | undefined>;
  createCompany(company: InsertCompany): Promise<Company>;
  
  // User operations  
  getUser(id: string): Promise<User | undefined>;
  getUserByEmail(email: string): Promise<User | undefined>;
  upsertUser(user: UpsertUser): Promise<User>;
  getCompanyUsers(companyId: string): Promise<User[]>;
  
  // Company invitations
  createInvitation(invitation: InsertCompanyInvitation): Promise<CompanyInvitation>;
  getInvitation(token: string): Promise<CompanyInvitation | undefined>;
  acceptInvitation(token: string, userId: string): Promise<boolean>;
  getCompanyInvitations(companyId: string): Promise<CompanyInvitation[]>;
  
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

  // Company operations
  async getCompany(id: string): Promise<Company | undefined> {
    const result = await this.db.select().from(companies).where(eq(companies.id, id));
    return result[0];
  }

  async createCompany(companyData: InsertCompany): Promise<Company> {
    const result = await this.db
      .insert(companies)
      .values(companyData)
      .returning();
    return result[0];
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
          companyId: userData.companyId,
          email: userData.email,
          firstName: userData.firstName,
          lastName: userData.lastName,
          profileImageUrl: userData.profileImageUrl,
          role: userData.role,
          isActive: userData.isActive,
          updatedAt: new Date(),
        },
      })
      .returning();
    return result[0];
  }

  async getCompanyUsers(companyId: string): Promise<User[]> {
    return await this.db
      .select()
      .from(users)
      .where(and(eq(users.companyId, companyId), eq(users.isActive, true)));
  }

  // Company invitations
  async createInvitation(invitationData: InsertCompanyInvitation): Promise<CompanyInvitation> {
    const result = await this.db
      .insert(companyInvitations)
      .values(invitationData)
      .returning();
    return result[0];
  }

  async getInvitation(token: string): Promise<CompanyInvitation | undefined> {
    const result = await this.db
      .select()
      .from(companyInvitations)
      .where(eq(companyInvitations.token, token));
    return result[0];
  }

  async acceptInvitation(token: string, userId: string): Promise<boolean> {
    const invitation = await this.getInvitation(token);
    if (!invitation || invitation.acceptedAt || invitation.expiresAt < new Date()) {
      return false;
    }

    // Update user's company and role
    await this.db
      .update(users)
      .set({ 
        companyId: invitation.companyId, 
        role: invitation.role,
        updatedAt: new Date()
      })
      .where(eq(users.id, userId));

    // Mark invitation as accepted
    await this.db
      .update(companyInvitations)
      .set({ acceptedAt: new Date() })
      .where(eq(companyInvitations.token, token));

    return true;
  }

  async getCompanyInvitations(companyId: string): Promise<CompanyInvitation[]> {
    return await this.db
      .select()
      .from(companyInvitations)
      .where(eq(companyInvitations.companyId, companyId))
      .orderBy(desc(companyInvitations.createdAt));
  }

  // API Settings
  async getApiSettings(companyId: string): Promise<ApiSettings | undefined> {
    const result = await this.db.select().from(apiSettings).where(eq(apiSettings.companyId, companyId)).limit(1);
    return result[0];
  }

  async saveApiSettings(companyId: string, settings: InsertApiSettings): Promise<ApiSettings> {
    // Delete existing settings for this company and insert new ones
    await this.db.delete(apiSettings).where(eq(apiSettings.companyId, companyId));
    const result = await this.db.insert(apiSettings).values({
      ...settings,
      companyId,
    }).returning();
    return result[0];
  }

  async updateApiSettingsLastSync(companyId: string, lastSyncAt: Date): Promise<void> {
    await this.db
      .update(apiSettings)
      .set({ lastSyncAt })
      .where(eq(apiSettings.companyId, companyId));
  }

  // Products
  async getProducts(companyId: string, filters?: { category?: string; search?: string; page?: number; limit?: number }): Promise<{ products: Product[]; total: number }> {
    const page = filters?.page || 1;
    const limit = filters?.limit || 50;
    const offset = (page - 1) * limit;

    // Build where conditions
    const conditions = [eq(products.companyId, companyId)];
    if (filters?.category && filters.category !== "all") {
      conditions.push(eq(products.category, filters.category));
    }
    if (filters?.search) {
      conditions.push(
        or(
          ilike(products.name, `%${filters.search}%`),
          ilike(products.sku, `%${filters.search}%`),
          eq(products.id, filters.search)
        )
      );
    }

    const whereClause = and(...conditions);
    
    // Get products with pagination
    const productResults = await this.db
      .select()
      .from(products)
      .where(whereClause)
      .orderBy(desc(products.lastUpdated))
      .limit(limit)
      .offset(offset);

    // Get total count
    const countResult = await this.db
      .select({ count: count() })
      .from(products)
      .where(whereClause);

    return {
      products: productResults,
      total: countResult[0]?.count || 0,
    };
  }

  async getProduct(companyId: string, id: string): Promise<Product | undefined> {
    const result = await this.db
      .select()
      .from(products)
      .where(and(eq(products.companyId, companyId), eq(products.id, id)));
    return result[0];
  }

  async createProduct(companyId: string, product: InsertProduct & { id: string }): Promise<Product> {
    const result = await this.db
      .insert(products)
      .values({ ...product, companyId })
      .returning();
    return result[0];
  }

  async updateProduct(companyId: string, id: string, updates: Partial<Product>): Promise<Product | undefined> {
    const result = await this.db
      .update(products)
      .set(updates)
      .where(and(eq(products.companyId, companyId), eq(products.id, id)))
      .returning();
    return result[0];
  }

  async deleteProduct(companyId: string, id: string): Promise<boolean> {
    const result = await this.db
      .delete(products)
      .where(and(eq(products.companyId, companyId), eq(products.id, id)))
      .returning();
    return result.length > 0;
  }

  async clearCompanyProducts(companyId: string): Promise<void> {
    await this.db.delete(products).where(eq(products.companyId, companyId));
  }

  // Product Variants
  async getProductVariants(companyId: string, productId: string): Promise<ProductVariant[]> {
    return await this.db
      .select()
      .from(productVariants)
      .where(and(eq(productVariants.companyId, companyId), eq(productVariants.productId, productId)));
  }

  async createProductVariant(companyId: string, variant: InsertProductVariant & { id: string; productId: string }): Promise<ProductVariant> {
    const result = await this.db
      .insert(productVariants)
      .values({ ...variant, companyId })
      .returning();
    return result[0];
  }

  async updateProductVariant(companyId: string, id: string, updates: Partial<ProductVariant>): Promise<ProductVariant | undefined> {
    const result = await this.db
      .update(productVariants)
      .set(updates)
      .where(and(eq(productVariants.companyId, companyId), eq(productVariants.id, id)))
      .returning();
    return result[0];
  }

  async deleteProductVariant(companyId: string, id: string): Promise<boolean> {
    const result = await this.db
      .delete(productVariants)
      .where(and(eq(productVariants.companyId, companyId), eq(productVariants.id, id)))
      .returning();
    return result.length > 0;
  }

  async clearProductVariants(companyId: string, productId: string): Promise<void> {
    await this.db
      .delete(productVariants)
      .where(and(eq(productVariants.companyId, companyId), eq(productVariants.productId, productId)));
  }

  // Work Orders
  async getWorkOrders(companyId: string, filters?: { archived?: boolean }): Promise<WorkOrder[]> {
    const conditions = [eq(workOrders.companyId, companyId)];
    
    if (filters?.archived !== undefined) {
      conditions.push(eq(workOrders.archived, filters.archived));
    }

    return await this.db
      .select()
      .from(workOrders)
      .where(and(...conditions))
      .orderBy(desc(workOrders.createdAt));
  }

  async getWorkOrder(companyId: string, id: string): Promise<WorkOrder | undefined> {
    const result = await this.db
      .select()
      .from(workOrders)
      .where(and(eq(workOrders.companyId, companyId), eq(workOrders.id, id)));
    return result[0];
  }

  async createWorkOrder(companyId: string, createdBy: string, workOrder: InsertWorkOrder): Promise<WorkOrder> {
    const result = await this.db
      .insert(workOrders)
      .values({ ...workOrder, companyId, createdBy })
      .returning();
    return result[0];
  }

  async updateWorkOrder(companyId: string, id: string, updates: Partial<WorkOrder>): Promise<WorkOrder | undefined> {
    const result = await this.db
      .update(workOrders)
      .set(updates)
      .where(and(eq(workOrders.companyId, companyId), eq(workOrders.id, id)))
      .returning();
    return result[0];
  }

  async deleteWorkOrder(companyId: string, id: string): Promise<boolean> {
    const result = await this.db
      .delete(workOrders)
      .where(and(eq(workOrders.companyId, companyId), eq(workOrders.id, id)))
      .returning();
    return result.length > 0;
  }

  async getPendingWorkOrders(): Promise<WorkOrder[]> {
    return await this.db
      .select()
      .from(workOrders)
      .where(eq(workOrders.status, "pending"));
  }
}

export const storage: IStorage = new DbStorage();