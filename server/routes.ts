import type { Express } from "express";
import { createServer, type Server } from "http";
import { storage } from "./storage";
import { insertApiSettingsSchema, insertWorkOrderSchema } from "@shared/schema";
import { BigCommerceService } from "./services/bigcommerce";
import { scheduler } from "./services/scheduler";
import { setupAuth, isAuthenticated } from "./replitAuth";

export async function registerRoutes(app: Express): Promise<Server> {
  // Setup authentication
  await setupAuth(app);

  // Auth routes
  app.get('/api/auth/user', isAuthenticated, async (req: any, res) => {
    try {
      const userId = req.user.claims.sub;
      const user = await storage.getUser(userId);
      res.json(user);
    } catch (error) {
      console.error("Error fetching user:", error);
      res.status(500).json({ message: "Failed to fetch user" });
    }
  });

  // API Settings routes
  app.get("/api/settings", isAuthenticated, async (req: any, res) => {
    try {
      const userId = req.user.claims.sub;
      const settings = await storage.getApiSettings(userId);
      res.json(settings || null);
    } catch (error: any) {
      res.status(500).json({ message: error.message });
    }
  });

  app.post("/api/settings", isAuthenticated, async (req: any, res) => {
    try {
      const userId = req.user.claims.sub;
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
      const userId = req.user.claims.sub;
      const { category, search, page = "1", limit = "20", sync = "false" } = req.query;
      
      if (sync === "true") {
        const apiSettings = await storage.getApiSettings(userId);
        if (!apiSettings) {
          return res.status(400).json({ message: "API settings not configured" });
        }

        const bigcommerce = new BigCommerceService(apiSettings);
        const bigCommerceProducts = await bigcommerce.getProducts();

        // Store products in database
        for (const product of bigCommerceProducts) {
          await storage.createProduct(userId, {
            id: product.id.toString(),
            name: product.name,
            sku: product.sku,
            description: product.description,
            category: product.primary_category?.name || null,
            regularPrice: product.price.toString(),
            salePrice: product.sale_price ? product.sale_price.toString() : null,
            stock: product.inventory_level || 0,
            weight: product.weight ? product.weight.toString() : null,
            status: product.is_visible ? "published" : "draft",
          });
        }
      }

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

  app.get("/api/products/:id", isAuthenticated, async (req: any, res) => {
    try {
      const userId = req.user.claims.sub;
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
      const userId = req.user.claims.sub;
      const workOrders = await storage.getWorkOrders(userId);
      res.json(workOrders);
    } catch (error: any) {
      res.status(500).json({ message: error.message });
    }
  });

  app.post("/api/work-orders", isAuthenticated, async (req: any, res) => {
    try {
      const userId = req.user.claims.sub;
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
      const userId = req.user.claims.sub;
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
      const userId = req.user.claims.sub;
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
      const userId = req.user.claims.sub;
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