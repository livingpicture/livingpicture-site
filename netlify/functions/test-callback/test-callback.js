// Test function to simulate PayPlus callback
exports.handler = async (event, context) => {
    console.log('=== Test Callback Function Started ===');
    
    // Simulate a PayPlus callback payload
    const testPayload = {
        transaction_type: "Charge",
        transaction: {
            uid: "test-uid-" + Date.now(),
            status_code: "000",
            amount: 1,
            currency: "ILS",
            more_info: JSON.stringify({
                leadId: "test_lead_" + Date.now(),
                orderId: "test_order_" + Date.now(),
                source: "memory-book-order"
            }),
            more_info_1: "test_lead_" + Date.now(),
            more_info_2: "test_order_" + Date.now()
        },
        data: {
            customer_email: "test@example.com",
            customer: {
                name: "Test Customer",
                country_iso: "IL"
            }
        }
    };
    
    // Call the actual callback function
    const { handler: callbackHandler } = require('../payplus-callback/payplus-callback.js');
    
    // Create a mock event with the test payload
    const mockEvent = {
        httpMethod: 'POST',
        body: JSON.stringify(testPayload)
    };
    
    try {
        const result = await callbackHandler(mockEvent, context);
        console.log('Test callback result:', result);
        
        return {
            statusCode: 200,
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                ok: true,
                message: 'Test callback executed',
                result: JSON.parse(result.body)
            })
        };
    } catch (error) {
        console.error('Test callback error:', error);
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
