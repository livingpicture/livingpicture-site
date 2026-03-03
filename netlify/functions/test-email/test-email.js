const { Resend } = require('resend');

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

exports.handler = async (event) => {
    // Handle CORS
    if (event.httpMethod === 'OPTIONS') {
        return createResponse(200, {});
    }

    if (event.httpMethod !== 'GET') {
        return createResponse(405, { error: 'Method not allowed' });
    }

    try {
        console.log('📧 Testing Resend email service...');
        
        const resend = new Resend(process.env.RESEND_API_KEY);
        
        const result = await resend.emails.send({
            from: 'noreply@livingpicture.net',
            to: 'ron.krishtul@gmail.com',
            subject: 'Test Email from LivingPicture',
            html: `
                <h1>Test Email</h1>
                <p>This is a test email from LivingPicture.</p>
                <p>If you receive this, Resend is working correctly!</p>
                <p>Time: ${new Date().toISOString()}</p>
            `,
            text: 'Test email from LivingPicture. If you receive this, Resend is working!'
        });

        console.log('✅ Test email sent:', result);
        
        return createResponse(200, {
            success: true,
            message: 'Test email sent successfully',
            messageId: result.id,
            timestamp: new Date().toISOString()
        });

    } catch (error) {
        console.error('💥 Test email failed:', error);
        
        return createResponse(500, {
            success: false,
            error: error.message,
            details: error.toString()
        });
    }
};
