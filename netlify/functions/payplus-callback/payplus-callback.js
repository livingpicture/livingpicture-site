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

    // Parse more_info field (JSON string passed in payment request)
    let moreInfo = {};
    if (data.more_info) {
        try {
            moreInfo = typeof data.more_info === 'string' ? JSON.parse(data.more_info) : data.more_info;
            console.log('Parsed more_info:', moreInfo);
        } catch (e) {
            console.warn('Failed to parse more_info:', e.message);
        }
    }
    
    // Try multiple sources for leadId: more_info, customer.external_id, or legacy metadata
    const leadId = moreInfo.leadId 
        || data.customer?.external_id 
        || data.data?.metadata?.leadId;
    const orderId = moreInfo.orderId || data.data?.metadata?.orderId;
    const now = new Date().toISOString();

    console.log('Extracted IDs:', { leadId, orderId, source: moreInfo.leadId ? 'more_info' : (data.customer?.external_id ? 'customer.external_id' : 'metadata') });

    if (!leadId) {
        console.error('Missing leadId in PayPlus callback data. Available fields:', Object.keys(data));
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

    // Update lead step to PAID
    const effectiveOrderId = orderId || `ord_${transaction.uuid}`;
    
    if (leadAirtableId) {
        try {
            await base('Leads').update([
                {
                    id: leadAirtableId,
                    fields: {
                        step: 'PAID',
                        orderId: effectiveOrderId,
                        updatedAt: now
                    }
                }
            ]);
            console.log('Updated lead step to PAID for lead:', leadAirtableId);
        } catch (error) {
            console.error('Error updating lead step to PAID:', error);
            return createResponse(500, { ok: false, error: 'Airtable Error', message: error.message });
        }
    }

    try {
        // Migrate photos from leads folder to orders folder in Cloudinary
        let migrationResult = { success: false, migratedCount: 0 };
        if (process.env.CLOUDINARY_API_KEY && process.env.CLOUDINARY_API_SECRET) {
            migrationResult = await migratePhotosToOrdersFolder(leadId, effectiveOrderId);
            console.log('Photo migration result:', migrationResult);
        } else {
            console.warn('Cloudinary credentials not configured, skipping photo migration');
        }
        
        // Update imageUrls with migrated URLs if migration was successful
        const finalImageUrls = migrationResult.success && migrationResult.imageUrls?.length > 0
            ? migrationResult.imageUrls.join('\n')
            : (leadRecord.imageUrls || moreInfo.imageUrls);
        
        // Update photosFolder to point to orders folder
        const photosFolder = migrationResult.success 
            ? `livingpicture/orders/${effectiveOrderId}`
            : (leadRecord.imageUrls || moreInfo.imageUrls);
        
        const orderFields = {
            orderId: effectiveOrderId,
            createdAt: now,
            paymentstatus: 'PAID',
            customerEmail: data.customer?.email || leadRecord.customerEmail,
            customerName: data.customer?.name || leadRecord.customerName,
            country: data.customer?.country_iso || leadRecord.country,
            memoryTitle: leadRecord.memoryTitle || moreInfo.memoryTitle,
            songChoice: leadRecord.songChoice || moreInfo.songChoice,
            photoCount: Number(leadRecord.photoCount || moreInfo.photoCount) || undefined,
            packageKey: leadRecord.packageKey || moreInfo.packageKey,
            imageUrls: photosFolder,
            transactionId: transaction.uuid,
            paymentProvider: 'PayPlus',
            paymentStatusRaw: JSON.stringify(data),
            'Customer (link)': [],
            currency: transaction.currency,
            totalAmount: Number(transaction.amount_in_cents) / 100,
            payplusPaymentLink: data.payment_page_link,
            paidAt: now,
            fulfillmentStatus: 'PAID',
            leadId: leadId,
            detectedCurrency: leadRecord.detectedCurrency || moreInfo.detectedCurrency,
            selectedCurrency: leadRecord.selectedCurrency || moreInfo.selectedCurrency,
        };
        
        const createdRecord = await base(AIRTABLE_ORDERS_TABLE).create([{ fields: orderFields }]);
        console.log('Successfully created order in Airtable:', createdRecord[0].id);
        
        return createResponse(200, { 
            ok: true, 
            message: 'Order created successfully', 
            orderId: createdRecord[0].id,
            photosMigrated: migrationResult.migratedCount || 0,
            photosFolder: photosFolder
        });
    } catch (error) {
        console.error('Error creating order record in Airtable:', error);
        return createResponse(500, { ok: false, error: 'Airtable Error', message: error.message });
    }
};
