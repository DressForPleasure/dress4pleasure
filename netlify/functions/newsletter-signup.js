
/**
 * Netlify Function - Newsletter Signup Handler
 * Processes newsletter subscriptions and integrates with email automation
 */

const https = require('https');

// Configuration
const CONFIG = {
  n8n: {
    webhookUrl: process.env.N8N_WEBHOOK_URL,
    newsletterEndpoint: '/newsletter-signup',
    emailAutomationEndpoint: '/email-automation'
  },
  airtable: {
    baseId: process.env.AIRTABLE_BASE_ID,
    apiKey: process.env.AIRTABLE_API_KEY,
    customerTable: 'Customers'
  },
  newsletter: {
    welcomeDiscount: 15, // 15% welcome discount
    welcomeCodePrefix: 'WELCOME',
    doubleOptIn: process.env.DOUBLE_OPT_IN === 'true'
  }
};

// CORS headers
const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'Content-Type',
  'Access-Control-Allow-Methods': 'POST, OPTIONS'
};

// Main handler
exports.handler = async (event, context) => {
  console.log('Newsletter signup received:', event.httpMethod);
  
  // Handle CORS preflight
  if (event.httpMethod === 'OPTIONS') {
    return {
      statusCode: 200,
      headers: corsHeaders,
      body: ''
    };
  }
  
  // Only allow POST requests
  if (event.httpMethod !== 'POST') {
    return {
      statusCode: 405,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      body: JSON.stringify({ error: 'Method not allowed' })
    };
  }
  
  try {
    // Parse request body
    const body = JSON.parse(event.body);
    
    // Validate email
    const validation = validateNewsletterSignup(body);
    if (!validation.isValid) {
      return {
        statusCode: 400,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        body: JSON.stringify({ 
          error: 'Validation failed', 
          details: validation.errors 
        })
      };
    }
    
    // Check if email already exists
    const existingCustomer = await findCustomerByEmail(body.email);
    
    if (existingCustomer && existingCustomer.fields.newsletter_subscribed) {
      return {
        statusCode: 409,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        body: JSON.stringify({
          error: 'Already subscribed',
          message: 'Diese E-Mail-Adresse ist bereits für den Newsletter angemeldet.'
        })
      };
    }
    
    // Enrich signup data
    const enrichedData = await enrichSignupData(body, event, existingCustomer);
    
    // Process newsletter signup
    const result = await processNewsletterSignup(enrichedData);
    
    // Send welcome email if not double opt-in
    if (!CONFIG.newsletter.doubleOptIn) {
      await sendWelcomeEmail(enrichedData);
    }
    
    // Send success response
    return {
      statusCode: 200,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      body: JSON.stringify({
        success: true,
        message: CONFIG.newsletter.doubleOptIn 
          ? 'Bestätigungs-E-Mail wurde gesendet. Bitte überprüfen Sie Ihr Postfach.'
          : 'Erfolgreich für Newsletter angemeldet!',
        welcomeDiscount: CONFIG.newsletter.welcomeDiscount,
        welcomeCode: result.welcomeCode,
        doubleOptIn: CONFIG.newsletter.doubleOptIn
      })
    };
    
  } catch (error) {
    console.error('Newsletter signup error:', error);
    
    return {
      statusCode: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      body: JSON.stringify({
        error: 'Internal server error',
        message: 'Ein Fehler ist aufgetreten. Bitte versuchen Sie es später erneut.'
      })
    };
  }
};

// Validate newsletter signup data
function validateNewsletterSignup(data) {
  const errors = [];
  
  // Required email field
  if (!data.email || !isValidEmail(data.email)) {
    errors.push('Gültige E-Mail-Adresse ist erforderlich');
  }
  
  // Optional name validation
  if (data.name && data.name.trim().length < 2) {
    errors.push('Name muss mindestens 2 Zeichen lang sein');
  }
  
  // Sanitize inputs
  if (data.email) data.email = data.email.trim().toLowerCase();
  if (data.name) data.name = sanitizeInput(data.name);
  
  return {
    isValid: errors.length === 0,
    errors
  };
}

// Check if email is valid
function isValidEmail(email) {
  const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
  return emailRegex.test(email);
}

// Sanitize input to prevent XSS
function sanitizeInput(input) {
  return input
    .trim()
    .replace(/[<>\"'&]/g, (match) => {
      const htmlEntities = {
        '<': '&lt;',
        '>': '&gt;',
        '"': '&quot;',
        "'": '&#x27;',
        '&': '&amp;'
      };
      return htmlEntities[match];
    })
    .substring(0, 100); // Limit length
}

// Enrich signup data with additional information
async function enrichSignupData(data, event, existingCustomer) {
  const enrichedData = {
    email: data.email,
    name: data.name || extractNameFromEmail(data.email),
    timestamp: new Date().toISOString(),
    source: data.source || 'website_newsletter',
    ipAddress: event.headers['x-forwarded-for'] || event.headers['client-ip'] || 'unknown',
    userAgent: event.headers['user-agent'] || 'unknown',
    language: event.headers['accept-language'] || 'de',
    referrer: event.headers['referer'] || 'direct'
  };
  
  // Generate welcome code
  enrichedData.welcomeCode = generateWelcomeCode();
  
  // Add customer information if exists
  if (existingCustomer) {
    enrichedData.customerId = existingCustomer.id;
    enrichedData.existingCustomer = true;
    enrichedData.customerTier = existingCustomer.fields.customer_tier || 'Neu';
    enrichedData.totalSpent = existingCustomer.fields.total_spent || 0;
    enrichedData.totalOrders = existingCustomer.fields.total_orders || 0;
  } else {
    enrichedData.existingCustomer = false;
    enrichedData.customerTier = 'Neu';
    enrichedData.totalSpent = 0;
    enrichedData.totalOrders = 0;
  }
  
  // Determine email preferences based on customer data
  enrichedData.emailPreferences = determineEmailPreferences(enrichedData);
  
  return enrichedData;
}

// Extract name from email address
function extractNameFromEmail(email) {
  const localPart = email.split('@')[0];
  return localPart
    .replace(/[._-]/g, ' ')
    .replace(/\d+/g, '')
    .trim()
    .split(' ')
    .map(word => word.charAt(0).toUpperCase() + word.slice(1))
    .join(' ')
    .substring(0, 50) || 'Liebe Kundin';
}

// Generate welcome discount code
function generateWelcomeCode() {
  const timestamp = Date.now().toString(36).toUpperCase();
  const randomStr = Math.random().toString(36).substr(2, 4).toUpperCase();
  return `${CONFIG.newsletter.welcomeCodePrefix}${CONFIG.newsletter.welcomeDiscount}-${timestamp}${randomStr}`;
}

// Determine email preferences based on customer data
function determineEmailPreferences(data) {
  const preferences = {
    welcomeSeries: true,
    productRecommendations: true,
    trendUpdates: true,
    saleNotifications: true,
    exclusiveOffers: true
  };
  
  // Customize based on customer tier
  if (data.customerTier === 'VIP' || data.customerTier === 'Gold') {
    preferences.vipOffers = true;
    preferences.earlyAccess = true;
  }
  
  // Customize based on purchase history
  if (data.totalOrders > 5) {
    preferences.loyaltyRewards = true;
  }
  
  return preferences;
}

// Find customer by email in Airtable
async function findCustomerByEmail(email) {
  return new Promise((resolve, reject) => {
    const encodedEmail = encodeURIComponent(email);
    const url = `https://api.airtable.com/v0/${CONFIG.airtable.baseId}/${CONFIG.airtable.customerTable}?filterByFormula={email}="${encodedEmail}"`;
    
    const options = {
      method: 'GET',
      headers: {
        'Authorization': `Bearer ${CONFIG.airtable.apiKey}`,
        'Content-Type': 'application/json'
      }
    };
    
    const req = https.request(url, options, (res) => {
      let data = '';
      
      res.on('data', (chunk) => {
        data += chunk;
      });
      
      res.on('end', () => {
        try {
          const response = JSON.parse(data);
          if (response.records && response.records.length > 0) {
            resolve(response.records[0]);
          } else {
            resolve(null);
          }
        } catch (error) {
          reject(error);
        }
      });
    });
    
    req.on('error', (error) => {
      reject(error);
    });
    
    req.end();
  });
}

// Process newsletter signup through n8n workflow
async function processNewsletterSignup(data) {
  return new Promise((resolve, reject) => {
    const url = `${CONFIG.n8n.webhookUrl}${CONFIG.n8n.newsletterEndpoint}`;
    const postData = JSON.stringify(data);
    
    const options = {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Content-Length': Buffer.byteLength(postData)
      }
    };
    
    const req = https.request(url, options, (res) => {
      let responseData = '';
      
      res.on('data', (chunk) => {
        responseData += chunk;
      });
      
      res.on('end', () => {
        try {
          if (res.statusCode >= 200 && res.statusCode < 300) {
            const response = responseData ? JSON.parse(responseData) : {};
            resolve({
              success: true,
              welcomeCode: data.welcomeCode,
              ...response
            });
          } else {
            reject(new Error(`n8n webhook failed with status ${res.statusCode}: ${responseData}`));
          }
        } catch (error) {
          reject(error);
        }
      });
    });
    
    req.on('error', (error) => {
      reject(error);
    });
    
    req.write(postData);
    req.end();
  });
}

// Send welcome email through email automation
async function sendWelcomeEmail(data) {
  return new Promise((resolve, reject) => {
    const url = `${CONFIG.n8n.webhookUrl}${CONFIG.n8n.emailAutomationEndpoint}`;
    const emailData = {
      trigger: 'welcome_series',
      customer_email: data.email,
      customer_name: data.name,
      welcome_code: data.welcomeCode,
      discount_amount: CONFIG.newsletter.welcomeDiscount,
      customer_tier: data.customerTier,
      timestamp: data.timestamp
    };
    
    const postData = JSON.stringify(emailData);
    
    const options = {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Content-Length': Buffer.byteLength(postData)
      }
    };
    
    const req = https.request(url, options, (res) => {
      let responseData = '';
      
      res.on('data', (chunk) => {
        responseData += chunk;
      });
      
      res.on('end', () => {
        try {
          if (res.statusCode >= 200 && res.statusCode < 300) {
            resolve(responseData ? JSON.parse(responseData) : {});
          } else {
            console.warn(`Welcome email failed with status ${res.statusCode}: ${responseData}`);
            resolve({}); // Don't fail the signup if welcome email fails
          }
        } catch (error) {
          console.warn('Welcome email error:', error);
          resolve({}); // Don't fail the signup if welcome email fails
        }
      });
    });
    
    req.on('error', (error) => {
      console.warn('Welcome email request error:', error);
      resolve({}); // Don't fail the signup if welcome email fails
    });
    
    req.write(postData);
    req.end();
  });
}

// Export configuration for testing
exports.CONFIG = CONFIG;
