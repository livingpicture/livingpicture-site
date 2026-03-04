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
        console.log('🔍 DEBUG: Checking email configuration...');
        
        // Check environment variables
        const apiKey = process.env.RESEND_API_KEY;
        const fromEmail = process.env.RESEND_FROM_EMAIL;
        
        console.log('🔍 DEBUG: API Key exists:', !!apiKey);
        console.log('🔍 DEBUG: API Key format:', apiKey ? `${apiKey.substring(0, 10)}...` : 'MISSING');
        console.log('🔍 DEBUG: From Email:', fromEmail || 'MISSING');
        
        if (!apiKey) {
            return createResponse(500, {
                error: 'RESEND_API_KEY is missing',
                envVars: {
                    RESEND_API_KEY: null,
                    RESEND_FROM_EMAIL: fromEmail
                }
            });
        }
        
        if (!fromEmail) {
            return createResponse(500, {
                error: 'RESEND_FROM_EMAIL is missing',
                envVars: {
                    RESEND_API_KEY: `${apiKey.substring(0, 10)}...`,
                    RESEND_FROM_EMAIL: null
                }
            });
        }
        
        // Try to initialize Resend
        console.log('🔍 DEBUG: Initializing Resend...');
        const resend = new Resend(apiKey);
        
        // Try to send a test email
        console.log('🔍 DEBUG: Attempting to send test email...');
        const result = await resend.emails.send({
            from: fromEmail,
            to: 'katyamalshukk@gmail.com',
            subject: 'DEBUG TEST - LivingPicture Email',
            html: `
                <h1>DEBUG TEST EMAIL</h1>
                <p>This is a debug test from LivingPicture.</p>
                <p>Time: ${new Date().toISOString()}</p>
                <p>From: ${fromEmail}</p>
            `,
            text: 'DEBUG TEST EMAIL from LivingPicture'
        });
        
        console.log('🔍 DEBUG: Email result:', result);
        
        return createResponse(200, {
            success: true,
            message: 'Debug email sent successfully',
            result: result,
            envVars: {
                RESEND_API_KEY: `${apiKey.substring(0, 10)}...`,
                RESEND_FROM_EMAIL: fromEmail
            },
            timestamp: new Date().toISOString()
        });

    } catch (error) {
        console.error('🔍 DEBUG: Error:', error);
        
        return createResponse(500, {
            success: false,
            error: error.message,
            stack: error.stack,
            envVars: {
                RESEND_API_KEY: process.env.RESEND_API_KEY ? `${process.env.RESEND_API_KEY.substring(0, 10)}...` : 'MISSING',
                RESEND_FROM_EMAIL: process.env.RESEND_FROM_EMAIL || 'MISSING'
            }
        });
    }
};
