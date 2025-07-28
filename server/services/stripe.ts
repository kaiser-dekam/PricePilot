import Stripe from 'stripe';
import { storage } from '../storage';

if (!process.env.STRIPE_SECRET_KEY) {
  throw new Error('STRIPE_SECRET_KEY environment variable is required');
}

const stripe = new Stripe(process.env.STRIPE_SECRET_KEY);

export interface SubscriptionPlan {
  id: string;
  name: string;
  priceId: string;
  productLimit: number;
  price: number;
  interval: 'month' | 'year';
  features: string[];
}

export const SUBSCRIPTION_PLANS: Record<string, SubscriptionPlan> = {
  trial: {
    id: 'trial',
    name: 'Trial',
    priceId: '', // No Stripe price for trial
    productLimit: 5,
    price: 0,
    interval: 'month',
    features: ['5 products', 'Basic sync', 'Work orders']
  },
  starter: {
    id: 'starter',
    name: 'Starter',
    priceId: 'price_starter', // You'll need to create this in Stripe
    productLimit: 10,
    price: 29,
    interval: 'month',
    features: ['10 products', 'Advanced sync', 'Work orders', 'Team collaboration']
  },
  premium: {
    id: 'premium',
    name: 'Premium',
    priceId: 'price_premium', // You'll need to create this in Stripe
    productLimit: 1000,
    price: 99,
    interval: 'month',
    features: ['1000 products', 'Full sync', 'Advanced work orders', 'Team collaboration', 'Priority support']
  }
};

export class StripeService {
  
  async createCustomer(email: string, name: string): Promise<Stripe.Customer> {
    return await stripe.customers.create({
      email,
      name,
    });
  }

  async createSubscription(customerId: string, priceId: string): Promise<Stripe.Subscription> {
    return await stripe.subscriptions.create({
      customer: customerId,
      items: [{ price: priceId }],
      payment_behavior: 'default_incomplete',
      payment_settings: { save_default_payment_method: 'on_subscription' },
      expand: ['latest_invoice.payment_intent'],
    });
  }

  async getSubscription(subscriptionId: string): Promise<Stripe.Subscription> {
    return await stripe.subscriptions.retrieve(subscriptionId, {
      expand: ['latest_invoice.payment_intent'],
    });
  }

  async cancelSubscription(subscriptionId: string): Promise<Stripe.Subscription> {
    return await stripe.subscriptions.cancel(subscriptionId);
  }

  async updateSubscription(subscriptionId: string, priceId: string): Promise<Stripe.Subscription> {
    const subscription = await stripe.subscriptions.retrieve(subscriptionId);
    
    return await stripe.subscriptions.update(subscriptionId, {
      items: [{
        id: subscription.items.data[0].id,
        price: priceId,
      }],
      proration_behavior: 'create_prorations',
    });
  }

  async createPaymentIntent(amount: number, currency: string = 'usd'): Promise<Stripe.PaymentIntent> {
    return await stripe.paymentIntents.create({
      amount: amount * 100, // Convert to cents
      currency,
    });
  }

  async handleWebhook(body: string, signature: string): Promise<Stripe.Event | null> {
    const webhookSecret = process.env.STRIPE_WEBHOOK_SECRET;
    if (!webhookSecret) {
      console.error('STRIPE_WEBHOOK_SECRET not configured');
      return null;
    }

    try {
      const event = stripe.webhooks.constructEvent(body, signature, webhookSecret);
      
      switch (event.type) {
        case 'customer.subscription.updated':
        case 'customer.subscription.deleted':
          await this.handleSubscriptionChange(event.data.object as Stripe.Subscription);
          break;
        case 'invoice.payment_succeeded':
          await this.handlePaymentSuccess(event.data.object as Stripe.Invoice);
          break;
        case 'invoice.payment_failed':
          await this.handlePaymentFailed(event.data.object as Stripe.Invoice);
          break;
      }

      return event;
    } catch (error) {
      console.error('Webhook signature verification failed:', error);
      return null;
    }
  }

  private async handleSubscriptionChange(subscription: Stripe.Subscription): Promise<void> {
    // Find company by Stripe subscription ID
    // This would require adding a method to storage to find company by subscription ID
    console.log('Subscription changed:', subscription.id, subscription.status);
    
    // Update company subscription status in database
    // const company = await storage.getCompanyByStripeSubscriptionId(subscription.id);
    // if (company) {
    //   await storage.updateCompanySubscription(company.id, {
    //     subscriptionStatus: subscription.status,
    //     currentPeriodEnd: new Date(subscription.current_period_end * 1000),
    //   });
    // }
  }

  private async handlePaymentSuccess(invoice: Stripe.Invoice): Promise<void> {
    console.log('Payment succeeded for invoice:', invoice.id);
  }

  private async handlePaymentFailed(invoice: Stripe.Invoice): Promise<void> {
    console.log('Payment failed for invoice:', invoice.id);
  }

  getPlanByProductLimit(productLimit: number): SubscriptionPlan {
    if (productLimit <= 5) return SUBSCRIPTION_PLANS.trial;
    if (productLimit <= 10) return SUBSCRIPTION_PLANS.starter;
    return SUBSCRIPTION_PLANS.premium;
  }
}

export const stripeService = new StripeService();