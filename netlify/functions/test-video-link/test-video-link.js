const jwt = require('jsonwebtoken');

const JWT_SECRET = process.env.JWT_SECRET || 'your-secret-key-change-in-production';

function createResponse(statusCode, body) {
    return {
        statusCode,
        headers: {
            'Content-Type': 'application/json',
            'Access-Control-Allow-Origin': '*',
            'Access-Control-Allow-Headers': 'Content-Type',
            'Access-Control-Allow-Methods': 'GET, OPTIONS'
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

    if (event.httpMethod !== 'GET') {
        return createResponse(405, { error: 'Method not allowed' });
    }

    try {
        const { orderId, customerEmail } = event.queryStringParameters;

        if (!orderId || !customerEmail) {
            return createResponse(400, { 
                error: 'Missing required parameters: orderId and customerEmail' 
            });
        }

        console.log(`🧪 Generating test video link for order: ${orderId}`);

        // Generate secure token
        const token = generateVideoToken(orderId, customerEmail);
        const videoUrl = `https://livingpicture.netlify.app/view.html?orderId=${encodeURIComponent(orderId)}&t=${encodeURIComponent(token)}`;

        console.log(`✅ Generated test video link for order ${orderId}`);

        return createResponse(200, {
            success: true,
            videoUrl,
            orderId,
            customerEmail,
            token,
            instructions: 'Use this URL to test the video viewing page. Note: The video will show "not ready" until the order is marked as READY in Airtable.'
        });

    } catch (error) {
        console.error('💥 Error generating test video link:', error);
        return createResponse(500, { 
            error: 'Internal server error',
            details: error.message 
        });
    }
};
