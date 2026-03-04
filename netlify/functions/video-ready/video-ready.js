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
                    <title>Your Living Picture is Ready</title>
                    <style>
                        @import url('https://fonts.googleapis.com/css2?family=Playfair+Display:wght@400;700&family=Montserrat:wght@300;400;500;600&display=swap');
                        
                        body { 
                            font-family: 'Montserrat', -apple-system, BlinkMacSystemFont, sans-serif; 
                            margin: 0; 
                            padding: 0; 
                            background: linear-gradient(135deg, #f8f6f3 0%, #e8e2d8 100%);
                            line-height: 1.6;
                            color: #2c1810;
                        }
                        
                        .container { 
                            max-width: 650px; 
                            margin: 30px auto; 
                            background-color: #ffffff; 
                            border-radius: 4px; 
                            overflow: hidden; 
                            box-shadow: 0 20px 60px rgba(44, 24, 16, 0.15);
                            border: 1px solid rgba(139, 115, 85, 0.1);
                        }
                        
                        .header { 
                            background: linear-gradient(135deg, #1a0e08 0%, #2c1810 50%, #8b7355 100%); 
                            color: white; 
                            padding: 50px 40px; 
                            text-align: center;
                            position: relative;
                            overflow: hidden;
                        }
                        
                        .header::before {
                            content: '';
                            position: absolute;
                            top: 0;
                            left: 0;
                            right: 0;
                            bottom: 0;
                            background: url('data:image/svg+xml,<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 100 100"><defs><pattern id="grain" width="100" height="100" patternUnits="userSpaceOnUse"><circle cx="25" cy="25" r="1" fill="white" opacity="0.1"/><circle cx="75" cy="75" r="1" fill="white" opacity="0.1"/><circle cx="50" cy="10" r="0.5" fill="white" opacity="0.15"/><circle cx="20" cy="60" r="0.5" fill="white" opacity="0.15"/><circle cx="80" cy="40" r="0.5" fill="white" opacity="0.15"/></pattern></defs><rect width="100" height="100" fill="url(%23grain)"/></svg>');
                            opacity: 0.3;
                        }
                        
                        .logo { 
                            font-family: 'Playfair Display', serif;
                            font-size: 32px; 
                            font-weight: 700; 
                            margin: 0; 
                            letter-spacing: 2px;
                            position: relative;
                            z-index: 1;
                        }
                        
                        .tagline {
                            font-size: 14px;
                            font-weight: 300;
                            margin-top: 8px;
                            opacity: 0.9;
                            letter-spacing: 1px;
                            position: relative;
                            z-index: 1;
                        }
                        
                        .content { 
                            padding: 50px 40px; 
                            color: #2c1810;
                        }
                        
                        .greeting { 
                            font-family: 'Playfair Display', serif;
                            font-size: 24px; 
                            margin-bottom: 25px; 
                            color: #2c1810;
                            font-weight: 400;
                        }
                        
                        .body-text { 
                            margin-bottom: 25px; 
                            color: #5a4a3f; 
                            font-size: 16px;
                            line-height: 1.7;
                        }
                        
                        .highlight-box {
                            background: linear-gradient(135deg, #f8f6f3 0%, #e8e2d8 100%);
                            border-left: 4px solid #8b7355;
                            padding: 25px 30px;
                            margin: 30px 0;
                            border-radius: 0 4px 4px 0;
                        }
                        
                        .cta-wrapper {
                            text-align: center;
                            margin: 40px 0;
                        }
                        
                        .video-link { 
                            display: inline-block; 
                            background: linear-gradient(135deg, #2c1810 0%, #8b7355 100%); 
                            color: white; 
                            padding: 18px 45px; 
                            text-decoration: none; 
                            border-radius: 50px; 
                            font-weight: 600; 
                            font-size: 16px;
                            letter-spacing: 0.5px;
                            transition: all 0.3s ease;
                            box-shadow: 0 8px 25px rgba(44, 24, 16, 0.3);
                            position: relative;
                            overflow: hidden;
                        }
                        
                        .video-link::before {
                            content: '';
                            position: absolute;
                            top: 0;
                            left: -100%;
                            width: 100%;
                            height: 100%;
                            background: linear-gradient(90deg, transparent, rgba(255,255,255,0.2), transparent);
                            transition: left 0.5s;
                        }
                        
                        .video-link:hover::before {
                            left: 100%;
                        }
                        
                        .video-link:hover { 
                            transform: translateY(-2px);
                            box-shadow: 0 12px 35px rgba(44, 24, 16, 0.4);
                        }
                        
                        .info-grid {
                            display: grid;
                            grid-template-columns: 1fr 1fr;
                            gap: 20px;
                            margin: 30px 0;
                        }
                        
                        .info-item {
                            background: #faf8f5;
                            padding: 20px;
                            border-radius: 8px;
                            text-align: center;
                            border: 1px solid rgba(139, 115, 85, 0.1);
                        }
                        
                        .info-icon {
                            font-size: 24px;
                            margin-bottom: 10px;
                        }
                        
                        .info-title {
                            font-weight: 600;
                            color: #2c1810;
                            margin-bottom: 5px;
                            font-size: 14px;
                        }
                        
                        .info-text {
                            font-size: 13px;
                            color: #6b5d54;
                        }
                        
                        .footer { 
                            background: linear-gradient(135deg, #2c1810 0%, #1a0e08 100%); 
                            padding: 40px; 
                            text-align: center; 
                            color: #e8e2d8; 
                            font-size: 14px;
                        }
                        
                        .signature { 
                            font-family: 'Playfair Display', serif;
                            font-style: italic; 
                            margin-top: 20px;
                            font-size: 18px;
                            color: #ffffff;
                        }
                        
                        .order-info {
                            margin-top: 25px;
                            padding-top: 25px;
                            border-top: 1px solid rgba(232, 226, 216, 0.3);
                            font-size: 12px;
                            opacity: 0.8;
                        }
                        
                        .social-links {
                            margin-top: 20px;
                        }
                        
                        .social-links a {
                            color: #e8e2d8;
                            text-decoration: none;
                            margin: 0 10px;
                            opacity: 0.8;
                            transition: opacity 0.3s;
                        }
                        
                        .social-links a:hover {
                            opacity: 1;
                        }
                        
                        @media (max-width: 600px) {
                            .container { margin: 10px; }
                            .header { padding: 40px 25px; }
                            .content { padding: 35px 25px; }
                            .info-grid { grid-template-columns: 1fr; }
                            .video-link { padding: 15px 35px; font-size: 15px; }
                        }
                    </style>
                </head>
                <body>
                    <div class="container">
                        <div class="header">
                            <div class="logo">LIVINGPICTURE</div>
                            <div class="tagline">Preserving Memories, Creating Legacies</div>
                        </div>
                        <div class="content">
                            <p class="greeting">Dear ${firstName},</p>
                            
                            <div class="highlight-box">
                                <p class="body-text" style="margin: 0; font-size: 18px; color: #2c1810; font-weight: 500;">
                                    🎬 Your Living Picture is ready for viewing
                                </p>
                            </div>
                            
                            <p class="body-text">
                                After meticulous craftsmanship and attention to detail, we are delighted to present your completed Living Picture. Your memories have been transformed into a timeless video that you and your loved ones will treasure for generations to come.
                            </p>
                            
                            <div class="cta-wrapper">
                                <a href="${videoLink}" class="video-link">VIEW YOUR LIVING PICTURE</a>
                            </div>
                            
                            <div class="info-grid">
                                <div class="info-item">
                                    <div class="info-icon">⏰</div>
                                    <div class="info-title">SECURE ACCESS</div>
                                    <div class="info-text">Link expires in 7 days</div>
                                </div>
                                <div class="info-item">
                                    <div class="info-icon">👥</div>
                                    <div class="info-title">SHARE WITH FAMILY</div>
                                    <div class="info-text">Send to loved ones</div>
                                </div>
                                <div class="info-item">
                                    <div class="info-icon">⬇️</div>
                                    <div class="info-title">DOWNLOAD</div>
                                    <div class="info-text">Save permanently</div>
                                </div>
                                <div class="info-item">
                                    <div class="info-icon">📱</div>
                                    <div class="info-title">ANY DEVICE</div>
                                    <div class="info-text">Watch anywhere</div>
                                </div>
                            </div>
                            
                            <p class="body-text">
                                This secure link provides exclusive access to your Living Picture. We encourage you to download your video for permanent safekeeping, as the link will expire after 7 days to maintain security and privacy.
                            </p>
                            
                            <p class="body-text">
                                Should you wish to create additional Living Pictures or require any assistance, our dedicated team is here to support you every step of the way.
                            </p>
                            
                            <p class="signature">
                                With warmest regards,<br>
                                The Living Picture Team
                            </p>
                        </div>
                        <div class="footer">
                            <div>Thank you for trusting us with your precious memories</div>
                            <div class="order-info">Order ID: ${orderId}</div>
                            <div class="social-links">
                                <a href="#">Website</a> • 
                                <a href="#">Instagram</a> • 
                                <a href="#">Contact</a>
                            </div>
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
