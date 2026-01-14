// Helper function to escape single quotes in strings for Airtable formulas
function escapeSingleQuotes(str) {
    if (typeof str !== 'string') return str;
    return str.replace(/'/g, "''");
}

exports.handler = async (event, context) => {
    console.log('=== Lead Upsert Function Started ===');
    console.log('HTTP Method:', event.httpMethod);
    console.log('Raw request body:', event.body);
    
    // Parse and validate request body
    let requestBody;
    try {
        requestBody = event.body ? JSON.parse(event.body) : {};
        console.log('Parsed request body:', JSON.stringify(requestBody, null, 2));
    } catch (parseError) {
        const errorMessage = 'Failed to parse request body';
        console.error(errorMessage, parseError);
        return {
            statusCode: 400,
            body: JSON.stringify({
                ok: false,
                error: 'Invalid JSON',
                message: errorMessage,
                details: parseError.message
            })
        };
    }
    
    // Only allow POST requests
    if (event.httpMethod !== 'POST') {
        const errorMessage = 'Method Not Allowed - Only POST requests are accepted';
        console.error(errorMessage);
        return {
            statusCode: 405,
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ 
                ok: false, 
                error: 'Method Not Allowed',
                message: errorMessage,
                method: event.httpMethod,
                allowedMethods: ['POST']
            })
        };
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
        return {
            statusCode: 500,
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ 
                ok: false, 
                error: 'Server Configuration Error',
                message: errorMessage,
                missingVariables: missingEnvVars
            })
        };
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
            return {
                statusCode: 400,
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    ok: false,
                    error: 'Validation Error',
                    message: errorMessage,
                    missingFields,
                    receivedData: {
                        hasLeadId: !!leadId,
                        hasStep: !!step,
                        otherFields: Object.keys(otherFields)
                    }
                })
            };
        }
        
        // Validate step format
        const validSteps = ['STEP_1', 'STEP_2', 'STEP_3', 'CHECKOUT'];
        if (!validSteps.includes(step)) {
            const errorMessage = `Invalid step value. Must be one of: ${validSteps.join(', ')}`;
            console.error('Validation error:', errorMessage);
            return {
                statusCode: 400,
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    ok: false,
                    error: 'Validation Error',
                    message: errorMessage,
                    receivedStep: step,
                    validSteps
                })
            };
        }
        
        console.log('Processing lead with ID:', leadId, 'Step:', step);

        // Prepare the record data with proper field mapping and sanitization
        const now = new Date().toISOString();
        const recordData = {
            fields: {
                // Required fields
                leadId: String(leadId).trim(),
                step: step,
                updatedAt: now,
                
                // Map and sanitize other fields
                ...(otherFields.customerEmail && { 
                    customerEmail: String(otherFields.customerEmail).trim() 
                }),
                ...(otherFields.memoryTitle && { 
                    memoryTitle: String(otherFields.memoryTitle).trim() 
                }),
                
                // Handle imageUrls - ensure it's a string
                ...(otherFields.imageUrls !== undefined && { 
                    imageUrls: Array.isArray(otherFields.imageUrls) 
                        ? otherFields.imageUrls.join(',')
                        : String(otherFields.imageUrls)
                }),
                
                // Include all other fields with basic string conversion
                ...Object.fromEntries(
                    Object.entries(otherFields)
                        .filter(([key]) => !['leadId', 'step', 'customerEmail', 'memoryTitle', 'imageUrls'].includes(key))
                        .map(([key, value]) => [
                            key,
                            typeof value === 'object' ? JSON.stringify(value) : String(value)
                        ])
                )
            }
        };
        
        console.log('Prepared record data for Airtable:', JSON.stringify(recordData, null, 2));

        // First, try to find an existing record with this leadId
        // Escape single quotes in leadId for the Airtable formula
        const escapedLeadId = escapeSingleQuotes(leadId);
        const filterFormula = `{leadId}='${escapedLeadId}'`;
        const url = `https://api.airtable.com/v0/${AIRTABLE_BASE_ID}/${encodeURIComponent(AIRTABLE_LEADS_TABLE)}?filterByFormula=${encodeURIComponent(filterFormula)}`;
        
        console.log('Searching for existing lead with filter:', filterFormula);
        
        let findResponse;
        try {
            findResponse = await fetch(url, {
                headers: {
                    'Authorization': `Bearer ${AIRTABLE_API_KEY}`,
                    'Content-Type': 'application/json'
                }
            });

            if (!findResponse.ok) {
                const errorText = await findResponse.text();
                throw new Error(`Airtable API error (${findResponse.status}): ${errorText}`);
            }
        } catch (error) {
            console.error('Error searching for existing lead:', error);
            throw new Error(`Failed to search for existing lead: ${error.message}`);
        }

        let findResult;
        try {
            findResult = await findResponse.json();
            console.log(`Found ${findResult.records ? findResult.records.length : 0} matching records`);
        } catch (parseError) {
            console.error('Failed to parse find response:', parseError);
            throw new Error(`Failed to parse Airtable response: ${parseError.message}`);
        }
        
        let response;

        if (findResult.records && findResult.records.length > 0) {
            // Update existing record
            const existingRecord = findResult.records[0];
            const recordId = existingRecord.id;
            
            console.log(`Updating existing record ${recordId} for lead ${leadId}`);
            
            // Keep the original createdAt if it exists
            recordData.fields.createdAt = existingRecord.fields.createdAt || now;
            
            try {
                response = await fetch(
                    `https://api.airtable.com/v0/${AIRTABLE_BASE_ID}/${encodeURIComponent(AIRTABLE_LEADS_TABLE)}/${recordId}`,
                    {
                        method: 'PATCH',
                        headers: {
                            'Authorization': `Bearer ${AIRTABLE_API_KEY}`,
                            'Content-Type': 'application/json'
                        },
                        body: JSON.stringify({
                            fields: recordData.fields,
                            typecast: true
                        })
                    }
                );
                
                if (!response.ok) {
                    const errorText = await response.text();
                    throw new Error(`Failed to update record (${response.status}): ${errorText}`);
                }
                
                console.log(`Successfully updated record ${recordId} for lead ${leadId}`);
                
            } catch (error) {
                console.error(`Error updating record ${recordId}:`, error);
                throw new Error(`Failed to update lead: ${error.message}`);
            }
            
        } else {
            // Create new record
            recordData.fields.createdAt = now;
            
            console.log(`Creating new record for lead ${leadId}`);
            
            try {
                response = await fetch(
                    `https://api.airtable.com/v0/${AIRTABLE_BASE_ID}/${encodeURIComponent(AIRTABLE_LEADS_TABLE)}`,
                    {
                        method: 'POST',
                        headers: {
                            'Authorization': `Bearer ${AIRTABLE_API_KEY}`,
                            'Content-Type': 'application/json'
                        },
                        body: JSON.stringify({
                            fields: recordData.fields,
                            typecast: true
                        })
                    }
                );
                
                if (!response.ok) {
                    const errorText = await response.text();
                    throw new Error(`Failed to create record (${response.status}): ${errorText}`);
                }
                
                console.log(`Successfully created new record for lead ${leadId}`);
                
            } catch (error) {
                console.error('Error creating new record:', error);
                throw new Error(`Failed to create lead: ${error.message}`);
            }
        }

        let result;
        try {
            result = await response.json();
            console.log('Airtable API response:', JSON.stringify(result, null, 2));
            
            if (!response.ok) {
                console.error('Airtable API error response:', result);
                return {
                    statusCode: response.status,
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({ 
                        ok: false, 
                        error: 'Airtable API Error',
                        message: 'Failed to save lead data',
                        status: response.status,
                        details: result.error || 'Unknown error',
                        requestId: response.headers.get('x-request-id')
                    })
                };
            }
            
            console.log(`Successfully processed lead ${leadId}`);
            
        } catch (parseError) {
            console.error('Failed to parse Airtable response:', parseError);
            return {
                statusCode: 500,
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    ok: false,
                    error: 'Response Parse Error',
                    message: 'Failed to parse Airtable response',

let findResponse;
try {
    findResponse = await fetch(url, {
        headers: {
            'Authorization': `Bearer ${AIRTABLE_API_KEY}`,
            'Content-Type': 'application/json'
        }
    });

    if (!findResponse.ok) {
        const errorText = await findResponse.text();
        throw new Error(`Airtable API error (${findResponse.status}): ${errorText}`);
    }
} catch (error) {
    console.error('Error searching for existing lead:', error);
    throw new Error(`Failed to search for existing lead: ${error.message}`);
}

let findResult;
try {
    findResult = await findResponse.json();
    console.log(`Found ${findResult.records ? findResult.records.length : 0} matching records`);
} catch (parseError) {
    console.error('Failed to parse find response:', parseError);
    throw new Error(`Failed to parse Airtable response: ${parseError.message}`);
}

let response;

if (findResult.records && findResult.records.length > 0) {
    // Update existing record
    const existingRecord = findResult.records[0];
    const recordId = existingRecord.id;
    
    console.log(`Updating existing record ${recordId} for lead ${leadId}`);
    
    // Keep the original createdAt if it exists
    recordData.fields.createdAt = existingRecord.fields.createdAt || now;
    
    try {
        response = await fetch(
            `https://api.airtable.com/v0/${AIRTABLE_BASE_ID}/${encodeURIComponent(AIRTABLE_LEADS_TABLE)}/${recordId}`,
            {
                method: 'PATCH',
                headers: {
                    'Authorization': `Bearer ${AIRTABLE_API_KEY}`,
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify({
                    fields: recordData.fields,
                    typecast: true
                })
            }
        );
        
        if (!response.ok) {
            const errorText = await response.text();
            throw new Error(`Failed to update record (${response.status}): ${errorText}`);
        }
        
        console.log(`Successfully updated record ${recordId} for lead ${leadId}`);
        
    } catch (error) {
        console.error(`Error updating record ${recordId}:`, error);
        throw new Error(`Failed to update lead: ${error.message}`);
    }
    
} else {
    // Create new record
    recordData.fields.createdAt = now;
    
    console.log(`Creating new record for lead ${leadId}`);
    
    try {
        response = await fetch(
            `https://api.airtable.com/v0/${AIRTABLE_BASE_ID}/${encodeURIComponent(AIRTABLE_LEADS_TABLE)}`,
            {
                method: 'POST',
                headers: {
                    'Authorization': `Bearer ${AIRTABLE_API_KEY}`,
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify({
                    fields: recordData.fields,
                    typecast: true
                })
            }
        );
        
        if (!response.ok) {
            const errorText = await response.text();
            throw new Error(`Failed to create record (${response.status}): ${errorText}`);
        }
        
        console.log(`Successfully created new record for lead ${leadId}`);
        
    } catch (error) {
        console.error('Error creating new record:', error);
        throw new Error(`Failed to create lead: ${error.message}`);
    }
}

let result;
try {
    result = await response.json();
    console.log('Airtable API response:', JSON.stringify(result, null, 2));
    
    if (!response.ok) {
        console.error('Airtable API error response:', result);
        return {
            statusCode: response.status,
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ 
                ok: false, 
                error: 'Airtable API Error',
                message: 'Failed to save lead data',
                status: response.status,
                details: result.error || 'Unknown error',
                requestId: response.headers.get('x-request-id')
                details: process.env.NODE_ENV === 'development' ? error.stack : undefined,
                leadId: leadId || 'unknown',
                step: step || 'unknown',
                timestamp: new Date().toISOString()
            })
        };
    }
};
