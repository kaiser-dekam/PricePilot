import { 
  type ApiSettings, type InsertApiSettings, 
  type Product, type InsertProduct, 
  type ProductVariant, type InsertProductVariant,
  type WorkOrder, type InsertWorkOrder, 
  type User, type UpsertUser,
  type Company, type InsertCompany,
  type CompanyInvitation,
  type PriceHistory, type InsertPriceHistory,
  apiSettings, products, productVariants, workOrders, users, companies, companyInvitations, priceHistory 
} from "@shared/schema";
import { randomUUID } from "crypto";
import { drizzle } from "drizzle-orm/neon-http";
import { neon } from "@neondatabase/serverless";
import { eq, ilike, and, desc, count, or, like } from "drizzle-orm";

export interface IStorage {
  // User operations
  getUser(id: string): Promise<(User & { company?: Company }) | undefined>;
  upsertUser(user: UpsertUser & { companyId?: string }): Promise<User>;
  markWalkthroughComplete(userId: string): Promise<void>;
  
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
  getAllCategories(userId: string): Promise<string[]>;
  getProduct(userId: string, id: string): Promise<Product | undefined>;
  createProduct(userId: string, product: InsertProduct & { id: string }): Promise<Product>;
  updateProduct(userId: string, id: string, updates: Partial<Product>): Promise<Product | undefined>;
  deleteProduct(userId: string, id: string): Promise<boolean>;
  clearUserProducts(userId: string): Promise<void>;
  
  // Product Variants
  getProductVariants(userId: string, productId: string): Promise<ProductVariant[]>;
  getProductVariant(userId: string, variantId: string): Promise<ProductVariant | undefined>;
  createProductVariant(userId: string, variant: InsertProductVariant & { id: string; productId: string }): Promise<ProductVariant>;
  updateProductVariant(userId: string, variantId: string, updates: Partial<ProductVariant>): Promise<ProductVariant | undefined>;
  deleteProductVariant(userId: string, variantId: string): Promise<boolean>;
  clearProductVariants(userId: string, productId: string): Promise<void>;
  
  // Work Orders
  getWorkOrders(userId: string): Promise<WorkOrder[]>;
  getWorkOrder(userId: string, id: string): Promise<WorkOrder | undefined>;
  createWorkOrder(userId: string, workOrder: InsertWorkOrder): Promise<WorkOrder>;
  updateWorkOrder(userId: string, id: string, updates: Partial<WorkOrder>): Promise<WorkOrder | undefined>;
  deleteWorkOrder(userId: string, id: string): Promise<boolean>;
  getPendingWorkOrders(): Promise<WorkOrder[]>;
  
  // Price History
  createPriceHistory(userId: string, history: InsertPriceHistory): Promise<PriceHistory>;
  getProductPriceHistory(userId: string, productId: string): Promise<PriceHistory[]>;
  
  // Company Invitations
  createInvitation(invitation: { companyId: string; email: string; role: string; invitedBy: string; token: string; expiresAt: Date }): Promise<CompanyInvitation>;
  getCompanyInvitations(companyId: string): Promise<CompanyInvitation[]>;
  getInvitationByToken(token: string): Promise<CompanyInvitation | undefined>;
  getInvitationById(id: string): Promise<CompanyInvitation | undefined>;
  deleteInvitation(id: string): Promise<void>;
  updateInvitationStatus(token: string, status: string): Promise<void>;
  updateUserCompany(userId: string, companyId: string, role: string): Promise<void>;
  getUserInvitations(email: string): Promise<CompanyInvitation[]>;
  
  // Company operations
  getCompany(id: string): Promise<Company | undefined>;
  updateCompanyName(companyId: string, name: string): Promise<void>;
  removeUserFromCompany(userId: string): Promise<void>;
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

  async markWalkthroughComplete(userId: string): Promise<void> {
    await this.db
      .update(users)
      .set({
        hasSeenWalkthrough: true,
        updatedAt: new Date(),
      })
      .where(eq(users.id, userId));
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
        subscriptionPlan: updates.subscriptionPlan.trim().toLowerCase(),
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
  async getProducts(userId: string, filters?: { category?: string | string[]; search?: string; page?: number; limit?: number }): Promise<{ products: (Product & { variants?: ProductVariant[] })[]; total: number }> {
    const user = await this.getUser(userId);
    if (!user?.companyId) {
      return { products: [], total: 0 };
    }
    
    const page = filters?.page || 1;
    const limit = filters?.limit || 50;
    const offset = (page - 1) * limit;

    // Get API settings to check visibility setting
    const apiSettings = await this.getApiSettings(userId);
    
    // Build where conditions
    const conditions = [eq(products.companyId, user.companyId)];
    
    // Handle category filtering - support both single string and array of strings
    if (filters?.category) {
      const categories = Array.isArray(filters.category) ? filters.category : [filters.category];
      console.log("Category filtering - received categories:", categories);
      if (categories.length > 0 && !categories.includes("all")) {
        // For category filtering, we want products that match ANY of the selected categories
        // OR are subcategories of the selected categories
        const categoryConditions = categories.flatMap(category => [
          eq(products.category, category),
          like(products.category, `${category} > %`)
        ]).filter((condition): condition is NonNullable<typeof condition> => condition != null);
        console.log("Generated category conditions count:", categoryConditions.length);
        if (categoryConditions.length > 0) {
          conditions.push(or(...categoryConditions));
          console.log("Added category filter to conditions");
        }
      }
    }
    if (filters?.search) {
      // Make search more flexible - search in name, sku, and description
      const searchTerm = `%${filters.search}%`;
      const searchCondition = or(
        ilike(products.name, searchTerm),
        ilike(products.sku, searchTerm),
        ilike(products.description, searchTerm)
      );
      if (searchCondition) {
        conditions.push(searchCondition);
      }
    }
    
    // Filter by visibility if setting is disabled
    if (!apiSettings?.showInvisibleProducts) {
      conditions.push(eq(products.status, 'published'));
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

    // Fetch variants for each product
    const productsWithVariants = await Promise.all(
      result.map(async (product) => {
        const variants = await this.db
          .select()
          .from(productVariants)
          .where(and(eq(productVariants.companyId, user.companyId), eq(productVariants.productId, product.id)));
        
        return {
          ...product,
          variants
        };
      })
    );

    return { products: productsWithVariants, total };
  }

  async getAllCategories(userId: string): Promise<string[]> {
    const user = await this.getUser(userId);
    if (!user?.companyId) {
      return [];
    }
    
    // Get all unique categories regardless of product visibility
    const result = await this.db
      .selectDistinct({ category: products.category })
      .from(products)
      .where(and(
        eq(products.companyId, user.companyId)
      ));
    
    return result
      .map(r => r.category)
      .filter((cat): cat is string => Boolean(cat)) // Remove any null/empty categories with type guard
      .sort();
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

  async updateProduct(userId: string, id: string, updates: Partial<Product>, skipPriceHistory = false): Promise<Product | undefined> {
    const user = await this.getUser(userId);
    if (!user?.companyId) return undefined;
    
    // Get the current product to track price changes (only if needed)
    let currentProduct;
    if (!skipPriceHistory) {
      currentProduct = await this.getProduct(userId, id);
      if (!currentProduct) return undefined;
    }
    
    const result = await this.db
      .update(products)
      .set({
        ...updates,
        lastUpdated: new Date(),
      })
      .where(and(eq(products.companyId, user.companyId), eq(products.id, id)))
      .returning();
    
    const updatedProduct = result[0];
    
    // Create price history entry if prices changed (and not skipped)
    if (!skipPriceHistory && updatedProduct && currentProduct && (updates.regularPrice || updates.salePrice !== undefined)) {
      const regularPriceChanged = updates.regularPrice && updates.regularPrice !== currentProduct.regularPrice;
      const salePriceChanged = updates.salePrice !== undefined && updates.salePrice !== currentProduct.salePrice;
      
      if (regularPriceChanged || salePriceChanged) {
        await this.createPriceHistory(userId, {
          productId: id,
          companyId: user.companyId,
          oldRegularPrice: currentProduct.regularPrice,
          newRegularPrice: regularPriceChanged ? updates.regularPrice : undefined,
          oldSalePrice: currentProduct.salePrice,
          newSalePrice: salePriceChanged ? updates.salePrice : undefined,
          changeType: 'system',
        });
      }
    }
    
    return updatedProduct;
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
    
    // Clear variants first (foreign key constraint)
    await this.db.delete(productVariants).where(eq(productVariants.companyId, user.companyId));
    
    // Then clear products
    await this.db.delete(products).where(eq(products.companyId, user.companyId));
  }

  // Work Orders
  async getWorkOrders(userId: string, includeArchived: boolean = false): Promise<WorkOrder[]> {
    const user = await this.getUser(userId);
    if (!user?.companyId) return [];
    
    const conditions = [eq(workOrders.companyId, user.companyId)];
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

  async archiveWorkOrder(userId: string, id: string): Promise<WorkOrder | undefined> {
    const user = await this.getUser(userId);
    if (!user?.companyId) return undefined;
    
    const result = await this.db
      .update(workOrders)
      .set({ archived: true })
      .where(and(eq(workOrders.companyId, user.companyId), eq(workOrders.id, id)))
      .returning();
    return result[0];
  }

  // Price History
  async createPriceHistory(userId: string, history: InsertPriceHistory): Promise<PriceHistory> {
    const user = await this.getUser(userId);
    if (!user?.companyId) {
      throw new Error("User not associated with a company");
    }
    
    const result = await this.db.insert(priceHistory).values({
      ...history,
      changedBy: userId,
    }).returning();
    return result[0];
  }

  async getProductPriceHistory(userId: string, productId: string): Promise<PriceHistory[]> {
    const user = await this.getUser(userId);
    if (!user?.companyId) return [];
    
    const result = await this.db
      .select()
      .from(priceHistory)
      .where(and(eq(priceHistory.companyId, user.companyId), eq(priceHistory.productId, productId)))
      .orderBy(desc(priceHistory.createdAt));
    return result;
  }

  async getPendingWorkOrders(): Promise<WorkOrder[]> {
    const result = await this.db
      .select()
      .from(workOrders)
      .where(eq(workOrders.status, "pending"));
    return result;
  }

  // Company Invitations
  async createInvitation(invitation: {
    companyId: string;
    email: string;
    role: string;
    invitedBy: string;
    token: string;
    expiresAt: Date;
  }): Promise<CompanyInvitation> {
    const result = await this.db
      .insert(companyInvitations)
      .values(invitation)
      .returning();
    return result[0];
  }

  async getCompanyInvitations(companyId: string): Promise<CompanyInvitation[]> {
    const result = await this.db
      .select()
      .from(companyInvitations)
      .where(eq(companyInvitations.companyId, companyId))
      .orderBy(desc(companyInvitations.createdAt));
    return result;
  }

  async getInvitationByToken(token: string): Promise<CompanyInvitation | undefined> {
    const result = await this.db
      .select()
      .from(companyInvitations)
      .where(eq(companyInvitations.token, token))
      .limit(1);
    return result[0];
  }

  async getInvitationById(id: string): Promise<CompanyInvitation | undefined> {
    const result = await this.db
      .select()
      .from(companyInvitations)
      .where(eq(companyInvitations.id, id))
      .limit(1);
    return result[0];
  }

  async getUserInvitations(email: string): Promise<CompanyInvitation[]> {
    const result = await this.db
      .select()
      .from(companyInvitations)
      .where(and(
        eq(companyInvitations.email, email),
        eq(companyInvitations.status, 'pending')
      ))
      .orderBy(desc(companyInvitations.createdAt));
    return result;
  }

  async updateInvitationStatus(token: string, status: string): Promise<void> {
    await this.db
      .update(companyInvitations)
      .set({ 
        status,
        acceptedAt: status === 'accepted' ? new Date() : undefined 
      })
      .where(eq(companyInvitations.token, token));
  }

  async deleteInvitation(id: string): Promise<void> {
    await this.db
      .delete(companyInvitations)
      .where(eq(companyInvitations.id, id));
  }

  async getCompanyUsers(companyId: string): Promise<User[]> {
    const result = await this.db
      .select()
      .from(users)
      .where(eq(users.companyId, companyId))
      .orderBy(desc(users.createdAt));
    return result;
  }

  async updateUserCompany(userId: string, companyId: string, role: string = 'member'): Promise<void> {
    await this.db
      .update(users)
      .set({ companyId, role, updatedAt: new Date() })
      .where(eq(users.id, userId));
  }



  async updateCompanyName(companyId: string, name: string): Promise<void> {
    await this.db
      .update(companies)
      .set({ name, updatedAt: new Date() })
      .where(eq(companies.id, companyId));
  }

  async removeUserFromCompany(userId: string): Promise<void> {
    // Create a new company for the user when they're removed
    const user = await this.getUser(userId);
    if (!user) return;

    const newCompany = await this.createCompany({
      name: user.email || 'My Company'
    });

    await this.db
      .update(users)
      .set({ 
        companyId: newCompany.id, 
        role: 'owner',
        updatedAt: new Date() 
      })
      .where(eq(users.id, userId));
  }

  // Product Variants
  async getProductVariants(userId: string, productId: string): Promise<ProductVariant[]> {
    const user = await this.getUser(userId);
    if (!user?.companyId) return [];
    
    const result = await this.db
      .select()
      .from(productVariants)
      .where(and(
        eq(productVariants.companyId, user.companyId),
        eq(productVariants.productId, productId)
      ))
      .orderBy(desc(productVariants.lastUpdated));
    
    return result;
  }

  async getProductVariant(userId: string, variantId: string): Promise<ProductVariant | undefined> {
    const user = await this.getUser(userId);
    if (!user?.companyId) return undefined;
    
    const result = await this.db
      .select()
      .from(productVariants)
      .where(and(
        eq(productVariants.companyId, user.companyId),
        eq(productVariants.id, variantId)
      ));
    
    return result[0];
  }

  async createProductVariant(userId: string, variant: InsertProductVariant & { id: string; productId: string }): Promise<ProductVariant> {
    const user = await this.getUser(userId);
    if (!user?.companyId) {
      throw new Error("User company not found");
    }
    
    const result = await this.db.insert(productVariants).values({
      ...variant,
      companyId: user.companyId,
    }).returning();
    
    return result[0];
  }

  async updateProductVariant(userId: string, variantId: string, updates: Partial<ProductVariant>): Promise<ProductVariant | undefined> {
    const user = await this.getUser(userId);
    if (!user?.companyId) return undefined;
    
    const result = await this.db
      .update(productVariants)
      .set({ ...updates, lastUpdated: new Date() })
      .where(and(
        eq(productVariants.companyId, user.companyId),
        eq(productVariants.id, variantId)
      ))
      .returning();
    
    return result[0];
  }

  async deleteProductVariant(userId: string, variantId: string): Promise<boolean> {
    const user = await this.getUser(userId);
    if (!user?.companyId) return false;
    
    const result = await this.db
      .delete(productVariants)
      .where(and(
        eq(productVariants.companyId, user.companyId),
        eq(productVariants.id, variantId)
      ));
    
    return result.rowCount ? result.rowCount > 0 : false;
  }

  async clearProductVariants(userId: string, productId: string): Promise<void> {
    const user = await this.getUser(userId);
    if (!user?.companyId) return;
    
    await this.db
      .delete(productVariants)
      .where(and(
        eq(productVariants.companyId, user.companyId),
        eq(productVariants.productId, productId)
      ));
  }

  // Additional methods for undo functionality

  async getPriceHistoryByWorkOrder(userId: string, workOrderId: string): Promise<PriceHistory[]> {
    const user = await this.getUser(userId);
    if (!user?.companyId) return [];
    
    const result = await this.db
      .select()
      .from(priceHistory)
      .where(and(
        eq(priceHistory.companyId, user.companyId),
        eq(priceHistory.workOrderId, workOrderId)
      ))
      .orderBy(priceHistory.createdAt);
    
    return result;
  }
}

// Use database storage
export const storage = new DbStorage();