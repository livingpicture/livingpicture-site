const Airtable = require('airtable');

// CORS headers
const CORS_HEADERS = {
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Headers': 'Content-Type',
    'Access-Control-Allow-Methods': 'POST, OPTIONS'
};

const PRICING = {
    '1-5': {
        ILS: 20,
        USD: 5.50,
        EUR: 5.00,
        RUB: 500
    },
    '6-15': {
        ILS: 18,
        USD: 4.95,
        EUR: 4.50,
        RUB: 450
    },
    '16-25': {
        ILS: 16,
        USD: 4.40,
        EUR: 4.00,
        RUB: 400
    },
    '26+': {
        ILS: 14,
        USD: 3.85,
        EUR: 3.50,
        RUB: 350
    }
};

function calculatePrice(photoCount, currency) {
    const tier = photoCount <= 5 ? '1-5' :
                 photoCount <= 15 ? '6-15' :
                 photoCount <= 25 ? '16-25' : '26+';
    
    const pricePerPhoto = PRICING[tier]?.[currency] || PRICING[tier]?.['USD'];
    const total = pricePerPhoto * photoCount;

    return { 
        total,
        pricePerPhoto,
        tier
    };
}

// Helper function to create response
function createResponse(statusCode, body) {
    return {
        statusCode,
        headers: {
            ...CORS_HEADERS,
            'Content-Type': 'application/json'
        },
        body: JSON.stringify(body)
    };
}

exports.handler = async (event, context) => {
    console.log('=== Lead Upsert Function Started ===');
    console.log('HTTP Method:', event.httpMethod);
    console.log('Raw request body:', event.body);
    
    // Handle CORS preflight
    if (event.httpMethod === 'OPTIONS') {
        return {
            statusCode: 200,
            headers: CORS_HEADERS,
            body: ''
        };
    }
    
    // Only allow POST requests
    if (event.httpMethod !== 'POST') {
        const errorMessage = 'Method Not Allowed - Only POST requests are accepted';
        console.error(errorMessage);
        return createResponse(405, {
            ok: false,
            error: 'Method Not Allowed',
            message: errorMessage,
            allowedMethods: ['POST']
        });
    }
    
    // Parse and validate request body
    let requestBody;
    try {
        requestBody = event.body ? JSON.parse(event.body) : {};
        console.log('Parsed request body:', JSON.stringify(requestBody, null, 2));
    } catch (parseError) {
        const errorMessage = 'Failed to parse request body';
        console.error(errorMessage, parseError);
        return createResponse(400, {
            ok: false,
            error: 'Invalid JSON',
            message: errorMessage,
            details: parseError.message
        });
    }

    // Check for required environment variables
    const { 
        AIRTABLE_API_KEY, 
        AIRTABLE_BASE_ID, 
        AIRTABLE_LEADS_TABLE 
    } = process.env;

    const missingEnvVars = [];
    if (!AIRTABLE_API_KEY) missingEnvVars.push('AIRTABLE_API_KEY');
    if (!AIRTABLE_BASE_ID) missingEnvVars.push('AIRTABLE_BASE_ID');
    if (!AIRTABLE_LEADS_TABLE) missingEnvVars.push('AIRTABLE_LEADS_TABLE');

    if (missingEnvVars.length > 0) {
        const errorMessage = `Missing required environment variables: ${missingEnvVars.join(', ')}`;
        console.error(errorMessage);
        return createResponse(500, {
            ok: false,
            error: 'Server Configuration Error',
            message: errorMessage,
            missingVariables: missingEnvVars
        });
    }

    const { leadId, photoCount, currency, ...leadData } = requestBody;

    // Calculate pricing
    const pricing = calculatePrice(photoCount, currency);

    // If this is just a price check, return the pricing and exit
    if (leadId === 'temp-price-check') {
        return {
            statusCode: 200,
            headers: {
                'Access-Control-Allow-Origin': '*',
                'Access-Control-Allow-Headers': 'Content-Type',
                'Content-Type': 'application/json'
            },
            body: JSON.stringify({ pricing })
        };
    }

    // Airtable Base
    const base = new Airtable({ apiKey: AIRTABLE_API_KEY }).base(AIRTABLE_BASE_ID);
    const table = base(AIRTABLE_LEADS_TABLE);

    try {
        // Extract and validate required fields
        const {
            leadId,
            step,
            memoryTitle,
            photoCount,
            imageUrls,
            customerName,
            customerEmail,
            country,
            currency,
            totalAmount,
            detectedCurrency,
            selectedCurrency,
            sessionId
        } = requestBody;
        
        // Validate required fields
        const missingFields = [];
        if (!leadId) missingFields.push('leadId');
        if (!step) missingFields.push('step');
        
        if (missingFields.length > 0) {
            const errorMessage = `Missing required fields: ${missingFields.join(', ')}`;
            console.error('Validation error:', errorMessage);
            return createResponse(400, {
                ok: false,
                error: 'Validation Error',
                message: errorMessage,
                missingFields,
                receivedData: {
                    hasLeadId: !!leadId,
                    hasStep: !!step,
                    otherFields: Object.keys(requestBody)
                }
            });
        }

        let pricingData = {};
        if (photoCount && currency) {
            pricingData = calculatePrice(photoCount, currency);
        }

        const airtableData = {
            leadId,
            memoryTitle,
            photoCount,
            imageUrls: Array.isArray(imageUrls) ? imageUrls.join(',') : (typeof imageUrls === 'string' ? imageUrls : undefined),
            customerName,
            customerEmail,
            country,
            currency,
            totalAmount: totalAmount || (pricingData ? pricingData.total : undefined),
            detectedCurrency,
            selectedCurrency,
            sessionId,
            step,
            'Last Updated': new Date().toISOString(),
        };

        // Remove undefined fields to avoid overwriting existing data with nulls
        Object.keys(airtableData).forEach(key => airtableData[key] === undefined && delete airtableData[key]);

        // Find existing record by leadId
        const records = await base(AIRTABLE_LEADS_TABLE).select({
            filterByFormula: `{leadId} = '${leadId}'`,
            maxRecords: 1
        }).firstPage();

        let airtableRecord;
        if (records.length > 0) {
            // Update existing record
            const recordToUpdate = records[0];
            const updatedRecords = await base(AIRTABLE_LEADS_TABLE).update([{
                id: recordToUpdate.id,
                fields: airtableData
            }]);
            airtableRecord = updatedRecords[0];
            console.log('Airtable record updated:', airtableRecord.id);
        } else {
            // Create new record
            const createdRecords = await base(AIRTABLE_LEADS_TABLE).create([{
                fields: airtableData
            }]);
            airtableRecord = createdRecords[0];
            console.log('Airtable record created:', airtableRecord.id);
        }

        return createResponse(200, {
            ok: true,
            leadId: airtableRecord.fields.leadId,
            airtableId: airtableRecord.id,
            pricing: pricingData,
            message: 'Lead upserted successfully'
        });

    } catch (error) {
        console.error('=== Error processing lead ===');
        console.error('Error message:', error.message);
        console.error('Error stack:', error.stack);
        
        return createResponse(500, {
            ok: false,
            error: 'Internal Server Error',
            message: 'An unexpected error occurred while processing your request',
            details: process.env.NODE_ENV === 'development' ? error.message : undefined
        });
    }
};