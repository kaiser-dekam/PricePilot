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
        this.executeWorkOrder(workOrder.id);
      }
    }
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

      if (workOrder.status !== "pending") {
        console.log(`Work order ${workOrderId} is not pending, skipping`);
        return;
      }

      // Update status to executing
      await storage.updateWorkOrder(workOrder.userId, workOrderId, { 
        status: "executing" 
      });

      // Get API settings for this user
      const apiSettings = await storage.getApiSettings(workOrder.userId);
      if (!apiSettings) {
        throw new Error("API settings not configured for this user");
      }

      const bigcommerce = new BigCommerceService(apiSettings);

      // Capture original prices before making changes
      const originalPrices = [];
      for (const update of workOrder.productUpdates) {
        try {
          const product = await storage.getProduct(workOrder.userId, update.productId);
          if (product) {
            originalPrices.push({
              productId: update.productId,
              originalRegularPrice: product.regularPrice || "0",
              originalSalePrice: product.salePrice || "0"
            });
          }
        } catch (error) {
          console.error(`Failed to get original price for product ${update.productId}:`, error);
        }
      }

      // Process each product update
      for (const update of workOrder.productUpdates) {
        try {
          console.log(`Processing product update:`, JSON.stringify(update, null, 2));
          
          const updateData = {
            regularPrice: update.newRegularPrice,
            salePrice: update.newSalePrice
          };

          console.log(`Calling BigCommerce updateProduct with:`, updateData);
          await bigcommerce.updateProduct(update.productId, updateData);
          
          // Update product in our database
          await storage.updateProduct(workOrder.userId, update.productId, {
            regularPrice: update.newRegularPrice || undefined,
            salePrice: update.newSalePrice || undefined,
          });

          console.log(`Updated product ${update.productId}`);
        } catch (error) {
          console.error(`Failed to update product ${update.productId}:`, error);
        }
      }

      // Mark as completed and save original prices for undo
      await storage.updateWorkOrder(workOrder.userId, workOrderId, {
        status: "completed",
        executedAt: new Date(),
        originalPrices: originalPrices,
      });

      console.log(`Work order ${workOrderId} completed successfully`);
    } catch (error: any) {
      console.error(`Work order ${workOrderId} failed:`, error);
      
      // Try to update status to failed
      try {
        const allWorkOrders = await storage.getPendingWorkOrders();
        const workOrder = allWorkOrders.find(wo => wo.id === workOrderId);
        if (workOrder) {
          await storage.updateWorkOrder(workOrder.userId, workOrderId, {
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