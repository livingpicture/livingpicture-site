const cloudinary = require('cloudinary').v2;

// Configure Cloudinary
cloudinary.config({
    cloud_name: process.env.CLOUDINARY_CLOUD_NAME || 'dojuekij4',
    api_key: process.env.CLOUDINARY_API_KEY,
    api_secret: process.env.CLOUDINARY_API_SECRET
});

exports.handler = async (event, context) => {
    console.log('=== Test Cloudinary Function Started ===');
    
    try {
        // Test listing assets in a folder
        console.log('Testing folder listing...');
        
        // List assets in a sample leads folder
        const result = await cloudinary.search
            .expression('folder:livingpicture/leads/*')
            .max_results(10)
            .execute();
            
        console.log('Found assets:', result.resources?.length || 0);
        
        if (result.resources && result.resources.length > 0) {
            console.log('Sample asset details:');
            result.resources.slice(0, 3).forEach((asset, index) => {
                console.log(`Asset ${index + 1}:`, {
                    public_id: asset.public_id,
                    folder: asset.folder,
                    secure_url: asset.secure_url
                });
            });
        }
        
        // Test deletion with a sample public_id format
        const samplePublicId = 'livingpicture/leads/test123/sample_image';
        console.log('\nTesting deletion with format:', samplePublicId);
        
        return {
            statusCode: 200,
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                ok: true,
                message: 'Test completed',
                assetsFound: result.resources?.length || 0,
                sampleAssets: result.resources?.slice(0, 3).map(r => ({
                    public_id: r.public_id,
                    folder: r.folder
                })) || []
            })
        };
        
    } catch (error) {
        console.error('Test error:', error);
        return {
            statusCode: 500,
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                ok: false,
                error: error.message
            })
        };
    }
};
