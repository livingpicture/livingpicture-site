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
    
    const { AIRTABLE_API_KEY, AIRTABLE_BASE_ID } = process.env;
    const AIRTABLE_ORDERS_TABLE = process.env.AIRTABLE_ORDERS_TABLE || 'Orders';
    const missingEnvVars = ['AIRTABLE_API_KEY', 'AIRTABLE_BASE_ID'].filter(key => !process.env[key]);

    if (missingEnvVars.length > 0) {
        const errorMessage = `Missing environment variables: ${missingEnvVars.join(', ')}`;
        console.error(errorMessage);
        return createResponse(500, { ok: false, error: 'Server Configuration Error', message: errorMessage });
    }

    const base = new Airtable({ apiKey: AIRTABLE_API_KEY }).base(AIRTABLE_BASE_ID);

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

    // PayPlus truncates more_info, so we rely on more_info_1 and more_info_2
    // more_info_1 = leadId, more_info_2 = orderId
    const leadId = transaction.more_info_1;
    const orderId = transaction.more_info_2;
    
    console.log('Extracted IDs from PayPlus fields:', { 
        leadId, 
        orderId,
        more_info_1: transaction.more_info_1,
        more_info_2: transaction.more_info_2,
        more_info_truncated: transaction.more_info?.substring(0, 100) + '...'
    });
    const now = new Date().toISOString();

    if (!leadId) {
        console.error('Missing leadId in PayPlus callback data.');
        console.error('Full transaction object:', JSON.stringify(transaction, null, 2));
        return createResponse(400, { ok: false, error: 'Missing leadId in payment data' });
    }

    let leadRecord = {};
    let leadAirtableId = null;
    try {
        const records = await base('Leads').select({
            filterByFormula: `{leadId} = '${leadId}'`,
            maxRecords: 1
        }).firstPage();

        if (records.length > 0) {
            leadAirtableId = records[0].id;
            leadRecord = records[0].fields;
            console.log('Found lead record:', records[0].id);
        } else {
            console.warn(`Lead with leadId ${leadId} not found. Proceeding with data from metadata.`);
        }
    } catch (error) {
        console.error('Error fetching lead from Airtable:', error);
        // Proceeding with metadata even if lead fetch fails
    }

    // Update lead step to PAID - this is critical and should always happen
    const effectiveOrderId = orderId || `ord_${transaction.uid}`;
    
    if (leadAirtableId) {
        try {
            console.log('=== Updating Lead record ===');
            const leadUpdateFields = {
                step: 'PAID',
                orderId: effectiveOrderId,
                updatedAt: now
            };
            
            console.log('Lead update fields:', leadUpdateFields);
            
            await base('Leads').update([
                {
                    id: leadAirtableId,
                    fields: leadUpdateFields
                }
            ]);
            console.log('✓ Updated lead step to PAID for lead:', leadAirtableId);
        } catch (error) {
            console.error('✗ Error updating lead step to PAID:', error);
            // Don't return here - we still want to try creating the order
        }
    } else {
        console.warn('⚠️ No leadAirtableId found - cannot update lead status to PAID');
    }

    try {
        // Create Order record first (don't wait for migration)
        console.log('=== Creating Order record in Airtable ===');
        
        // Get imageUrls from lead record
        const imageUrls = leadRecord.imageUrls || '';
        
        const orderFields = {
            orderId: effectiveOrderId,
            leadId: leadId,
            paymentStatus: 'PAID',
            customerEmail: leadRecord.customerEmail || data.customer?.email || '',
            customerName: leadRecord.customerName || data.customer?.name || '',
            country: leadRecord.country || data.customer?.country_iso || '',
            memoryTitle: leadRecord.memoryTitle || '',
            songChoice: leadRecord.songChoice || '',
            photoCount: Number(leadRecord.photoCount) || 0,
            packageKey: leadRecord.packageKey || '',
            imageUrls: imageUrls,
            transactionId: transaction.uid || '',
            paymentProvider: 'PayPlus',
            currency: transaction.currency || leadRecord.currency || 'ILS',
            totalAmount: Number(transaction.amount) || (Number(transaction.amount_in_cents) / 100) || 0,
            paidAt: now,
            detectedCurrency: leadRecord.detectedCurrency || '',
            selectedCurrency: leadRecord.selectedCurrency || ''
        };
        
        // Remove undefined fields and ensure all fields are strings or numbers
        Object.keys(orderFields).forEach(key => {
            if (orderFields[key] === undefined || orderFields[key] === null) {
                delete orderFields[key];
            }
        });
        
        console.log('Order fields to create:', JSON.stringify(orderFields, null, 2));
        
        const createdRecord = await base(AIRTABLE_ORDERS_TABLE).create([{ fields: orderFields }]);
        console.log('✓ Order record created successfully:', createdRecord[0].id);
        
        // Now migrate photos in the background
        let migrationResult = { success: false, migratedCount: 0 };
        if (process.env.CLOUDINARY_API_KEY && process.env.CLOUDINARY_API_SECRET) {
            console.log('Starting photo migration...');
            migrationResult = await migratePhotosToOrdersFolder(leadId, effectiveOrderId);
            console.log('Photo migration result:', migrationResult);
            
            // Update order with migration results if successful
            if (migrationResult.success) {
                try {
                    await base(AIRTABLE_ORDERS_TABLE).update([
                        {
                            id: createdRecord[0].id,
                            fields: {
                                photosFolder: `livingpicture/orders/${effectiveOrderId}`,
                                migrationStatus: 'SUCCESS',
                                migratedPhotoCount: migrationResult.migratedCount || 0
                            }
                        }
                    ]);
                    console.log('Updated order with migration results');
                } catch (updateError) {
                    console.warn('Failed to update order with migration results:', updateError);
                }
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
