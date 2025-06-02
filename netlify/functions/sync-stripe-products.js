const stripe = require('stripe')(process.env.STRIPE_SECRET_KEY);

exports.handler = async (event, context) => {
  const headers = {
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Headers': 'Content-Type',
    'Access-Control-Allow-Methods': 'GET, POST, OPTIONS'
  };

  if (event.httpMethod === 'OPTIONS') {
    return { statusCode: 200, headers, body: '' };
  }

  if (event.httpMethod !== 'POST') {
    return {
      statusCode: 405,
      headers,
      body: JSON.stringify({ error: 'Method not allowed' })
    };
  }

  try {
    const { products } = JSON.parse(event.body);
    const syncedProducts = [];

    for (const product of products) {
      try {
        // Create product in Stripe
        const stripeProduct = await stripe.products.create({
          name: product.name,
          description: product.description,
          images: product.image_url ? [product.image_url] : [],
          metadata: {
            airtable_id: product.airtable_id,
            category: product.category,
            sku: product.sku
          }
        });

        // Create price for the product
        const stripePrice = await stripe.prices.create({
          unit_amount: Math.round(product.price * 100), // Convert to cents
          currency: 'eur',
          product: stripeProduct.id,
          metadata: {
            airtable_id: product.airtable_id
          }
        });

        syncedProducts.push({
          airtable_id: product.airtable_id,
          stripe_product_id: stripeProduct.id,
          stripe_price_id: stripePrice.id,
          name: product.name,
          price: product.price
        });

      } catch (productError) {
        console.error(`Error syncing product ${product.name}:`, productError);
      }
    }

    return {
      statusCode: 200,
      headers,
      body: JSON.stringify({ 
        success: true, 
        synced_count: syncedProducts.length,
        products: syncedProducts
      })
    };

  } catch (error) {
    console.error('Stripe sync error:', error);
    return {
      statusCode: 500,
      headers,
      body: JSON.stringify({ 
        error: 'Fehler bei der Stripe-Synchronisation' 
      })
    };
  }
};
