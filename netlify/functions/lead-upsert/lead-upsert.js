// Helper function to escape single quotes in strings for Airtable formulas
function escapeSingleQuotes(str) {
    if (typeof str !== 'string') return str;
    return str.replace(/'/g, "''");
}

// CORS headers
const CORS_HEADERS = {
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Headers': 'Content-Type',
    'Access-Control-Allow-Methods': 'POST, OPTIONS'
};

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

// Import Airtable
const Airtable = require('airtable');

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

    try {
        // Extract and validate required fields
        const { leadId, step, ...otherFields } = requestBody;
        
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
                    otherFields: Object.keys(otherFields)
                }
            });
        }

        // Initialize Airtable
        const base = new Airtable({ apiKey: AIRTABLE_API_KEY }).base(AIRTABLE_BASE_ID);
        const table = base(AIRTABLE_LEADS_TABLE);

        // Prepare record data - using exact field names from Airtable schema
        const recordData = {
            leadId,
            step,
            ...otherFields,
            // Include all possible fields from the form
            sessionId: otherFields.sessionId || '',
            country: otherFields.country || '',
            currency: otherFields.currency || 'ILS',
            customerEmail: otherFields.customerEmail || otherFields.email || '',
            customerName: otherFields.customerName || otherFields.name || '',
            memoryTitle: otherFields.memoryTitle || '',
            songChoice: otherFields.songChoice || '',
            photoCount: otherFields.photoCount || 0,
            totalAmount: otherFields.totalAmount || 0,
            imageUrls: otherFields.imageUrls || []
        };

        // Log the data being sent to Airtable
        console.log('Preparing to upsert record with data:', JSON.stringify(recordData, null, 2));

        let result;
        try {
            // Check if a record with this leadId already exists
            const existingRecords = await table.select({
                filterByFormula: `{leadId} = '${escapeSingleQuotes(leadId)}'`,
                maxRecords: 1
            }).firstPage();

            if (existingRecords && existingRecords.length > 0) {
                // Update existing record
                const recordId = existingRecords[0].id;
                console.log(`Updating existing record ${recordId} for lead ${leadId}`);
                result = await table.update(recordId, recordData);
            } else {
                // Create new record
                console.log(`Creating new record for lead ${leadId}`);
                result = await table.create(recordData);
            }

            // Log the Airtable response
            console.log('Airtable response:', JSON.stringify(result, null, 2));

            return createResponse(200, {
                ok: true,
                message: 'Lead data processed successfully',
                recordId: result.id
            });

        } catch (airtableError) {
            console.error('Airtable operation failed:', airtableError);
            if (airtableError.error) {
                console.error('Airtable error details:', JSON.stringify(airtableError.error, null, 2));
            }
            throw airtableError; // Re-throw to be caught by the outer catch
        }

    } catch (error) {
        console.error('=== Error processing lead ===');
        console.error('Error message:', error.message);
        console.error('Error stack:', error.stack);
        
        // Enhanced error details for debugging
        const errorResponse = {
            ok: false,
            error: 'Internal Server Error',
            message: 'An unexpected error occurred while processing your request',
            details: {
                message: error.message,
                type: error.name
            }
        };

        // Add more details in development
        if (process.env.NODE_ENV === 'development') {
            errorResponse.details.stack = error.stack;
            if (error.error) {
                errorResponse.details.airtableError = error.error;
            }
        } else {
            // In production, only include non-sensitive error information
            errorResponse.details = undefined;
        }

        return createResponse(500, errorResponse);
    }
};