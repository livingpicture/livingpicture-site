// netlify/functions/payplus-callback.js
const FUNC_VERSION = "payplus-callback@2026-01-14-2";
const Airtable = require('airtable');

// Initialize Airtable
const base = new Airtable({ apiKey: process.env.AIRTABLE_API_KEY }).base(process.env.AIRTABLE_BASE_ID);

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

async function moveLeadToOrders(leadId, paymentData) {
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

    // 2. Create order data with required fields
    const orderData = {
      // Primary field
      'orderId': leadId,
      
      // Customer information
      'customerEmail': leadData['customerEmail'] || leadData['Email'] || '',
      'customerName': leadData['Name'] || leadData['customerName'] || '',
      'customerPhone': leadData['Phone'] || leadData['customerPhone'] || '',
      'country': leadData['Country'] || leadData['country'] || '',
      
      // Order details
      'memoryTitle': leadData['memoryTitle'] || leadData['Memory Name'] || '',
      'photoCount': Number(leadData['Photo Count'] || leadData['photoCount'] || 0),
      'totalAmount': Number(leadData['Total Amount'] || leadData['totalAmount'] || 0),
      'currency': (leadData['Currency'] || leadData['currency'] || 'ILS').toUpperCase(),
      
      // Payment information
      'paymentstatus': 'PAID', // all lowercase as per schema
      'transactionId': paymentData.transaction_uid || '',
      'paymentMethod': paymentData.payment_method || 'credit_card',
      'paymentStatusRaw': JSON.stringify(paymentData) || '{}',
      
      // Order status
      'fulfillmentStatus': 'NEW',
      'source': leadData['source'] || 'website',
      
      // Image URLs - ensure we have an array
      'imageUrls': Array.isArray(leadData['Image URLs']) 
        ? leadData['Image URLs'].join(',') 
        : (leadData['Image URLs'] || leadData['imageUrls'] || ''),
      
      // Timestamps
      'createdAt': new Date().toISOString(),
      'updatedAt': new Date().toISOString(),
      'paidAt': new Date().toISOString(),
      
      // Additional metadata
      'leadId': leadId,
      'notes': ''
    };

    // 3. Create record in Orders table
    const orderRecord = await base('Orders').create([{
      fields: orderData
    }]);

    // 4. Update lead status to indicate it's now an order
    await base('Leads').update([{
      id: lead.id,
      fields: {
        'Status': 'CONVERTED_TO_ORDER',
        'Converted At': new Date().toISOString(),
        'Order ID': orderRecord[0].id
      }
    }]);

    return orderRecord[0];
  } catch (error) {
    console.error('Error moving lead to orders:', error);
    throw error;
  }
}

exports.handler = async (event) => {
  try {
    // Parse the request body
    const data = event.httpMethod === 'POST' 
      ? JSON.parse(event.body || '{}')
      : event.queryStringParameters || {};

    console.log('✅ PayPlus CALLBACK HIT', {
      method: event.httpMethod,
      path: event.path,
      data
    });

    // Extract payment information
    const paymentData = data.payment || data;
    const transactionUid = paymentData.transaction_uid;
    const amount = paymentData.amount;
    const leadId = paymentData.metadata?.leadId || paymentData.custom_1;

    if (!transactionUid || !amount || !leadId) {
      console.error('❌ Missing required payment data:', { transactionUid, amount, leadId });
      return json(400, { 
        ok: false, 
        error: 'Missing required payment data',
        received: data
      });
    }

    console.log(`Processing payment for lead ${leadId}, transaction: ${transactionUid}`);

    // Move lead to orders in Airtable
    const order = await moveLeadToOrders(leadId, paymentData);

    console.log(`✅ Successfully created order ${order.id} for lead ${leadId}`);

    return json(200, {
      ok: true,
      message: 'Payment processed successfully',
      orderId: order.id,
      transactionUid,
      leadId
    });

  } catch (err) {
    console.error('❌ Callback error:', err);
    return json(500, { 
      ok: false, 
      error: 'Internal error processing payment',
      message: err.message,
      stack: process.env.NODE_ENV === 'development' ? err.stack : undefined
    });
  }
};
