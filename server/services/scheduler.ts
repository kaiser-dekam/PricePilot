import { WorkOrder } from "@shared/schema";
import { storage } from "../storage";
import { BigCommerceService } from "./bigcommerce";
import * as cron from "node-cron";

class SchedulerService {
  private scheduledJobs = new Map<string, cron.ScheduledTask>();

  async init() {
    // Restore scheduled work orders on startup
    const pendingWorkOrders = await storage.getPendingWorkOrders();
    for (const workOrder of pendingWorkOrders) {
      if (workOrder.scheduledAt && new Date(workOrder.scheduledAt) > new Date()) {
        this.scheduleWorkOrder(workOrder);
      } else if (workOrder.executeImmediately) {
        this.scheduleImmediateExecution(workOrder);
      }
    }
  }

  scheduleWorkOrder(workOrder: WorkOrder) {
    if (workOrder.executeImmediately) {
      // Execute immediately
      setImmediate(() => this.executeWorkOrder(workOrder));
      return;
    }

    if (!workOrder.scheduledAt) {
      return;
    }

    const scheduledTime = new Date(workOrder.scheduledAt);
    if (scheduledTime <= new Date()) {
      // If scheduled time is in the past, execute immediately
      setImmediate(() => this.executeWorkOrder(workOrder));
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
      await this.executeWorkOrder(workOrder);
      this.scheduledJobs.delete(workOrder.id);
    });

    this.scheduledJobs.set(workOrder.id, task);
    task.start();

    console.log(`Work order ${workOrder.id} scheduled for ${scheduledTime.toISOString()}`);
  }

  scheduleImmediateExecution(workOrder: WorkOrder) {
    setImmediate(() => this.executeWorkOrder(workOrder));
  }

  async executeWorkOrder(workOrder: WorkOrder): Promise<void> {
    try {
      console.log(`Executing work order: ${workOrder.id}`);
      
      // Update status to executing
      await storage.updateWorkOrder(workOrder.companyId, workOrder.id, {
        status: "executing"
      });

      // Get API settings for the company
      const apiSettings = await storage.getApiSettings(workOrder.companyId);
      if (!apiSettings) {
        throw new Error("No API settings found for company");
      }

      const bigcommerce = new BigCommerceService(apiSettings);

      // Capture original prices before making changes
      const originalPrices = [];
      for (const update of workOrder.productUpdates) {
        try {
          const product = await storage.getProduct(workOrder.companyId, update.productId);
          if (product) {
            const originalPrice = {
              productId: update.productId,
              originalRegularPrice: product.regularPrice || "0",
              originalSalePrice: product.salePrice || "0",
              variantPrices: [] as Array<{
                variantId: string;
                originalRegularPrice: string;
                originalSalePrice: string;
              }>
            };

            // Capture original variant prices if variants are being updated
            if (update.variantUpdates && update.variantUpdates.length > 0) {
              for (const variantUpdate of update.variantUpdates) {
                try {
                  const variants = await storage.getProductVariants(workOrder.companyId, update.productId);
                  const existingVariant = variants.find(v => v.id === variantUpdate.variantId);
                  if (existingVariant) {
                    originalPrice.variantPrices.push({
                      variantId: variantUpdate.variantId,
                      originalRegularPrice: existingVariant.regularPrice || "0",
                      originalSalePrice: existingVariant.salePrice || "0"
                    });
                  }
                } catch (error) {
                  console.error(`Failed to get original variant price for ${variantUpdate.variantId}:`, error);
                }
              }
            }

            originalPrices.push(originalPrice);
          }
        } catch (error) {
          console.error(`Failed to get original price for product ${update.productId}:`, error);
        }
      }

      // Process each product update
      for (const update of workOrder.productUpdates) {
        try {
          console.log(`Processing product update:`, JSON.stringify(update, null, 2));
          
          // Update main product pricing if specified
          if (update.newRegularPrice || update.newSalePrice) {
            const updateData: any = {};
            if (update.newRegularPrice) updateData.price = parseFloat(update.newRegularPrice);
            if (update.newSalePrice) updateData.sale_price = update.newSalePrice !== "0.00" ? parseFloat(update.newSalePrice) : 0;
            
            await bigcommerce.updateProduct(update.productId, updateData);

            // Update in local database
            const localUpdateData: any = {};
            if (update.newRegularPrice) localUpdateData.regularPrice = update.newRegularPrice;
            if (update.newSalePrice) localUpdateData.salePrice = update.newSalePrice;
            
            await storage.updateProduct(workOrder.companyId, update.productId, localUpdateData);
          }

          // Update variant pricing if specified
          if (update.variantUpdates && update.variantUpdates.length > 0) {
            for (const variantUpdate of update.variantUpdates) {
              try {
                const variantUpdateData: any = {};
                if (variantUpdate.newRegularPrice) variantUpdateData.price = parseFloat(variantUpdate.newRegularPrice);
                if (variantUpdate.newSalePrice) variantUpdateData.sale_price = variantUpdate.newSalePrice !== "0.00" ? parseFloat(variantUpdate.newSalePrice) : 0;
                
                await bigcommerce.updateProductVariant(update.productId, variantUpdate.variantId, variantUpdateData);

                // Update in local database
                const localVariantUpdateData: any = {};
                if (variantUpdate.newRegularPrice) localVariantUpdateData.regularPrice = variantUpdate.newRegularPrice;
                if (variantUpdate.newSalePrice) localVariantUpdateData.salePrice = variantUpdate.newSalePrice;
                
                await storage.updateProductVariant(workOrder.companyId, variantUpdate.variantId, localVariantUpdateData);
              } catch (error) {
                console.error(`Failed to update variant ${variantUpdate.variantId}:`, error);
                throw error;
              }
            }
          }
        } catch (error) {
          console.error(`Failed to process product update for ${update.productId}:`, error);
          throw error;
        }
      }

      // Mark as completed with original prices stored
      await storage.updateWorkOrder(workOrder.companyId, workOrder.id, {
        status: "completed",
        executedAt: new Date(),
        originalPrices: originalPrices
      });

      console.log(`Work order ${workOrder.id} executed successfully`);
    } catch (error: any) {
      console.error(`Work order ${workOrder.id} failed:`, error);
      
      // Mark as failed
      await storage.updateWorkOrder(workOrder.companyId, workOrder.id, {
        status: "failed",
        error: error.message
      });
    }
  }

  private dateToCron(date: Date): string {
    const minute = date.getMinutes();
    const hour = date.getHours();
    const day = date.getDate();
    const month = date.getMonth() + 1;
    const year = date.getFullYear();
    
    return `${minute} ${hour} ${day} ${month} *`;
  }

  cancelWorkOrder(workOrderId: string) {
    if (this.scheduledJobs.has(workOrderId)) {
      this.scheduledJobs.get(workOrderId)?.stop();
      this.scheduledJobs.delete(workOrderId);
      console.log(`Cancelled scheduled work order: ${workOrderId}`);
    }
  }
}

export const scheduler = new SchedulerService();