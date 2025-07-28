// Quick script to get price IDs from your Stripe products
import Stripe from 'stripe';
const stripe = new Stripe(process.env.STRIPE_SECRET_KEY);

async function getPrices() {
  try {
    console.log('Fetching prices from Stripe...');
    
    // Get all prices
    const prices = await stripe.prices.list({
      expand: ['data.product'],
      limit: 100
    });
    
    console.log('\nFound prices:');
    prices.data.forEach(price => {
      if (price.product && typeof price.product === 'object') {
        console.log(`Product: ${price.product.name}`);
        console.log(`Price ID: ${price.id}`);
        console.log(`Amount: $${price.unit_amount / 100}/${price.recurring?.interval || 'one-time'}`);
        console.log('---');
      }
    });
    
    // Look for our specific products
    const starterPrice = prices.data.find(price => 
      price.product && 
      typeof price.product === 'object' &&
      (price.product.id === 'prod_SlUZKZe1zpGZ2p' || 
       price.product.name?.toLowerCase().includes('starter'))
    );
    
    const premiumPrice = prices.data.find(price => 
      price.product && 
      typeof price.product === 'object' &&
      (price.product.id === 'prod_SlUai0MzuUmFQg' || 
       price.product.name?.toLowerCase().includes('premium'))
    );
    
    console.log('\n=== RESULTS FOR CATALOG PILOT ===');
    if (starterPrice) {
      console.log(`Starter Price ID: ${starterPrice.id}`);
    } else {
      console.log('Starter price not found - check product ID prod_SlUZKZe1zpGZ2p');
    }
    
    if (premiumPrice) {
      console.log(`Premium Price ID: ${premiumPrice.id}`);
    } else {
      console.log('Premium price not found - check product ID prod_SlUai0MzuUmFQg');
    }
    
  } catch (error) {
    console.error('Error:', error.message);
  }
}

getPrices();