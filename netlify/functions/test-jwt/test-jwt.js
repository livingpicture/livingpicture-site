const jwt = require('jsonwebtoken');

const JWT_SECRET = process.env.JWT_SECRET || 'your-secret-key-change-in-production';

function createResponse(statusCode, body) {
    return {
        statusCode,
        headers: {
            'Content-Type': 'application/json',
            'Access-Control-Allow-Origin': 'https://www.livingpicture.net',
            'Access-Control-Allow-Headers': 'Content-Type',
            'Access-Control-Allow-Methods': 'GET, OPTIONS',
            'Access-Control-Allow-Credentials': 'true'
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
        const { orderId, customerEmail, token: testToken } = event.queryStringParameters;

        console.log('🔑 JWT_SECRET configured:', !!JWT_SECRET);
        console.log('🔑 JWT_SECRET length:', JWT_SECRET?.length || 0);

        if (testToken) {
            // Test token validation
            try {
                const decoded = jwt.verify(testToken, JWT_SECRET);
                console.log('✅ Token decoded successfully:', decoded);
                
                return createResponse(200, {
                    success: true,
                    decoded,
                    message: 'Token is valid'
                });
            } catch (jwtError) {
                console.log('❌ Token validation failed:', jwtError.message);
                return createResponse(403, { 
                    error: 'Invalid token',
                    details: jwtError.message,
                    token: testToken
                });
            }
        } else if (orderId && customerEmail) {
            // Generate new token
            const token = generateVideoToken(orderId, customerEmail);
            const videoUrl = `https://www.livingpicture.net/view.html?orderId=${encodeURIComponent(orderId)}&t=${encodeURIComponent(token)}`;

            return createResponse(200, {
                success: true,
                token,
                videoUrl,
                orderId,
                customerEmail,
                message: 'New token generated'
            });
        } else {
            return createResponse(400, { 
                error: 'Provide either (orderId + customerEmail) to generate token OR token to validate'
            });
        }

    } catch (error) {
        console.error('💥 Error in test-jwt:', error);
        return createResponse(500, { 
            error: 'Internal server error',
            details: error.message 
        });
    }
};
