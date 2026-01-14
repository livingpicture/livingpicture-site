const fetch = require('node-fetch');

exports.handler = async (event, context) => {
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

        // Prepare the record data
        const now = new Date().toISOString();
        const recordData = {
            fields: {
                leadId,
                step,
                updatedAt: now,
                ...otherFields
            }
        };

        // Handle imageUrls - convert to JSON string if it's an array
        if (recordData.fields.imageUrls && Array.isArray(recordData.fields.imageUrls)) {
            recordData.fields.imageUrls = JSON.stringify(recordData.fields.imageUrls);
        }

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
        console.error('Error processing lead:', error);
        return {
            statusCode: 500,
            body: JSON.stringify({ 
                ok: false, 
                error: 'Internal server error',
                message: error.message
            })
        };
    }
};
