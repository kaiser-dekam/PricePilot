import type { Express } from "express";
import { createServer, type Server } from "http";
import { storage } from "./storage";
import { insertApiSettingsSchema, insertWorkOrderSchema } from "@shared/schema";
import { BigCommerceService } from "./services/bigcommerce";
import { scheduler } from "./services/scheduler";

// Simple middleware to extract Firebase user info from headers
const getFirebaseUser = (req: any, res: any, next: any) => {
  const userId = req.headers['x-user-id'];
  const userEmail = req.headers['x-user-email'];
  
  if (!userId) {
    return res.status(401).json({ message: "Unauthorized" });
  }
  
  req.user = { uid: userId, email: userEmail };
  next();
};

export async function registerRoutes(app: Express): Promise<Server> {
  // API Settings routes
  app.get("/api/settings", getFirebaseUser, async (req: any, res) => {
    try {
      const userId = req.user.uid;
      const settings = await storage.getApiSettings(userId);
      res.json(settings || null);
    } catch (error: any) {
      console.error("Error fetching settings:", error);
      res.status(500).json({ message: error.message });
    }
  });

  app.post("/api/settings", getFirebaseUser, async (req: any, res) => {
    try {
      const userId = req.user.uid;
      const validatedData = insertApiSettingsSchema.parse(req.body);
      const settings = await storage.saveApiSettings(userId, validatedData);
      res.json(settings);
    } catch (error: any) {
      console.error("Error saving settings:", error);
      res.status(500).json({ message: error.message });
    }
  });

  app.post("/api/settings/test", getFirebaseUser, async (req: any, res) => {
    try {
      const userId = req.user.uid;
      const settings = await storage.getApiSettings(userId);
      
      if (!settings) {
        return res.status(400).json({ message: "No API settings found" });
      }

      const bcService = new BigCommerceService(settings);
      const isConnected = await bcService.testConnection();
      
      res.json({ connected: isConnected });
    } catch (error: any) {
      console.error("Connection test error:", error);
      res.status(500).json({ message: error.message });
    }
  });

  // Products routes
  app.get("/api/products", getFirebaseUser, async (req: any, res) => {
    try {
      const userId = req.user.uid;
      const { category, search, page, limit } = req.query;
      
      const filters = {
        category: category || undefined,
        search: search || undefined,
        page: page ? parseInt(page as string) : undefined,
        limit: limit ? parseInt(limit as string) : undefined,
      };
      
      const result = await storage.getProducts(userId, filters);
      res.json(result);
    } catch (error: any) {
      console.error("Error fetching products:", error);
      res.status(500).json({ message: error.message });
    }
  });

  app.post("/api/products/sync", getFirebaseUser, async (req: any, res) => {
    try {
      const userId = req.user.uid;
      const settings = await storage.getApiSettings(userId);
      
      if (!settings) {
        return res.status(400).json({ message: "No API settings found. Please configure BigCommerce API first." });
      }

      const bcService = new BigCommerceService(settings);
      
      // Clear existing products and variants
      await storage.clearUserProducts(userId);
      
      // Fetch products from BigCommerce
      const result = await bcService.getProducts();
      const bcProducts = result.products;
      const bcCategories = await bcService.getCategories();
      
      const categoryMap = new Map(bcCategories.map(cat => [cat.id, cat.name]));
      
      // Save products to database
      let syncedCount = 0;
      for (const bcProduct of bcProducts) {
        const product = {
          id: bcProduct.id.toString(),
          name: bcProduct.name,
          sku: bcProduct.sku || undefined,
          description: bcProduct.description || undefined,
          category: bcProduct.categories && bcProduct.categories.length > 0 
            ? categoryMap.get(bcProduct.categories[0]) || "Uncategorized"
            : "Uncategorized",
          regularPrice: bcProduct.price ? bcProduct.price.toString() : undefined,
          salePrice: bcProduct.sale_price && parseFloat(bcProduct.sale_price) > 0 ? bcProduct.sale_price.toString() : undefined,
          stock: bcProduct.inventory_level || 0,
          weight: bcProduct.weight ? bcProduct.weight.toString() : undefined,
          status: bcProduct.is_visible ? "published" : "draft"
        };
        
        await storage.createProduct(userId, product);
        syncedCount++;
      }
      
      // Update last sync time
      await storage.updateApiSettingsLastSync(userId, new Date());
      
      res.json({ 
        message: "Products synced successfully", 
        count: syncedCount 
      });
      
    } catch (error: any) {
      console.error("Sync error:", error);
      res.status(500).json({ message: error.message });
    }
  });

  // Work Orders routes
  app.get("/api/work-orders", getFirebaseUser, async (req: any, res) => {
    try {
      const userId = req.user.uid;
      const { archived } = req.query;
      
      const filters = archived !== undefined ? { archived: archived === 'true' } : undefined;
      const workOrders = await storage.getWorkOrders(userId, filters);
      res.json(workOrders);
    } catch (error: any) {
      console.error("Error fetching work orders:", error);
      res.status(500).json({ message: error.message });
    }
  });

  app.post("/api/work-orders", getFirebaseUser, async (req: any, res) => {
    try {
      const userId = req.user.uid;
      const validatedData = insertWorkOrderSchema.parse(req.body);
      
      const workOrder = await storage.createWorkOrder(userId, validatedData);
      res.json(workOrder);
    } catch (error: any) {
      console.error("Error creating work order:", error);
      res.status(500).json({ message: error.message });
    }
  });

  const httpServer = createServer(app);
  return httpServer;
}