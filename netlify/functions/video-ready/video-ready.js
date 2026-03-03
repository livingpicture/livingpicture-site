const Airtable = require('airtable');
const jwt = require('jsonwebtoken');
const sgMail = require('@sendgrid/mail');

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
        // Initialize SendGrid
        sgMail.setApiKey(process.env.SENDGRID_API_KEY);
        
        const firstName = customerName ? customerName.split(' ')[0] : 'Valued Customer';
        
        const emailContent = {
            to: customerEmail,
            from: {
                email: process.env.SENDGRID_FROM_EMAIL || 'noreply@livingpicture.net',
                name: 'LivingPicture'
            },
            subject: '🎬 Your LivingPicture is Ready!',
            html: `
                <!DOCTYPE html>
                <html>
                <head>
                    <meta charset="utf-8">
                    <meta name="viewport" content="width=device-width, initial-scale=1.0">
                    <title>Your LivingPicture is Ready!</title>
                    <style>
                        body { font-family: 'Playfair Display', serif, -apple-system, BlinkMacSystemFont, sans-serif; margin: 0; padding: 0; background-color: #f5f2ed; }
                        .container { max-width: 600px; margin: 0 auto; background-color: white; border-radius: 16px; overflow: hidden; box-shadow: 0 8px 32px rgba(44, 24, 16, 0.12); }
                        .header { background: linear-gradient(135deg, #2c1810 0%, #8b7355 100%); color: white; padding: 40px 30px; text-align: center; }
                        .header h1 { margin: 0; font-size: 32px; font-weight: 700; }
                        .content { padding: 40px 30px; }
                        .content h2 { color: #2c1810; font-size: 24px; margin-bottom: 20px; }
                        .content p { color: #6b5d54; line-height: 1.6; margin-bottom: 20px; }
                        .button { display: inline-block; background-color: #2c1810; color: white; padding: 16px 32px; text-decoration: none; border-radius: 8px; font-weight: 500; margin: 20px 0; }
                        .button:hover { background-color: #1a0e08; }
                        .footer { background-color: #f8f5f0; padding: 30px; text-align: center; color: #6b5d54; font-size: 14px; }
                        .logo { font-size: 24px; font-weight: 700; color: white; margin-bottom: 10px; }
                    </style>
                </head>
                <body>
                    <div class="container">
                        <div class="header">
                            <div class="logo">LivingPicture</div>
                            <h1>🎬 Your LivingPicture is Ready!</h1>
                        </div>
                        <div class="content">
                            <h2>Dear ${firstName},</h2>
                            <p>Wonderful news! Your LivingPicture video has been completed and is ready for you to view, download, and share with your loved ones.</p>
                            <p>We've carefully crafted your memories into a beautiful video that you can treasure forever.</p>
                            <p style="text-align: center;">
                                <a href="${videoLink}" class="button">Watch Your LivingPicture</a>
                            </p>
                            <p><strong>Important:</strong> This secure link will expire in 7 days for your privacy and security. Please download your video to keep it permanently.</p>
                            <p>You can share this link with family and friends so they can enjoy your LivingPicture as well!</p>
                            <p>Thank you for choosing LivingPicture to preserve your precious memories.</p>
                        </div>
                        <div class="footer">
                            <p>With love and care,<br>The LivingPicture Team</p>
                            <p style="font-size: 12px; margin-top: 20px;">
                                Order ID: ${orderId}<br>
                                If you have any questions, please don't hesitate to contact us.
                            </p>
                        </div>
                    </div>
                </body>
                </html>
            `,
            text: `
                Your LivingPicture is Ready!
                
                Dear ${firstName},
                
                Wonderful news! Your LivingPicture video has been completed and is ready for you to view.
                
                Watch your video here: ${videoLink}
                
                This secure link will expire in 7 days, so please download your video to keep it permanently.
                
                You can share this link with family and friends so they can enjoy your LivingPicture as well!
                
                Thank you for choosing LivingPicture to preserve your precious memories.
                
                With love and care,
                The LivingPicture Team
                
                Order ID: ${orderId}
            `
        };

        const result = await sgMail.send(emailContent);
        console.log(`📧 Email sent successfully to ${customerEmail}`);
        return { success: true, messageId: result[0].headers['x-message-id'] };
        
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
