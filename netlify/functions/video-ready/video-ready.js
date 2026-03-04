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
                <table width="100%" border="0" cellspacing="0" cellpadding="0" style="background-color: #F6F1EB; font-family: 'Helvetica Neue', Arial, sans-serif; margin: 0; padding: 0;">
                    <tr>
                        <td align="center" style="padding: 20px 10px;">
                            <table width="100%" max-width="600" border="0" cellspacing="0" cellpadding="0" style="max-width: 600px; background-color: #ffffff; border-radius: 16px; overflow: hidden; box-shadow: 0 4px 20px rgba(58, 31, 20, 0.1);">
                                
                                <!-- Header -->
                                <tr>
                                    <td style="background: linear-gradient(135deg, #3A1F14 0%, #B08D57 100%); padding: 40px; text-align: center;">
                                        <h1 style="font-family: 'Helvetica Neue', Arial, sans-serif; font-size: 28px; font-weight: bold; color: #ffffff; margin: 0; letter-spacing: 1px;">LIVINGPICTURE</h1>
                                        <p style="font-family: 'Helvetica Neue', Arial, sans-serif; font-size: 14px; color: rgba(255,255,255,0.9); margin: 8px 0 0 0; font-weight: 300;">Preserving Memories, Creating Legacies</p>
                                    </td>
                                </tr>
                                
                                <!-- Content -->
                                <tr>
                                    <td style="padding: 40px; color: #2C2C2C;">
                                        
                                        <!-- Greeting -->
                                        <p style="font-family: 'Helvetica Neue', Arial, sans-serif; font-size: 20px; color: #2C2C2C; margin: 0 0 20px 0; line-height: 1.7;">Dear ${firstName},</p>
                                        
                                        <!-- Main Message -->
                                        <p style="font-family: 'Helvetica Neue', Arial, sans-serif; font-size: 16px; color: #2C2C2C; margin: 0 0 20px 0; line-height: 1.7;">Your memory has been beautifully brought back to life.</p>
                                        
                                        <p style="font-family: 'Helvetica Neue', Arial, sans-serif; font-size: 16px; color: #2C2C2C; margin: 0 0 30px 0; line-height: 1.7;">After meticulous craftsmanship and attention to detail, we are delighted to present your completed Living Picture. Your memories have been transformed into a timeless film that you and your loved ones will treasure for generations to come.</p>
                                        
                                        <!-- CTA Button -->
                                        <table border="0" cellspacing="0" cellpadding="0" align="center" style="margin: 30px 0;">
                                            <tr>
                                                <td align="center" style="background: linear-gradient(135deg, #3A1F14 0%, #5C3A2A 100%); border-radius: 30px; box-shadow: 0 4px 15px rgba(58, 31, 20, 0.2);">
                                                    <a href="${videoLink}" style="display: inline-block; padding: 14px 28px; font-family: 'Helvetica Neue', Arial, sans-serif; font-size: 16px; font-weight: 600; color: #ffffff; text-decoration: none; border-radius: 30px; white-space: nowrap;">Watch Your Film</a>
                                                </td>
                                            </tr>
                                        </table>
                                        
                                        <!-- Info Section -->
                                        <table border="0" cellspacing="0" cellpadding="0" width="100%" style="margin: 30px 0;">
                                            <tr>
                                                <td width="50%" style="padding: 0 10px 20px 0;" valign="top">
                                                    <table border="0" cellspacing="0" cellpadding="0" width="100%" style="background-color: #FAFAFA; border-radius: 12px; padding: 20px;">
                                                        <tr>
                                                            <td align="center">
                                                                <div style="font-size: 24px; margin-bottom: 8px;">⏰</div>
                                                                <h4 style="font-family: 'Helvetica Neue', Arial, sans-serif; font-size: 14px; font-weight: 600; color: #2C2C2C; margin: 0 0 4px 0;">SECURE ACCESS</h4>
                                                                <p style="font-family: 'Helvetica Neue', Arial, sans-serif; font-size: 13px; color: #8A7F75; margin: 0; line-height: 1.5;">Link expires in 7 days</p>
                                                            </td>
                                                        </tr>
                                                    </table>
                                                </td>
                                                <td width="50%" style="padding: 0 0 20px 10px;" valign="top">
                                                    <table border="0" cellspacing="0" cellpadding="0" width="100%" style="background-color: #FAFAFA; border-radius: 12px; padding: 20px;">
                                                        <tr>
                                                            <td align="center">
                                                                <div style="font-size: 24px; margin-bottom: 8px;">👥</div>
                                                                <h4 style="font-family: 'Helvetica Neue', Arial, sans-serif; font-size: 14px; font-weight: 600; color: #2C2C2C; margin: 0 0 4px 0;">SHARE WITH FAMILY</h4>
                                                                <p style="font-family: 'Helvetica Neue', Arial, sans-serif; font-size: 13px; color: #8A7F75; margin: 0; line-height: 1.5;">Send to loved ones</p>
                                                            </td>
                                                        </tr>
                                                    </table>
                                                </td>
                                            </tr>
                                            <tr>
                                                <td width="50%" style="padding: 0 10px 0 0;" valign="top">
                                                    <table border="0" cellspacing="0" cellpadding="0" width="100%" style="background-color: #FAFAFA; border-radius: 12px; padding: 20px;">
                                                        <tr>
                                                            <td align="center">
                                                                <div style="font-size: 24px; margin-bottom: 8px;">⬇️</div>
                                                                <h4 style="font-family: 'Helvetica Neue', Arial, sans-serif; font-size: 14px; font-weight: 600; color: #2C2C2C; margin: 0 0 4px 0;">DOWNLOAD</h4>
                                                                <p style="font-family: 'Helvetica Neue', Arial, sans-serif; font-size: 13px; color: #8A7F75; margin: 0; line-height: 1.5;">Save permanently</p>
                                                            </td>
                                                        </tr>
                                                    </table>
                                                </td>
                                                <td width="50%" style="padding: 0 0 0 10px;" valign="top">
                                                    <table border="0" cellspacing="0" cellpadding="0" width="100%" style="background-color: #FAFAFA; border-radius: 12px; padding: 20px;">
                                                        <tr>
                                                            <td align="center">
                                                                <div style="font-size: 24px; margin-bottom: 8px;">📱</div>
                                                                <h4 style="font-family: 'Helvetica Neue', Arial, sans-serif; font-size: 14px; font-weight: 600; color: #2C2C2C; margin: 0 0 4px 0;">ANY DEVICE</h4>
                                                                <p style="font-family: 'Helvetica Neue', Arial, sans-serif; font-size: 13px; color: #8A7F75; margin: 0; line-height: 1.5;">Watch anywhere</p>
                                                            </td>
                                                        </tr>
                                                    </table>
                                                </td>
                                            </tr>
                                        </table>
                                        
                                        <!-- Additional Information -->
                                        <p style="font-family: 'Helvetica Neue', Arial, sans-serif; font-size: 16px; color: #2C2C2C; margin: 0 0 20px 0; line-height: 1.7;">This secure link provides exclusive access to your Living Picture. We encourage you to download your film for permanent safekeeping.</p>
                                        
                                        <p style="font-family: 'Helvetica Neue', Arial, sans-serif; font-size: 16px; color: #2C2C2C; margin: 0 0 30px 0; line-height: 1.7;">Should you wish to create additional Living Pictures or require any assistance, our dedicated team is here to support you every step of the way.</p>
                                        
                                        <!-- Signature -->
                                        <p style="font-family: 'Helvetica Neue', Arial, sans-serif; font-size: 16px; color: #2C2C2C; margin: 0 0 10px 0; line-height: 1.7; font-style: italic;">With warmest regards,</p>
                                        <p style="font-family: 'Helvetica Neue', Arial, sans-serif; font-size: 16px; color: #2C2C2C; margin: 0; line-height: 1.7; font-weight: 600;">The Living Picture Team</p>
                                        
                                    </td>
                                </tr>
                                
                                <!-- Footer Divider -->
                                <tr>
                                    <td style="border-top: 1px solid #E8E2D8; height: 1px;"></td>
                                </tr>
                                
                                <!-- Footer -->
                                <tr>
                                    <td style="background-color: #FAFAFA; padding: 30px 40px; text-align: center;">
                                        <p style="font-family: 'Helvetica Neue', Arial, sans-serif; font-size: 13px; color: #8A7F75; margin: 0 0 15px 0; line-height: 1.6;">Order ID: ${orderId}</p>
                                        <p style="font-family: 'Helvetica Neue', Arial, sans-serif; font-size: 13px; color: #8A7F75; margin: 0 0 15px 0; line-height: 1.6;">This private link will remain active for 7 days.</p>
                                        <p style="font-family: 'Helvetica Neue', Arial, sans-serif; font-size: 13px; color: #8A7F75; margin: 0 0 15px 0; line-height: 1.6;">
                                            <a href="mailto:support@livingpicture.net" style="color: #B08D57; text-decoration: none;">support@livingpicture.net</a>
                                        </p>
                                        <p style="font-family: 'Helvetica Neue', Arial, sans-serif; font-size: 11px; color: #8A7F75; margin: 20px 0 0 0; line-height: 1.6;">© 2026 LivingPicture. All rights reserved.</p>
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
