import { WorkOrder } from "@shared/schema";
import { storage } from "../storage";
import { BigCommerceService } from "./bigcommerce";
import * as cron from "node-cron";

class SchedulerService {
  private scheduledJobs = new Map<string, cron.ScheduledTask>();

  async init() {
    // Restore scheduled work orders on startup
    console.log('Initializing scheduler...');
    const pendingWorkOrders = await storage.getPendingWorkOrders();
    console.log(`Found ${pendingWorkOrders.length} pending work orders`);
    
    for (const workOrder of pendingWorkOrders) {
      console.log(`Processing work order ${workOrder.id}: executeImmediately=${workOrder.executeImmediately}, scheduledAt=${workOrder.scheduledAt}`);
      
      if (workOrder.executeImmediately) {
        console.log(`Executing work order ${workOrder.id} immediately`);
        this.executeWorkOrder(workOrder.id);
      } else if (workOrder.scheduledAt) {
        const scheduledTime = new Date(workOrder.scheduledAt);
        const now = new Date();
        
        if (scheduledTime > now) {
          console.log(`Scheduling work order ${workOrder.id} for ${scheduledTime.toISOString()}`);
          this.scheduleWorkOrder(workOrder);
        } else {
          console.log(`Work order ${workOrder.id} is overdue, executing immediately`);
          this.executeWorkOrder(workOrder.id);
        }
      } else {
        console.log(`Work order ${workOrder.id} has no execution plan, skipping`);
      }
    }
    
    console.log('Scheduler initialization complete');
  }

  scheduleWorkOrder(workOrder: WorkOrder) {
    if (workOrder.executeImmediately) {
      // Execute immediately
      setImmediate(() => this.executeWorkOrder(workOrder.id));
      return;
    }

    if (!workOrder.scheduledAt) {
      return;
    }

    const scheduledTime = new Date(workOrder.scheduledAt);
    if (scheduledTime <= new Date()) {
      // If scheduled time is in the past, execute immediately
      setImmediate(() => this.executeWorkOrder(workOrder.id));
      return;
    }

    // Cancel existing job if it exists
    if (this.scheduledJobs.has(workOrder.id)) {
      this.scheduledJobs.get(workOrder.id)?.stop();
      this.scheduledJobs.delete(workOrder.id);
    }

    // Calculate cron expression
    const cronExpression = this.dateToCron(scheduledTime);
    
    const task = cron.schedule(cronExpression, async () => {
      await this.executeWorkOrder(workOrder.id);
      this.scheduledJobs.delete(workOrder.id);
    });

    this.scheduledJobs.set(workOrder.id, task);
    task.start();

    console.log(`Work order ${workOrder.id} scheduled for ${scheduledTime.toISOString()}`);
  }

  async executeWorkOrder(workOrderId: string) {
    try {
      console.log(`Executing work order ${workOrderId}`);
      
      // Get all work orders to find the specific one (we need userId)
      const allWorkOrders = await storage.getPendingWorkOrders();
      const workOrder = allWorkOrders.find(wo => wo.id === workOrderId);
      
      if (!workOrder) {
        console.error(`Work order ${workOrderId} not found`);
        return;
      }
      
      console.log(`Found work order: ${JSON.stringify({ id: workOrder.id, createdBy: workOrder.createdBy, companyId: workOrder.companyId })}`);

      if (workOrder.status !== "pending") {
        console.log(`Work order ${workOrderId} is not pending, skipping`);
        return;
      }

      // Update status to executing
      await storage.updateWorkOrder(workOrder.createdBy, workOrderId, { 
        status: "executing" 
      });

      // Get API settings for this user
      const apiSettings = await storage.getApiSettings(workOrder.createdBy);
      if (!apiSettings) {
        throw new Error("API settings not configured for this user");
      }

      const bigcommerce = new BigCommerceService(apiSettings);

      // Process each product/variant update
      for (const update of workOrder.productUpdates) {
        try {
          if (update.variantId) {
            // Handle variant update
            const updateData: any = {};
            if (update.newRegularPrice) {
              updateData.regularPrice = update.newRegularPrice;
            }
            if (update.newSalePrice) {
              updateData.salePrice = update.newSalePrice;
            }

            console.log(`Work Order - Updating variant ${update.variantId} of product ${update.productId} in BigCommerce with:`, updateData);
            await bigcommerce.updateProduct(update.productId, updateData, update.variantId);
            console.log(`Work Order - Successfully updated variant ${update.variantId} in BigCommerce`);
          } else {
            // Handle product update
            const updateData: any = {};
            if (update.newRegularPrice) {
              updateData.regularPrice = update.newRegularPrice;
            }
            if (update.newSalePrice) {
              updateData.salePrice = update.newSalePrice;
            }

            console.log(`Work Order - Updating product ${update.productId} in BigCommerce with:`, updateData);
            await bigcommerce.updateProduct(update.productId, updateData);
            console.log(`Work Order - Successfully updated product ${update.productId} in BigCommerce`);
          }
          
          if (update.variantId) {
            // Handle variant price tracking and history
            const currentVariant = await storage.getProductVariant(workOrder.createdBy, update.variantId);
            if (currentVariant) {
              // Update variant in our database
              await storage.updateProductVariant(workOrder.createdBy, update.variantId, {
                regularPrice: update.newRegularPrice || undefined,
                salePrice: update.newSalePrice || undefined,
              });

              // Create price history entry for variant
              const hasRegularPriceChange = update.newRegularPrice && update.newRegularPrice !== currentVariant.regularPrice;
              const hasSalePriceChange = update.newSalePrice !== undefined && update.newSalePrice !== currentVariant.salePrice;

              if (hasRegularPriceChange || hasSalePriceChange) {
                console.log(`Work Order - Creating price history entry for variant ${update.variantId}`);
                await storage.createPriceHistory(workOrder.createdBy, {
                  productId: update.productId,
                  variantId: update.variantId,
                  companyId: workOrder.companyId,
                  oldRegularPrice: hasRegularPriceChange ? currentVariant.regularPrice : undefined,
                  newRegularPrice: hasRegularPriceChange ? update.newRegularPrice : undefined,
                  oldSalePrice: hasSalePriceChange ? (currentVariant.salePrice || null) : undefined,
                  newSalePrice: hasSalePriceChange ? (update.newSalePrice || null) : undefined,
                  changeType: 'work_order',
                  workOrderId: workOrder.id,
                });
              }
            }
          } else {
            // Handle product price tracking and history
            const currentProduct = await storage.getProduct(workOrder.createdBy, update.productId);
            if (currentProduct) {
              // Update product in our database (skip automatic price history)
              await storage.updateProduct(workOrder.createdBy, update.productId, {
                regularPrice: update.newRegularPrice || undefined,
                salePrice: update.newSalePrice || undefined,
              }, true);

              // Create price history entry specifically for work order
              const hasRegularPriceChange = update.newRegularPrice && update.newRegularPrice !== currentProduct.regularPrice;
              const hasSalePriceChange = update.newSalePrice !== undefined && update.newSalePrice !== currentProduct.salePrice;

              if (hasRegularPriceChange || hasSalePriceChange) {
                console.log(`Work Order - Creating price history entry for product ${update.productId}`);
                await storage.createPriceHistory(workOrder.createdBy, {
                  productId: update.productId,
                  companyId: workOrder.companyId,
                  oldRegularPrice: hasRegularPriceChange ? currentProduct.regularPrice : undefined,
                  newRegularPrice: hasRegularPriceChange ? update.newRegularPrice : undefined,
                  oldSalePrice: hasSalePriceChange ? (currentProduct.salePrice || null) : undefined,
                  newSalePrice: hasSalePriceChange ? (update.newSalePrice || null) : undefined,
                  changeType: 'work_order',
                  workOrderId: workOrder.id,
                });
              }
            }
          }

          console.log(`Updated product ${update.productId}`);
        } catch (error) {
          console.error(`Failed to update product ${update.productId}:`, error);
        }
      }

      // Mark as completed
      await storage.updateWorkOrder(workOrder.createdBy, workOrderId, {
        status: "completed",
        executedAt: new Date(),
      });

      console.log(`Work order ${workOrderId} completed successfully`);
    } catch (error: any) {
      console.error(`Work order ${workOrderId} failed:`, error);
      
      // Try to update status to failed
      try {
        const allWorkOrders = await storage.getPendingWorkOrders();
        const workOrder = allWorkOrders.find(wo => wo.id === workOrderId);
        if (workOrder) {
          await storage.updateWorkOrder(workOrder.createdBy, workOrderId, {
            status: "failed",
            error: error.message,
            executedAt: new Date(),
          });
        }
      } catch (updateError) {
        console.error(`Failed to update work order status:`, updateError);
      }
    }
  }

  private dateToCron(date: Date): string {
    const minute = date.getMinutes();
    const hour = date.getHours();
    const day = date.getDate();
    const month = date.getMonth() + 1; // months are 0-indexed
    return `${minute} ${hour} ${day} ${month} *`;
  }

  cancelWorkOrder(workOrderId: string) {
    if (this.scheduledJobs.has(workOrderId)) {
      this.scheduledJobs.get(workOrderId)?.stop();
      this.scheduledJobs.delete(workOrderId);
      console.log(`Cancelled work order ${workOrderId}`);
    }
  }
}

export const scheduler = new SchedulerService();