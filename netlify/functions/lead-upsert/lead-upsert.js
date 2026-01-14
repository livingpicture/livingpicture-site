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
            headers: { 'Content-Type': 'application/json' },
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
            console.warn(`Invalid step value received: ${step}. Proceeding anyway.`);
        }
        
        console.log('Processing lead with ID:', leadId, 'Step:', step);

        // Prepare the record data with proper field mapping and sanitization
        const now = new Date().toISOString();
        const recordData = {
            fields: {
                // Required fields
                leadId: String(leadId).trim(),
                step: step,
                updatedAt: now
            }
        };

        // Add optional fields only if they exist and are not empty
        if (otherFields.customerEmail) {
            recordData.fields.customerEmail = String(otherFields.customerEmail).trim();
        }
        if (otherFields.customerName) {
            recordData.fields.customerName = String(otherFields.customerName).trim();
        }
        if (otherFields.customerPhone) {
            recordData.fields.customerPhone = String(otherFields.customerPhone).trim();
        }
        if (otherFields.country) {
            recordData.fields.country = String(otherFields.country).trim();
        }
        if (otherFields.memoryTitle) {
            recordData.fields.memoryTitle = String(otherFields.memoryTitle).trim();
        }
        if (otherFields.songChoice) {
            recordData.fields.songChoice = String(otherFields.songChoice).trim();
        }
        if (otherFields.photoCount !== undefined) {
            recordData.fields.photoCount = Number(otherFields.photoCount) || 0;
        }
        if (otherFields.packageKey) {
            recordData.fields.packageKey = String(otherFields.packageKey).trim();
        }
        if (otherFields.totalAmount !== undefined) {
            recordData.fields.totalAmount = Number(otherFields.totalAmount) || 0;
        }
        if (otherFields.currency) {
            recordData.fields.currency = String(otherFields.currency).toUpperCase().trim();
        }
        if (otherFields.paymentstatus) {
            recordData.fields.paymentstatus = String(otherFields.paymentstatus).toLowerCase();
        }
        
        // Handle imageUrls - ensure it's a comma-separated string
        if (otherFields.imageUrls !== undefined && otherFields.imageUrls !== null) {
            if (Array.isArray(otherFields.imageUrls)) {
                recordData.fields.imageUrls = otherFields.imageUrls
                    .filter(url => url && typeof url === 'string')
                    .join(',');
            } else {
                recordData.fields.imageUrls = String(otherFields.imageUrls);
            }
        }
        
        console.log('Prepared record data for Airtable:', JSON.stringify(recordData, null, 2));

        // Search for existing record with this leadId
        const escapedLeadId = escapeSingleQuotes(String(leadId));
        const filterFormula = `{leadId}='${escapedLeadId}'`;
        const searchUrl = `https://api.airtable.com/v0/${AIRTABLE_BASE_ID}/${encodeURIComponent(AIRTABLE_LEADS_TABLE)}?filterByFormula=${encodeURIComponent(filterFormula)}&maxRecords=1`;
        
        console.log('Searching for existing lead with filter:', filterFormula);
        
        const findResponse = await fetch(searchUrl, {
            headers: {
                'Authorization': `Bearer ${AIRTABLE_API_KEY}`,
                'Content-Type': 'application/json'
            }
        });

        if (!findResponse.ok) {
            const errorText = await findResponse.text();
            console.error('Airtable search error:', errorText);
            throw new Error(`Airtable API error (${findResponse.status}): ${errorText}`);
        }

        const findResult = await findResponse.json();
        console.log(`Found ${findResult.records ? findResult.records.length : 0} matching records`);
        
        let response;
        let action;

        if (findResult.records && findResult.records.length > 0) {
            // Update existing record
            const existingRecord = findResult.records[0];
            const recordId = existingRecord.id;
            
            console.log(`Updating existing record ${recordId} for lead ${leadId}`);
            
            // Keep the original createdAt if it exists
            if (existingRecord.fields.createdAt) {
                recordData.fields.createdAt = existingRecord.fields.createdAt;
            } else {
                recordData.fields.createdAt = now;
            }
            
            response = await fetch(
                `https://api.airtable.com/v0/${AIRTABLE_BASE_ID}/${encodeURIComponent(AIRTABLE_LEADS_TABLE)}/${recordId}`,
                {
                    method: 'PATCH',
                    headers: {
                        'Authorization': `Bearer ${AIRTABLE_API_KEY}`,
                        'Content-Type': 'application/json'
                    },
                    body: JSON.stringify({
                        fields: recordData.fields
                    })
                }
            );
            
            action = 'updated';
            
        } else {
            // Create new record
            recordData.fields.createdAt = now;
            
            console.log(`Creating new record for lead ${leadId}`);
            
            response = await fetch(
                `https://api.airtable.com/v0/${AIRTABLE_BASE_ID}/${encodeURIComponent(AIRTABLE_LEADS_TABLE)}`,
                {
                    method: 'POST',
                    headers: {
                        'Authorization': `Bearer ${AIRTABLE_API_KEY}`,
                        'Content-Type': 'application/json'
                    },
                    body: JSON.stringify({
                        fields: recordData.fields
                    })
                }
            );
            
            action = 'created';
        }

        const result = await response.json();
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
                    details: result.error?.message || result.error || 'Unknown error',
                    action: action
                })
            };
        }
        
        console.log(`=== Successfully ${action} lead ${leadId} ===`);
        
        return {
            statusCode: 200,
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                ok: true,
                record: result,
                action: action,
                leadId: leadId
            })
        };

    } catch (error) {
        console.error('=== Error processing lead ===');
        console.error('Error message:', error.message);
        console.error('Error stack:', error.stack);
        
        return {
            statusCode: error.statusCode || 500,
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ 
                ok: false, 
                error: 'Internal Server Error',
                message: error.message,
                details: process.env.NODE_ENV === 'development' ? error.stack : undefined,
                timestamp: new Date().toISOString()
            })
        };
    }
};