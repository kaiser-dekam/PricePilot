import type { Express } from "express";
import { createServer, type Server } from "http";
import { storage } from "./storage";
import { insertApiSettingsSchema, insertWorkOrderSchema } from "@shared/schema";
import { BigCommerceService } from "./services/bigcommerce";
import { scheduler } from "./services/scheduler";
import { isAuthenticated } from "./firebaseAuth";
import Stripe from "stripe";

// Initialize Stripe
const stripe = new Stripe(process.env.STRIPE_SECRET_KEY!, {
  apiVersion: "2025-07-30.basil",
});

export async function registerRoutes(app: Express): Promise<Server> {
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

      // Get user's company to check product limit
      const user = await storage.getUser(userId);
      if (!user || !user.company) {
        return res.status(400).json({ message: "User company information not found" });
      }

      const productLimit = user.company.productLimit || 5; // Default to 5 if null
      const subscriptionPlan = user.company.subscriptionPlan || 'trial';

      console.log(`User ${userId} has ${subscriptionPlan} plan with limit of ${productLimit} products`);

      const bigcommerce = new BigCommerceService(apiSettings);
      
      // Fetch all products by paginating through all pages
      let allProducts: any[] = [];
      let page = 1;
      let hasMorePages = true;
      
      while (hasMorePages && allProducts.length < productLimit) {
        console.log(`Fetching page ${page} of products...`);
        const productsResponse = await bigcommerce.getProducts(page, 50);
        const pageProducts = Array.isArray(productsResponse) ? productsResponse : productsResponse.products || [];
        
        // Only add products up to the limit
        const remainingSlots = productLimit - allProducts.length;
        const productsToAdd = pageProducts.slice(0, remainingSlots);
        allProducts.push(...productsToAdd);
        
        // Check if there are more pages and we haven't hit our limit
        const total = productsResponse.total || 0;
        const currentCount = page * 50;
        hasMorePages = currentCount < total && allProducts.length < productLimit;
        page++;
      }

      // Check if user was limited
      const isLimited = allProducts.length >= productLimit;
      const totalAvailable = await bigcommerce.getProductCount();

      console.log(`Syncing ${allProducts.length} products for user ${userId} (limited by ${subscriptionPlan} plan)`);

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

      // Create appropriate response message
      let message = `Successfully synced ${allProducts.length} products`;
      let warning = null;

      if (isLimited && totalAvailable > productLimit) {
        message = `Synced ${allProducts.length} products (limited by ${subscriptionPlan} plan)`;
        warning = `Your ${subscriptionPlan} plan allows up to ${productLimit} products. You have ${totalAvailable} products in your BigCommerce store. Upgrade your plan to sync more products.`;
      }

      res.json({ 
        message,
        warning,
        count: allProducts.length,
        totalAvailable,
        productLimit,
        subscriptionPlan,
        isLimited
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

  // Delete all products route
  app.delete("/api/products/all", isAuthenticated, async (req: any, res) => {
    try {
      const userId = req.user.uid;
      await storage.clearUserProducts(userId);
      res.json({ message: "All products deleted successfully" });
    } catch (error: any) {
      console.error("Error deleting all products:", error);
      res.status(500).json({ message: error.message });
    }
  });

  // Create Stripe checkout session for subscription change
  app.post("/api/subscription/checkout", isAuthenticated, async (req: any, res) => {
    try {
      const userId = req.user.uid;
      const { plan } = req.body;
      
      // Validate plan
      const validPlans = ['starter', 'premium']; // Only paid plans need checkout
      if (!validPlans.includes(plan.toLowerCase())) {
        return res.status(400).json({ message: "Invalid subscription plan for checkout" });
      }

      const user = await storage.getUser(userId);
      if (!user || !user.company) {
        return res.status(400).json({ message: "User company information not found" });
      }

      // Define plan prices and limits
      const planDetails = {
        starter: { priceId: 'price_starter', amount: 1000, limit: 100 }, // $10.00
        premium: { priceId: 'price_premium', amount: 2000, limit: 1000 } // $20.00
      };

      const selectedPlan = planDetails[plan.toLowerCase() as keyof typeof planDetails];

      // Create Stripe checkout session
      const session = await stripe.checkout.sessions.create({
        payment_method_types: ['card'],
        line_items: [
          {
            price_data: {
              currency: 'usd',
              product_data: {
                name: `Catalog Pilot ${plan.charAt(0).toUpperCase() + plan.slice(1)} Plan`,
                description: `Up to ${selectedPlan.limit} products`,
              },
              unit_amount: selectedPlan.amount,
              recurring: {
                interval: 'month',
              },
            },
            quantity: 1,
          },
        ],
        mode: 'subscription',
        success_url: `${req.protocol}://${req.get('host')}/subscription?success=true&plan=${plan}`,
        cancel_url: `${req.protocol}://${req.get('host')}/subscription?canceled=true`,
        metadata: {
          userId,
          companyId: user.companyId,
          plan: plan.toLowerCase(),
        },
      });

      res.json({ checkoutUrl: session.url });
    } catch (error: any) {
      console.error("Error creating checkout session:", error);
      res.status(500).json({ message: error.message });
    }
  });

  // Update subscription plan (for manual changes and webhook processing)
  app.post("/api/subscription/change", isAuthenticated, async (req: any, res) => {
    try {
      const userId = req.user.uid;
      const { plan } = req.body;
      
      // Validate plan
      const validPlans = ['trial', 'starter', 'premium'];
      if (!validPlans.includes(plan.toLowerCase())) {
        return res.status(400).json({ message: "Invalid subscription plan" });
      }

      // Set product limits based on plan
      const productLimits = {
        trial: 5,
        starter: 100,
        premium: 1000
      };

      const user = await storage.getUser(userId);
      if (!user || !user.company) {
        return res.status(400).json({ message: "User company information not found" });
      }

      // Update company subscription plan
      await storage.updateCompanySubscription(user.companyId, {
        subscriptionPlan: plan.toLowerCase(),
        productLimit: productLimits[plan.toLowerCase() as keyof typeof productLimits]
      });

      res.json({ 
        message: `Successfully changed to ${plan} plan`,
        plan: plan.toLowerCase(),
        productLimit: productLimits[plan.toLowerCase() as keyof typeof productLimits]
      });
    } catch (error: any) {
      console.error("Error changing subscription plan:", error);
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