import type { Express } from "express";
import { createServer, type Server } from "http";
import { storage } from "./storage";
import { insertApiSettingsSchema, insertWorkOrderSchema } from "@shared/schema";
import { BigCommerceService } from "./services/bigcommerce";
import { scheduler } from "./services/scheduler";
import { isAuthenticated } from "./firebaseAuth";

export async function registerRoutes(app: Express): Promise<Server> {
  // No auth setup needed for Firebase

  // Auth routes - simplified for Firebase
  app.get('/api/auth/user', isAuthenticated, async (req: any, res) => {
    try {
      const userId = req.user.uid; 
      let user = await storage.getUser(userId);
      
      // Create user if doesn't exist
      if (!user) {
        user = await storage.upsertUser({
          id: userId,
          email: req.user.email,
          firstName: null,
          lastName: null,
          profileImageUrl: null,
        });
      }
      
      res.json(user);
    } catch (error) {
      console.error("Error fetching user:", error);
      res.status(500).json({ message: "Failed to fetch user" });
    }
  });

  // API Settings routes
  app.get("/api/settings", isAuthenticated, async (req: any, res) => {
    try {
      const userId = req.user.uid;
      const settings = await storage.getApiSettings(userId);
      res.json(settings || null);
    } catch (error: any) {
      res.status(500).json({ message: error.message });
    }
  });

  app.post("/api/settings", isAuthenticated, async (req: any, res) => {
    try {
      const userId = req.user.uid;
      const validatedData = insertApiSettingsSchema.parse(req.body);
      
      // Test connection before saving
      const bigcommerce = new BigCommerceService(validatedData);
      const isConnected = await bigcommerce.testConnection();
      
      if (!isConnected) {
        return res.status(400).json({ message: "Failed to connect to BigCommerce API. Please check your credentials." });
      }

      const settings = await storage.saveApiSettings(userId, validatedData);
      res.json(settings);
    } catch (error: any) {
      res.status(400).json({ message: error.message });
    }
  });

  // Products routes
  app.get("/api/products", isAuthenticated, async (req: any, res) => {
    try {
      const userId = req.user.uid;
      const { category, search, page = "1", limit = "20", sync = "false" } = req.query;
      
      // Note: Sync functionality moved to dedicated POST /api/sync endpoint

      const filters = {
        category: category as string,
        search: search as string,
        page: parseInt(page as string),
        limit: parseInt(limit as string),
      };

      const result = await storage.getProducts(userId, filters);
      res.json(result);
    } catch (error: any) {
      console.error("Error in /api/products:", error);
      res.status(500).json({ message: error.message });
    }
  });

  // Dedicated sync endpoint for frontend
  app.post("/api/sync", isAuthenticated, async (req: any, res) => {
    try {
      const userId = req.user.uid;
      
      const apiSettings = await storage.getApiSettings(userId);
      if (!apiSettings) {
        return res.status(400).json({ message: "API settings not configured" });
      }

      const bigcommerce = new BigCommerceService(apiSettings);
      
      // Fetch all products by paginating through all pages
      let allProducts: any[] = [];
      let page = 1;
      let hasMorePages = true;
      
      while (hasMorePages) {
        console.log(`Fetching page ${page} of products...`);
        const productsResponse = await bigcommerce.getProducts(page, 50);
        const pageProducts = Array.isArray(productsResponse) ? productsResponse : productsResponse.products || [];
        
        allProducts.push(...pageProducts);
        
        // Check if there are more pages
        const total = productsResponse.total || 0;
        const currentCount = page * 50;
        hasMorePages = currentCount < total;
        page++;
      }

      console.log(`Syncing ${allProducts.length} products for user ${userId}`);

      // Clear existing products for this user before syncing new ones
      // This ensures we don't have duplicates and handles deleted products
      await storage.clearUserProducts(userId);

      // Store products in database
      for (const product of allProducts) {
        try {
          await storage.createProduct(userId, {
            id: product.id,
            name: product.name,
            sku: product.sku || '',
            description: product.description || '',
            category: product.category || null,
            regularPrice: product.regularPrice || '0',
            salePrice: product.salePrice || null,
            stock: product.stock || 0,
            weight: product.weight || '0',
            status: product.status || 'draft',
          });
        } catch (productError) {
          console.error(`Error storing product ${product.id}:`, productError);
        }
      }

      // Update lastSyncAt in API settings
      await storage.updateApiSettingsLastSync(userId, new Date());

      res.json({ 
        message: `Successfully synced ${allProducts.length} products`,
        count: allProducts.length 
      });
    } catch (error: any) {
      console.error("Error in /api/sync:", error);
      res.status(500).json({ message: error.message });
    }
  });

  app.get("/api/products/:id", isAuthenticated, async (req: any, res) => {
    try {
      const userId = req.user.uid;
      const product = await storage.getProduct(userId, req.params.id);
      if (!product) {
        return res.status(404).json({ message: "Product not found" });
      }
      res.json(product);
    } catch (error: any) {
      res.status(500).json({ message: error.message });
    }
  });

  // Work Orders routes
  app.get("/api/work-orders", isAuthenticated, async (req: any, res) => {
    try {
      const userId = req.user.uid;
      const workOrders = await storage.getWorkOrders(userId);
      res.json(workOrders);
    } catch (error: any) {
      res.status(500).json({ message: error.message });
    }
  });

  app.post("/api/work-orders", isAuthenticated, async (req: any, res) => {
    try {
      const userId = req.user.uid;
      const validatedData = insertWorkOrderSchema.parse(req.body);
      
      const workOrder = await storage.createWorkOrder(userId, validatedData);
      
      if (workOrder.executeImmediately || workOrder.scheduledAt) {
        scheduler.scheduleWorkOrder(workOrder);
      }
      
      res.json(workOrder);
    } catch (error: any) {
      console.error("Error creating work order:", error);
      res.status(400).json({ message: error.message });
    }
  });

  app.patch("/api/work-orders/:id", isAuthenticated, async (req: any, res) => {
    try {
      const userId = req.user.uid;
      const workOrder = await storage.updateWorkOrder(userId, req.params.id, req.body);
      if (!workOrder) {
        return res.status(404).json({ message: "Work order not found" });
      }
      res.json(workOrder);
    } catch (error: any) {
      res.status(500).json({ message: error.message });
    }
  });

  app.delete("/api/work-orders/:id", isAuthenticated, async (req: any, res) => {
    try {
      const userId = req.user.uid;
      const deleted = await storage.deleteWorkOrder(userId, req.params.id);
      if (!deleted) {
        return res.status(404).json({ message: "Work order not found" });
      }
      res.json({ message: "Work order deleted" });
    } catch (error: any) {
      res.status(500).json({ message: error.message });
    }
  });

  // Categories route for work order modal
  app.get("/api/categories", isAuthenticated, async (req: any, res) => {
    try {
      const userId = req.user.uid;
      const result = await storage.getProducts(userId, { limit: 1000 }); // Get all products to extract categories
      const categories = Array.from(new Set(result.products.map(p => p.category).filter(Boolean)));
      res.json(categories);
    } catch (error: any) {
      res.status(500).json({ message: error.message });
    }
  });

  const httpServer = createServer(app);
  return httpServer;
}