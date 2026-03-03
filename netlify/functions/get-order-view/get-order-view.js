const Airtable = require('airtable');
const jwt = require('jsonwebtoken');
const cloudinary = require('cloudinary').v2;

// Configure Cloudinary
cloudinary.config({
    cloud_name: process.env.CLOUDINARY_CLOUD_NAME || 'dojuekij4',
    api_key: process.env.CLOUDINARY_API_KEY,
    api_secret: process.env.CLOUDINARY_API_SECRET
});

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
            'Access-Control-Allow-Origin': 'https://www.livingpicture.net',
            'Access-Control-Allow-Headers': 'Content-Type',
            'Access-Control-Allow-Methods': 'GET, OPTIONS',
            'Access-Control-Allow-Credentials': 'true'
        },
        body: JSON.stringify(body)
    };
}

function generateSignedUrl(publicId, options = {}) {
    return cloudinary.url(publicId, {
        resource_type: 'video',
        type: 'upload',
        ...options,
        sign_url: true,
        expires_at: Math.floor(Date.now() / 1000) + (7 * 24 * 60 * 60) // 7 days
    });
}

function generateDownloadUrl(publicId) {
    return cloudinary.url(publicId, {
        resource_type: 'video',
        type: 'upload',
        format: 'mp4',
        flags: 'attachment',
        sign_url: true,
        expires_at: Math.floor(Date.now() / 1000) + (7 * 24 * 60 * 60) // 7 days
    });
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
        const { orderId, t: token } = event.queryStringParameters;

        if (!orderId || !token) {
            return createResponse(400, { 
                error: 'Missing required parameters: orderId and token' 
            });
        }

        console.log(`🎬 Processing video access request for order: ${orderId}`);

        // Verify JWT token
        let decoded;
        try {
            decoded = jwt.verify(token, JWT_SECRET);
            
            if (decoded.orderId !== orderId || decoded.type !== 'video_access') {
                return createResponse(403, { error: 'Invalid token for this order' });
            }
        } catch (jwtError) {
            console.log('❌ Token verification failed:', jwtError.message);
            return createResponse(403, { 
                error: 'Invalid or expired token',
                details: jwtError.message 
            });
        }

        // Fetch order from Airtable
        console.log(`📋 Fetching order ${orderId} from Airtable...`);
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
        console.log(`✅ Found order:`, {
            orderId: order.orderId,
            status: order.fulfillmentStatus,
            hasVideo: !!order.videoUrl,
            customerName: order.customerName
        });

        // Check fulfillment status
        if (order.fulfillmentStatus !== 'READY') {
            console.log(`⏳ Order not ready. Status: ${order.fulfillmentStatus}`);
            return createResponse(200, {
                status: 'not_ready',
                message: 'Your video is still being prepared',
                fulfillmentStatus: order.fulfillmentStatus
            });
        }

        // Check if video exists
        if (!order.videoUrl) {
            console.log(`❌ No video URL found for order ${orderId}`);
            return createResponse(404, { 
                error: 'Video not available',
                status: 'no_video'
            });
        }

        // Extract Cloudinary public ID from video URL
        let videoPublicId;
        try {
            // Parse Cloudinary URL to get public ID
            const url = new URL(order.videoUrl);
            const pathParts = url.pathname.split('/');
            const uploadIndex = pathParts.indexOf('upload');
            
            if (uploadIndex !== -1) {
                // Remove version number if present and get the rest
                const remainingParts = pathParts.slice(uploadIndex + 2);
                videoPublicId = remainingParts.join('/');
                
                // Remove file extension for Cloudinary operations
                videoPublicId = videoPublicId.replace(/\.[^/.]+$/, '');
            } else {
                throw new Error('Invalid Cloudinary URL format');
            }
            
            console.log(`🎥 Extracted video public ID: ${videoPublicId}`);
        } catch (parseError) {
            console.error(`❌ Failed to parse video URL:`, parseError);
            return createResponse(500, { 
                error: 'Invalid video URL format',
                status: 'error'
            });
        }

        // Generate secure signed URLs
        console.log(`🔐 Generating signed URLs for video...`);
        
        const streamUrl = generateSignedUrl(videoPublicId, {
            streaming_profile: 'full_hd',
            quality: 'auto'
        });

        const downloadUrl = generateDownloadUrl(videoPublicId);

        console.log(`✅ Generated secure URLs for order ${orderId}`);

        // Return success response
        return createResponse(200, {
            status: 'ready',
            streamUrl,
            downloadUrl,
            message: order.message || 'Your LivingPicture is ready!',
            customerName: order.customerName || 'Valued Customer',
            orderId: order.orderId,
            fulfillmentStatus: order.fulfillmentStatus
        });

    } catch (error) {
        console.error('💥 Error in get-order-view:', error);
        return createResponse(500, { 
            error: 'Internal server error',
            details: error.message 
        });
    }
};
