import type { Express } from "express";
import { createServer, type Server } from "http";
import { storage } from "./storage";
import { insertApiSettingsSchema, insertWorkOrderSchema, insertCompanyInvitationSchema } from "@shared/schema";
import { randomBytes } from "crypto";
import { BigCommerceService } from "./services/bigcommerce";
import { scheduler } from "./services/scheduler";
import { isAuthenticated } from "./firebaseAuth";
import { sendInvitationEmail } from "./services/email";
import Stripe from "stripe";

// Initialize Stripe
const stripe = new Stripe(process.env.STRIPE_SECRET_KEY!, {
  apiVersion: "2025-07-30.basil",
});

// Track active sync operations
const activeSyncs = new Map<string, { controller: AbortController; response: any }>();

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
      
      // Fetch company info if user has a companyId
      let userWithCompany = user;
      if (user.companyId) {
        const company = await storage.getCompany(user.companyId);
        userWithCompany = { ...user, company };
      }
      
      res.json(userWithCompany);
    } catch (error) {
      console.error("Error fetching user:", error);
      res.status(500).json({ message: "Failed to fetch user" });
    }
  });

  // Mark walkthrough as complete
  app.post("/api/auth/user/walkthrough-complete", isAuthenticated, async (req: any, res) => {
    try {
      const userId = req.user.uid;
      await storage.markWalkthroughComplete(userId);
      res.json({ success: true });
    } catch (error) {
      console.error("Error marking walkthrough complete:", error);
      res.status(500).json({ message: "Failed to update walkthrough status" });
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

  app.get("/api/categories", isAuthenticated, async (req: any, res) => {
    try {
      const userId = req.user.uid;
      const categories = await storage.getAllCategories(userId);
      res.json(categories);
    } catch (error: any) {
      console.error("Error in /api/categories:", error);
      res.status(500).json({ message: error.message });
    }
  });

  // Dedicated sync endpoint for frontend
  // Cancel sync endpoint
  app.post("/api/sync/cancel", isAuthenticated, async (req: any, res) => {
    try {
      const userId = req.user.uid;
      const activeSync = activeSyncs.get(userId);
      
      if (activeSync) {
        activeSync.controller.abort();
        activeSyncs.delete(userId);
        
        // Send cancellation message and close the response
        try {
          activeSync.response.write(`data: ${JSON.stringify({
            stage: 'cancelled',
            current: 0,
            total: 100,
            percentage: 0,
            message: 'Sync cancelled by user'
          })}\n\n`);
          activeSync.response.end();
        } catch (e) {
          // Response may already be closed
        }
        
        res.json({ success: true, message: "Sync cancelled" });
      } else {
        res.status(400).json({ success: false, message: "No active sync found" });
      }
    } catch (error) {
      console.error("Error cancelling sync:", error);
      res.status(500).json({ success: false, message: "Failed to cancel sync" });
    }
  });

  app.post("/api/sync", isAuthenticated, async (req: any, res) => {
    try {
      const userId = req.user.uid;
      
      // Check if there's already an active sync for this user
      if (activeSyncs.has(userId)) {
        return res.status(409).json({ message: "Sync already in progress. Please cancel the current sync first." });
      }
      
      // Create abort controller for this sync
      const controller = new AbortController();
      
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
      
      // Send initial progress using Server-Sent Events
      res.writeHead(200, {
        'Content-Type': 'text/event-stream',
        'Cache-Control': 'no-cache',
        'Connection': 'keep-alive',
        'Access-Control-Allow-Origin': '*',
        'Access-Control-Allow-Headers': 'Cache-Control'
      });
      
      // Register this sync as active
      activeSyncs.set(userId, { controller, response: res });
      
      const sendProgress = (stage: string, current: number, total: number, message?: string) => {
        const progress = {
          stage,
          current,
          total,
          percentage: Math.round((current / total) * 100),
          message
        };
        res.write(`data: ${JSON.stringify(progress)}\n\n`);
      };

      // Start sync process
      sendProgress('fetching', 0, 100, 'Starting product sync...');
      
      // Fetch all products by paginating through all pages
      let allProducts: any[] = [];
      let page = 1;
      let hasMorePages = true;
      
      // Get total count first for accurate progress
      const totalAvailable = await bigcommerce.getProductCount();
      const effectiveLimit = Math.min(productLimit, totalAvailable);
      
      sendProgress('fetching', 10, 100, `Found ${totalAvailable} products in BigCommerce`);
      
      let allVariants: any[] = [];

      while (hasMorePages && allProducts.length < productLimit) {
        // Check if sync was cancelled
        if (controller.signal.aborted) {
          console.log('Sync cancelled during fetch phase');
          activeSyncs.delete(userId);
          return;
        }
        
        console.log(`Fetching page ${page} of products (current count: ${allProducts.length}/${productLimit})...`);
        
        try {
          const productsResponse = await bigcommerce.getProducts(page, 50);
          const pageProducts = Array.isArray(productsResponse) ? productsResponse : productsResponse.products || [];
          const pageVariants = productsResponse.variants || [];
          
          console.log(`Page ${page}: Got ${pageProducts.length} products and ${pageVariants.length} variants from API`);
          
          // Only add products up to the limit
          const remainingSlots = productLimit - allProducts.length;
          const productsToAdd = pageProducts.slice(0, remainingSlots);
          allProducts.push(...productsToAdd);
          
          // Add corresponding variants
          const addedProductIds = new Set(productsToAdd.map(p => p.id));
          const correspondingVariants = pageVariants.filter((v: any) => addedProductIds.has(v.productId));
          allVariants.push(...correspondingVariants);
          
          console.log(`Added ${productsToAdd.length} products and ${correspondingVariants.length} variants. Total: ${allProducts.length} products, ${allVariants.length} variants`);
          
          // Update fetching progress
          const fetchProgress = 10 + Math.round((allProducts.length / effectiveLimit) * 30);
          sendProgress('fetching', fetchProgress, 100, `Fetched ${allProducts.length}/${effectiveLimit} products with variants`);
          
          // Check if there are more pages and we haven't hit our limit
          const total = productsResponse.total || 0;
          const currentCount = page * 50;
          hasMorePages = currentCount < total && allProducts.length < productLimit;
          
          console.log(`Pagination check: currentCount=${currentCount}, total=${total}, hasMorePages=${hasMorePages}, allProducts.length=${allProducts.length}, productLimit=${productLimit}`);
          
          page++;
          
          // Stop if we got no products from this page
          if (pageProducts.length === 0) {
            console.log(`No products returned from page ${page - 1}, stopping pagination`);
            break;
          }
          
        } catch (error: any) {
          console.error(`Error fetching page ${page}:`, error);
          
          // Check if it's a rate limit or timeout error
          if (error.response?.status === 429) {
            console.log(`Rate limited on page ${page}, waiting 2 seconds before retrying...`);
            const currentProgress = 10 + Math.round((allProducts.length / effectiveLimit) * 30);
            sendProgress('fetching', currentProgress, 100, `Rate limited, waiting before retry...`);
            await new Promise(resolve => setTimeout(resolve, 2000));
            page--; // Retry the same page
            continue;
          }
          
          if (error.code === 'ECONNABORTED' || error.message?.includes('timeout')) {
            console.log(`Timeout on page ${page}, retrying once...`);
            const currentProgress = 10 + Math.round((allProducts.length / effectiveLimit) * 30);
            sendProgress('fetching', currentProgress, 100, `Request timeout, retrying...`);
            page--; // Retry the same page
            continue;
          }
          
          console.error(`Fatal error on page ${page}, stopping sync:`, error.message);
          sendProgress('error', 10, 100, `Error fetching products: ${error.message}`);
          break;
        }
      }

      // Check if user was limited
      const isLimited = allProducts.length >= productLimit;

      console.log(`Fetching complete. Got ${allProducts.length} products and ${allVariants.length} variants for user ${userId} (limit: ${productLimit}, plan: ${subscriptionPlan})`);
      
      if (allProducts.length === 0) {
        sendProgress('completed', 100, 100, 'No products found to sync');
        res.write(`data: ${JSON.stringify({ stage: 'completed', current: 100, total: 100, percentage: 100, message: 'Sync completed - no products found' })}\n\n`);
        res.end();
        return;
      }

      sendProgress('processing', 40, 100, 'Preparing to sync products to database...');

      // Clear existing products for this user before syncing new ones
      await storage.clearUserProducts(userId);
      
      sendProgress('processing', 50, 100, 'Cleared existing products');

      // Store products in database
      for (let i = 0; i < allProducts.length; i++) {
        // Check if sync was cancelled
        if (controller.signal.aborted) {
          console.log('Sync cancelled during product storage phase');
          activeSyncs.delete(userId);
          return;
        }
        
        const product = allProducts[i];
        
        try {
          // Use upsert logic to either create or update existing products
          const existingProduct = await storage.getProduct(userId, product.id);
          if (existingProduct) {
            // Update existing product
            await storage.updateProduct(userId, product.id, {
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
          } else {
            // Create new product
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
          }
          
          // Update progress
          const processProgress = 50 + Math.round(((i + 1) / allProducts.length) * 25);
          sendProgress('processing', processProgress, 100, `Processed ${i + 1}/${allProducts.length} products`);
          
        } catch (productError) {
          console.error(`Error storing product ${product.id}:`, productError);
        }
      }

      sendProgress('processing', 75, 100, `Storing ${allVariants.length} product variants...`);

      // Store all variants in database
      for (let i = 0; i < allVariants.length; i++) {
        // Check if sync was cancelled
        if (controller.signal.aborted) {
          console.log('Sync cancelled during variant storage phase');
          activeSyncs.delete(userId);
          return;
        }
        
        const variant = allVariants[i];
        
        try {
          // Use upsert logic for variants too
          const existingVariant = await storage.getProductVariant(userId, variant.id);
          if (existingVariant) {
            // Update existing variant
            await storage.updateProductVariant(userId, variant.id, {
              variantSku: variant.variantSku,
              regularPrice: variant.regularPrice,
              salePrice: variant.salePrice,
              stock: variant.stock,
              optionValues: variant.optionValues,
            });
          } else {
            // Create new variant
            await storage.createProductVariant(userId, {
              id: variant.id,
              productId: variant.productId,
              variantSku: variant.variantSku,
              regularPrice: variant.regularPrice,
              salePrice: variant.salePrice,
              stock: variant.stock,
              optionValues: variant.optionValues,
            });
          }
          
          // Update progress for variants
          if (i % 10 === 0 || i === allVariants.length - 1) {
            const variantProgress = 75 + Math.round(((i + 1) / allVariants.length) * 15);
            sendProgress('processing', variantProgress, 100, `Stored ${i + 1}/${allVariants.length} variants`);
          }
          
        } catch (variantError) {
          console.error(`Error storing variant ${variant.id}:`, variantError);
        }
      }

      console.log(`Successfully stored ${allProducts.length} products and ${allVariants.length} variants`);

      sendProgress('processing', 90, 100, 'Finalizing database updates...');

      // Update lastSyncAt in API settings
      await storage.updateApiSettingsLastSync(userId, new Date());
      
      sendProgress('completing', 95, 100, 'Finalizing sync...');

      // Create appropriate response message
      let message = `Successfully synced ${allProducts.length} products`;
      let warning = null;

      if (isLimited && totalAvailable > productLimit) {
        message = `Synced ${allProducts.length} products (limited by ${subscriptionPlan} plan)`;
        warning = `Your ${subscriptionPlan} plan allows up to ${productLimit} products. You have ${totalAvailable} products in your BigCommerce store. Upgrade your plan to sync more products.`;
      }

      // Send final progress
      sendProgress('complete', 100, 100, message);
      
      // End the stream with the final result
      res.write(`result: ${JSON.stringify({ 
        message,
        warning,
        count: allProducts.length,
        totalAvailable,
        productLimit,
        subscriptionPlan,
        isLimited
      })}\n\n`);
      
      res.end();
      
      // Clean up active sync
      activeSyncs.delete(req.user.uid);
      
    } catch (error: any) {
      console.error("Error in /api/sync:", error);
      
      // Clean up active sync on error
      activeSyncs.delete(req.user.uid);
      
      try {
        res.write(`error: ${JSON.stringify({ message: error.message })}\n\n`);
        res.end();
      } catch (writeError) {
        // Response may already be closed
        console.error("Error writing to response:", writeError);
      }
    } finally {
      // Ensure cleanup happens
      activeSyncs.delete(req.user.uid);
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

  app.put("/api/products/:id", isAuthenticated, async (req: any, res) => {
    try {
      const userId = req.user.uid;
      const productId = req.params.id;
      const { regularPrice, salePrice } = req.body;

      // Get current product to track price changes
      const currentProduct = await storage.getProduct(userId, productId);
      if (!currentProduct) {
        return res.status(404).json({ message: "Product not found" });
      }

      // Get API settings to update BigCommerce if configured
      const apiSettings = await storage.getApiSettings(userId);
      if (apiSettings && apiSettings.storeHash && apiSettings.accessToken) {
        try {
          const bigcommerce = new BigCommerceService({
            storeHash: apiSettings.storeHash,
            accessToken: apiSettings.accessToken,
            clientId: apiSettings.clientId
          });

          // Update product in BigCommerce
          const updateData: any = {};
          if (regularPrice !== undefined) updateData.regularPrice = regularPrice;
          if (salePrice !== undefined) updateData.salePrice = salePrice || null;

          console.log(`Updating product ${productId} in BigCommerce with:`, updateData);
          await bigcommerce.updateProduct(productId, updateData);
          console.log(`Successfully updated product ${productId} in BigCommerce`);
        } catch (error: any) {
          console.error("Failed to update product in BigCommerce:", error);
          return res.status(500).json({ message: "Failed to update product in BigCommerce: " + error.message });
        }
      }

      // Update product in local database (skip price history here since we create it below)
      const updateData: any = {};
      if (regularPrice !== undefined) updateData.regularPrice = regularPrice;
      if (salePrice !== undefined) updateData.salePrice = salePrice || null;

      const updatedProduct = await storage.updateProduct(userId, productId, updateData, true);
      
      // Record price history
      const hasRegularPriceChange = regularPrice !== undefined && regularPrice !== currentProduct.regularPrice;
      const hasSalePriceChange = salePrice !== undefined && (salePrice || null) !== (currentProduct.salePrice || null);
      
      if (hasRegularPriceChange || hasSalePriceChange) {
        await storage.createPriceHistory(userId, {
          productId,
          companyId: currentProduct.companyId,
          oldRegularPrice: hasRegularPriceChange ? currentProduct.regularPrice : undefined,
          newRegularPrice: hasRegularPriceChange ? regularPrice : undefined,
          oldSalePrice: hasSalePriceChange ? (currentProduct.salePrice || null) : undefined,
          newSalePrice: hasSalePriceChange ? (salePrice || null) : undefined,
          changeType: 'manual',
        });
      }

      console.log(`Updated product ${productId}`);
      res.json(updatedProduct);
    } catch (error: any) {
      console.error("Error updating product:", error);
      res.status(500).json({ message: error.message });
    }
  });

  app.get("/api/products/:id/price-history", isAuthenticated, async (req: any, res) => {
    try {
      const userId = req.user.uid;
      const productId = req.params.id;
      
      // Verify product exists and user has access
      const product = await storage.getProduct(userId, productId);
      if (!product) {
        return res.status(404).json({ message: "Product not found" });
      }
      
      const history = await storage.getProductPriceHistory(userId, productId);
      res.json(history);
    } catch (error: any) {
      res.status(500).json({ message: error.message });
    }
  });

  // Product Variants endpoints
  app.get("/api/products/:id/variants", isAuthenticated, async (req: any, res) => {
    try {
      const userId = req.user.uid;
      const productId = req.params.id;
      
      const variants = await storage.getProductVariants(userId, productId);
      res.json(variants);
    } catch (error: any) {
      console.error("Error fetching product variants:", error);
      res.status(500).json({ message: error.message });
    }
  });

  app.put("/api/variants/:id", isAuthenticated, async (req: any, res) => {
    try {
      const userId = req.user.uid;
      const variantId = req.params.id;
      const { regularPrice, salePrice } = req.body;

      // Get current variant to track price changes
      const currentVariant = await storage.getProductVariant(userId, variantId);
      if (!currentVariant) {
        return res.status(404).json({ message: "Product variant not found" });
      }

      // Update variant
      const updateData: any = {};
      if (regularPrice !== undefined) updateData.regularPrice = regularPrice;
      if (salePrice !== undefined) updateData.salePrice = salePrice || null;

      const updatedVariant = await storage.updateProductVariant(userId, variantId, updateData);
      
      console.log(`Updated variant ${variantId}`);
      res.json(updatedVariant);
    } catch (error: any) {
      console.error("Error updating product variant:", error);
      res.status(500).json({ message: error.message });
    }
  });

  // Debug endpoint to check BigCommerce categories
  app.get('/api/debug-categories', isAuthenticated, async (req: any, res) => {
    try {
      const user = await storage.getUser(req.user.uid);
      if (!user) {
        return res.status(404).json({ message: 'User not found' });
      }

      const settings = await storage.getApiSettings(user.companyId);
      if (!settings) {
        return res.status(400).json({ message: 'BigCommerce settings not configured' });
      }

      const bigCommerce = new BigCommerceService(
        settings.storeHash,
        settings.accessToken
      );

      // Get all categories from BigCommerce
      const categoriesResponse = await bigCommerce.api.get('/catalog/categories');
      const allCategories = categoriesResponse.data.data;
      
      // Filter for categories with "Mini" or "Bobcat"
      const miniCategories = allCategories.filter((cat: any) => 
        cat.name.toLowerCase().includes('mini') || cat.name.toLowerCase().includes('bobcat')
      );
      
      // Filter for all attachment categories
      const attachmentCategories = allCategories.filter((cat: any) => 
        cat.name.toLowerCase().includes('attachment') || cat.parent_id === 24
      );

      res.json({
        totalCategories: allCategories.length,
        miniCategories: miniCategories.map((cat: any) => ({
          id: cat.id,
          name: cat.name,
          parent_id: cat.parent_id
        })),
        attachmentCategories: attachmentCategories.map((cat: any) => ({
          id: cat.id,
          name: cat.name,
          parent_id: cat.parent_id
        })),
        allCategoryNames: allCategories.map((cat: any) => cat.name).sort()
      });
    } catch (error: any) {
      console.error('Debug categories error:', error);
      res.status(500).json({ 
        message: 'Failed to fetch categories',
        error: error.message 
      });
    }
  });

  // Work Orders routes
  app.get("/api/work-orders", isAuthenticated, async (req: any, res) => {
    try {
      const userId = req.user.uid;
      const includeArchived = req.query.includeArchived === 'true';
      const workOrders = await storage.getWorkOrders(userId, includeArchived);
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

  app.patch("/api/work-orders/:id/archive", isAuthenticated, async (req: any, res) => {
    try {
      const userId = req.user.uid;
      const workOrder = await storage.archiveWorkOrder(userId, req.params.id);
      if (!workOrder) {
        return res.status(404).json({ message: "Work order not found" });
      }
      res.json({ message: "Work order archived successfully", workOrder });
    } catch (error: any) {
      res.status(500).json({ message: error.message });
    }
  });

  app.post("/api/work-orders/:id/undo", isAuthenticated, async (req: any, res) => {
    try {
      const userId = req.user.uid;
      const workOrderId = req.params.id;
      
      const user = await storage.getUser(userId);
      if (!user) {
        return res.status(404).json({ message: "User not found" });
      }

      // Get the work order
      const workOrder = await storage.getWorkOrder(userId, workOrderId);
      if (!workOrder) {
        return res.status(404).json({ message: "Work order not found" });
      }

      if (workOrder.status !== "completed") {
        return res.status(400).json({ message: "Can only undo completed work orders" });
      }

      // Get price history entries created by this work order
      const priceHistories = await storage.getPriceHistoryByWorkOrder(userId, workOrderId);
      if (!priceHistories || priceHistories.length === 0) {
        return res.status(400).json({ message: "No price changes found for this work order" });
      }

      // Revert each price change
      let revertedCount = 0;
      for (const history of priceHistories) {
        try {
          const product = await storage.getProduct(userId, history.productId);
          if (!product) {
            console.log(`Product ${history.productId} not found, skipping revert`);
            continue;
          }

          // Revert to old prices
          const updateData: any = {};
          if (history.oldRegularPrice !== undefined) {
            updateData.regularPrice = history.oldRegularPrice;
          }
          if (history.oldSalePrice !== undefined) {
            updateData.salePrice = history.oldSalePrice;
          }

          await storage.updateProduct(userId, history.productId, updateData, true);

          // Create a new price history entry for the revert
          await storage.createPriceHistory(userId, {
            productId: history.productId,
            companyId: user.companyId,
            oldRegularPrice: history.newRegularPrice,
            newRegularPrice: history.oldRegularPrice,
            oldSalePrice: history.newSalePrice,
            newSalePrice: history.oldSalePrice,
            changeType: 'undo',
            workOrderId: undefined, // This is a revert, not from a work order
          });

          revertedCount++;
        } catch (error: any) {
          console.error(`Error reverting product ${history.productId}:`, error);
        }
      }

      // Mark the work order as undone
      await storage.updateWorkOrder(userId, workOrderId, { 
        status: 'undone',
        error: null,
        undoneAt: new Date()
      });

      res.json({ 
        message: `Successfully reverted ${revertedCount} products`,
        revertedCount 
      });

    } catch (error: any) {
      console.error("Error undoing work order:", error);
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
      const { plan, couponCode } = req.body;
      
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
        starter: { priceId: 'price_1RvINwCQT46XbXAbXRC4YdQz', amount: 500, limit: 100 }, // $5.00
        premium: { priceId: 'price_1RvIOWCQT46XbXAb4c0bniaE', amount: 1000, limit: 1000 } // $10.00
      };

      const selectedPlan = planDetails[plan.toLowerCase() as keyof typeof planDetails];

      // Create Stripe checkout session configuration
      const sessionConfig: any = {
        payment_method_types: ['card'],
        line_items: [
          {
            price: selectedPlan.priceId,
            quantity: 1,
          },
        ],
        mode: 'subscription',
        success_url: `${req.protocol}://${req.get('host')}/thank-you?plan=${plan}`,
        cancel_url: `${req.protocol}://${req.get('host')}/subscription?canceled=true`,
        metadata: {
          userId,
          companyId: user.companyId,
          plan: plan.toLowerCase(),
        },
        allow_promotion_codes: true, // Enable promotion codes in Stripe checkout
      };

      // Add coupon if provided
      if (couponCode && couponCode.trim()) {
        try {
          // Validate coupon exists in Stripe
          const coupon = await stripe.coupons.retrieve(couponCode.trim());
          sessionConfig.discounts = [{
            coupon: couponCode.trim()
          }];
        } catch (couponError: any) {
          console.log("Invalid coupon code:", couponCode, couponError.message);
          return res.status(400).json({ 
            message: "Invalid coupon code. Please check the code and try again." 
          });
        }
      }

      const session = await stripe.checkout.sessions.create(sessionConfig);

      res.json({ checkoutUrl: session.url || '' });
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

  // Cancel subscription endpoint
  app.post("/api/subscription/cancel", isAuthenticated, async (req: any, res) => {
    try {
      const userId = req.user.uid;
      
      const user = await storage.getUser(userId);
      if (!user || !user.company) {
        return res.status(400).json({ message: "User company information not found" });
      }

      const company = user.company;
      
      // Only allow cancellation for paid plans
      if (company.subscriptionPlan === 'trial') {
        return res.status(400).json({ message: "Trial plan cannot be cancelled" });
      }

      // If there's a Stripe subscription ID, cancel it
      if (company.stripeSubscriptionId) {
        try {
          // Cancel the subscription at period end to maintain access until billing cycle ends
          await stripe.subscriptions.update(company.stripeSubscriptionId, {
            cancel_at_period_end: true,
            metadata: {
              cancelled_by_user: 'true',
              cancelled_at: new Date().toISOString(),
              user_id: userId
            }
          });

          // Update company to reflect the cancellation pending status - only update supported fields
          await storage.updateCompanySubscription(user.companyId!, {
            subscriptionPlan: company.subscriptionPlan, // Keep current plan until cancellation is effective
            productLimit: company.productLimit || 5
          });

          res.json({ 
            message: "Subscription scheduled for cancellation at the end of your billing period",
            cancellationEffectiveDate: "end of current billing period"
          });
        } catch (stripeError: any) {
          console.error("Error cancelling Stripe subscription:", stripeError);
          
          // Fallback: downgrade to trial immediately if Stripe fails
          await storage.updateCompanySubscription(user.companyId, {
            subscriptionPlan: 'trial',
            productLimit: 5
          });

          res.json({ 
            message: "Subscription cancelled and downgraded to Trial plan",
            plan: "trial",
            productLimit: 5
          });
        }
      } else {
        // No Stripe subscription ID, just downgrade to trial
        await storage.updateCompanySubscription(user.companyId, {
          subscriptionPlan: 'trial',
          productLimit: 5
        });

        res.json({ 
          message: "Subscription cancelled and downgraded to Trial plan",
          plan: "trial",
          productLimit: 5
        });
      }
    } catch (error: any) {
      console.error("Error cancelling subscription:", error);
      res.status(500).json({ message: "Failed to cancel subscription. Please contact support." });
    }
  });



  // Company Invitation routes
  app.post("/api/invitations", isAuthenticated, async (req: any, res) => {
    try {
      const userId = req.user.uid;
      const validatedData = insertCompanyInvitationSchema.parse(req.body);
      
      const user = await storage.getUser(userId);
      if (!user?.companyId) {
        return res.status(400).json({ message: "User not associated with a company" });
      }

      // Check if user has permission to invite (must be admin or owner)
      if (user.role !== 'admin' && user.role !== 'owner') {
        return res.status(403).json({ message: "Only company admins and owners can send invitations" });
      }

      // Generate secure token
      const token = randomBytes(32).toString('hex');
      const expiresAt = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000); // 7 days

      const invitation = await storage.createInvitation({
        companyId: user.companyId,
        email: validatedData.email,
        role: validatedData.role || 'member',
        invitedBy: userId,
        token,
        expiresAt,
      });

      // Get company information for email
      const company = await storage.getCompany(user.companyId);
      const inviterName = user.firstName && user.lastName 
        ? `${user.firstName} ${user.lastName}` 
        : user.email || 'A team member';
      
      // Create invitation URL (you'll need to adjust the domain for production)
      const baseUrl = process.env.NODE_ENV === 'production' 
        ? 'https://your-production-domain.com' 
        : 'http://localhost:5000';
      const invitationUrl = `${baseUrl}/accept-invitation?token=${token}`;

      // Send invitation email
      const emailSent = await sendInvitationEmail({
        to: validatedData.email,
        inviterName,
        companyName: company?.name || 'Your Company',
        role: validatedData.role || 'member',
        invitationUrl,
      });

      if (!emailSent) {
        console.warn(`Failed to send invitation email to ${validatedData.email}`);
      }

      res.json({ 
        message: "Invitation sent successfully",
        emailSent,
        invitation: {
          id: invitation.id,
          email: invitation.email,
          role: invitation.role,
          status: invitation.status,
          createdAt: invitation.createdAt
        }
      });
    } catch (error: any) {
      if (error.name === 'ZodError') {
        return res.status(400).json({ message: "Invalid invitation data", errors: error.issues });
      }
      console.error("Error creating invitation:", error);
      res.status(500).json({ message: error.message });
    }
  });

  // Get company invitations (for admin/owner view)
  app.get("/api/invitations", isAuthenticated, async (req: any, res) => {
    try {
      const userId = req.user.uid;
      const user = await storage.getUser(userId);
      
      if (!user?.companyId) {
        return res.status(400).json({ message: "User not associated with a company" });
      }

      const invitations = await storage.getCompanyInvitations(user.companyId);
      res.json(invitations);
    } catch (error: any) {
      console.error("Error fetching invitations:", error);
      res.status(500).json({ message: error.message });
    }
  });

  // Get pending invitations for current user's email
  app.get("/api/my-invitations", isAuthenticated, async (req: any, res) => {
    try {
      const userEmail = req.user.email;
      const invitations = await storage.getUserInvitations(userEmail);
      
      // Add company names to invitations
      const invitationsWithCompany = await Promise.all(
        invitations.map(async (invitation) => {
          const company = await storage.getCompany(invitation.companyId);
          return {
            ...invitation,
            companyName: company?.name || 'Unknown Company'
          };
        })
      );
      
      res.json(invitationsWithCompany);
    } catch (error: any) {
      console.error("Error fetching user invitations:", error);
      res.status(500).json({ message: error.message });
    }
  });

  // Get invitation details by token (public endpoint for email links)
  app.get("/api/invitations/:token", async (req: any, res) => {
    try {
      const { token } = req.params;
      const invitation = await storage.getInvitationByToken(token);
      
      if (!invitation) {
        return res.status(404).json({ message: "Invitation not found or expired" });
      }

      // Get company info for display
      const company = await storage.getCompany(invitation.companyId);
      
      res.json({
        invitation: {
          id: invitation.id,
          companyName: company?.name || 'Unknown Company',
          email: invitation.email,
          role: invitation.role,
          status: invitation.status,
          expiresAt: invitation.expiresAt,
          inviterEmail: invitation.invitedBy, // You might want to get the actual email
        }
      });
    } catch (error: any) {
      console.error("Error fetching invitation details:", error);
      res.status(500).json({ message: error.message });
    }
  });

  // Accept invitation from Team page (user must be logged in and manually accept)
  app.post("/api/invitations/:id/accept", isAuthenticated, async (req: any, res) => {
    try {
      const { id } = req.params;
      const userId = req.user.uid;
      
      const invitation = await storage.getInvitationById(id);
      if (!invitation) {
        return res.status(404).json({ message: "Invitation not found" });
      }

      if (invitation.status !== 'pending') {
        return res.status(400).json({ message: "Invitation has already been processed" });
      }

      if (invitation.expiresAt < new Date()) {
        return res.status(400).json({ message: "Invitation has expired" });
      }

      if (invitation.email !== req.user.email) {
        return res.status(403).json({ message: "You can only accept invitations sent to your email" });
      }

      // Update user's company and role
      await storage.updateUserCompany(userId, invitation.companyId, invitation.role || 'member');
      
      // Mark invitation as accepted
      await storage.updateInvitationStatus(invitation.token, 'accepted');

      res.json({ message: "Invitation accepted successfully" });
    } catch (error: any) {
      console.error("Error accepting invitation:", error);
      res.status(500).json({ message: error.message });
    }
  });

  app.delete("/api/invitations/:id", isAuthenticated, async (req: any, res) => {
    try {
      const { id } = req.params;
      const userId = req.user.uid;
      
      const user = await storage.getUser(userId);
      if (!user?.companyId) {
        return res.status(400).json({ message: "User not associated with a company" });
      }

      if (user.role !== 'admin' && user.role !== 'owner') {
        return res.status(403).json({ message: "Only company admins and owners can cancel invitations" });
      }

      await storage.deleteInvitation(id);
      res.json({ message: "Invitation cancelled successfully" });
    } catch (error: any) {
      console.error("Error deleting invitation:", error);
      res.status(500).json({ message: error.message });
    }
  });

  app.get("/api/company/users", isAuthenticated, async (req: any, res) => {
    try {
      const userId = req.user.uid;
      const user = await storage.getUser(userId);
      
      if (!user?.companyId) {
        return res.status(400).json({ message: "User not associated with a company" });
      }

      const users = await storage.getCompanyUsers(user.companyId);
      res.json(users);
    } catch (error: any) {
      console.error("Error fetching company users:", error);
      res.status(500).json({ message: error.message });
    }
  });

  // Update company name (owner only)
  app.put("/api/company/name", isAuthenticated, async (req: any, res) => {
    try {
      const userId = req.user.uid;
      const user = await storage.getUser(userId);
      const { name } = req.body;
      
      if (!user?.companyId) {
        return res.status(400).json({ message: "User not associated with a company" });
      }

      if (user.role !== 'owner' && user.role !== 'admin') {
        return res.status(403).json({ message: "Only company owners and admins can change the company name" });
      }

      if (!name || name.trim().length === 0) {
        return res.status(400).json({ message: "Company name is required" });
      }

      await storage.updateCompanyName(user.companyId, name.trim());
      res.json({ message: "Company name updated successfully" });
    } catch (error: any) {
      console.error("Error updating company name:", error);
      res.status(500).json({ message: error.message });
    }
  });

  // Remove team member (admin/owner only)
  app.delete("/api/company/users/:userId", isAuthenticated, async (req: any, res) => {
    try {
      const currentUserId = req.user.uid;
      const { userId } = req.params;
      const currentUser = await storage.getUser(currentUserId);
      const targetUser = await storage.getUser(userId);
      
      if (!currentUser?.companyId) {
        return res.status(400).json({ message: "User not associated with a company" });
      }

      if (!['admin', 'owner'].includes(currentUser.role || '')) {
        return res.status(403).json({ message: "Only admins and owners can remove team members" });
      }

      if (!targetUser || targetUser.companyId !== currentUser.companyId) {
        return res.status(404).json({ message: "User not found in your company" });
      }

      if (targetUser.role === 'owner') {
        return res.status(403).json({ message: "Cannot remove the company owner" });
      }

      if (currentUserId === userId) {
        return res.status(400).json({ message: "You cannot remove yourself" });
      }

      await storage.removeUserFromCompany(userId);
      res.json({ message: "User removed from company successfully" });
    } catch (error: any) {
      console.error("Error removing user from company:", error);
      res.status(500).json({ message: error.message });
    }
  });

  // Initialize scheduler to restore pending work orders
  scheduler.init().catch(console.error);

  const httpServer = createServer(app);
  return httpServer;
}