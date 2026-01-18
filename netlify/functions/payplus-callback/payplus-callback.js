// netlify/functions/payplus-callback.js
const FUNC_VERSION = "payplus-callback@2026-01-15-1";
const Airtable = require('airtable');

// Initialize Airtable
const base = new Airtable({ 
  apiKey: process.env.AIRTABLE_API_KEY,
  // Enable retry logic for rate limiting
  requestTimeout: 30000 // 30 seconds timeout
}).base(process.env.AIRTABLE_BASE_ID);

// Constants
const LEAD_STATUS = {
  PAID: 'Converted/Paid',
  PENDING: 'Pending',
  FAILED: 'Payment Failed'
};

// Cache for storing payment processing status to prevent duplicates
const paymentProcessingCache = new Map();

function json(statusCode, body) {
  return {
    statusCode,
    headers: {
      "Content-Type": "application/json",
      "X-Func-Version": FUNC_VERSION,
    },
    body: JSON.stringify(body),
  };
}

/**
 * Updates the lead status and creates an order record in Airtable
 * @param {string} leadId - The unique ID of the lead
 * @param {object} paymentData - Payment data from PayPlus
 * @returns {Promise<object>} The created order record
 */
async function processPaidOrder(leadId, paymentData) {
  // Check if we're already processing this payment to prevent duplicates
  const cacheKey = `${leadId}-${paymentData.transaction_uid}`;
  if (paymentProcessingCache.has(cacheKey)) {
    console.log(`Payment ${cacheKey} is already being processed`);
    return paymentProcessingCache.get(cacheKey);
  }

  // Add to processing cache
  const processingPromise = (async () => {
    try {
      // 1. Find the lead in the Leads table
      const leads = await base('Leads').select({
        filterByFormula: `{leadId} = '${leadId}'`,
        maxRecords: 1
      }).firstPage();

      if (leads.length === 0) {
        throw new Error(`Lead with ID ${leadId} not found`);
      }

      const lead = leads[0];
      const leadData = lead.fields;
      
      // Check if already processed
      if (leadData.Status === LEAD_STATUS.PAID) {
        console.log(`Lead ${leadId} is already marked as paid`);
        // Try to find existing order
        const orders = await base('Orders').select({
          filterByFormula: `{leadId} = '${leadId}'`,
          maxRecords: 1
        }).firstPage();
        
        if (orders.length > 0) {
          return orders[0];
        }
        // Continue to create order if not found
      }
      
      // Get the order ID from PayPlus metadata or generate one
      const orderId = paymentData.metadata?.orderId || `order-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
      const now = new Date().toISOString();
      const paymentAmount = Number(paymentData.amount || 0);
      const currency = paymentData.currency || 'ILS';

      // 2. Prepare order data
      const orderData = {
        // Primary fields
        'orderId': orderId,
        'leadId': leadId,  // Reference back to the original lead
        
        // Customer Information
        'customerEmail': leadData['customerEmail'] || leadData['Email'] || '',
        'customerName': leadData['customerName'] || leadData['Name'] || '',
        'customerPhone': leadData['customerPhone'] || leadData['Phone'] || '',
        'country': leadData['country'] || leadData['Country'] || 'Israel',
        
        // Order Details
        'memoryTitle': leadData['memoryTitle'] || leadData['Memory Name'] || '',
        'photoCount': Number(leadData['photoCount'] || leadData['Photo Count'] || 0),
        'packageKey': leadData['packageKey'] || 'basic',
        'totalAmount': paymentAmount,
        'currency': currency,
        'imageUrls': Array.isArray(leadData['imageUrls']) 
          ? leadData['imageUrls'].join(',') 
          : (leadData['imageUrls'] || leadData['Image URLs'] || ''),
        'source': leadData['source'] || 'website',
        'notes': leadData['notes'] || leadData['Notes'] || '',
        
        // Payment Information
        'amount': paymentAmount,
        'transactionId': paymentData.transaction_uid || paymentData.id || '',
        'paymentStatus': 'paid',
        'paymentProvider': 'payplus',
        'paymentMethod': paymentData.payment_method || 'credit_card',
        'paymentStatusRaw': JSON.stringify(paymentData) || '{}',
        
        // Order Status
        'status': 'NEW',
        'createdAt': now,
        'updatedAt': now,
        'paidAt': now
      };
      
      console.log('Creating order with data:', JSON.stringify(orderData, null, 2));

      // 3. Create record in Orders table with error handling
      let orderRecord;
      try {
        [orderRecord] = await base('Orders').create([{
          fields: orderData,
          typecast: true
        }]);
        console.log(`✅ Created order ${orderRecord.id} for lead ${leadId}`);
      } catch (orderError) {
        console.error('Error creating order:', orderError);
        throw new Error(`Failed to create order: ${orderError.message}`);
      }

      // 4. Update lead status to 'Converted/Paid' without deleting it
      try {
        await base('Leads').update([{
          id: lead.id,
          fields: {
            'Status': LEAD_STATUS.PAID,
            'Converted At': now,
            'Order ID': orderRecord.id,
            'paymentStatus': 'paid',
            'amountPaid': paymentAmount,
            'paymentDate': now,
            'updatedAt': now
          },
          typecast: true
        }]);
        console.log(`✅ Updated lead ${leadId} status to '${LEAD_STATUS.PAID}'`);
      } catch (updateError) {
        console.error('Error updating lead status:', updateError);
        // Don't fail the whole process if lead update fails
      }

      return orderRecord;
    } catch (error) {
      console.error('Error in processPaidOrder:', error);
      throw error;
    } finally {
      // Remove from processing cache
      paymentProcessingCache.delete(cacheKey);
    }
  })();

  // Store the promise in cache
  paymentProcessingCache.set(cacheKey, processingPromise);
  return processingPromise;
}

/**
 * Netlify serverless function handler for PayPlus payment callbacks
 */
exports.handler = async (event) => {
  // Set CORS headers
  const headers = {
    'Content-Type': 'application/json',
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Methods': 'POST, OPTIONS',
    'Access-Control-Allow-Headers': 'Content-Type',
    'X-Func-Version': FUNC_VERSION
  };

  // Handle CORS preflight
  if (event.httpMethod === 'OPTIONS') {
    return {
      statusCode: 204,
      headers,
      body: ''
    };
  }

  try {
    // Parse the request body
    let data;
    try {
      data = event.httpMethod === 'POST' 
        ? JSON.parse(event.body || '{}')
        : event.queryStringParameters || {};
    } catch (parseError) {
      console.error('Error parsing request body:', parseError);
      return {
        statusCode: 400,
        headers,
        body: JSON.stringify({ 
          ok: false, 
          error: 'Invalid JSON payload',
          details: parseError.message 
        })
      };
    }

    console.log('✅ PayPlus CALLBACK RECEIVED', {
      method: event.httpMethod,
      path: event.path,
      ip: event.headers['client-ip'] || event.headers['x-forwarded-for'],
      userAgent: event.headers['user-agent']
    });

    // Extract payment information
    const paymentData = data.payment || data;
    const transactionUid = paymentData.transaction_uid || paymentData.id;
    const amount = paymentData.amount;
    const leadId = paymentData.metadata?.leadId || paymentData.custom_1 || data.leadId;

    // Validate required fields
    if (!transactionUid) {
      console.error('❌ Missing transaction_uid in payment data');
      return {
        statusCode: 400,
        headers,
        body: JSON.stringify({ 
          ok: false, 
          error: 'Missing transaction_uid in payment data',
          received: data
        })
      };
    }

    if (!amount) {
      console.error('❌ Missing amount in payment data');
      return {
        statusCode: 400,
        headers,
        body: JSON.stringify({ 
          ok: false, 
          error: 'Missing amount in payment data',
          received: data
        })
      };
    }

    if (!leadId) {
      console.error('❌ Missing leadId in payment data');
      return {
        statusCode: 400,
        headers,
        body: JSON.stringify({ 
          ok: false, 
          error: 'Missing leadId in payment data',
          received: data
        })
      };
    }

    console.log(`🔄 Processing payment for lead ${leadId}, transaction: ${transactionUid}, amount: ${amount}`);

    try {
      // Process the paid order (update lead and create order)
      const order = await processPaidOrder(leadId, paymentData);

      console.log(`✅ Successfully processed payment for lead ${leadId}, order: ${order.id}`);

      return {
        statusCode: 200,
        headers,
        body: JSON.stringify({
          ok: true,
          message: 'Payment processed successfully',
          orderId: order.id,
          transactionUid,
          leadId,
          timestamp: new Date().toISOString()
        })
      };
    } catch (processError) {
      console.error(`❌ Error processing payment for lead ${leadId}:`, processError);
      
      // Update lead status to indicate payment processing error
      try {
        await base('Leads').update([{
          fields: {
            'leadId': leadId,
            'Status': LEAD_STATUS.FAILED,
            'paymentStatus': 'error',
            'errorMessage': processError.message.substring(0, 100), // Truncate long messages
            'updatedAt': new Date().toISOString()
          },
          typecast: true
        }]);
      } catch (updateError) {
        console.error('Failed to update lead with error status:', updateError);
      }

      return {
        statusCode: 500,
        headers,
        body: JSON.stringify({
          ok: false,
          error: 'Failed to process payment',
          message: processError.message,
          leadId,
          transactionUid
        })
      };
    }
  } catch (err) {
    console.error('❌ Unhandled error in payment callback:', err);
    
    return {
      statusCode: 500,
      headers,
      body: JSON.stringify({
        ok: false,
        error: 'Internal server error',
        message: process.env.NODE_ENV === 'development' ? err.message : 'An unexpected error occurred',
        ...(process.env.NODE_ENV === 'development' && { stack: err.stack })
      })
    };
  }
};
