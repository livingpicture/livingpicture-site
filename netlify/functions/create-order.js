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
        if (!orderData.email || !orderData.photoCount === undefined || !orderData.currency || !orderData.total) {
            return {
                statusCode: 400,
                body: JSON.stringify({ ok: false, error: 'Missing required fields' })
            };
        }

        // Prepare Airtable record
        const recordData = {
            fields: {
                'Email': orderData.email,
                'Photo Count': orderData.photoCount,
                'Currency': orderData.currency,
                'Total': orderData.total,
                'Status': 'New',
                'Created At': orderData.createdAt || new Date().toISOString(),
                'Customer Name': orderData.customerName || '',
                'Memory Name': orderData.memoryName || '',
                'Notes': orderData.notes || ''
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

