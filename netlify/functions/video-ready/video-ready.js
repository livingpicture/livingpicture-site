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
                <table width="100%" border="0" cellspacing="0" cellpadding="0" style="background-color: #F6F1EA; font-family: Arial, Helvetica, sans-serif; margin: 0; padding: 0;">
                    <tr>
                        <td align="center" style="padding: 40px 20px;">
                            <table width="100%" max-width="600" border="0" cellspacing="0" cellpadding="0" style="max-width: 600px; background-color: #ffffff; border-radius: 0px; overflow: hidden;">
                                
                                <!-- Header -->
                                <tr>
                                    <td style="background-color: #F6F1EA; padding: 50px 40px; text-align: center;">
                                        <h1 style="font-family: Georgia, 'Times New Roman', serif; font-size: 24px; font-weight: normal; color: #2B2521; margin: 0; letter-spacing: 3px;">LIVINGPICTURE</h1>
                                    </td>
                                </tr>
                                
                                <!-- Gold Line Divider -->
                                <tr>
                                    <td style="border-top: 1px solid #B08D57; height: 1px;"></td>
                                </tr>
                                
                                <!-- Content -->
                                <tr>
                                    <td style="padding: 60px 40px; color: #2B2521;">
                                        
                                        <!-- Greeting -->
                                        <p style="font-family: Georgia, 'Times New Roman', serif; font-size: 18px; color: #2B2521; margin: 0 0 30px 0; line-height: 1.8;">Dear ${firstName},</p>
                                        
                                        <!-- Main Message -->
                                        <p style="font-family: Arial, Helvetica, sans-serif; font-size: 16px; color: #2B2521; margin: 0 0 20px 0; line-height: 1.8;">Your Living Picture is ready.</p>
                                        
                                        <p style="font-family: Arial, Helvetica, sans-serif; font-size: 16px; color: #2B2521; margin: 0 0 40px 0; line-height: 1.8;">View and download it securely using the button below. This link remains active for 7 days.</p>
                                        
                                        <!-- CTA Button -->
                                        <table border="0" cellspacing="0" cellpadding="0" align="center" style="margin: 40px 0;">
                                            <tr>
                                                <td align="center" style="background-color: #2B2521; border-radius: 12px;">
                                                    <a href="${videoLink}" style="display: inline-block; padding: 18px 40px; font-family: Arial, Helvetica, sans-serif; font-size: 16px; font-weight: normal; color: #ffffff; text-decoration: none; border-radius: 12px; white-space: nowrap;">View Your Living Picture</a>
                                                </td>
                                            </tr>
                                        </table>
                                        
                                        <!-- Secondary Link -->
                                        <table border="0" cellspacing="0" cellpadding="0" align="center" style="margin: 20px 0 40px 0;">
                                            <tr>
                                                <td align="center">
                                                    <a href="${videoLink}" style="font-family: Arial, Helvetica, sans-serif; font-size: 14px; color: #666666; text-decoration: underline;">Or open in browser</a>
                                                </td>
                                            </tr>
                                        </table>
                                        
                                        <!-- Footer -->
                                        <table border="0" cellspacing="0" cellpadding="0" width="100%" style="margin-top: 60px;">
                                            <tr>
                                                <td align="center" style="padding: 30px 0 0 0; border-top: 1px solid #E8E8E8;">
                                                    <p style="font-family: Arial, Helvetica, sans-serif; font-size: 12px; color: #888888; margin: 0 0 10px 0; line-height: 1.6;">Order ID: ${orderId}</p>
                                                    <p style="font-family: Arial, Helvetica, sans-serif; font-size: 12px; color: #888888; margin: 0 0 10px 0; line-height: 1.6;">
                                                        <a href="mailto:support@livingpicture.net" style="color: #888888; text-decoration: none;">support@livingpicture.net</a>
                                                    </p>
                                                </td>
                                            </tr>
                                        </table>
                                        
                                    </td>
                                </tr>
                                
                            </table>
                        </td>
                    </tr>
                </table>
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
