const Airtable = require('airtable');
const cloudinary = require('cloudinary').v2;

// Configure Cloudinary
cloudinary.config({
    cloud_name: process.env.CLOUDINARY_CLOUD_NAME || 'dojuekij4',
    api_key: process.env.CLOUDINARY_API_KEY,
    api_secret: process.env.CLOUDINARY_API_SECRET
});

function createResponse(statusCode, body) {
    return {
        statusCode,
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
    };
}

// Migrate photos from leads folder to orders folder in Cloudinary
async function migratePhotosToOrdersFolder(leadId, orderId) {
    const sourceFolder = `livingpicture/leads/${leadId}`;
    const targetFolder = `livingpicture/orders/${orderId}`;
    
    console.log(`Migrating photos from ${sourceFolder} to ${targetFolder}`);
    
    try {
        // Get all assets in the leads folder
        const result = await cloudinary.search
            .expression(`folder:${sourceFolder}`)
            .max_results(100)
            .execute();
        
        if (!result.resources || result.resources.length === 0) {
            console.log(`No photos found in ${sourceFolder}`);
            return { success: true, migratedCount: 0, newFolder: targetFolder };
        }
        
        console.log(`Found ${result.resources.length} photos to migrate`);
        
        // Move each asset to the orders folder
        const migratedUrls = [];
        for (const asset of result.resources) {
            const oldPublicId = asset.public_id;
            const fileName = oldPublicId.split('/').pop();
            const newPublicId = `${targetFolder}/${fileName}`;
            
            try {
                // Rename (move) the asset to the new folder
                const renameResult = await cloudinary.uploader.rename(oldPublicId, newPublicId);
                migratedUrls.push(renameResult.secure_url);
                console.log(`Migrated: ${oldPublicId} -> ${newPublicId}`);
            } catch (renameError) {
                console.error(`Failed to migrate ${oldPublicId}:`, renameError.message);
            }
        }
        
        return {
            success: true,
            migratedCount: migratedUrls.length,
            newFolder: targetFolder,
            imageUrls: migratedUrls
        };
    } catch (error) {
        console.error('Error migrating photos:', error);
        return { success: false, error: error.message };
    }
}

exports.handler = async (event, context) => {
    console.log('=== PayPlus Callback Function Started ===');
    console.log('Request body:', event.body);
    
    // Debug environment variables
    console.log('Environment variables check:', {
        AIRTABLE_API_KEY: process.env.AIRTABLE_API_KEY ? 'SET' : 'NOT SET',
        AIRTABLE_BASE_ID: process.env.AIRTABLE_BASE_ID ? 'SET' : 'NOT SET',
        CLOUDINARY_CLOUD_NAME: process.env.CLOUDINARY_CLOUD_NAME ? 'SET' : 'NOT SET',
        CLOUDINARY_API_KEY: process.env.CLOUDINARY_API_KEY ? 'SET' : 'NOT SET',
        CLOUDINARY_API_SECRET: process.env.CLOUDINARY_API_SECRET ? 'SET' : 'NOT SET',
        AIRTABLE_ORDERS_TABLE: process.env.AIRTABLE_ORDERS_TABLE || 'Orders (default)'
    });
    
    const { AIRTABLE_API_KEY, AIRTABLE_BASE_ID } = process.env;
    const AIRTABLE_ORDERS_TABLE = process.env.AIRTABLE_ORDERS_TABLE || 'Orders';
    const missingEnvVars = ['AIRTABLE_API_KEY', 'AIRTABLE_BASE_ID'].filter(key => !process.env[key]);

    if (missingEnvVars.length > 0) {
        const errorMessage = `Missing environment variables: ${missingEnvVars.join(', ')}`;
        console.error(errorMessage);
        return createResponse(500, { ok: false, error: 'Server Configuration Error', message: errorMessage });
    }

    const base = new Airtable({ apiKey: AIRTABLE_API_KEY }).base(AIRTABLE_BASE_ID);

    // Verify table schema before proceeding
    async function verifyTableSchema(tableName) {
        try {
            console.log(`🔍 Verifying schema for table: ${tableName}`);
            const table = base(tableName);
            const records = await table.select({ maxRecords: 1 }).firstPage();
            
            if (records.length > 0) {
                const fields = Object.keys(records[0].fields);
                console.log(`✅ Table ${tableName} found with fields:`, fields);
                
                // Check for paymentStatus field specifically
                if (tableName === AIRTABLE_ORDERS_TABLE) {
                    const hasPaymentStatus = fields.includes('paymentStatus');
                    console.log(`🔍 paymentStatus field exists in ${tableName}: ${hasPaymentStatus}`);
                    
                    if (!hasPaymentStatus) {
                        console.error(`❌ CRITICAL: 'paymentStatus' field NOT found in ${tableName} table!`);
                        console.error('Available fields:', fields);
                        console.error('Please add a "paymentStatus" field to your Airtable Orders table');
                        return false;
                    }
                }
                
                return true;
            } else {
                console.warn(`⚠️ Table ${tableName} exists but has no records`);
                return true;
            }
        } catch (error) {
            console.error(`❌ Error accessing table ${tableName}:`, error);
            return false;
        }
    }

    if (!await verifyTableSchema(AIRTABLE_ORDERS_TABLE)) {
        return createResponse(500, { ok: false, error: 'Table Schema Error', message: 'paymentStatus field not found in Airtable Orders table' });
    }

    let data;
    try {
        data = JSON.parse(event.body || '{}');
        console.log('PayPlus callback received:', JSON.stringify(data, null, 2));
    } catch (error) {
        console.error('Failed to parse request body:', error);
        return createResponse(400, { ok: false, error: 'Invalid JSON' });
    }

    const transaction = data.transaction;
    if (!transaction || transaction.status_code !== '000') {
        console.log(`Payment not successful. Status: ${transaction?.status_code}. Aborting order creation.`);
        return createResponse(200, { ok: true, message: 'Payment not successful, no order created.' });
    }

    // Extract leadId strictly from more_info field (primary source)
    // more_info should contain: leadId (e.g., "lead_123456")
    let leadId = null;
    let orderId = null;
    
    if (transaction.more_info && transaction.more_info.trim()) {
        leadId = transaction.more_info.trim();
        console.log('🔍 Extracted leadId from more_info:', leadId);
    } else {
        // Fallback to more_info_1 if more_info is empty
        leadId = transaction.more_info_1;
        console.log('⚠️ more_info was empty, using fallback more_info_1:', leadId);
    }
    
    // orderId from more_info_2
    orderId = transaction.more_info_2;
    
    console.log('📋 Extracted IDs from PayPlus fields:', { 
        leadId, 
        orderId,
        more_info: transaction.more_info,
        more_info_1: transaction.more_info_1,
        more_info_2: transaction.more_info_2,
        more_info_length: transaction.more_info?.length || 0
    });
    const now = new Date().toISOString();

    if (!leadId) {
        console.error('Missing leadId in PayPlus callback data.');
        console.error('Full transaction object:', JSON.stringify(transaction, null, 2));
        return createResponse(400, { ok: false, error: 'Missing leadId in payment data' });
    }

    let leadRecord = {};
    let leadAirtableId = null;
    
    console.log('🔍 Searching for Lead record with leadId:', leadId);
    
    try {
        const records = await base('Leads').select({
            filterByFormula: `{leadId} = '${leadId}'`,
            maxRecords: 1
        }).firstPage();

        console.log(`📋 Found ${records.length} lead record(s) for leadId: ${leadId}`);
        
        if (records.length > 0) {
            // STRICT VALIDATION: Ensure exact match
            const exactMatch = records.find(record => 
                record.fields.leadId === leadId && 
                record.fields.leadId !== undefined && 
                record.fields.leadId !== null
            );
            
            if (!exactMatch) {
                console.error(`❌ CRITICAL: No exact match found for leadId: ${leadId}`);
                console.error('Found records do not match exactly:');
                records.forEach(record => {
                    console.error(`  - ID: ${record.id}, leadId: "${record.fields.leadId}" (type: ${typeof record.fields.leadId})`);
                });
                console.error(`Looking for: "${leadId}" (type: ${typeof leadId})`);
                return createResponse(404, { 
                    ok: false, 
                    error: 'Lead not found', 
                    message: `No exact match found for leadId: ${leadId}` 
                });
            }
            
            leadAirtableId = exactMatch.id;
            leadRecord = exactMatch.fields;
            
            // PREVENT DUPLICATE UPDATES: Check if already paid
            if (leadRecord.step === 'PAID') {
                console.log(`⚠️ Lead ${leadAirtableId} is already marked as PAID. Skipping duplicate update.`);
                console.log('🔍 Current step:', leadRecord.step);
                console.log('🔍 Last updated:', leadRecord.updatedAt);
                
                // Still return success so PayPlus doesn't retry
                return createResponse(200, { 
                    ok: true, 
                    message: 'Lead already processed',
                    leadId: leadId,
                    leadAirtableId: leadAirtableId,
                    alreadyPaid: true
                });
            }
            
            console.log('✅ Found exact lead record:', leadAirtableId);
            console.log('🔍 Current lead fields:', JSON.stringify(leadRecord, null, 2));
            console.log('🔍 Current step value:', leadRecord.step);
        } else {
            console.error(`❌ Lead with leadId ${leadId} not found in Airtable.`);
            console.error('This indicates a critical issue - the lead should exist before payment.');
            console.error('🔍 Transaction UID:', transaction.uid);
            console.error('🔍 PayPlus more_info:', transaction.more_info);
            console.error('🔍 PayPlus more_info_1:', transaction.more_info_1);
            
            // Show available leads for debugging
            console.log('🔍 Available leads (first 5):');
            try {
                const allLeads = await base('Leads').select({ maxRecords: 5 }).firstPage();
                if (allLeads.length === 0) {
                    console.error('❌ No leads found in the Leads table at all!');
                } else {
                    allLeads.forEach(lead => {
                        console.error(`  - ID: ${lead.id}, leadId: "${lead.fields.leadId}", step: ${lead.fields.step}`);
                    });
                }
            } catch (listError) {
                console.warn('Could not list leads:', listError.message);
            }
            
            return createResponse(404, { 
                ok: false, 
                error: 'Lead not found', 
                message: `Lead with leadId ${leadId} not found. Cannot process payment.` 
            });
        }
    } catch (error) {
        console.error('❌ Error fetching lead from Airtable:', error);
        // Proceeding with metadata even if lead fetch fails
    }

    // Update lead step to PAID - this is critical and should always happen
    const effectiveOrderId = orderId || `ord_${transaction.uid}`;
    
    if (leadAirtableId) {
        try {
            console.log('=== 🔄 Updating Lead record ===');
            console.log('🔍 Lead Airtable ID:', leadAirtableId);
            console.log('🔍 Current step before update:', leadRecord.step);
            
            const leadUpdateFields = {
                step: 'PAID',
                orderId: effectiveOrderId,
                updatedAt: now
            };
            
            console.log('📋 Lead update fields:', leadUpdateFields);
            
            // Verify the Leads table schema
            console.log('🔍 Verifying Leads table schema...');
            try {
                const leadTableCheck = await base('Leads').select({ maxRecords: 1 }).firstPage();
                if (leadTableCheck.length > 0) {
                    const leadFields = Object.keys(leadTableCheck[0].fields);
                    console.log('✅ Leads table fields:', leadFields);
                    const hasStepField = leadFields.includes('step');
                    console.log(`🔍 'step' field exists in Leads table: ${hasStepField}`);
                    
                    if (!hasStepField) {
                        console.error('❌ CRITICAL: "step" field NOT found in Leads table!');
                        console.error('Available fields:', leadFields);
                        console.error('Please add a "step" field to your Airtable Leads table');
                    }
                }
            } catch (schemaError) {
                console.warn('Could not verify Leads table schema:', schemaError.message);
            }
            
            const updateResult = await base('Leads').update([
                {
                    id: leadAirtableId,
                    fields: leadUpdateFields
                }
            ]);
            
            console.log('✅ Lead update result:', JSON.stringify(updateResult, null, 2));
            console.log('✅ Updated lead step to PAID for lead:', leadAirtableId);
            
            // Verify the update actually worked
            try {
                const verificationRecord = await base('Leads').find(leadAirtableId);
                console.log('🔍 Verification - Updated lead fields:', JSON.stringify(verificationRecord.fields, null, 2));
                console.log('🔍 Verification - New step value:', verificationRecord.fields.step);
                
                if (verificationRecord.fields.step === 'PAID') {
                    console.log('✅ SUCCESS: Lead step field correctly updated to PAID');
                } else {
                    console.error('❌ FAILURE: Lead step field was NOT updated to PAID');
                    console.error('Expected: PAID, Got:', verificationRecord.fields.step);
                }
            } catch (verifyError) {
                console.warn('Could not verify lead update:', verifyError.message);
            }
            
        } catch (error) {
            console.error('❌ Error updating lead step to PAID:', error);
            console.error('Error details:', {
                message: error.message,
                stack: error.stack,
                leadAirtableId: leadAirtableId,
                updateFields: {
                    step: 'PAID',
                    orderId: effectiveOrderId,
                    updatedAt: now
                }
            });
            // Don't return here - we still want to try creating the order
        }
    } else {
        console.warn('⚠️ No leadAirtableId found - cannot update lead status to PAID');
        console.warn('This means the lead was not found in Airtable with the given leadId');
    }

    try {
        // Create Order record first (don't wait for migration)
        console.log('=== Creating Order record in Airtable ===');
        
        // Get imageUrls from lead record
        const imageUrls = leadRecord.imageUrls || '';
        
        // Create Cloudinary console folder link
        const cloudinaryFolderUrl = `https://console.cloudinary.com/pm/c-dojuekij4/media-explorer/livingpicture/orders/${effectiveOrderId}`;
        
        const orderFields = {
            // Exact match with Airtable Orders table fields
            orderId: effectiveOrderId,
            paymentStatus: 'PAID', // Clean string, no extra quotes
            customerEmail: leadRecord.customerEmail || data.customer?.email || '',
            customerName: leadRecord.customerName || data.customer?.name || '',
            customerPhone: leadRecord.customerPhone || data.customer?.phone || '',
            country: leadRecord.country || data.customer?.country_iso || '',
            memoryTitle: leadRecord.memoryTitle || '',
            songChoice: leadRecord.songChoice || '',
            photoCount: Number(leadRecord.photoCount) || 0,
            packageKey: leadRecord.packageKey || '',
            imageUrls: cloudinaryFolderUrl,
            transactionId: transaction.uid || '',
            paymentProvider: 'PayPlus', // Clean string
            currency: transaction.currency || leadRecord.currency || 'ILS',
            // totalAmount is a computed field - don't set it directly
            // totalAmount: Number(transaction.amount) || (Number(transaction.amount_in_cents) / 100) || 0,
            paidAt: now,
            fulfillmentStatus: 'NEW', // Use valid option from Airtable
            leadId: leadId,
            selectedCurrency: leadRecord.selectedCurrency || '',
            // Customer (link) as plain string since it's Single line text in Airtable
            'Customer (link)': leadRecord.airtableRecordId || leadId
        };
        
        // Remove undefined fields and ensure all fields are strings or numbers
        Object.keys(orderFields).forEach(key => {
            if (orderFields[key] === undefined || orderFields[key] === null) {
                delete orderFields[key];
            }
        });
        
        // Verify all required fields are present
        const requiredFields = [
            'orderId', 'paymentStatus', 'customerEmail', 'customerName', 'customerPhone',
            'country', 'memoryTitle', 'songChoice', 'photoCount', 'packageKey', 
            'imageUrls', 'transactionId', 'paymentProvider', 'currency', 
            // totalAmount is computed, not required for creation
            'paidAt', 'fulfillmentStatus', 'leadId', 'selectedCurrency',
            'Customer (link)'
        ];
        
        console.log('📋 Field verification:');
        requiredFields.forEach(field => {
            const hasField = orderFields.hasOwnProperty(field);
            const value = orderFields[field];
            console.log(`  ${field}: ${hasField ? '✅' : '❌'} = ${JSON.stringify(value)}`);
        });
        
        // Log the final paymentStatus value to verify
        console.log('🔍 Final paymentStatus value:', JSON.stringify(orderFields.paymentStatus));
        console.log('🔍 paymentStatus type:', typeof orderFields.paymentStatus);
        
        console.log('Order fields to create:', JSON.stringify(orderFields, null, 2));
        
        try {
            const createdRecord = await base(AIRTABLE_ORDERS_TABLE).create([{ fields: orderFields }]);
            console.log('✓ Order record created successfully:', createdRecord[0].id);
            console.log('🔍 Created record fields:', JSON.stringify(createdRecord[0].fields, null, 2));
            
            // Verify paymentStatus was saved correctly
            if (createdRecord[0].fields.paymentStatus) {
                console.log('✅ paymentStatus saved correctly:', createdRecord[0].fields.paymentStatus);
            } else {
                console.error('❌ paymentStatus NOT found in created record!');
                console.error('Available fields:', Object.keys(createdRecord[0].fields));
            }
        } catch (createError) {
            console.error('❌ Error creating order record:', createError);
            throw createError;
        }
        
        // Now migrate photos in the background
        let migrationResult = { success: false, migratedCount: 0 };
        console.log('Checking Cloudinary credentials for migration:', {
            hasApiKey: !!process.env.CLOUDINARY_API_KEY,
            hasApiSecret: !!process.env.CLOUDINARY_API_SECRET
        });
        
        if (process.env.CLOUDINARY_API_KEY && process.env.CLOUDINARY_API_SECRET) {
            console.log('✓ Cloudinary credentials found, starting photo migration...');
            console.log('Migration parameters:', { leadId, orderId: effectiveOrderId });
            migrationResult = await migratePhotosToOrdersFolder(leadId, effectiveOrderId);
            console.log('Photo migration result:', migrationResult);
            
            // Update order with migration results if successful
            if (migrationResult.success) {
                try {
                    // The folder now exists, so we can confirm the Cloudinary console link
                    await base(AIRTABLE_ORDERS_TABLE).update([
                        {
                            id: createdRecord[0].id,
                            fields: {
                                photosFolder: `livingpicture/orders/${effectiveOrderId}`,
                                migrationStatus: 'SUCCESS',
                                migratedPhotoCount: migrationResult.migratedCount || 0,
                                imageUrls: cloudinaryFolderUrl // Confirm the Cloudinary console link after successful migration
                            }
                        }
                    ]);
                    console.log('Updated order with migration results');
                    console.log('✓ Cloudinary folder link confirmed:', cloudinaryFolderUrl);
                } catch (updateError) {
                    console.warn('Failed to update order with migration results:', updateError);
                }
            } else {
                console.log('Migration failed, but order was created with initial Cloudinary link');
            }
        } else {
            console.warn('Cloudinary credentials not configured, skipping photo migration');
        }
        
        return createResponse(200, { 
            ok: true, 
            message: 'Order created successfully', 
            orderId: createdRecord[0].id,
            leadId: leadId,
            orderAirtableId: createdRecord[0].id,
            leadAirtableId: leadAirtableId,
            photosMigrated: migrationResult.migratedCount || 0
        });
    } catch (error) {
        console.error('Error creating order record in Airtable:', error);
        return createResponse(500, { ok: false, error: 'Airtable Error', message: error.message });
    }
};
