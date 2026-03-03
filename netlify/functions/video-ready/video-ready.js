const Airtable = require('airtable');
const jwt = require('jsonwebtoken');
const { Resend } = require('resend');

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
            'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
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

async function sendVideoReadyEmail(customerEmail, customerName, videoLink, orderId) {
    try {
        // Initialize Resend
        const resend = new Resend(process.env.RESEND_API_KEY);
        
        const firstName = customerName ? customerName.split(' ')[0] : 'Valued Customer';
        
        const emailContent = {
            to: customerEmail,
            from: process.env.RESEND_FROM_EMAIL || 'noreply@livingpicture.net',
            subject: 'Your Living Picture is ready',
            html: `
                <!DOCTYPE html>
                <html>
                <head>
                    <meta charset="utf-8">
                    <meta name="viewport" content="width=device-width, initial-scale=1.0">
                    <title>Your Living Picture is ready</title>
                    <style>
                        body { font-family: 'Playfair Display', serif, -apple-system, BlinkMacSystemFont, sans-serif; margin: 0; padding: 0; background-color: #f5f2ed; line-height: 1.6; }
                        .container { max-width: 600px; margin: 40px auto; background-color: white; border-radius: 16px; overflow: hidden; box-shadow: 0 8px 32px rgba(44, 24, 16, 0.12); }
                        .header { background: linear-gradient(135deg, #2c1810 0%, #8b7355 100%); color: white; padding: 30px; text-align: center; }
                        .logo { font-size: 24px; font-weight: 700; margin: 0; }
                        .content { padding: 40px 30px; color: #2c1810; }
                        .greeting { font-size: 18px; margin-bottom: 20px; }
                        .body-text { margin-bottom: 20px; color: #6b5d54; }
                        .video-link { display: inline-block; background-color: #2c1810; color: white; padding: 12px 24px; text-decoration: none; border-radius: 8px; margin: 20px 0; font-weight: 500; }
                        .video-link:hover { background-color: #1a0e08; }
                        .footer { background-color: #f8f5f0; padding: 30px; text-align: center; color: #6b5d54; font-size: 14px; }
                        .signature { font-style: italic; margin-top: 20px; }
                    </style>
                </head>
                <body>
                    <div class="container">
                        <div class="header">
                            <div class="logo">LivingPicture</div>
                        </div>
                        <div class="content">
                            <p class="greeting">Hi ${firstName},</p>
                            <p class="body-text">Your Living Picture is ready.</p>
                            <p class="body-text">We've carefully brought your memory back to life, and it's now available for you to view and download securely.</p>
                            <p style="text-align: center;">
                                <a href="${videoLink}" class="video-link">View your video here</a>
                            </p>
                            <p class="body-text">You can share this link with family and friends.</p>
                            <p class="body-text">The link will remain active for 7 days.</p>
                            <p class="body-text">If you need anything or would like to create another Living Picture, we're here for you.</p>
                            <p class="signature">With love,<br>The Living Picture Team</p>
                        </div>
                        <div class="footer">
                            <p style="font-size: 12px;">Order ID: ${orderId}</p>
                        </div>
                    </div>
                </body>
                </html>
            `,
            text: `
                Hi ${firstName},
                
                Your Living Picture is ready.
                
                We've carefully brought your memory back to life, and it's now available for you to view and download securely.
                
                View your video here: ${videoLink}
                
                You can share this link with family and friends.
                The link will remain active for 7 days.
                
                If you need anything or would like to create another Living Picture, we're here for you.
                
                With love,
                The Living Picture Team
                
                Order ID: ${orderId}
            `
        };

        const result = await resend.emails.send(emailContent);
        console.log(`📧 Email sent successfully to ${customerEmail}`);
        return { success: true, messageId: result.id };
        
    } catch (emailError) {
        console.error('💥 Error sending email:', emailError);
        // Don't fail the whole function if email fails, just log it
        return { success: false, error: emailError.message };
    }
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
        const { orderId, videoUrl, message } = JSON.parse(event.body);

        if (!orderId || !videoUrl) {
            return createResponse(400, { 
                error: 'Missing required parameters: orderId and videoUrl' 
            });
        }

        console.log(`🎬 Processing video ready notification for order: ${orderId}`);

        // Find the order
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
        console.log(`✅ Found order: ${orderId}, customer: ${order.customerEmail}`);

        // Update order with video information
        const updateFields = {
            videoUrl: videoUrl,
            videoReadyAt: new Date().toISOString()
        };

        if (message) {
            updateFields.message = message;
        }

        await base(ORDERS_TABLE).update([
            {
                id: orderRecords[0].id,
                fields: updateFields
            }
        ]);

        console.log(`✅ Updated order ${orderId} with video information`);

        // Generate secure video link
        const token = generateVideoToken(orderId, order.customerEmail);
        const videoLink = `https://www.livingpicture.net/view.html?orderId=${encodeURIComponent(orderId)}&t=${encodeURIComponent(token)}`;

        console.log(`🔗 Generated video link for order ${orderId}`);

        // Send email to customer
        console.log(`📧 Sending video ready email to: ${order.customerEmail}`);
        const emailResult = await sendVideoReadyEmail(
            order.customerEmail,
            order.customerName,
            videoLink,
            orderId
        );

        return createResponse(200, {
            success: true,
            videoLink,
            orderId,
            customerEmail: order.customerEmail,
            customerName: order.customerName,
            message: 'Video marked as ready and link generated',
            emailSent: emailResult.success,
            emailMessageId: emailResult.messageId,
            emailError: emailResult.error || null
        });

    } catch (error) {
        console.error('💥 Error processing video ready notification:', error);
        return createResponse(500, { 
            error: 'Internal server error',
            details: error.message 
        });
    }
};
