/**
 * Netlify Function - Contact Form Handler
 * Processes contact form submissions and integrates with n8n workflows
 */

const https = require('https');

// Configuration
const CONFIG = {
  n8n: {
    webhookUrl: process.env.N8N_WEBHOOK_URL,
    contactEndpoint: '/contact-form'
  },
  airtable: {
    baseId: process.env.AIRTABLE_BASE_ID,
    apiKey: process.env.AIRTABLE_API_KEY,
    customerTable: 'Customers'
  },
  email: {
    adminEmail: process.env.ADMIN_EMAIL || 'admin@dressforpleasure.com',
    supportEmail: process.env.SUPPORT_EMAIL || 'support@dressforpleasure.com'
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
  console.log('Contact form submission received:', event.httpMethod);
  
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
    
    // Validate required fields
    const validation = validateContactForm(body);
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
    
    // Enrich contact data
    const enrichedData = await enrichContactData(body, event);
    
    // Process contact form
    const result = await processContactForm(enrichedData);
    
    // Send success response
    return {
      statusCode: 200,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      body: JSON.stringify({
        success: true,
        message: 'Nachricht erfolgreich gesendet',
        ticketId: result.ticketId
      })
    };
    
  } catch (error) {
    console.error('Contact form error:', error);
    
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

// Validate contact form data
function validateContactForm(data) {
  const errors = [];
  
  // Required fields
  if (!data.name || data.name.trim().length < 2) {
    errors.push('Name ist erforderlich (mindestens 2 Zeichen)');
  }
  
  if (!data.email || !isValidEmail(data.email)) {
    errors.push('Gültige E-Mail-Adresse ist erforderlich');
  }
  
  if (!data.message || data.message.trim().length < 10) {
    errors.push('Nachricht ist erforderlich (mindestens 10 Zeichen)');
  }
  
  if (!data.subject) {
    errors.push('Betreff ist erforderlich');
  }
  
  // Valid subject options
  const validSubjects = ['styling', 'order', 'return', 'vip', 'other'];
  if (data.subject && !validSubjects.includes(data.subject)) {
    errors.push('Ungültiger Betreff');
  }
  
  // Sanitize inputs
  if (data.name) data.name = sanitizeInput(data.name);
  if (data.message) data.message = sanitizeInput(data.message);
  
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
    .substring(0, 1000); // Limit length
}

// Enrich contact data with additional information
async function enrichContactData(data, event) {
  const enrichedData = {
    ...data,
    timestamp: new Date().toISOString(),
    source: 'website_contact_form',
    ipAddress: event.headers['x-forwarded-for'] || event.headers['client-ip'] || 'unknown',
    userAgent: event.headers['user-agent'] || 'unknown',
    language: event.headers['accept-language'] || 'unknown'
  };
  
  // Map subject to readable format
  const subjectMap = {
    'styling': 'Styling-Beratung',
    'order': 'Bestellanfrage',
    'return': 'Rückgabe/Umtausch',
    'vip': 'VIP-Programm',
    'other': 'Sonstiges'
  };
  
  enrichedData.subjectDisplay = subjectMap[data.subject] || data.subject;
  
  // Generate ticket ID
  enrichedData.ticketId = generateTicketId();
  
  // Check if customer exists
  try {
    const existingCustomer = await findCustomerByEmail(data.email);
    if (existingCustomer) {
      enrichedData.customerId = existingCustomer.id;
      enrichedData.customerTier = existingCustomer.fields.customer_tier || 'Neu';
      enrichedData.isExistingCustomer = true;
    } else {
      enrichedData.isExistingCustomer = false;
    }
  } catch (error) {
    console.warn('Could not check customer status:', error.message);
    enrichedData.isExistingCustomer = false;
  }
  
  return enrichedData;
}

// Generate unique ticket ID
function generateTicketId() {
  const timestamp = Date.now().toString(36);
  const randomStr = Math.random().toString(36).substr(2, 5);
  return `DFP-${timestamp}-${randomStr}`.toUpperCase();
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

// Process contact form through n8n workflow
async function processContactForm(data) {
  return new Promise((resolve, reject) => {
    const url = `${CONFIG.n8n.webhookUrl}${CONFIG.n8n.contactEndpoint}`;
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
              ticketId: data.ticketId,
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

// Export configuration for testing
exports.CONFIG = CONFIG;
