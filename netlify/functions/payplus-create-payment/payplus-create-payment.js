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

        // Read and trim environment variables
        const requiredVars = [
            'PAYPLUS_API_KEY',
            'PAYPLUS_SECRET_KEY',
            'PAYPLUS_BASE_URL',
            'SITE_URL',
            'PAYPLUS_PAYMENT_PAGE_UID'
        ];
        
        const env = {};
        const missingVars = [];
        
        // Load and validate required variables
        for (const varName of requiredVars) {
            const value = String(process.env[varName] || '').trim();
            if (!value) {
                missingVars.push(varName);
            }
            env[varName] = value;
        }
        
        if (missingVars.length > 0) {
            return createResponse(500, {
                ok: false,
                error: `Missing required environment variables: ${missingVars.join(', ')}`
            });
        }
        
        // Optional variables
        const successUrl = String(process.env.PAYPLUS_SUCCESS_URL || '').trim() || `${env.SITE_URL}/thank-you.html`;


        // Prepare PayPlus request payload
        const paymentData = {
            payment_page_uid: env.PAYPLUS_PAYMENT_PAGE_UID,
            amount: amount * 100, // Convert to agorot/cent
            currency_code: currency,
            item_name: 'Memory Book Order',
            item_description: `Memory Book Order${leadId ? ` (${leadId})` : ''}${orderId ? ` [orderId: ${orderId}]` : ''}`,
            success_url: successUrl,
            cancel_url: `${env.SITE_URL}/payment-failed.html`,
            callback_url: `${env.SITE_URL}/.netlify/functions/payplus-callback`,
            metadata: {
                leadId: leadId || `lead_${Date.now()}`,
                orderId: orderId,
                source: 'memory-book-order',
                timestamp: new Date().toISOString()
            }
        };

        // Make request to PayPlus API
        const response = await fetch(`${env.PAYPLUS_BASE_URL}/PaymentPages/generateLink`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${env.PAYPLUS_API_KEY}`
            },
            body: JSON.stringify(paymentData)
        });

        const responseData = await response.json();
        console.log('PayPlus response keys:', responseData ? Object.keys(responseData) : 'No response data');

        if (!response.ok) {
            console.error('PayPlus API error:', {
                status: response.status,
                statusText: response.statusText,
                data: responseData
            });

            return createResponse(500, {
                ok: false,
                error: 'Payment processing failed',
                details: responseData?.error_description || 'Unknown error from payment provider',
                raw: responseData
            });
        }

        // Extract relevant data from PayPlus response
        const paymentUrl = responseData?.results?.url;
        const transactionId = responseData?.results?.transaction_uid;

        if (!paymentUrl || !transactionId) {
            console.error('Invalid PayPlus response:', responseData);
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
