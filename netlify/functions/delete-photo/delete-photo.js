const cloudinary = require('cloudinary').v2;

// Configure Cloudinary
cloudinary.config({
    cloud_name: process.env.CLOUDINARY_CLOUD_NAME || 'dojuekij4',
    api_key: process.env.CLOUDINARY_API_KEY,
    api_secret: process.env.CLOUDINARY_API_SECRET
});

function createResponse(statusCode, body) {
    return {
        statusCode,
        headers: {
            'Content-Type': 'application/json',
            'Access-Control-Allow-Origin': '*',
            'Access-Control-Allow-Headers': 'Content-Type',
            'Access-Control-Allow-Methods': 'POST, OPTIONS'
        },
        body: JSON.stringify(body)
    };
}

exports.handler = async (event, context) => {
    console.log('=== Delete Photo Function Started ===');
    console.log('HTTP Method:', event.httpMethod);
    console.log('Request body:', event.body);
    
    // Handle CORS preflight
    if (event.httpMethod === 'OPTIONS') {
        console.log('CORS preflight request');
        return createResponse(200, {});
    }
    
    // Only allow POST requests
    if (event.httpMethod !== 'POST') {
        console.log('Method not allowed:', event.httpMethod);
        return createResponse(405, { 
            ok: false, 
            error: 'Method Not Allowed' 
        });
    }
    
    try {
        // Parse request body
        const requestBody = JSON.parse(event.body || '{}');
        const { publicId, leadId } = requestBody;
        
        console.log('Delete request:', { publicId, leadId });
        console.log('Environment variables:', {
            CLOUDINARY_CLOUD_NAME: process.env.CLOUDINARY_CLOUD_NAME,
            CLOUDINARY_API_KEY: process.env.CLOUDINARY_API_KEY ? 'SET' : 'NOT SET',
            CLOUDINARY_API_SECRET: process.env.CLOUDINARY_API_SECRET ? 'SET' : 'NOT SET'
        });
        
        if (!publicId) {
            return createResponse(400, { 
                ok: false, 
                error: 'Missing publicId' 
            });
        }
        
        // Security: Ensure the publicId is in the allowed path
        // Relaxed pattern: allow any path that starts with livingpicture/leads/
        const allowedPattern = /^livingpicture\/leads\/.*$/;
        
        console.log('Validating publicId format:', {
            publicId: publicId,
            pattern: allowedPattern.toString(),
            testResult: allowedPattern.test(publicId)
        });
        
        if (!allowedPattern.test(publicId)) {
            console.error('❌ Regex validation failed for publicId:', publicId);
            console.error('❌ Expected format: any path starting with livingpicture/leads/');
            console.error('❌ Actual publicId received:', JSON.stringify(publicId));
            return createResponse(403, { 
                ok: false, 
                error: 'Invalid publicId format - must be in livingpicture/leads/ path',
                received: publicId
            });
        } else {
            console.log('✅ PublicId format validation passed:', publicId);
        }
        
        // Additional security: If leadId is provided, ensure it matches the path
        if (leadId && !publicId.startsWith(`livingpicture/leads/${leadId}/`)) {
            console.error('LeadId mismatch:', { leadId, publicId });
            return createResponse(403, { 
                ok: false, 
                error: 'LeadId does not match publicId path' 
            });
        }
        
        // Check if Cloudinary credentials are configured
        console.log('🔑 Checking Cloudinary credentials...');
        if (!process.env.CLOUDINARY_API_KEY) {
            console.error('❌ CLOUDINARY_API_KEY is missing from environment variables');
            return createResponse(500, { 
                ok: false, 
                error: 'CLOUDINARY_API_KEY not configured' 
            });
        }
        
        if (!process.env.CLOUDINARY_API_SECRET) {
            console.error('❌ CLOUDINARY_API_SECRET is missing from environment variables');
            console.error('❌ This is required for the destroy() method to work');
            return createResponse(500, { 
                ok: false, 
                error: 'CLOUDINARY_API_SECRET not configured - required for deletion' 
            });
        }
        
        console.log('✅ Cloudinary credentials are configured');
        
        // Delete the image from Cloudinary
        console.log('Attempting to delete from Cloudinary:', publicId);
        console.log('Cloudinary config check:', {
            cloud_name: cloudinary.config().cloud_name,
            has_api_key: !!cloudinary.config().api_key,
            has_api_secret: !!cloudinary.config().api_secret
        });
        
        try {
            const result = await cloudinary.uploader.destroy(publicId, {
                resource_type: 'image',
                invalidate: true // Clear CDN cache
            });
            
            console.log('Cloudinary deletion result:', result);
            console.log('Deletion successful:', result.result === 'ok' || result.result === 'not found');
            
            if (result.result === 'ok' || result.result === 'not found') {
                return createResponse(200, { 
                    ok: true, 
                    message: 'Photo deleted successfully',
                    publicId: publicId,
                    result: result.result
                });
            } else {
                console.error('Failed to delete photo:', result);
                return createResponse(500, { 
                    ok: false, 
                    error: 'Failed to delete photo',
                    details: result
                });
            }
        } catch (cloudinaryError) {
            console.error('Cloudinary API error:', cloudinaryError);
            return createResponse(500, { 
                ok: false, 
                error: 'Cloudinary API error',
                message: cloudinaryError.message 
            });
        }
        
    } catch (error) {
        console.error('Error in delete-photo function:', error);
        return createResponse(500, { 
            ok: false, 
            error: 'Internal server error',
            message: error.message 
        });
    }
};
