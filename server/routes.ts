import type { Express } from "express";
import { createServer, type Server } from "http";
import { storage } from "./storage";
import { insertApiSettingsSchema, insertWorkOrderSchema, insertCompanySchema, insertCompanyInvitationSchema } from "@shared/schema";
import { BigCommerceService } from "./services/bigcommerce";
import { scheduler } from "./services/scheduler";

import { stripeService, SUBSCRIPTION_PLANS } from "./services/stripe";
import { randomUUID } from "crypto";
import { addDays } from "date-fns";

export async function registerRoutes(app: Express): Promise<Server> {

  // Firebase Auth routes
  app.get('/api/auth/firebase-user', async (req, res) => {
    try {
      const authHeader = req.headers.authorization;
      if (!authHeader || !authHeader.startsWith('Bearer ')) {
        return res.status(401).json({ message: "No authorization header" });
      }

      const idToken = authHeader.split('Bearer ')[1];
      if (!idToken || idToken.length < 10) {
        return res.status(401).json({ message: "Invalid token format" });
      }
      
      console.log("Attempting to decode Firebase token...", { tokenLength: idToken.length });
      
      // Decode the JWT token payload (without verification for MVP)
      // In production, use Firebase Admin SDK to verify the token
      let payload;
      try {
        const parts = idToken.split('.');
        if (parts.length !== 3) {
          throw new Error("Invalid JWT format");
        }
        
        // Add padding if needed for base64 decoding
        let base64Payload = parts[1];
        const padding = '===='.slice(0, (4 - base64Payload.length % 4) % 4);
        base64Payload += padding;
        
        payload = JSON.parse(atob(base64Payload));
        console.log("Decoded payload:", { sub: payload.sub, email: payload.email });
      } catch (decodeError) {
        console.error("Token decode error:", decodeError);
        return res.status(401).json({ message: "Invalid token format" });
      }
      
      // Check if user already exists to preserve their role
      const existingUser = await storage.getUser(payload.sub || payload.user_id);
      
      const userData = {
        id: payload.sub || payload.user_id,
        email: payload.email,
        firstName: payload.given_name || payload.name?.split(' ')[0] || null,
        lastName: payload.family_name || payload.name?.split(' ').slice(1).join(' ') || null,
        profileImageUrl: payload.picture || null,
        role: existingUser?.role || "member" as const, // Preserve existing role or default to member
        isActive: true,
      };

      console.log("Creating/updating user:", userData.id, userData.email);
      const user = await storage.upsertUser(userData);
      console.log("User upserted successfully");
      res.json(user);
    } catch (error: any) {
      console.error("Error with Firebase auth:", error);
      res.status(500).json({ message: "Internal server error", error: error.message });
    }
  });

  // Company setup routes (for users without a company) - Firebase Auth version
  app.post('/api/company/create', async (req, res) => {
    try {
      // Get Firebase user ID from header
      const authHeader = req.headers.authorization;
      if (!authHeader || !authHeader.startsWith('Bearer ')) {
        return res.status(401).json({ message: "Unauthorized" });
      }
      
      const idToken = authHeader.split('Bearer ')[1];
      const payload = JSON.parse(atob(idToken.split('.')[1]));
      const userId = payload.sub || payload.user_id;
      
      const user = await storage.getUser(userId);
      
      if (!user) {
        return res.status(404).json({ message: "User not found" });
      }

      if (user.companyId) {
        return res.status(400).json({ message: "User already has a company" });
      }

      const validatedData = insertCompanySchema.parse(req.body);
      const company = await storage.createCompany(validatedData);

      // Update user to be owner of the new company
      await storage.upsertUser({
        ...user,
        companyId: company.id,
        role: "owner",
      });

      res.json({ company, user: { ...user, companyId: company.id, role: "owner" } });
    } catch (error: any) {
      console.error("Error creating company:", error);
      res.status(500).json({ message: error.message });
    }
  });

  app.post('/api/invitations/accept/:token', async (req, res) => {
    try {
      const authHeader = req.headers.authorization;
      if (!authHeader || !authHeader.startsWith('Bearer ')) {
        return res.status(401).json({ message: "Unauthorized" });
      }
      
      const idToken = authHeader.split('Bearer ')[1];
      const payload = JSON.parse(atob(idToken.split('.')[1]));
      const userId = payload.sub || payload.user_id;
      
      const { token } = req.params;
      
      const success = await storage.acceptInvitation(token, userId);
      if (!success) {
        return res.status(400).json({ message: "Invalid or expired invitation" });
      }

      const user = await storage.getUser(userId);
      res.json({ user });
    } catch (error: any) {
      console.error("Error accepting invitation:", error);
      res.status(500).json({ message: error.message });
    }
  });

  // Helper function to get user and company from Firebase token
  async function getFirebaseUserAndCompany(req: any) {
    const authHeader = req.headers.authorization;
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      throw new Error("No authorization header");
    }
    
    const idToken = authHeader.split('Bearer ')[1];
    const payload = JSON.parse(atob(idToken.split('.')[1]));
    const userId = payload.sub || payload.user_id;
    
    console.log('Looking up user with ID:', userId);
    const user = await storage.getUser(userId);
    console.log('Found user:', user ? { id: user.id, companyId: user.companyId, role: user.role } : 'null');
    
    if (!user || !user.companyId) {
      throw new Error("User not found or no company");
    }
    
    const company = await storage.getCompany(user.companyId);
    console.log('Found company:', company ? { id: company.id, name: company.name } : 'null');
    return { user, company };
  }

  // Company-based routes (require user to be part of a company)
  app.get('/api/company', async (req, res) => {
    try {
      const { company } = await getFirebaseUserAndCompany(req);
      res.json(company);
    } catch (error: any) {
      console.error("Error fetching company:", error);
      if (error.message === "No authorization header" || error.message === "User not found or no company") {
        return res.status(401).json({ message: "Unauthorized" });
      }
      res.status(500).json({ message: error.message });
    }
  });

  app.get('/api/company/users', async (req, res) => {
    try {
      const { user } = await getFirebaseUserAndCompany(req);
      const users = await storage.getCompanyUsers(user.companyId!);
      res.json(users);
    } catch (error: any) {
      console.error("Error fetching company users:", error);
      if (error.message === "No authorization header" || error.message === "User not found or no company") {
        return res.status(401).json({ message: "Unauthorized" });
      }
      res.status(500).json({ message: error.message });
    }
  });

  app.post('/api/company/invite', async (req, res) => {
    try {
      const { user } = await getFirebaseUserAndCompany(req);
      const currentUser = user;
      
      // Only owners and admins can invite
      if (!currentUser.role || !['owner', 'admin'].includes(currentUser.role)) {
        return res.status(403).json({ message: "Insufficient permissions" });
      }

      const validatedData = insertCompanyInvitationSchema.parse({
        ...req.body,
        companyId: user.companyId!,
        invitedBy: currentUser.id,
        token: randomUUID(),
        expiresAt: addDays(new Date(), 7),
      });

      const invitation = await storage.createInvitation(validatedData);
      res.json(invitation);
    } catch (error: any) {
      console.error("Error creating invitation:", error);
      res.status(500).json({ message: error.message });
    }
  });

  app.get('/api/company/invitations', async (req, res) => {
    try {
      const { user } = await getFirebaseUserAndCompany(req);
      const invitations = await storage.getCompanyInvitations(user.companyId!);
      res.json(invitations);
    } catch (error: any) {
      console.error("Error fetching invitations:", error);
      if (error.message === "No authorization header" || error.message === "User not found or no company") {
        return res.status(401).json({ message: "Unauthorized" });
      }
      res.status(500).json({ message: error.message });
    }
  });

  // API Settings routes
  app.get("/api/settings", async (req, res) => {
    try {
      const { user } = await getFirebaseUserAndCompany(req);
      const settings = await storage.getApiSettings(user.companyId!);
      res.json(settings || null);
    } catch (error: any) {
      console.error("Error fetching settings:", error);
      if (error.message === "No authorization header" || error.message === "User not found or no company") {
        return res.status(401).json({ message: "Unauthorized" });
      }
      res.status(500).json({ message: error.message });
    }
  });

  app.post("/api/settings", async (req, res) => {
    try {
      const { user } = await getFirebaseUserAndCompany(req);
      const validatedData = insertApiSettingsSchema.parse(req.body);
      
      const settings = await storage.saveApiSettings(user.companyId!, validatedData);
      res.json(settings);
    } catch (error: any) {
      console.error("Error saving settings:", error);
      if (error.message === "No authorization header" || error.message === "User not found or no company") {
        return res.status(401).json({ message: "Unauthorized" });
      }
      res.status(500).json({ message: error.message });
    }
  });

  app.post("/api/settings/test", async (req, res) => {
    try {
      const { user } = await getFirebaseUserAndCompany(req);
      const settings = await storage.getApiSettings(user.companyId!);
      
      if (!settings) {
        return res.status(400).json({ message: "No API settings found" });
      }

      const bcService = new BigCommerceService(settings);
      await bcService.testConnection();
      
      res.json({ success: true, message: "Connection successful" });
    } catch (error: any) {
      console.error("Connection test failed:", error);
      if (error.message === "No authorization header" || error.message === "User not found or no company") {
        return res.status(401).json({ message: "Unauthorized" });
      }
      res.status(400).json({ success: false, message: error.message });
    }
  });

  // Products routes
  app.get("/api/products", async (req, res) => {
    try {
      const { user } = await getFirebaseUserAndCompany(req);
      const { category, search, page, limit } = req.query;
      
      const filters = {
        category: category as string,
        search: search as string,
        page: page ? parseInt(page as string) : undefined,
        limit: limit ? parseInt(limit as string) : undefined,
      };

      const result = await storage.getProducts(user.companyId!, filters);
      res.json(result);
    } catch (error: any) {
      console.error("Error fetching products:", error);
      if (error.message === "No authorization header" || error.message === "User not found or no company") {
        return res.status(401).json({ message: "Unauthorized" });
      }
      res.status(500).json({ message: error.message });
    }
  });

  app.get("/api/products/:id", async (req, res) => {
    try {
      const { user } = await getFirebaseUserAndCompany(req);
      const { id } = req.params;
      
      const product = await storage.getProduct(user.companyId!, id);
      if (!product) {
        return res.status(404).json({ message: "Product not found" });
      }
      
      res.json(product);
    } catch (error: any) {
      console.error("Error fetching product:", error);
      if (error.message === "No authorization header" || error.message === "User not found or no company") {
        return res.status(401).json({ message: "Unauthorized" });
      }
      res.status(500).json({ message: error.message });
    }
  });

  app.get("/api/products/:id/variants", async (req, res) => {
    try {
      const { user } = await getFirebaseUserAndCompany(req);
      const { id } = req.params;
      
      const variants = await storage.getProductVariants(user.companyId!, id);
      res.json(variants);
    } catch (error: any) {
      console.error("Error fetching product variants:", error);
      res.status(500).json({ message: error.message });
    }
  });

  // Legacy sync endpoint for backwards compatibility
  app.post("/api/sync", async (req, res) => {
    try {
      const { user, company } = await getFirebaseUserAndCompany(req);
      const settings = await storage.getApiSettings(user.companyId!);
      
      if (!settings) {
        return res.status(400).json({ message: "No API settings found. Please configure BigCommerce API first." });
      }

      const bcService = new BigCommerceService(settings);
      
      // Fetch total product count from BigCommerce first to check limits
      console.log("Checking BigCommerce product count for limit enforcement...");
      const firstPageResult = await bcService.getProducts(1, 1);
      const totalBcProducts = firstPageResult.total || 0;
      
      // Check subscription plan limits
      const productLimit = company?.productLimit || 5; // Default to trial plan limit
      const subscriptionPlan = company?.subscriptionPlan || 'trial';
      
      if (totalBcProducts > productLimit) {
        return res.status(400).json({ 
          message: `Your ${subscriptionPlan} plan is limited to ${productLimit} products, but your BigCommerce store has ${totalBcProducts} products. Please upgrade your subscription to sync more products.`,
          currentPlan: subscriptionPlan,
          productLimit: productLimit,
          storeProductCount: totalBcProducts
        });
      }
      
      // Clear existing products and variants
      await storage.clearCompanyProducts(user.companyId!);
      
      // Fetch all products from BigCommerce with pagination
      let allProducts: any[] = [];
      let page = 1;
      let hasMorePages = true;
      
      console.log(`Starting BigCommerce product sync (legacy endpoint) - ${totalBcProducts} products within ${productLimit} limit...`);
      
      while (hasMorePages) {
        console.log(`Fetching page ${page} of products...`);
        const result = await bcService.getProducts(page, 250); // Use max limit of 250 per page
        const pageProducts = result.products;
        
        allProducts.push(...pageProducts);
        
        // Check if there are more pages
        const total = result.total || 0;
        const currentCount = page * 250;
        hasMorePages = currentCount < total;
        page++;
        
        console.log(`Fetched ${pageProducts.length} products. Total so far: ${allProducts.length} / ${total}`);
      }
      
      console.log(`Finished fetching all ${allProducts.length} products from BigCommerce`);
      const bcProducts = allProducts;
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
        
        await storage.createProduct(user.companyId!, product);
        
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
            
            await storage.createProductVariant(user.companyId!, variant);
          }
        } catch (variantError) {
          console.warn(`Failed to fetch variants for product ${bcProduct.id}:`, variantError);
        }

        syncedCount++;
      }
      
      // Update last sync time
      await storage.updateApiSettingsLastSync(user.companyId!, new Date());
      
      res.json({ 
        message: "Products synced successfully", 
        count: syncedCount 
      });
      
    } catch (error: any) {
      console.error("Sync error:", error);
      if (error.message === "No authorization header" || error.message === "User not found or no company") {
        return res.status(401).json({ message: "Unauthorized" });
      }
      res.status(500).json({ message: error.message });
    }
  });

  app.post("/api/products/sync", async (req, res) => {
    try {
      const { user, company } = await getFirebaseUserAndCompany(req);
      const settings = await storage.getApiSettings(user.companyId!);
      
      if (!settings) {
        return res.status(400).json({ message: "No API settings found. Please configure BigCommerce API first." });
      }

      const bcService = new BigCommerceService(settings);
      
      // Fetch total product count from BigCommerce first to check limits
      console.log("Checking BigCommerce product count for limit enforcement...");
      const firstPageResult = await bcService.getProducts(1, 1);
      const totalBcProducts = firstPageResult.total || 0;
      
      // Check subscription plan limits
      const productLimit = company?.productLimit || 5; // Default to trial plan limit
      const subscriptionPlan = company?.subscriptionPlan || 'trial';
      
      if (totalBcProducts > productLimit) {
        return res.status(400).json({ 
          message: `Your ${subscriptionPlan} plan is limited to ${productLimit} products, but your BigCommerce store has ${totalBcProducts} products. Please upgrade your subscription to sync more products.`,
          currentPlan: subscriptionPlan,
          productLimit: productLimit,
          storeProductCount: totalBcProducts
        });
      }
      
      // Clear existing products and variants
      await storage.clearCompanyProducts(user.companyId!);
      
      // Fetch all products from BigCommerce with pagination
      let allProducts: any[] = [];
      let page = 1;
      let hasMorePages = true;
      
      console.log(`Starting BigCommerce product sync - ${totalBcProducts} products within ${productLimit} limit...`);
      
      while (hasMorePages) {
        console.log(`Fetching page ${page} of products...`);
        const result = await bcService.getProducts(page, 250); // Use max limit of 250 per page
        const pageProducts = result.products;
        
        allProducts.push(...pageProducts);
        
        // Check if there are more pages
        const total = result.total || 0;
        const currentCount = page * 250;
        hasMorePages = currentCount < total;
        page++;
        
        console.log(`Fetched ${pageProducts.length} products. Total so far: ${allProducts.length} / ${total}`);
      }
      
      console.log(`Finished fetching all ${allProducts.length} products from BigCommerce`);
      const bcProducts = allProducts;
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
        
        await storage.createProduct(user.companyId!, product);
        
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
            
            await storage.createProductVariant(user.companyId!, variant);
          }
        } catch (variantError) {
          console.warn(`Failed to fetch variants for product ${bcProduct.id}:`, variantError);
        }

        syncedCount++;
      }
      
      // Update last sync time
      await storage.updateApiSettingsLastSync(user.companyId!, new Date());
      
      res.json({ 
        message: "Products synced successfully", 
        count: syncedCount 
      });
      
    } catch (error: any) {
      console.error("Sync error:", error);
      if (error.message === "No authorization header" || error.message === "User not found or no company") {
        return res.status(401).json({ message: "Unauthorized" });
      }
      res.status(500).json({ message: error.message });
    }
  });

  // Work Orders routes
  app.get("/api/work-orders", async (req, res) => {
    try {
      const { user } = await getFirebaseUserAndCompany(req);
      const { archived } = req.query;
      
      const filters = archived !== undefined ? { archived: archived === 'true' } : undefined;
      const workOrders = await storage.getWorkOrders(user.companyId!, filters);
      res.json(workOrders);
    } catch (error: any) {
      console.error("Error fetching work orders:", error);
      if (error.message === "No authorization header" || error.message === "User not found or no company") {
        return res.status(401).json({ message: "Unauthorized" });
      }
      res.status(500).json({ message: error.message });
    }
  });

  app.get("/api/work-orders/:id", async (req, res) => {
    try {
      const { user } = await getFirebaseUserAndCompany(req);
      const { id } = req.params;
      
      const workOrder = await storage.getWorkOrder(user.companyId!, id);
      if (!workOrder) {
        return res.status(404).json({ message: "Work order not found" });
      }
      
      res.json(workOrder);
    } catch (error: any) {
      console.error("Error fetching work order:", error);
      res.status(500).json({ message: error.message });
    }
  });

  app.post("/api/work-orders", async (req, res) => {
    try {
      const { user } = await getFirebaseUserAndCompany(req);
      const createdBy = user.id;
      const validatedData = insertWorkOrderSchema.parse(req.body);
      
      const workOrder = await storage.createWorkOrder(user.companyId!, createdBy, validatedData);
      
      // Schedule work order if needed
      if (workOrder.executeImmediately) {
        scheduler.scheduleImmediateExecution(workOrder);
      } else if (workOrder.scheduledAt) {
        scheduler.scheduleWorkOrder(workOrder);
      }
      
      res.json(workOrder);
    } catch (error: any) {
      console.error("Error creating work order:", error);
      res.status(500).json({ message: error.message });
    }
  });

  app.patch("/api/work-orders/:id", async (req, res) => {
    try {
      const { user } = await getFirebaseUserAndCompany(req);
      const { id } = req.params;
      
      const workOrder = await storage.updateWorkOrder(user.companyId!, id, req.body);
      if (!workOrder) {
        return res.status(404).json({ message: "Work order not found" });
      }
      
      res.json(workOrder);
    } catch (error: any) {
      console.error("Error updating work order:", error);
      res.status(500).json({ message: error.message });
    }
  });

  app.delete("/api/work-orders/:id", async (req, res) => {
    try {
      const { user } = await getFirebaseUserAndCompany(req);
      const { id } = req.params;
      
      const success = await storage.deleteWorkOrder(user.companyId!, id);
      if (!success) {
        return res.status(404).json({ message: "Work order not found" });
      }
      
      res.json({ success: true });
    } catch (error: any) {
      console.error("Error deleting work order:", error);
      res.status(500).json({ message: error.message });
    }
  });

  // Archive work order
  app.patch("/api/work-orders/:id/archive", async (req, res) => {
    try {
      const { user } = await getFirebaseUserAndCompany(req);
      const { id } = req.params;
      
      const workOrder = await storage.updateWorkOrder(user.companyId!, id, { archived: true });
      if (!workOrder) {
        return res.status(404).json({ message: "Work order not found" });
      }
      
      res.json(workOrder);
    } catch (error: any) {
      console.error("Error archiving work order:", error);
      res.status(500).json({ message: error.message });
    }
  });

  // Unarchive work order
  app.patch("/api/work-orders/:id/unarchive", async (req, res) => {
    try {
      const { user } = await getFirebaseUserAndCompany(req);
      const { id } = req.params;
      
      const workOrder = await storage.updateWorkOrder(user.companyId!, id, { archived: false });
      if (!workOrder) {
        return res.status(404).json({ message: "Work order not found" });
      }
      
      res.json(workOrder);
    } catch (error: any) {
      console.error("Error unarchiving work order:", error);
      res.status(500).json({ message: error.message });
    }
  });

  app.post("/api/work-orders/:id/undo", async (req, res) => {
    try {
      const { user } = await getFirebaseUserAndCompany(req);
      const { id } = req.params;
      
      const workOrder = await storage.getWorkOrder(user.companyId!, id);
      if (!workOrder) {
        return res.status(404).json({ message: "Work order not found" });
      }

      if (workOrder.status !== "completed") {
        return res.status(400).json({ message: "Can only undo completed work orders" });
      }

      if (!workOrder.originalPrices || workOrder.originalPrices.length === 0) {
        return res.status(400).json({ message: "No original prices available for undo" });
      }

      const settings = await storage.getApiSettings(user.companyId!);
      if (!settings) {
        return res.status(400).json({ message: "No API settings found" });
      }

      const bcService = new BigCommerceService(settings);

      // Restore original prices
      for (const originalPrice of workOrder.originalPrices) {
        try {
          // Update product pricing
          await bcService.updateProduct(originalPrice.productId, {
            price: parseFloat(originalPrice.originalRegularPrice),
            sale_price: originalPrice.originalSalePrice !== "0" ? parseFloat(originalPrice.originalSalePrice) : 0
          });

          // Update variants if they exist
          if (originalPrice.variantPrices) {
            for (const variantPrice of originalPrice.variantPrices) {
              await bcService.updateProductVariant(originalPrice.productId, variantPrice.variantId, {
                price: parseFloat(variantPrice.originalRegularPrice),
                sale_price: variantPrice.originalSalePrice !== "0" ? parseFloat(variantPrice.originalSalePrice) : 0
              });
            }
          }
        } catch (error) {
          console.error(`Failed to restore prices for product ${originalPrice.productId}:`, error);
        }
      }

      // Update work order status
      await storage.updateWorkOrder(user.companyId!, id, {
        status: "undone",
        undoneAt: new Date(),
      });

      res.json({ success: true, message: "Work order undone successfully" });
    } catch (error: any) {
      console.error("Error undoing work order:", error);
      res.status(500).json({ message: error.message });
    }
  });

  // Subscription and billing routes
  app.get('/api/subscription/plans', async (req, res) => {
    res.json(Object.values(SUBSCRIPTION_PLANS));
  });

  app.get('/api/subscription/current', async (req, res) => {
    try {
      const { user, company } = await getFirebaseUserAndCompany(req);
      if (!company) {
        return res.status(404).json({ message: "Company not found" });
      }
      res.json({
        currentPlan: company.subscriptionPlan || 'trial',
        productLimit: company.productLimit || 5,
        subscriptionStatus: company.subscriptionStatus || 'active',
        currentPeriodEnd: company.currentPeriodEnd,
        stripeCustomerId: company.stripeCustomerId,
        stripeSubscriptionId: company.stripeSubscriptionId
      });
    } catch (error: any) {
      console.error("Error fetching subscription:", error);
      res.status(500).json({ message: error.message });
    }
  });

  app.post('/api/subscription/create', async (req, res) => {
    try {
      const { user, company } = await getFirebaseUserAndCompany(req);
      if (!company) {
        return res.status(404).json({ message: "Company not found" });
      }
      
      const { planId } = req.body;

      if (!planId || !SUBSCRIPTION_PLANS[planId]) {
        return res.status(400).json({ message: 'Invalid plan selected' });
      }

      const plan = SUBSCRIPTION_PLANS[planId];
      
      // Trial plan doesn't require Stripe
      if (planId === 'trial') {
        await storage.updateCompanySubscription(company.id, {
          subscriptionPlan: 'trial',
          productLimit: 5,
          subscriptionStatus: 'active'
        });
        return res.json({ success: true });
      }

      // Create or get Stripe customer
      let customerId = company.stripeCustomerId;
      if (!customerId) {
        const customer = await stripeService.createCustomer(
          user.email || '', 
          company.name
        );
        customerId = customer.id;
        
        await storage.updateCompanySubscription(company.id, {
          stripeCustomerId: customerId
        });
      }

      // Create subscription
      const subscription = await stripeService.createSubscription(customerId, plan.priceId);
      
      // Handle period end safely - it might not be set for incomplete subscriptions
      let currentPeriodEnd = null;
      if ((subscription as any).current_period_end) {
        currentPeriodEnd = new Date((subscription as any).current_period_end * 1000);
      }
      
      await storage.updateCompanySubscription(company.id, {
        subscriptionPlan: planId,
        productLimit: plan.productLimit,
        stripeSubscriptionId: subscription.id,
        subscriptionStatus: subscription.status,
        currentPeriodEnd: currentPeriodEnd
      });

      const latestInvoice = (subscription as any).latest_invoice;
      let clientSecret = latestInvoice?.payment_intent?.client_secret;

      // If no payment intent exists, create one manually
      if (!clientSecret && latestInvoice && latestInvoice.amount_due > 0) {
        console.log("No payment intent found, creating one manually for invoice:", latestInvoice.id);
        
        // Create a payment intent for the invoice amount
        const paymentIntent = await stripeService.stripe.paymentIntents.create({
          amount: latestInvoice.amount_due,
          currency: latestInvoice.currency,
          customer: latestInvoice.customer as string,
          metadata: {
            invoice_id: latestInvoice.id,
            subscription_id: subscription.id
          },
          automatic_payment_methods: {
            enabled: true,
          },
        });
        
        clientSecret = paymentIntent.client_secret;
        console.log("Created manual payment intent with clientSecret:", !!clientSecret);
      }

      const responseData = {
        subscriptionId: subscription.id,
        clientSecret,
        success: true
      };

      console.log("Subscription response data:", responseData);
      console.log("Latest invoice:", latestInvoice);
      console.log("Payment intent:", latestInvoice?.payment_intent);
      
      res.json(responseData);

    } catch (error: any) {
      console.error("Error creating subscription:", error);
      res.status(500).json({ message: error.message });
    }
  });

  app.post('/api/subscription/cancel', async (req, res) => {
    try {
      const { company } = await getFirebaseUserAndCompany(req);
      
      if (!company || !company.stripeSubscriptionId) {
        return res.status(400).json({ message: 'No active subscription found' });
      }

      await stripeService.cancelSubscription(company.stripeSubscriptionId);
      
      await storage.updateCompanySubscription(company.id, {
        subscriptionStatus: 'cancelled'
      });

      res.json({ success: true });

    } catch (error: any) {
      console.error("Error canceling subscription:", error);
      res.status(500).json({ message: error.message });
    }
  });

  // Product limit enforcement endpoint
  app.get('/api/products/can-sync', async (req, res) => {
    try {
      const { company } = await getFirebaseUserAndCompany(req);
      if (!company) {
        return res.status(404).json({ message: "Company not found" });
      }
      
      const { products } = await storage.getProducts(company.id, { limit: 1000 });
      
      const currentProductCount = products.length;
      const productLimit = company.productLimit || 5;
      
      res.json({
        canSync: currentProductCount < productLimit,
        currentCount: currentProductCount,
        limit: productLimit,
        plan: company.subscriptionPlan || 'trial'
      });
    } catch (error: any) {
      console.error("Error checking sync ability:", error);
      res.status(500).json({ message: error.message });
    }
  });

  const httpServer = createServer(app);
  return httpServer;
}