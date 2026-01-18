// DEPRECATED: This function is no longer in use. Please use the create-order function instead.

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
        const { leadId: rawLeadId, step: rawStep, ...otherFields } = requestBody;
        
        // Trim and validate required fields
        const leadId = typeof rawLeadId === 'string' ? rawLeadId.trim() : '';
        const step = typeof rawStep === 'string' ? rawStep.trim() : '';
        
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
        
        // Sanitize and validate other fields
        const sanitizedFields = {};
        const allowedFields = [
            'sessionId', 'country', 'currency', 'customerEmail', 'customerName',
            'memoryTitle', 'songChoice', 'photoCount', 'totalAmount', 'imageUrls',
            'utmSource', 'utmCampaign', 'email', 'name' // Include aliases for backward compatibility
        ];
        
        // Process only allowed fields
        Object.entries(otherFields).forEach(([key, value]) => {
            if (allowedFields.includes(key)) {
                // Handle string fields
                if (typeof value === 'string') {
                    sanitizedFields[key] = value.trim();
                } 
                // Handle array fields (specifically imageUrls)
                else if (key === 'imageUrls' && Array.isArray(value)) {
                    console.log(`Processing ${value.length} image URLs:`);
                    value.forEach((url, index) => {
                        console.log(`  [${index + 1}] ${typeof url === 'string' ? url : 'Invalid URL (not a string)'}`);
                    });
                    sanitizedFields[key] = value.length > 0 ? value.join(',') : '';
                }
                // Handle number fields
                else if (['photoCount', 'totalAmount'].includes(key)) {
                    sanitizedFields[key] = Number(value) || 0;
                }
                // Handle other cases
                else {
                    sanitizedFields[key] = value || '';
                }
            }
        });

        // Validate photoCount matches the number of image URLs if both are provided
        if (sanitizedFields.photoCount > 0 && sanitizedFields.imageUrls) {
            const urlCount = sanitizedFields.imageUrls.split(',').filter(Boolean).length;
            console.log(`Validating photo count: ${sanitizedFields.photoCount} (expected) vs ${urlCount} (actual URLs)`);
            
            if (sanitizedFields.photoCount !== urlCount) {
                const errorMessage = `Photo count (${sanitizedFields.photoCount}) does not match the number of image URLs (${urlCount})`;
                console.error('Validation error:', errorMessage);
                return createResponse(400, {
                    ok: false,
                    error: 'Validation Error',
                    message: errorMessage,
                    details: {
                        photoCount: sanitizedFields.photoCount,
                        urlCount,
                        imageUrls: sanitizedFields.imageUrls.split(',').map(url => url.trim()).filter(Boolean)
                    }
                });
            }
        }

        // Initialize Airtable
        const base = new Airtable({ apiKey: AIRTABLE_API_KEY }).base(AIRTABLE_BASE_ID);
        const table = base(AIRTABLE_LEADS_TABLE);

        // Prepare record data with only allowed and properly formatted fields
        const recordFields = {
            leadId,
            step,
            sessionId: sanitizedFields.sessionId || '',
            country: sanitizedFields.country || '',
            currency: (sanitizedFields.currency || 'ILS').toUpperCase(),
            customerEmail: sanitizedFields.customerEmail || sanitizedFields.email || '',
            customerName: sanitizedFields.customerName || sanitizedFields.name || '',
            memoryTitle: sanitizedFields.memoryTitle || '',
            songChoice: sanitizedFields.songChoice || '',
            photoCount: Number(sanitizedFields.photoCount) || 0,
            totalAmount: Number(sanitizedFields.totalAmount) || 0,
            imageUrls: Array.isArray(sanitizedFields.imageUrls) 
                ? sanitizedFields.imageUrls.join(',') 
                : (sanitizedFields.imageUrls || ''),
            utmSource: sanitizedFields.utmSource || '',
            utmCampaign: sanitizedFields.utmCampaign || ''
        };
        
        // Log the sanitized data being sent to Airtable
        console.log('Sanitized record fields for Airtable:', JSON.stringify({
            ...recordFields,
            // Truncate long fields in logs for better readability
            imageUrls: recordFields.imageUrls ? 
                (recordFields.imageUrls.length > 100 ? 
                    recordFields.imageUrls.substring(0, 100) + '...' : 
                    recordFields.imageUrls) : 
                null
        }, null, 2));

        // Log detailed image URL information
        if (recordFields.imageUrls) {
            const urls = recordFields.imageUrls.split(',').filter(Boolean);
            console.log(`Saving ${urls.length} image URLs to Airtable:`);
            urls.forEach((url, index) => {
                console.log(`  [${index + 1}] ${url}`);
            });
        }

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
                result = await table.update([{
                    id: recordId,
                    fields: recordFields
                }]);
            } else {
                // Create new record
                console.log(`Creating new record for lead ${leadId}`);
                result = await table.create([{ fields: recordFields }]);
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