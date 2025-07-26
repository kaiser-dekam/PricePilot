import type { Express } from "express";
import { createServer, type Server } from "http";
import { storage } from "./storage";
import { insertApiSettingsSchema, insertWorkOrderSchema } from "@shared/schema";
import { BigCommerceService } from "./services/bigcommerce";
import { scheduler } from "./services/scheduler";

export async function registerRoutes(app: Express): Promise<Server> {
  // API Settings routes
  app.get("/api/settings", async (_req, res) => {
    try {
      const settings = await storage.getApiSettings();
      res.json(settings || null);
    } catch (error: any) {
      res.status(500).json({ message: error.message });
    }
  });

  app.post("/api/settings", async (req, res) => {
    try {
      const validatedData = insertApiSettingsSchema.parse(req.body);
      
      // Test connection before saving
      const bigcommerce = new BigCommerceService(validatedData);
      const isConnected = await bigcommerce.testConnection();
      
      if (!isConnected) {
        return res.status(400).json({ message: "Failed to connect to BigCommerce API. Please check your credentials." });
      }

      const settings = await storage.saveApiSettings(validatedData);
      res.json(settings);
    } catch (error: any) {
      res.status(400).json({ message: error.message });
    }
  });

  // Products routes
  app.get("/api/products", async (req, res) => {
    try {
      const { category, search, page = "1", limit = "20", sync = "false" } = req.query;
      
      if (sync === "true") {
        const apiSettings = await storage.getApiSettings();
        if (!apiSettings) {
          return res.status(400).json({ message: "BigCommerce API not configured" });
        }

        const bigcommerce = new BigCommerceService(apiSettings);
        const { products: bcProducts, total } = await bigcommerce.getProducts(
          parseInt(page as string),
          parseInt(limit as string)
        );

        // Update local storage
        for (const product of bcProducts) {
          await storage.createProduct(product);
        }

        return res.json({ products: bcProducts, total });
      }

      const result = await storage.getProducts({
        category: category as string,
        search: search as string,
        page: parseInt(page as string),
        limit: parseInt(limit as string),
      });

      res.json(result);
    } catch (error: any) {
      res.status(500).json({ message: error.message });
    }
  });

  app.get("/api/products/:id", async (req, res) => {
    try {
      const { id } = req.params;
      const { sync = "false" } = req.query;

      if (sync === "true") {
        const apiSettings = await storage.getApiSettings();
        if (!apiSettings) {
          return res.status(400).json({ message: "BigCommerce API not configured" });
        }

        const bigcommerce = new BigCommerceService(apiSettings);
        const product = await bigcommerce.getProduct(id);
        
        if (product) {
          await storage.createProduct(product);
          return res.json(product);
        } else {
          return res.status(404).json({ message: "Product not found" });
        }
      }

      const product = await storage.getProduct(id);
      if (!product) {
        return res.status(404).json({ message: "Product not found" });
      }

      res.json(product);
    } catch (error: any) {
      res.status(500).json({ message: error.message });
    }
  });

  app.put("/api/products/:id", async (req, res) => {
    try {
      const { id } = req.params;
      const updates = req.body;

      const apiSettings = await storage.getApiSettings();
      if (!apiSettings) {
        return res.status(400).json({ message: "BigCommerce API not configured" });
      }

      const bigcommerce = new BigCommerceService(apiSettings);
      const updatedProduct = await bigcommerce.updateProduct(id, updates);
      
      // Update local storage
      await storage.updateProduct(id, updatedProduct);
      
      res.json(updatedProduct);
    } catch (error: any) {
      res.status(500).json({ message: error.message });
    }
  });

  // Work Orders routes
  app.get("/api/work-orders", async (_req, res) => {
    try {
      const workOrders = await storage.getWorkOrders();
      res.json(workOrders);
    } catch (error: any) {
      res.status(500).json({ message: error.message });
    }
  });

  app.post("/api/work-orders", async (req, res) => {
    try {
      const validatedData = insertWorkOrderSchema.parse(req.body);
      console.log("Creating work order:", JSON.stringify(validatedData, null, 2));
      
      const workOrder = await storage.createWorkOrder(validatedData);
      console.log("Work order created:", JSON.stringify(workOrder, null, 2));

      if (workOrder.executeImmediately) {
        console.log("Executing work order immediately");
        // Execute immediately in background
        scheduler.executeImmediately(workOrder.id).catch(console.error);
      } else if (workOrder.scheduledAt) {
        console.log("Scheduling work order for:", workOrder.scheduledAt);
        // Schedule for later
        await scheduler.scheduleWorkOrder(workOrder.id, new Date(workOrder.scheduledAt));
      } else {
        console.log("Work order has no execution schedule");
      }

      res.json(workOrder);
    } catch (error: any) {
      console.error("Error creating work order:", error);
      res.status(400).json({ message: error.message });
    }
  });

  app.delete("/api/work-orders/:id", async (req, res) => {
    try {
      const { id } = req.params;
      
      // Cancel scheduled job if exists
      scheduler.cancelWorkOrder(id);
      
      const deleted = await storage.deleteWorkOrder(id);
      if (!deleted) {
        return res.status(404).json({ message: "Work order not found" });
      }

      res.json({ success: true });
    } catch (error: any) {
      res.status(500).json({ message: error.message });
    }
  });

  // Sync route for initial data load
  app.post("/api/sync", async (_req, res) => {
    try {
      const apiSettings = await storage.getApiSettings();
      if (!apiSettings) {
        return res.status(400).json({ message: "BigCommerce API not configured" });
      }

      const bigcommerce = new BigCommerceService(apiSettings);
      let page = 1;
      let totalSynced = 0;

      while (true) {
        const { products, total } = await bigcommerce.getProducts(page, 50);
        
        for (const product of products) {
          await storage.createProduct(product);
        }

        totalSynced += products.length;

        if (products.length < 50) {
          break;
        }
        page++;
      }

      res.json({ message: `Synced ${totalSynced} products successfully` });
    } catch (error: any) {
      res.status(500).json({ message: error.message });
    }
  });

  const httpServer = createServer(app);

  // Initialize scheduled jobs
  scheduler.initializeScheduledJobs().catch(console.error);

  return httpServer;
}
