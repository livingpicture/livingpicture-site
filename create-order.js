const Airtable = require('airtable');
const { v4: uuidv4 } = require('uuid');

// Initialize Airtable with environment variables
const base = new Airtable({
  apiKey: process.env.AIRTABLE_API_KEY
}).base(process.env.AIRTABLE_BASE_ID);

const TABLE_NAME = process.env.AIRTABLE_TABLE_NAME || 'Orders';
const ALLOWED_CURRENCIES = ['USD', 'ILS', 'EUR', 'RUB'];

// Helper function to generate order ID
function generateOrderId() {
  return `LP-${uuidv4().substring(0, 8).toUpperCase()}`;
}

// CORS headers
const headers = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'Content-Type',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
  'Content-Type': 'application/json'
};

exports.handler = async (event, context) => {
  // Handle OPTIONS request for CORS preflight
  if (event.httpMethod === 'OPTIONS') {
    return {
      statusCode: 200,
      headers,
      body: ''
    };
  }

  // Only allow POST requests
  if (event.httpMethod !== 'POST') {
    return {
      statusCode: 405,
      headers,
      body: JSON.stringify({ error: 'Method Not Allowed' })
    };
  }

  try {
    // Parse and validate request body
    const body = JSON.parse(event.body);
    const { customerEmail, currency, imageUrls, customerName, country, memoryTitle, songChoice } = body;

    // Input validation
    const errors = [];
    
    if (!customerEmail || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(customerEmail)) {
      errors.push('Valid customerEmail is required');
    }
    
    if (!ALLOWED_CURRENCIES.includes(currency)) {
      errors.push(`currency must be one of: ${ALLOWED_CURRENCIES.join(', ')}`);
    }
    
    if (!Array.isArray(imageUrls) || imageUrls.length === 0) {
      errors.push('imageUrls must be a non-empty array');
    }

    if (errors.length > 0) {
      return {
        statusCode: 400,
        headers,
        body: JSON.stringify({ 
          error: 'Invalid input',
          details: errors 
        })
      };
    }

    // Prepare order data
    const orderId = generateOrderId();
    const now = new Date().toISOString();
    const photoCount = imageUrls.length;
    const packageKey = photoCount <= 5 ? '1-5' :
                     photoCount <= 15 ? '6-15' :
                     photoCount <= 25 ? '16-25' : '26+';

    // Create a single record in Airtable
    const record = await base(TABLE_NAME).create({
      orderId,
      createdAt: now,
      status: 'PAYMENT_PENDING',
      paymentStatusRaw: '',
      customerEmail,
      customerName: customerName || '',
      country: country || '',
      memoryTitle: memoryTitle || '',
      songChoice: songChoice || '',
      photoCount,
      packageKey,
      currency,
      imageUrls: JSON.stringify(imageUrls),
      paymentProvider: 'PayPlus'
    });

    return {
      statusCode: 200,
      headers,
      body: JSON.stringify({
        success: true,
        orderId
      })
    };

  } catch (error) {
    console.error('Error creating order:', error);
    
    return {
      statusCode: error.statusCode || 500,
      headers,
      body: JSON.stringify({
        error: 'Failed to create order',
        details: error.message
      })
    };
  }
};
