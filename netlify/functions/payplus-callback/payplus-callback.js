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
    
    // Get the order ID from PayPlus metadata or use leadId as fallback
    const orderId = paymentData.metadata?.orderId || leadId;
    const now = new Date().toISOString();

    // 2. Create order data matching the 20-field Orders table schema
    const orderData = {
      // Primary field - first column in Airtable is the record name
      'orderId': orderId,
      
      // Customer information (fields 1-5)
      'customerEmail': leadData['customerEmail'] || '',
      'customerName': leadData['customerName'] || leadData['Name'] || '',
      'customerPhone': leadData['customerPhone'] || leadData['Phone'] || '',
      'country': leadData['country'] || leadData['Country'] || 'Israel',
      
      // Order details (fields 6-13)
      'memoryTitle': leadData['memoryTitle'] || leadData['Memory Name'] || '',
      'photoCount': Number(leadData['photoCount'] || leadData['Photo Count'] || 0),
      'packageKey': leadData['packageKey'] || 'basic',
      'totalAmount': Number(leadData['totalAmount'] || leadData['Total Amount'] || 0),
      'currency': (leadData['currency'] || leadData['Currency'] || 'ILS').toUpperCase(),
      'imageUrls': Array.isArray(leadData['imageUrls']) 
        ? leadData['imageUrls'].join(',') 
        : (leadData['imageUrls'] || leadData['Image URLs'] || ''),
      'source': leadData['source'] || 'website',
      'notes': leadData['notes'] || leadData['Notes'] || '',
      
      // Payment information (fields 14-17)
      'paymentstatus': 'paid', // all lowercase as per schema
      'amount': Number(paymentData.amount || 0),
      'currency': paymentData.currency || 'ILS',
      'transactionId': paymentData.transaction_uid || paymentData.id || '',
      'paymentStatus': 'paid',
      'paymentProvider': 'payplus',
      'paymentStatusRaw': JSON.stringify(paymentData) || '{}',
      
      // Order status (fields 18-20)
      'fulfillmentStatus': 'NEW',
      'createdAt': new Date().toISOString(),
      'updatedAt': now
    };
    
    console.log('Creating order with data:', JSON.stringify(orderData, null, 2));

    // 3. Create record in Orders table with typecasting enabled
    const orderRecord = await base('Orders').create([{
      fields: orderData,
      typecast: true
    }]);

    // 4. Update lead status to indicate it's now an order
    await base('Leads').update([{
      id: lead.id,
      fields: {
        'Status': 'CONVERTED_TO_ORDER',
        'Converted At': now,
        'Order ID': orderRecord[0].id,
        'paymentstatus': 'paid', // Update payment status in leads as well
        'updatedAt': now
      },
      typecast: true
    }]);
    
    console.log(`Successfully created order ${orderRecord[0].id} for lead ${leadId}`);
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
