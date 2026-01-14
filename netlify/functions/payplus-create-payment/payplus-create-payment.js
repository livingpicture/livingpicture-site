// Netlify function to create a PayPlus payment
// Environment variables required:
// - PAYPLUS_API_KEY: Your PayPlus API key
// - PAYPLUS_PAYMENT_PAGE_UID: Your PayPlus payment page UID
// - PAYPLUS_SECRET_KEY: Your PayPlus secret key

// Function version for tracking
const FUNC_VERSION = "payplus-create-payment@2026-01-14-1";

// Helper function to create consistent responses
function createResponse(statusCode, body, headers = {}) {
    return {
        statusCode,
        headers: {
            'Content-Type': 'application/json',
            'X-Func-Version': FUNC_VERSION,
            ...headers
        },
        body: JSON.stringify({
            ...(typeof body === 'string' ? { message: body } : body),
            debug: {
                ...(typeof body === 'object' && body.debug ? body.debug : {}),
                version: FUNC_VERSION
            }
        })
    };
}

exports.handler = async (event, context) => {
    // Only allow POST requests
    if (event.httpMethod !== 'POST') {
        return createResponse(405, { 
            ok: false, 
            error: 'Method Not Allowed' 
        }, { 'Allow': 'POST' });
    }

    try {
        // Parse request body
        let requestBody;
        try {
            requestBody = JSON.parse(event.body);
        } catch (e) {
            return createResponse(400, {
                ok: false,
                error: 'Invalid JSON in request body'
            });
        }

        console.log('Received request with keys:', Object.keys(requestBody));

        // Validate required fields
        const { amount, currency = 'USD', leadId, orderId } = requestBody;
        const errors = [];

        // Log received orderId for debugging
        console.log('Received orderId:', orderId);

        if (typeof amount !== 'number' || isNaN(amount) || amount <= 0) {
            errors.push('amount must be a positive number');
        }

        const allowedCurrencies = ['USD', 'ILS', 'EUR'];
        if (!allowedCurrencies.includes(currency)) {
            errors.push(`currency must be one of: ${allowedCurrencies.join(', ')}`);
        }

        if (errors.length > 0) {
            return createResponse(400, {
                ok: false,
                error: 'Validation failed',
                details: errors
            });
        }

        // Build clean API key from environment
        const rawApiKey = String(process.env.PAYPLUS_API_KEY || "");
        const apiKey = rawApiKey.replace(/^Bearer\s+/i, "").trim();
        if (!apiKey) {
            return createResponse(500, { 
                ok: false, 
                error: "Missing PAYPLUS_API_KEY" 
            });
        }

        // Get base URL with fallback to production
        const baseUrl = String(process.env.PAYPLUS_BASE_URL || "").trim() || "https://restapi.payplus.co.il/api/v1.0";
        
        // Get required configuration from environment
        const paymentPageUid = String(process.env.PAYPLUS_PAYMENT_PAGE_UID || "").trim();
        const siteUrl = String(process.env.SITE_URL || "").trim();
        const successUrl = String(process.env.PAYPLUS_SUCCESS_URL || "").trim() || `${siteUrl}/thank-you.html`;

        // Validate required configuration
        if (!paymentPageUid || !siteUrl) {
            const missing = [];
            if (!paymentPageUid) missing.push('PAYPLUS_PAYMENT_PAGE_UID');
            if (!siteUrl) missing.push('SITE_URL');
            
            return createResponse(500, {
                ok: false,
                error: `Missing required configuration: ${missing.join(', ')}`
            });
        }

        // Log the start of the payment process (without sensitive data)
        console.log('Starting payment process with PayPlus');

        // Prepare PayPlus request payload
        const paymentData = {
            payment_page_uid: paymentPageUid,
            amount: amount * 100, // Convert to agorot/cent
            currency_code: currency,
            item_name: 'Memory Book Order',
            item_description: `Memory Book Order${leadId ? ` (${leadId})` : ''}${orderId ? ` [orderId: ${orderId}]` : ''}`,
            success_url: successUrl || `${siteUrl}/thank-you.html`,
            cancel_url: `${siteUrl}/payment-failed.html`,
            callback_url: `${siteUrl}/.netlify/functions/payplus-callback`,
            metadata: {
                leadId: leadId || `lead_${Date.now()}`,
                orderId: orderId,
                source: 'memory-book-order',
                timestamp: new Date().toISOString()
            }
        };

        // Make request to PayPlus API
        const response = await fetch(`${baseUrl}/PaymentPages/generateLink`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${apiKey}`
            },
            body: JSON.stringify(paymentData)
        });

        // Get response as text first to properly log errors
        const responseText = await response.text();
        let responseData;
        
        try {
            responseData = JSON.parse(responseText);
        } catch (e) {
            console.error('Failed to parse PayPlus response:', responseText);
            return createResponse(500, {
                ok: false,
                error: 'Invalid response from payment provider',
                details: 'Could not parse response as JSON'
            });
        }

        if (!response.ok) {
            console.error('PayPlus API error:', {
                status: response.status,
                statusText: response.statusText,
                body: responseText
            });

            return createResponse(500, {
                ok: false,
                error: 'Payment processing failed',
                details: responseData?.error_description || response.statusText,
                code: response.status
            });
        }

        // Extract relevant data from PayPlus response
        const paymentUrl = responseData?.results?.url;
        const transactionId = responseData?.results?.transaction_uid;

        if (!paymentUrl || !transactionId) {
            console.error('Received invalid response from PayPlus');
            throw new Error('Invalid response from payment provider');
        }

        // Return success response
        return createResponse(200, {
            ok: true,
            paymentUrl,
            transactionId,
            raw: responseData,
            debug: {
                requestKeys: Object.keys(paymentData),
                responseKeys: responseData ? Object.keys(responseData) : []
            }
        });

    } catch (error) {
        console.error('Error in payplus-create-payment:', error);

        return createResponse(500, {
            ok: false,
            error: 'Internal server error',
            details: process.env.NODE_ENV === 'development' ? error.message : undefined,
            raw: process.env.NODE_ENV === 'development' ? { message: error.message, stack: error.stack } : undefined
        });
    }
};
