import * as cron from 'node-cron';
import { storage } from '../storage';
import { BigCommerceService } from './bigcommerce';

class SchedulerService {
  private jobs: Map<string, cron.ScheduledTask> = new Map();

  async scheduleWorkOrder(workOrderId: string, scheduledAt: Date): Promise<void> {
    const cronExpression = this.dateToCron(scheduledAt);
    console.log(`Scheduling work order ${workOrderId} for ${scheduledAt} with cron: ${cronExpression}`);
    
    const task = cron.schedule(cronExpression, async () => {
      console.log(`Cron triggered for work order ${workOrderId}`);
      await this.executeWorkOrder(workOrderId);
      this.jobs.delete(workOrderId);
    });

    this.jobs.set(workOrderId, task);
    task.start();
    
    console.log(`Work order ${workOrderId} scheduled successfully. Current time: ${new Date()}`);
  }

  async executeWorkOrder(workOrderId: string): Promise<void> {
    try {
      console.log(`Executing work order ${workOrderId}`);
      
      const workOrder = await storage.getWorkOrder(workOrderId);
      if (!workOrder) {
        throw new Error('Work order not found');
      }

      if (workOrder.status !== 'pending') {
        console.log(`Work order ${workOrderId} is not pending, skipping execution`);
        return;
      }

      await storage.updateWorkOrder(workOrderId, { status: 'executing' });

      const apiSettings = await storage.getApiSettings();
      if (!apiSettings) {
        throw new Error('BigCommerce API settings not configured');
      }

      const bigcommerce = new BigCommerceService({
        storeHash: apiSettings.storeHash,
        accessToken: apiSettings.accessToken,
        clientId: apiSettings.clientId,
      });

      const updates = workOrder.productUpdates.map(update => ({
        id: update.productId,
        regularPrice: update.newRegularPrice || undefined,
        salePrice: update.newSalePrice || undefined,
      }));

      await bigcommerce.updateMultipleProducts(updates);

      // Update local product cache
      for (const update of workOrder.productUpdates) {
        const updateData: any = {};
        if (update.newRegularPrice) updateData.regularPrice = update.newRegularPrice;
        if (update.newSalePrice) updateData.salePrice = update.newSalePrice;
        
        await storage.updateProduct(update.productId, updateData);
      }

      await storage.updateWorkOrder(workOrderId, {
        status: 'completed',
        executedAt: new Date(),
      });

      console.log(`Work order ${workOrderId} completed successfully`);
    } catch (error: any) {
      console.error(`Error executing work order ${workOrderId}:`, error);
      
      await storage.updateWorkOrder(workOrderId, {
        status: 'failed',
        error: error.message,
        executedAt: new Date(),
      });
    }
  }

  async executeImmediately(workOrderId: string): Promise<void> {
    await this.executeWorkOrder(workOrderId);
  }

  cancelWorkOrder(workOrderId: string): void {
    const task = this.jobs.get(workOrderId);
    if (task) {
      task.destroy();
      this.jobs.delete(workOrderId);
      console.log(`Work order ${workOrderId} cancelled`);
    }
  }

  private dateToCron(date: Date): string {
    const minutes = date.getMinutes();
    const hours = date.getHours();
    const day = date.getDate();
    const month = date.getMonth() + 1;
    const year = date.getFullYear();
    
    return `${minutes} ${hours} ${day} ${month} *`;
  }

  async initializeScheduledJobs(): Promise<void> {
    const pendingWorkOrders = await storage.getPendingWorkOrders();
    
    for (const workOrder of pendingWorkOrders) {
      if (workOrder.scheduledAt && !workOrder.executeImmediately) {
        const scheduledDate = new Date(workOrder.scheduledAt);
        if (scheduledDate > new Date()) {
          await this.scheduleWorkOrder(workOrder.id, scheduledDate);
        } else {
          // Execute overdue work orders immediately
          await this.executeWorkOrder(workOrder.id);
        }
      }
    }
  }
}

export const scheduler = new SchedulerService();
