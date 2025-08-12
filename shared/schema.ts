import { sql } from "drizzle-orm";
import { pgTable, text, varchar, decimal, timestamp, boolean, integer, json, index } from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod";

// Session storage table for authentication
export const sessions = pgTable(
  "sessions",
  {
    sid: varchar("sid").primaryKey(),
    sess: json("sess").notNull(),
    expire: timestamp("expire").notNull(),
  },
  (table) => [index("IDX_session_expire").on(table.expire)],
);

// Companies table for multi-tenant organization
export const companies = pgTable("companies", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  name: text("name").notNull(),
  subscriptionPlan: text("subscription_plan").default("trial"),
  productLimit: integer("product_limit").default(5),
  stripeCustomerId: varchar("stripe_customer_id"),
  stripeSubscriptionId: varchar("stripe_subscription_id"),
  subscriptionStatus: text("subscription_status").default("active"),
  currentPeriodEnd: timestamp("current_period_end"),
  createdAt: timestamp("created_at").defaultNow(),
  updatedAt: timestamp("updated_at").defaultNow(),
});

// User storage table for authentication
export const users = pgTable("users", {
  id: varchar("id").primaryKey(),
  companyId: varchar("company_id").notNull().references(() => companies.id),
  email: varchar("email").unique(),
  firstName: varchar("first_name"),
  lastName: varchar("last_name"),
  profileImageUrl: varchar("profile_image_url"),
  role: text("role").default("member"), // owner, admin, member
  isActive: boolean("is_active").default(true),
  createdAt: timestamp("created_at").defaultNow(),
  updatedAt: timestamp("updated_at").defaultNow(),
});

// Company invitations for team collaboration
export const companyInvitations = pgTable("company_invitations", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  companyId: varchar("company_id").notNull().references(() => companies.id),
  email: varchar("email").notNull(),
  role: text("role").default("member"),
  invitedBy: varchar("invited_by").notNull().references(() => users.id),
  token: varchar("token").notNull().unique(),
  status: text("status").default("pending"), // pending, accepted, rejected, expired
  expiresAt: timestamp("expires_at").notNull(),
  acceptedAt: timestamp("accepted_at"),
  createdAt: timestamp("created_at").defaultNow(),
});

export const apiSettings = pgTable("api_settings", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  companyId: varchar("company_id").notNull().references(() => companies.id),
  storeHash: text("store_hash").notNull(),
  accessToken: text("access_token").notNull(),
  clientId: text("client_id").notNull(),
  showStock: boolean("show_stock").default(false),
  showStockStatus: boolean("show_stock_status").default(false),
  lastSyncAt: timestamp("last_sync_at"),
  createdAt: timestamp("created_at").defaultNow(),
});

export const products = pgTable("products", {
  id: varchar("id").primaryKey(),
  companyId: varchar("company_id").notNull().references(() => companies.id),
  name: text("name").notNull(),
  sku: text("sku"),
  description: text("description"),
  category: text("category"),
  regularPrice: decimal("regular_price", { precision: 10, scale: 2 }),
  salePrice: decimal("sale_price", { precision: 10, scale: 2 }),
  stock: integer("stock").default(0),
  weight: decimal("weight", { precision: 10, scale: 2 }),
  status: text("status").default("published"),
  lastUpdated: timestamp("last_updated").defaultNow(),
});

// Product variants for managing variations (size, color, etc.)
export const productVariants = pgTable("product_variants", {
  id: varchar("id").primaryKey(),
  companyId: varchar("company_id").notNull().references(() => companies.id),
  productId: varchar("product_id").notNull(),
  variantSku: text("variant_sku"),
  optionValues: json("option_values").$type<Record<string, string>>(),
  regularPrice: decimal("regular_price", { precision: 10, scale: 2 }),
  salePrice: decimal("sale_price", { precision: 10, scale: 2 }),
  calculatedPrice: decimal("calculated_price", { precision: 10, scale: 2 }),
  stock: integer("stock").default(0),
  lastUpdated: timestamp("last_updated").defaultNow(),
});

export const workOrders = pgTable("work_orders", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  companyId: varchar("company_id").notNull().references(() => companies.id),
  createdBy: varchar("created_by").notNull().references(() => users.id),
  title: text("title").notNull(),
  productUpdates: json("product_updates").$type<Array<{
    productId: string;
    productName: string;
    variantId?: string;
    variantSku?: string;
    newRegularPrice?: string;
    newSalePrice?: string;
  }>>().notNull(),
  originalPrices: json("original_prices").$type<Array<{
    productId: string;
    variantId?: string;
    originalRegularPrice?: string;
    originalSalePrice?: string;
  }>>(),
  scheduledAt: timestamp("scheduled_at"),
  executeImmediately: boolean("execute_immediately").default(false),
  status: text("status").default("pending"), // pending, executing, completed, failed
  archived: boolean("archived").default(false),
  createdAt: timestamp("created_at").defaultNow(),
  executedAt: timestamp("executed_at"),
  undoneAt: timestamp("undone_at"),
  error: text("error"),
});

// Price history table to track product and variant price changes over time
export const priceHistory = pgTable("price_history", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  productId: varchar("product_id").notNull().references(() => products.id, { onDelete: 'cascade' }),
  variantId: varchar("variant_id"), // null for product-level changes, set for variant-level changes
  companyId: varchar("company_id").notNull().references(() => companies.id, { onDelete: 'cascade' }),
  oldRegularPrice: decimal("old_regular_price", { precision: 10, scale: 2 }),
  newRegularPrice: decimal("new_regular_price", { precision: 10, scale: 2 }),
  oldSalePrice: decimal("old_sale_price", { precision: 10, scale: 2 }),
  newSalePrice: decimal("new_sale_price", { precision: 10, scale: 2 }),
  changeType: text("change_type").notNull(), // manual, work_order, sync
  workOrderId: varchar("work_order_id").references(() => workOrders.id, { onDelete: 'cascade' }),
  changedBy: varchar("changed_by").references(() => users.id, { onDelete: 'cascade' }),
  createdAt: timestamp("created_at").defaultNow(),
});

export const insertCompanySchema = createInsertSchema(companies).pick({
  name: true,
  subscriptionPlan: true,
  productLimit: true,
});

export const insertApiSettingsSchema = createInsertSchema(apiSettings).pick({
  storeHash: true,
  accessToken: true,
  clientId: true,
  showStock: true,
  showStockStatus: true,
});

export const insertUserSchema = createInsertSchema(users).pick({
  id: true,
  email: true,
  firstName: true,
  lastName: true,
  profileImageUrl: true,
  role: true,
});

export const insertCompanyInvitationSchema = createInsertSchema(companyInvitations).pick({
  email: true,
  role: true,
});

export const insertProductSchema = createInsertSchema(products).pick({
  name: true,
  sku: true,
  description: true,
  category: true,
  regularPrice: true,
  salePrice: true,
  stock: true,
  weight: true,
  status: true,
});

export const insertProductVariantSchema = createInsertSchema(productVariants).pick({
  variantSku: true,
  optionValues: true,
  regularPrice: true,
  salePrice: true,
  calculatedPrice: true,
  stock: true,
});

export const insertWorkOrderSchema = createInsertSchema(workOrders).pick({
  title: true,
  productUpdates: true,
  scheduledAt: true,
  executeImmediately: true,
}).extend({
  scheduledAt: z.string().datetime().optional().nullable().transform(val => val ? new Date(val) : null),
});

export type Company = typeof companies.$inferSelect;
export type InsertCompany = z.infer<typeof insertCompanySchema>;
export type User = typeof users.$inferSelect;
export type UpsertUser = z.infer<typeof insertUserSchema>;
export type CompanyInvitation = typeof companyInvitations.$inferSelect;
export type InsertCompanyInvitation = z.infer<typeof insertCompanyInvitationSchema>;
export type ApiSettings = typeof apiSettings.$inferSelect;
export type InsertApiSettings = z.infer<typeof insertApiSettingsSchema>;
export type Product = typeof products.$inferSelect;
export type InsertProduct = z.infer<typeof insertProductSchema>;
export type ProductVariant = typeof productVariants.$inferSelect;
export type InsertProductVariant = z.infer<typeof insertProductVariantSchema>;
export type WorkOrder = typeof workOrders.$inferSelect;
export type InsertWorkOrder = z.infer<typeof insertWorkOrderSchema>;
export type PriceHistory = typeof priceHistory.$inferSelect;
export type InsertPriceHistory = typeof priceHistory.$inferInsert;

// BigCommerce product type without companyId (used in BigCommerce service)
export type BigCommerceProduct = Omit<Product, 'companyId'>;
