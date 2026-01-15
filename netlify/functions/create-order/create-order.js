// Helper function to make Airtable API requests
async function airtableRequest(config) {
    const { method, table, data, recordId, params } = config;
    const { AIRTABLE_API_KEY, AIRTABLE_BASE_ID, AIRTABLE_LEADS_TABLE, AIRTABLE_ORDERS_TABLE } = process.env;

    // Function version for tracking
    const FUNC_VERSION = "create-order@2026-01-14-1";

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

    let url = recordId 
        ? `https://api.airtable.com/v0/${AIRTABLE_BASE_ID}/${encodeURIComponent(table)}/${recordId}`
        : `https://api.airtable.com/v0/${AIRTABLE_BASE_ID}/${encodeURIComponent(table)}`;

    // Add query parameters if provided
    if (params) {
        const queryParams = new URLSearchParams();
        Object.entries(params).forEach(([key, value]) => {
            if (value !== undefined && value !== null) {
                queryParams.append(key, value);
            }
        });
        url += `?${queryParams.toString()}`;
    }

    try {
        const response = await fetch(url, {
            method,
            headers: {
                'Authorization': `Bearer ${AIRTABLE_API_KEY}`,
                'Content-Type': 'application/json'
            },
            body: data ? JSON.stringify(data) : undefined
        });

        const responseData = await response.json();

        if (!response.ok) {
            throw {
                status: response.status,
                message: responseData.error?.message || 'Airtable API error',
                details: responseData.error || { message: responseData.message || 'Unknown error' },
                type: 'AirtableError',
                statusCode: response.status,
                url: url.split('?')[0] // Don't include query params in error URL for security
            };
        }

        return responseData;
    } catch (error) {
        // Re-throw with more context if it's not already our custom error
        if (error.type) throw error;
        throw {
            status: 500,
            message: 'Failed to complete Airtable request',
            details: error.message || 'Unknown error',
            type: 'AirtableRequestError'
        };
    }
}

exports.handler = async (event, context) => {
    // Log the raw request body for debugging
    console.log('Function triggered with body:', event.body);
    
    // Only allow POST requests
    if (event.httpMethod !== 'POST') {
        return createResponse(405, { 
            ok: false, 
            error: 'Method Not Allowed',
            message: 'Only POST requests are accepted'
        }, { 'Allow': 'POST' });
    }

    try {
        // Parse and log the parsed data
        let orderData;
        try {
            orderData = JSON.parse(event.body);
            console.log('Parsed order data:', JSON.stringify(orderData, null, 2));
        } catch (parseError) {
            console.error('Failed to parse request body:', parseError);
            return createResponse(400, {
                ok: false,
                error: 'Invalid JSON in request body',
                message: parseError.message
            });
        }
        const { 
            AIRTABLE_API_KEY, 
            AIRTABLE_BASE_ID, 
            AIRTABLE_LEADS_TABLE,
            AIRTABLE_ORDERS_TABLE 
        } = process.env;

        // Validate required environment variables
        const missingVars = [];
        if (!AIRTABLE_API_KEY) missingVars.push('AIRTABLE_API_KEY');
        if (!AIRTABLE_BASE_ID) missingVars.push('AIRTABLE_BASE_ID');
        if (!AIRTABLE_LEADS_TABLE) missingVars.push('AIRTABLE_LEADS_TABLE');
        if (!AIRTABLE_ORDERS_TABLE) missingVars.push('AIRTABLE_ORDERS_TABLE');
        
        if (missingVars.length > 0) {
            throw {
                status: 500,
                message: 'Server configuration error',
                details: {
                    missingVars: missingVars.map(v => v.replace(/[A-Z]/g, '*'))
                }
            };
        }

        // Common validation for both leads and orders
        if (!orderData.leadId) {
            return {
                statusCode: 400,
                body: JSON.stringify({ 
                    ok: false, 
                    error: 'Missing required field: leadId' 
                })
            };
        }

        // Handle payment success (create order and update lead)
        if (orderData.paymentstatus === 'PAID') {
            // Validate required fields for paid order
            const requiredFields = ['customerEmail', 'photoCount', 'totalAmount', 'currency', 'transactionId'];
            const missingFields = requiredFields.filter(field => !orderData[field]);
            
            if (missingFields.length > 0) {
                return {
                    statusCode: 400,
                    body: JSON.stringify({ 
                        ok: false, 
                        error: 'Missing required fields for paid order',
                        missingFields
                    })
                };
            }

            // 1. Find lead record by leadId with proper escaping
            const safeLeadId = String(orderData.leadId).replace(/'/g, "\\'");
            const formula = `{leadId}='${safeLeadId}'`;
            
            const findLeadResult = await airtableRequest({
                method: 'GET',
                table: AIRTABLE_LEADS_TABLE,
                params: {
                    filterByFormula: formula,
                    maxRecords: 1
                }
            });
            
            if (!findLeadResult.records || findLeadResult.records.length === 0) {
                return {
                    statusCode: 404,
                    body: JSON.stringify({ 
                        ok: false, 
                        error: 'Lead not found',
                        details: `No lead found with leadId: ${orderData.leadId}`
                    })
                };
            }

            const leadRecordId = findLeadResult.records[0].id;

            // 2. Update the lead to mark as PAID
            const leadUpdate = {
                fields: {
                    step: 'PAID',
                    paymentstatus: 'PAID',
                    transactionId: orderData.transactionId,
                    paymentStatusRaw: typeof orderData.paymentStatusRaw === 'object' 
                        ? JSON.stringify(orderData.paymentStatusRaw) 
                        : String(orderData.paymentStatusRaw || ''),
                    paidAt: new Date().toISOString(),
                    updatedAt: new Date().toISOString()
                }
            };

            // Whitelisted fields for order creation with standardized field names
            const now = new Date().toISOString();
            const orderFields = {
                // Primary field
                orderId: orderData.orderId || `ORD-${Date.now()}`,
                
                // Customer Information (fields 1-5)
                customerEmail: orderData.customerEmail?.toString().trim() || '',
                customerName: orderData.customerName?.toString().trim() || '',
                customerPhone: orderData.customerPhone?.toString().trim() || '',
                country: (orderData.country?.toString().trim() || 'Israel').toUpperCase(),
                
                // Order Details (fields 6-13)
                memoryTitle: (orderData.memoryTitle || orderData.memoryName || '').toString().trim(),
                photoCount: Math.max(0, parseInt(orderData.photoCount, 10) || 0),
                packageKey: (() => {
                    if (orderData.packageKey) return orderData.packageKey.toString();
                    // Auto-determine package key based on photo count if not provided
                    const count = Math.max(0, parseInt(orderData.photoCount, 10) || 0);
                    if (count <= 5) return '1-5';
                    if (count <= 15) return '6-15';
                    if (count <= 30) return '16-30';
                    return '30+';
                })(),
                imageUrls: (() => {
                    if (!orderData.imageUrls) return '';
                    if (Array.isArray(orderData.imageUrls)) {
                        return orderData.imageUrls
                            .map(url => url?.toString().trim())
                            .filter(url => url && url.startsWith('http'))
                            .join(',');
                    }
                    return orderData.imageUrls.toString().trim();
                })(),
                totalAmount: Math.max(0, parseFloat(orderData.totalAmount) || 0),
                currency: (orderData.currency || 'ILS').toUpperCase(),
                songChoice: orderData.songChoice?.toString().trim() || '',
                
                // Payment Information (fields 14-17)
                paymentstatus: 'paid', // all lowercase as per schema
                transactionId: orderData.transactionId?.toString().trim() || '',
                paymentProvider: (orderData.paymentProvider || 'payplus').toLowerCase(),
                paymentStatusRaw: (() => {
                    if (!orderData.paymentStatusRaw) return '{}';
                    try {
                        return typeof orderData.paymentStatusRaw === 'string' 
                            ? orderData.paymentStatusRaw 
                            : JSON.stringify(orderData.paymentStatusRaw);
                    } catch {
                        return '{}';
                    }
                })(),
                
                // Order Management (fields 18-20)
                fulfillmentStatus: 'NEW',
                source: (orderData.source || 'website').toLowerCase(),
                notes: orderData.notes?.toString().trim() || '',
                
                // Timestamps
                createdAt: orderData.createdAt || now,
                updatedAt: now,
                paidAt: orderData.paidAt || now,
                
                // Additional metadata
                leadId: orderData.leadId?.toString().trim() || '',
                payplusPaymentLink: orderData.payplusPaymentLink?.toString().trim() || ''
            };
            
            console.log('Prepared order data for Airtable:', JSON.stringify(orderFields, null, 2));

            // Create order record with whitelisted fields
            const orderRecord = { fields: orderFields };

            // Log field keys and sample values before making API calls
            const logSafeLeadFields = {};
            const logSafeOrderFields = {};
            
            Object.entries(leadUpdate.fields || {}).forEach(([key, value]) => {
                logSafeLeadFields[key] = typeof value === 'string' && value.length > 50 
                    ? `${value.substring(0, 50)}...` 
                    : value;
            });
            
            Object.entries(orderRecord.fields || {}).forEach(([key, value]) => {
                logSafeOrderFields[key] = typeof value === 'string' && value.length > 50 
                    ? `${value.substring(0, 50)}...` 
                    : value;
            });
            
            console.log('Sending to Airtable - Lead fields:', JSON.stringify(logSafeLeadFields, null, 2));
            console.log('Sending to Airtable - Order fields:', JSON.stringify(logSafeOrderFields, null, 2));

            // Execute both operations in parallel
            try {
                const [leadResult, orderResult] = await Promise.all([
                    airtableRequest({
                        method: 'PATCH',
                        table: AIRTABLE_LEADS_TABLE,
                        data: leadUpdate,
                        recordId: leadRecordId
                    }),
                    airtableRequest({
                        method: 'POST',
                        table: AIRTABLE_ORDERS_TABLE,
                        data: { fields: orderRecord.fields }
                    })
                ]);

                return createResponse(200, {
                    ok: true,
                    lead: leadResult,
                    order: orderResult,
                    action: 'order_created',
                    debug: {
                        sentLeadFields: logSafeLeadFields,
                        sentOrderFields: logSafeOrderFields,
                        receivedKeys: Object.keys(orderData || {})
                    }
                });
            } catch (error) {
                console.error('Error in parallel operations:', error);
                throw {
                    ...error,
                    debug: {
                        ...(error.debug || {}),
                        sentLeadFields: logSafeLeadFields,
                        sentOrderFields: logSafeOrderFields,
                        receivedKeys: Object.keys(orderData || {})
                    }
                };
            }
        } 
        // Handle payment failure (update lead only)
        else if (orderData.paymentstatus === 'FAILED') {
            // Find lead record by leadId with proper escaping
            const safeLeadId = String(orderData.leadId).replace(/'/g, "\\'");
            const formula = `{leadId}='${safeLeadId}'`;
            
            const findLeadResult = await airtableRequest({
                method: 'GET',
                table: AIRTABLE_LEADS_TABLE,
                params: {
                    filterByFormula: formula,
                    maxRecords: 1
                }
            });
            
            if (!findLeadResult.records || findLeadResult.records.length === 0) {
                return {
                    statusCode: 404,
                    body: JSON.stringify({ 
                        ok: false, 
                        error: 'Lead not found',
                        details: `No lead found with leadId: ${orderData.leadId}`
                    })
                };
            }

            const leadRecordId = findLeadResult.records[0].id;
            
            // Whitelisted fields for failed payment update
            const leadUpdate = {
                fields: {
                    step: 'FAILED',
                    paymentstatus: 'FAILED',
                    transactionId: orderData.transactionId || '',
                    paymentStatusRaw: typeof orderData.paymentStatusRaw === 'object' 
                        ? JSON.stringify(orderData.paymentStatusRaw) 
                        : String(orderData.paymentStatusRaw || 'Payment failed'),
                    updatedAt: new Date().toISOString()
                }
            };

            const leadResult = await airtableRequest({
                method: 'PATCH',
                table: AIRTABLE_LEADS_TABLE,
                data: leadUpdate,
                recordId: leadRecordId
            });

            return createResponse(200, {
                ok: true,
                lead: leadResult,
                action: 'lead_updated_failed',
                debug: {
                    sentLeadFields: logSafeLeadFields,
                    receivedKeys: Object.keys(orderData || {})
                }
            });
        }
        // Regular lead update (not a payment event)
        else {
            // Find lead record by leadId with proper escaping
            const safeLeadId = String(orderData.leadId).replace(/'/g, "\\'");
            const formula = `{leadId}='${safeLeadId}'`;
            
            const findLeadResult = await airtableRequest({
                method: 'GET',
                table: AIRTABLE_LEADS_TABLE,
                params: {
                    filterByFormula: formula,
                    maxRecords: 1
                }
            });
            
            if (!findLeadResult.records || findLeadResult.records.length === 0) {
                return {
                    statusCode: 404,
                    body: JSON.stringify({ 
                        ok: false, 
                        error: 'Lead not found',
                        details: `No lead found with leadId: ${orderData.leadId}`
                    })
                };
            }

            const leadRecordId = findLeadResult.records[0].id;

            // Whitelist of allowed lead fields (only fields that exist in Airtable)
            const allowedLeadFields = [
                // Customer Information
                'customerEmail', 'customerName', 'country',
                
                // Order Details
                'memoryName', 'memoryTitle', 'songName', 'artistName', 'imageUrls',
                'photoCount', 'packageKey', 'totalAmount', 'currency',
                
                // Payment Information
                'paymentstatus', 'paymentProvider', 'paymentStatusRaw', 'transactionId',
                'payplusPaymentLink',
                
                // Order Management
                'fulfillmentStatus',
                
                // System fields
                'step', 'notes', 'createdAt', 'updatedAt', 'paidAt'
            ];
            
            // Only include fields that exist in the Airtable schema
            const existingLeadFields = new Set(allowedLeadFields);
            
            const filteredLeadFields = allowedLeadFields.filter(field => existingLeadFields.has(field));

            // Prepare lead update with only whitelisted fields
            const leadUpdate = {
                fields: {
                    step: orderData.step || 'STEP_1',
                    updatedAt: new Date().toISOString(),
                    createdAt: orderData.createdAt || new Date().toISOString()
                }
            };

            // Copy only whitelisted and existing fields from orderData to leadUpdate
            filteredLeadFields.forEach(field => {
                if (orderData[field] !== undefined && orderData[field] !== null) {
                    // Special handling for imageUrls array
                    if (field === 'imageUrls' && Array.isArray(orderData[field])) {
                        leadUpdate.fields[field] = JSON.stringify(orderData[field]);
                    } else {
                        leadUpdate.fields[field] = orderData[field];
                    }
                }
            });

            const leadResult = await airtableRequest({
                method: 'PATCH',
                table: AIRTABLE_LEADS_TABLE,
                data: leadUpdate,
                recordId: leadRecordId
            });

            return createResponse(200, {
                ok: true,
                lead: leadResult,
                action: 'lead_updated',
                debug: {
                    sentLeadFields: logSafeLeadFields,
                    receivedKeys: Object.keys(orderData || {})
                }
            });
        }
        
        // This block intentionally left blank - redundant code removed

    } catch (error) {
        // Enhanced error logging
        const errorId = `err_${Date.now()}_${Math.random().toString(36).substr(2, 5)}`;
        const errorDetails = {
            errorId,
            timestamp: new Date().toISOString(),
            message: error.message || 'Unknown error',
            name: error.name || 'Error',
            status: error.status || 500,
            stack: process.env.NODE_ENV === 'development' ? error.stack : undefined,
            details: error.details || {}
        };
        
        console.error('Error in create-order:', JSON.stringify(errorDetails, null, 2));
        
        // Return error response with appropriate status code
        return createResponse(error.status || 500, {
            ok: false,
            error: error.message || 'Internal Server Error',
            errorId,
            timestamp: errorDetails.timestamp,
            details: process.env.NODE_ENV === 'development' 
                ? error.details || {}
                : undefined
        });
    }
};
