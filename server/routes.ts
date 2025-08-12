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
      
      // Send initial progress using Server-Sent Events
      res.writeHead(200, {
        'Content-Type': 'text/event-stream',
        'Cache-Control': 'no-cache',
        'Connection': 'keep-alive',
        'Access-Control-Allow-Origin': '*',
        'Access-Control-Allow-Headers': 'Cache-Control'
      });
      
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
      
      while (hasMorePages && allProducts.length < productLimit) {
        console.log(`Fetching page ${page} of products...`);
        const productsResponse = await bigcommerce.getProducts(page, 50);
        const pageProducts = Array.isArray(productsResponse) ? productsResponse : productsResponse.products || [];
        
        // Only add products up to the limit
        const remainingSlots = productLimit - allProducts.length;
        const productsToAdd = pageProducts.slice(0, remainingSlots);
        allProducts.push(...productsToAdd);
        
        // Update fetching progress
        const fetchProgress = 10 + Math.round((allProducts.length / effectiveLimit) * 30);
        sendProgress('fetching', fetchProgress, 100, `Fetched ${allProducts.length}/${effectiveLimit} products`);
        
        // Check if there are more pages and we haven't hit our limit
        const total = productsResponse.total || 0;
        const currentCount = page * 50;
        hasMorePages = currentCount < total && allProducts.length < productLimit;
        page++;
      }

      // Check if user was limited
      const isLimited = allProducts.length >= productLimit;

      console.log(`Syncing ${allProducts.length} products for user ${userId} (limited by ${subscriptionPlan} plan)`);

      sendProgress('processing', 40, 100, 'Preparing to sync products to database...');

      // Clear existing products for this user before syncing new ones
      await storage.clearUserProducts(userId);
      
      sendProgress('processing', 50, 100, 'Cleared existing products');

      // Store products and their variants in database
      for (let i = 0; i < allProducts.length; i++) {
        const product = allProducts[i];
        
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

          // Fetch and store variants for this product
          try {
            const variants = await bigcommerce.getProductVariants(product.id);
            console.log(`Found ${variants.length} variants for product ${product.id}`);
            
            for (const variant of variants) {
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
          } catch (variantError) {
            console.error(`Error fetching/storing variants for product ${product.id}:`, variantError);
            // Don't fail the entire sync if variants fail
          }
          
          // Update progress
          const processProgress = 50 + Math.round(((i + 1) / allProducts.length) * 40);
          sendProgress('processing', processProgress, 100, `Processed ${i + 1}/${allProducts.length} products`);
          
        } catch (productError) {
          console.error(`Error storing product ${product.id}:`, productError);
        }
      }

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
      
    } catch (error: any) {
      console.error("Error in /api/sync:", error);
      res.write(`error: ${JSON.stringify({ message: error.message })}\n\n`);
      res.end();
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
        starter: { priceId: 'price_starter', amount: 1000, limit: 100 }, // $10.00
        premium: { priceId: 'price_premium', amount: 2000, limit: 1000 } // $20.00
      };

      const selectedPlan = planDetails[plan.toLowerCase() as keyof typeof planDetails];

      // Create Stripe checkout session configuration
      const sessionConfig: any = {
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