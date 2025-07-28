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
  
  req.firebaseUser = { uid: userId, email: userEmail };
  next();
};

export async function registerRoutes(app: Express): Promise<Server> {
  // API Settings routes
  app.get("/api/settings", getFirebaseUser, async (req: any, res) => {
    try {
      const userId = req.firebaseUser.uid;
      const settings = await storage.getApiSettings(userId);
      res.json(settings);
    } catch (error: any) {
      console.error("Error fetching settings:", error);
      res.status(500).json({ message: error.message });
    }
  });

  app.post("/api/settings", getFirebaseUser, async (req: any, res) => {
    try {
      const userId = req.firebaseUser.uid;
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
      const userId = req.firebaseUser.uid;
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
      const userId = req.firebaseUser.uid;
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

  app.get("/api/products/:id", getFirebaseUser, async (req: any, res) => {
    try {
      const userId = req.firebaseUser.uid;
      const { id } = req.params;
      
      const product = await storage.getProduct(userId, id);
      if (!product) {
        return res.status(404).json({ message: "Product not found" });
      }
      
      res.json(product);
    } catch (error: any) {
      console.error("Error fetching product:", error);
      res.status(500).json({ message: error.message });
    }
  });

  app.get("/api/products/:id/variants", getFirebaseUser, async (req: any, res) => {
    try {
      const userId = req.firebaseUser.uid;
      const { id } = req.params;
      
      const variants = await storage.getProductVariants(userId, id);
      res.json(variants);
    } catch (error: any) {
      console.error("Error fetching product variants:", error);
      res.status(500).json({ message: error.message });
    }
  });

  app.post("/api/products/sync", getFirebaseUser, async (req: any, res) => {
    try {
      const userId = req.firebaseUser.uid;
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
        
        // Fetch and save variants for this product
        try {
          const bcVariants = await bcService.getProductVariants(bcProduct.id);
          for (const bcVariant of bcVariants) {
            const variant = {
              id: bcVariant.id.toString(),
              productId: bcProduct.id.toString(),
              variantSku: bcVariant.sku || undefined,
              optionValues: bcVariant.option_values || [],
              regularPrice: bcVariant.price ? bcVariant.price.toString() : undefined,
              salePrice: bcVariant.sale_price && parseFloat(bcVariant.sale_price) > 0 ? bcVariant.sale_price.toString() : undefined,
              calculatedPrice: bcVariant.calculated_price ? bcVariant.calculated_price.toString() : undefined,
              stock: bcVariant.inventory_level || 0
            };
            
            await storage.createProductVariant(userId, variant);
          }
        } catch (variantError) {
          console.warn(`Failed to fetch variants for product ${bcProduct.id}:`, variantError);
        }

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
      const userId = req.firebaseUser.uid;
      const { archived } = req.query;
      
      const filters = archived !== undefined ? { archived: archived === 'true' } : undefined;
      const workOrders = await storage.getWorkOrders(userId, filters);
      res.json(workOrders);
    } catch (error: any) {
      console.error("Error fetching work orders:", error);
      res.status(500).json({ message: error.message });
    }
  });

  app.get("/api/work-orders/:id", getFirebaseUser, async (req: any, res) => {
    try {
      const userId = req.firebaseUser.uid;
      const { id } = req.params;
      
      const workOrder = await storage.getWorkOrder(userId, id);
      if (!workOrder) {
        return res.status(404).json({ message: "Work order not found" });
      }
      
      res.json(workOrder);
    } catch (error: any) {
      console.error("Error fetching work order:", error);
      res.status(500).json({ message: error.message });
    }
  });

  app.post("/api/work-orders", getFirebaseUser, async (req: any, res) => {
    try {
      const userId = req.firebaseUser.uid;
      const validatedData = insertWorkOrderSchema.parse(req.body);
      
      const workOrder = await storage.createWorkOrder(userId, validatedData);
      res.json(workOrder);
    } catch (error: any) {
      console.error("Error creating work order:", error);
      res.status(500).json({ message: error.message });
    }
  });

  app.patch("/api/work-orders/:id", getFirebaseUser, async (req: any, res) => {
    try {
      const userId = req.firebaseUser.uid;
      const { id } = req.params;
      
      const workOrder = await storage.updateWorkOrder(userId, id, req.body);
      if (!workOrder) {
        return res.status(404).json({ message: "Work order not found" });
      }
      
      res.json(workOrder);
    } catch (error: any) {
      console.error("Error updating work order:", error);
      res.status(500).json({ message: error.message });
    }
  });

  app.delete("/api/work-orders/:id", getFirebaseUser, async (req: any, res) => {
    try {
      const userId = req.firebaseUser.uid;
      const { id } = req.params;
      
      const deleted = await storage.deleteWorkOrder(userId, id);
      if (!deleted) {
        return res.status(404).json({ message: "Work order not found" });
      }
      
      res.json({ message: "Work order deleted successfully" });
    } catch (error: any) {
      console.error("Error deleting work order:", error);
      res.status(500).json({ message: error.message });
    }
  });

  app.post("/api/work-orders/:id/archive", getFirebaseUser, async (req: any, res) => {
    try {
      const userId = req.firebaseUser.uid;
      const { id } = req.params;
      
      const workOrder = await storage.updateWorkOrder(userId, id, { archived: true });
      if (!workOrder) {
        return res.status(404).json({ message: "Work order not found" });
      }
      
      res.json(workOrder);
    } catch (error: any) {
      console.error("Error archiving work order:", error);
      res.status(500).json({ message: error.message });
    }
  });

  app.post("/api/work-orders/:id/unarchive", getFirebaseUser, async (req: any, res) => {
    try {
      const userId = req.firebaseUser.uid;
      const { id } = req.params;
      
      const workOrder = await storage.updateWorkOrder(userId, id, { archived: false });
      if (!workOrder) {
        return res.status(404).json({ message: "Work order not found" });
      }
      
      res.json(workOrder);
    } catch (error: any) {
      console.error("Error unarchiving work order:", error);
      res.status(500).json({ message: error.message });
    }
  });

  app.post("/api/work-orders/:id/undo", getFirebaseUser, async (req: any, res) => {
    try {
      const userId = req.firebaseUser.uid;
      const { id } = req.params;
      
      const workOrder = await storage.getWorkOrder(userId, id);
      if (!workOrder) {
        return res.status(404).json({ message: "Work order not found" });
      }

      if (workOrder.status !== "completed") {
        return res.status(400).json({ message: "Can only undo completed work orders" });
      }

      if (!workOrder.originalPrices || workOrder.originalPrices.length === 0) {
        return res.status(400).json({ message: "No original prices available to restore" });
      }

      const settings = await storage.getApiSettings(userId);
      if (!settings) {
        return res.status(400).json({ message: "BigCommerce API not configured" });
      }

      const bcService = new BigCommerceService(settings);

      // Restore original prices
      for (const originalPrice of workOrder.originalPrices) {
        try {
          if (originalPrice.variantId) {
            // Update variant
            await bcService.updateProductVariant(
              originalPrice.productId,
              originalPrice.variantId,
              {
                price: originalPrice.originalRegularPrice ? parseFloat(originalPrice.originalRegularPrice) : undefined,
                sale_price: originalPrice.originalSalePrice ? parseFloat(originalPrice.originalSalePrice) : undefined,
              }
            );
          } else {
            // Update product
            await bcService.updateProduct(originalPrice.productId, {
              price: originalPrice.originalRegularPrice ? parseFloat(originalPrice.originalRegularPrice) : undefined,
              sale_price: originalPrice.originalSalePrice ? parseFloat(originalPrice.originalSalePrice) : undefined,
            });
          }
        } catch (updateError) {
          console.error(`Failed to restore prices for ${originalPrice.productId}:`, updateError);
        }
      }

      // Update work order status
      const updatedWorkOrder = await storage.updateWorkOrder(userId, id, {
        status: "undone",
        undoneAt: new Date(),
      });

      res.json(updatedWorkOrder);
    } catch (error: any) {
      console.error("Error undoing work order:", error);
      res.status(500).json({ message: error.message });
    }
  });

  const httpServer = createServer(app);
  return httpServer;
}