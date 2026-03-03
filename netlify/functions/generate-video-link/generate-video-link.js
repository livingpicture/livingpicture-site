const Airtable = require('airtable');
const jwt = require('jsonwebtoken');

// Configure Airtable
const base = new Airtable({
    apiKey: process.env.AIRTABLE_API_KEY
}).base(process.env.AIRTABLE_BASE_ID);

const ORDERS_TABLE = process.env.AIRTABLE_ORDERS_TABLE || 'Orders';
const JWT_SECRET = process.env.JWT_SECRET || 'your-secret-key-change-in-production';

function createResponse(statusCode, body) {
    return {
        statusCode,
        headers: {
            'Content-Type': 'application/json',
            'Access-Control-Allow-Origin': '*',
            'Access-Control-Allow-Headers': 'Content-Type',
            'Access-Control-Allow-Methods': 'GET, POST, OPTIONS'
        },
        body: JSON.stringify(body)
    };
}

function generateVideoToken(orderId, customerEmail) {
    return jwt.sign(
        { 
            orderId, 
            customerEmail,
            type: 'video_access',
            exp: Math.floor(Date.now() / 1000) + (7 * 24 * 60 * 60) // 7 days
        },
        JWT_SECRET
    );
}

exports.handler = async (event) => {
    // Handle CORS
    if (event.httpMethod === 'OPTIONS') {
        return createResponse(200, {});
    }

    if (event.httpMethod !== 'POST') {
        return createResponse(405, { error: 'Method not allowed' });
    }

    try {
        const { orderId, customerEmail } = JSON.parse(event.body);

        if (!orderId || !customerEmail) {
            return createResponse(400, { 
                error: 'Missing required parameters: orderId and customerEmail' 
            });
        }

        console.log(`🔗 Generating video link for order: ${orderId}, email: ${customerEmail}`);

        // Verify order exists and belongs to customer
        const orderRecords = await base(ORDERS_TABLE)
            .select({
                filterByFormula: `{orderId} = "${orderId}"`,
                maxRecords: 1
            })
            .firstPage();

        if (orderRecords.length === 0) {
            console.log(`❌ Order ${orderId} not found`);
            return createResponse(404, { error: 'Order not found' });
        }

        const order = orderRecords[0].fields;
        
        // Verify customer email matches
        if (order.customerEmail !== customerEmail) {
            console.log(`❌ Email mismatch. Expected: ${order.customerEmail}, Provided: ${customerEmail}`);
            return createResponse(403, { error: 'Email does not match order' });
        }

        // Generate secure token
        const token = generateVideoToken(orderId, customerEmail);
        const videoUrl = `https://www.livingpicture.net/view.html?orderId=${encodeURIComponent(orderId)}&t=${encodeURIComponent(token)}`;

        console.log(`✅ Generated video link for order ${orderId}`);

        return createResponse(200, {
            success: true,
            videoUrl,
            orderId,
            customerName: order.customerName,
            fulfillmentStatus: order.fulfillmentStatus
        });

    } catch (error) {
        console.error('💥 Error generating video link:', error);
        return createResponse(500, { 
            error: 'Internal server error',
            details: error.message 
        });
    }
};
