const fetch = require('node-fetch');

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
        
        // Validate required fields
        if (!orderData.customerEmail && !orderData.email) {
            return {
                statusCode: 400,
                body: JSON.stringify({ ok: false, error: 'Missing required field: customerEmail' })
            };
        }
        
        if (orderData.photoCount === undefined) {
            return {
                statusCode: 400,
                body: JSON.stringify({ ok: false, error: 'Missing required field: photoCount' })
            };
        }
        
        if (orderData.priceUSD === undefined) {
            return {
                statusCode: 400,
                body: JSON.stringify({ ok: false, error: 'Missing required field: priceUSD' })
            };
        }

        // Prepare Airtable record with exact field names
        const recordData = {
            fields: {
                orderId: orderData.orderId || `ORD-${Date.now()}`,
                createdAt: orderData.createdAt || new Date().toISOString(),
                status: orderData.status || 'DRAFT',
                customerEmail: orderData.customerEmail || orderData.email || '',
                customerName: orderData.customerName || '',
                country: orderData.country || '',
                memoryTitle: orderData.memoryTitle || orderData.memoryName || '',
                songChoice: orderData.songChoice || '',
                photoCount: typeof orderData.photoCount === 'number' ? orderData.photoCount : 0,
                packageKey: orderData.packageKey || '',
                priceUSD: typeof orderData.priceUSD === 'number' ? orderData.priceUSD : 0,
                imageUrls: Array.isArray(orderData.imageUrls) ? JSON.stringify(orderData.imageUrls) : (orderData.imageUrls || ''),
                transactionId: orderData.transactionId || '',
                paymentProvider: orderData.paymentProvider || '',
                paymentStatusRaw: orderData.paymentStatusRaw 
                    ? (typeof orderData.paymentStatusRaw === 'object' 
                        ? JSON.stringify(orderData.paymentStatusRaw) 
                        : String(orderData.paymentStatusRaw))
                    : ''
            }
        };

        // Get environment variables
        const { AIRTABLE_API_KEY, AIRTABLE_BASE_ID, AIRTABLE_TABLE_NAME } = process.env;
        
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
