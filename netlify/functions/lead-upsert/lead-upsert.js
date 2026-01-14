exports.handler = async (event, context) => {
    // Log the raw request body for debugging
    console.log('Function triggered with body:', event.body);
    
    // Parse and log the parsed data
    let data = {};
    try {
        data = event.body ? JSON.parse(event.body) : {};
        console.log('Parsed request data:', JSON.stringify(data, null, 2));
    } catch (parseError) {
        console.error('Failed to parse request body:', parseError);
        return {
            statusCode: 400,
            body: JSON.stringify({
                ok: false,
                error: 'Invalid JSON in request body',
                message: parseError.message
            })
        };
    }
    
    // Only allow POST requests
    if (event.httpMethod !== 'POST') {
        return {
            statusCode: 405,
            body: JSON.stringify({ 
                ok: false, 
                error: 'Method Not Allowed',
                message: 'Only POST requests are accepted'
            })
        };
    }

    // Check for required environment variables
    const { 
        AIRTABLE_API_KEY, 
        AIRTABLE_BASE_ID, 
        AIRTABLE_LEADS_TABLE 
    } = process.env;

    if (!AIRTABLE_API_KEY || !AIRTABLE_BASE_ID || !AIRTABLE_LEADS_TABLE) {
        console.error('Missing required environment variables');
        return {
            statusCode: 500,
            body: JSON.stringify({ 
                ok: false, 
                error: 'Server configuration error',
                message: 'Required environment variables are not set'
            })
        };
    }

    try {
        // Parse and validate request body
        const requestBody = JSON.parse(event.body || '{}');
        const { leadId, step, ...otherFields } = requestBody;

        // Map incoming fields to Airtable schema
        const mappedFields = {};
        if (otherFields.memoryTitle) mappedFields.memoryTitle = otherFields.memoryTitle;
        if (otherFields.customerEmail) mappedFields.customerEmail = otherFields.customerEmail;
        if (otherFields.step) mappedFields.step = otherFields.step;
        
        // Handle imageUrls - convert to string if it's an array
        if (otherFields.imageUrls) {
            mappedFields.imageUrls = Array.isArray(otherFields.imageUrls) 
                ? otherFields.imageUrls.join(',') 
                : otherFields.imageUrls;
        }

        // Validate required fields
        if (!leadId) {
            return {
                statusCode: 400,
                body: JSON.stringify({ 
                    ok: false, 
                    error: 'Missing required field',
                    message: 'leadId is required'
                })
            };
        }

        if (!step) {
            return {
                statusCode: 400,
                body: JSON.stringify({ 
                    ok: false, 
                    error: 'Missing required field',
                    message: 'step is required'
                })
            };
        }

        // Prepare the record data with proper field mapping
        const now = new Date().toISOString();
        const recordData = {
            fields: {
                // Required fields
                leadId,
                step,
                updatedAt: now,
                
                // Map other fields with proper naming
                ...(otherFields.customerEmail && { customerEmail: otherFields.customerEmail }),
                ...(otherFields.memoryTitle && { memoryTitle: otherFields.memoryTitle }),
                ...(otherFields.imageUrls && { 
                    // Ensure imageUrls is stored as a string (Long Text)
                    imageUrls: Array.isArray(otherFields.imageUrls) 
                        ? otherFields.imageUrls.join(',') 
                        : otherFields.imageUrls 
                }),
                
                // Include all other fields that don't need special handling
                ...Object.fromEntries(
                    Object.entries(otherFields)
                        .filter(([key]) => !['customerEmail', 'memoryTitle', 'imageUrls'].includes(key))
                )
            }
        };
        
        console.log('Prepared record data for Airtable:', JSON.stringify(recordData, null, 2));

        // First, try to find an existing record with this leadId
        const findResponse = await fetch(
            `https://api.airtable.com/v0/${AIRTABLE_BASE_ID}/${encodeURIComponent(AIRTABLE_LEADS_TABLE)}?filterByFormula={leadId}='${leadId}'`,
            {
                headers: {
                    'Authorization': `Bearer ${AIRTABLE_API_KEY}`,
                    'Content-Type': 'application/json'
                }
            }
        );

        if (!findResponse.ok) {
            throw new Error(`Airtable API error: ${findResponse.statusText}`);
        }

        const findResult = await findResponse.json();
        let response;

        if (findResult.records && findResult.records.length > 0) {
            // Update existing record
            const existingRecord = findResult.records[0];
            const recordId = existingRecord.id;
            
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
                        fields: recordData.fields,
                        typecast: true
                    })
                }
            );
        } else {
            // Create new record with createdAt
            recordData.fields.createdAt = now;
            
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
        }

        const result = await response.json();

        if (!response.ok) {
            console.error('Airtable API error:', result);
            return {
                statusCode: response.status,
                body: JSON.stringify({ 
                    ok: false, 
                    error: 'Failed to save lead',
                    details: result.error?.message || 'Unknown error'
                })
            };
        }

        return {
            statusCode: 200,
            body: JSON.stringify({
                ok: true,
                record: result,
                action: findResult.records && findResult.records.length > 0 ? 'updated' : 'created'
            })
        };

    } catch (error) {
        console.error('Error processing lead:', {
            message: error.message,
            stack: error.stack,
            leadId: leadId || 'unknown',
            step: step || 'unknown'
        });
        
        // Return detailed error information
        return {
            statusCode: error.statusCode || 500,
            body: JSON.stringify({ 
                ok: false, 
                error: 'Internal server error',
                message: error.message,
                details: process.env.NODE_ENV === 'development' ? error.stack : undefined,
                leadId: leadId || 'unknown',
                step: step || 'unknown',
                timestamp: new Date().toISOString()
            })
        };
    }
};
