import { sql } from "drizzle-orm";
import { pgTable, text, varchar, decimal, timestamp, boolean, integer, json } from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod";

export const apiSettings = pgTable("api_settings", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  storeHash: text("store_hash").notNull(),
  accessToken: text("access_token").notNull(),
  clientId: text("client_id").notNull(),
  createdAt: timestamp("created_at").defaultNow(),
});

export const products = pgTable("products", {
  id: varchar("id").primaryKey(),
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

export const workOrders = pgTable("work_orders", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  title: text("title").notNull(),
  productUpdates: json("product_updates").$type<Array<{
    productId: string;
    productName: string;
    newRegularPrice?: string;
    newSalePrice?: string;
  }>>().notNull(),
  scheduledAt: timestamp("scheduled_at"),
  executeImmediately: boolean("execute_immediately").default(false),
  status: text("status").default("pending"), // pending, executing, completed, failed
  createdAt: timestamp("created_at").defaultNow(),
  executedAt: timestamp("executed_at"),
  error: text("error"),
});

export const insertApiSettingsSchema = createInsertSchema(apiSettings).pick({
  storeHash: true,
  accessToken: true,
  clientId: true,
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

export const insertWorkOrderSchema = createInsertSchema(workOrders).pick({
  title: true,
  productUpdates: true,
  scheduledAt: true,
  executeImmediately: true,
});

export type ApiSettings = typeof apiSettings.$inferSelect;
export type InsertApiSettings = z.infer<typeof insertApiSettingsSchema>;
export type Product = typeof products.$inferSelect;
export type InsertProduct = z.infer<typeof insertProductSchema>;
export type WorkOrder = typeof workOrders.$inferSelect;
export type InsertWorkOrder = z.infer<typeof insertWorkOrderSchema>;
