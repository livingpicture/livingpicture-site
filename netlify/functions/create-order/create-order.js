const fetch = require('node-fetch');

// Helper function to make Airtable API requests
async function airtableRequest(config) {
    const { method, table, data, recordId } = config;
    const { AIRTABLE_API_KEY, AIRTABLE_BASE_ID } = process.env;
    
    const url = recordId 
        ? `https://api.airtable.com/v0/${AIRTABLE_BASE_ID}/${encodeURIComponent(table)}/${recordId}`
        : `https://api.airtable.com/v0/${AIRTABLE_BASE_ID}/${encodeURIComponent(table)}`;
    
    const response = await fetch(url, {
        method,
        headers: {
            'Authorization': `Bearer ${AIRTABLE_API_KEY}`,
            'Content-Type': 'application/json'
        },
        body: data ? JSON.stringify(data) : undefined
    });
    
    if (!response.ok) {
        const error = await response.json();
        throw new Error(error.error?.message || 'Airtable API error');
    }
    
    return response.json();
}

exports.handler = async (event, context) => {
    // Only allow POST requests
    if (event.httpMethod !== 'POST') {
        return {
            statusCode: 405,
            body: JSON.stringify({ ok: false, error: 'Method Not Allowed' })
        };
    }

    try {
        const orderData = JSON.parse(event.body);
        const { 
            AIRTABLE_API_KEY, 
            AIRTABLE_BASE_ID, 
            AIRTABLE_LEADS_TABLE,
            AIRTABLE_ORDERS_TABLE 
        } = process.env;

        // Validate required environment variables
        const missingVars = [];
        if (!AIRTABLE_API_KEY) missingVars.push('AIRTABLE_API_KEY');
        if (!AIRTABLE_BASE_ID) missingVars.push('AIRTABLE_BASE_ID');
        if (!AIRTABLE_LEADS_TABLE) missingVars.push('AIRTABLE_LEADS_TABLE');
        if (!AIRTABLE_ORDERS_TABLE) missingVars.push('AIRTABLE_ORDERS_TABLE');
        
        if (missingVars.length > 0) {
            throw new Error(`Missing required environment variables: ${missingVars.join(', ')}`);
        }

        // Common validation for both leads and orders
        if (!orderData.leadId) {
            return {
                statusCode: 400,
                body: JSON.stringify({ ok: false, error: 'Missing required field: leadId' })
            };
        }

        // Handle payment success (create order and update lead)
        if (orderData.paymentStatus === 'PAID') {
            // Validate required fields for paid order
            const requiredFields = ['customerEmail', 'photoCount', 'totalAmount', 'currency', 'transactionId'];
            const missingFields = requiredFields.filter(field => !orderData[field]);
            
            if (missingFields.length > 0) {
                return {
                    statusCode: 400,
                    body: JSON.stringify({ 
                        ok: false, 
                        error: 'Missing required fields for paid order',
                        missingFields
                    })
                };
            }

            // 1. Update the lead to mark as PAID
            const leadUpdate = {
                fields: {
                    step: 'PAID',
                    status: 'PAID',
                    transactionId: orderData.transactionId,
                    paymentStatusRaw: typeof orderData.paymentStatusRaw === 'object' 
                        ? JSON.stringify(orderData.paymentStatusRaw) 
                        : String(orderData.paymentStatusRaw || ''),
                    paidAt: new Date().toISOString(),
                    updatedAt: new Date().toISOString()
                }
            };

            // 2. Create order record
            const orderRecord = {
                fields: {
                    leadId: orderData.leadId,
                    orderId: orderData.orderId || `ORD-${Date.now()}`,
                    status: 'PAID',
                    customerEmail: orderData.customerEmail,
                    customerName: orderData.customerName || '',
                    country: orderData.country || '',
                    memoryTitle: orderData.memoryTitle || orderData.memoryName || '',
                    songChoice: orderData.songChoice || '',
                    photoCount: Number(orderData.photoCount) || 0,
                    packageKey: orderData.packageKey || '',
                    totalAmount: Number(orderData.totalAmount) || 0,
                    currency: orderData.currency || 'USD',
                    imageUrls: Array.isArray(orderData.imageUrls) 
                        ? JSON.stringify(orderData.imageUrls) 
                        : (orderData.imageUrls || ''),
                    transactionId: orderData.transactionId,
                    paymentProvider: orderData.paymentProvider || 'payplus',
                    paymentStatusRaw: typeof orderData.paymentStatusRaw === 'object' 
                        ? JSON.stringify(orderData.paymentStatusRaw) 
                        : String(orderData.paymentStatusRaw || ''),
                    createdAt: orderData.createdAt || new Date().toISOString(),
                    paidAt: new Date().toISOString()
                }
            };

            // Execute both operations in parallel
            const [leadResult, orderResult] = await Promise.all([
                airtableRequest({
                    method: 'PATCH',
                    table: AIRTABLE_LEADS_TABLE,
                    data: leadUpdate,
                    recordId: orderData.leadId
                }),
                airtableRequest({
                    method: 'POST',
                    table: AIRTABLE_ORDERS_TABLE,
                    data: { fields: orderRecord.fields }
                })
            ]);

            return {
                statusCode: 200,
                body: JSON.stringify({
                    ok: true,
                    lead: leadResult,
                    order: orderResult,
                    action: 'order_created'
                })
            };
        } 
        // Handle payment failure (update lead only)
        else if (orderData.paymentStatus === 'FAILED') {
            const leadUpdate = {
                fields: {
                    step: 'FAILED',
                    status: 'FAILED',
                    paymentStatusRaw: typeof orderData.paymentStatusRaw === 'object' 
                        ? JSON.stringify(orderData.paymentStatusRaw) 
                        : String(orderData.paymentStatusRaw || 'Payment failed'),
                    updatedAt: new Date().toISOString()
                }
            };

            const leadResult = await airtableRequest({
                method: 'PATCH',
                table: AIRTABLE_LEADS_TABLE,
                data: leadUpdate,
                recordId: orderData.leadId
            });

            return {
                statusCode: 200,
                body: JSON.stringify({
                    ok: true,
                    lead: leadResult,
                    action: 'lead_updated_failed'
                })
            };
        }
        // Regular lead update (not a payment event)
        else {
            // Only update the lead, not the orders table
            const leadUpdate = {
                fields: {
                    ...orderData,
                    step: orderData.step || 'STEP_1',
                    updatedAt: new Date().toISOString(),
                    createdAt: orderData.createdAt || new Date().toISOString()
                }
            };

            // Handle imageUrls if it's an array
            if (leadUpdate.fields.imageUrls && Array.isArray(leadUpdate.fields.imageUrls)) {
                leadUpdate.fields.imageUrls = JSON.stringify(leadUpdate.fields.imageUrls);
            }

            const leadResult = await airtableRequest({
                method: 'PATCH',
                table: AIRTABLE_LEADS_TABLE,
                data: leadUpdate,
                recordId: orderData.leadId
            });

            return {
                statusCode: 200,
                body: JSON.stringify({
                    ok: true,
                    lead: leadResult,
                    action: 'lead_updated'
                })
            };
        }
        
        if (!AIRTABLE_API_KEY || !AIRTABLE_BASE_ID || !AIRTABLE_TABLE_NAME) {
            console.error('Missing required environment variables');
            return {
                statusCode: 500,
                body: JSON.stringify({ ok: false, error: 'Server configuration error' })
            };
        }

        // Create record in Airtable
        const response = await fetch(
            `https://api.airtable.com/v0/${AIRTABLE_BASE_ID}/${encodeURIComponent(AIRTABLE_TABLE_NAME)}`,
            {
                method: 'POST',
                headers: {
                    'Authorization': `Bearer ${AIRTABLE_API_KEY}`,
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify(recordData)
            }
        );

        const data = await response.json();

        if (!response.ok) {
            console.error('Airtable API error:', data);
            return {
                statusCode: 500,
                body: JSON.stringify({ 
                    ok: false, 
                    error: 'Failed to create order',
                    details: data.error?.message || 'Unknown error'
                })
            };
        }

        // Generate a simple order ID if not provided
        const orderId = orderData.orderId || `LP-${Math.floor(100000 + Math.random() * 900000)}`;

        return {
            statusCode: 200,
            body: JSON.stringify({
                ok: true,
                orderId: orderId,
                airtableRecordId: data.id
            })
        };

    } catch (error) {
        console.error('Error processing order:', error);
        return {
            statusCode: 500,
            body: JSON.stringify({ 
                ok: false, 
                error: 'Internal server error',
                details: error.message
            })
        };
    }
};
