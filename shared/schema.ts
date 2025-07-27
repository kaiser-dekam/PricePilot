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

// User storage table for authentication
export const users = pgTable("users", {
  id: varchar("id").primaryKey(),
  email: varchar("email").unique(),
  firstName: varchar("first_name"),
  lastName: varchar("last_name"),
  profileImageUrl: varchar("profile_image_url"),
  createdAt: timestamp("created_at").defaultNow(),
  updatedAt: timestamp("updated_at").defaultNow(),
});

export const apiSettings = pgTable("api_settings", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  userId: varchar("user_id").notNull().references(() => users.id),
  storeHash: text("store_hash").notNull(),
  accessToken: text("access_token").notNull(),
  clientId: text("client_id").notNull(),
  showStock: boolean("show_stock").default(true),
  lastSyncAt: timestamp("last_sync_at"),
  createdAt: timestamp("created_at").defaultNow(),
});

export const products = pgTable("products", {
  id: varchar("id").primaryKey(),
  userId: varchar("user_id").notNull().references(() => users.id),
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

export const productVariants = pgTable("product_variants", {
  id: varchar("id").primaryKey(),
  userId: varchar("user_id").notNull().references(() => users.id),
  productId: varchar("product_id").notNull().references(() => products.id),
  variantSku: text("variant_sku"),
  optionValues: json("option_values").$type<Array<{
    id: number;
    option_id: number;
    option_display_name: string;
    label: string;
  }>>(),
  regularPrice: decimal("regular_price", { precision: 10, scale: 2 }),
  salePrice: decimal("sale_price", { precision: 10, scale: 2 }),
  calculatedPrice: decimal("calculated_price", { precision: 10, scale: 2 }),
  stock: integer("stock").default(0),
  lastUpdated: timestamp("last_updated").defaultNow(),
});

export const workOrders = pgTable("work_orders", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  userId: varchar("user_id").notNull().references(() => users.id),
  title: text("title").notNull(),
  productUpdates: json("product_updates").$type<Array<{
    productId: string;
    productName: string;
    newRegularPrice?: string;
    newSalePrice?: string;
    variantUpdates?: Array<{
      variantId: string;
      variantSku: string;
      optionValues: Array<{
        option_display_name: string;
        label: string;
      }>;
      newRegularPrice?: string;
      newSalePrice?: string;
    }>;
  }>>().notNull(),
  originalPrices: json("original_prices").$type<Array<{
    productId: string;
    originalRegularPrice: string;
    originalSalePrice: string;
    variantPrices?: Array<{
      variantId: string;
      originalRegularPrice: string;
      originalSalePrice: string;
    }>;
  }>>(),
  scheduledAt: timestamp("scheduled_at"),
  executeImmediately: boolean("execute_immediately").default(false),
  status: text("status").default("pending"), // pending, executing, completed, failed, undone
  archived: boolean("archived").default(false),
  createdAt: timestamp("created_at").defaultNow(),
  executedAt: timestamp("executed_at"),
  undoneAt: timestamp("undone_at"),
  error: text("error"),
});

export const insertApiSettingsSchema = createInsertSchema(apiSettings).pick({
  storeHash: true,
  accessToken: true,
  clientId: true,
  showStock: true,
});

export const insertUserSchema = createInsertSchema(users).pick({
  id: true,
  email: true,
  firstName: true,
  lastName: true,
  profileImageUrl: true,
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

export type User = typeof users.$inferSelect;
export type UpsertUser = z.infer<typeof insertUserSchema>;
export type ApiSettings = typeof apiSettings.$inferSelect;
export type InsertApiSettings = z.infer<typeof insertApiSettingsSchema>;
export type Product = typeof products.$inferSelect;
export type InsertProduct = z.infer<typeof insertProductSchema>;
export type ProductVariant = typeof productVariants.$inferSelect;
export type InsertProductVariant = z.infer<typeof insertProductVariantSchema>;
export type WorkOrder = typeof workOrders.$inferSelect;
export type InsertWorkOrder = z.infer<typeof insertWorkOrderSchema>;
