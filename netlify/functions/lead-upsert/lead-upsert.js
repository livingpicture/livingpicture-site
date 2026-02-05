const Airtable = require('airtable');
const cloudinary = require('cloudinary').v2;

// Configure Cloudinary
cloudinary.config({
    cloud_name: process.env.CLOUDINARY_CLOUD_NAME || 'dojuekij4',
    api_key: process.env.CLOUDINARY_API_KEY,
    api_secret: process.env.CLOUDINARY_API_SECRET
});

// Cloudinary cloud name for console URLs
const CLOUDINARY_CLOUD_ID = 'dojuekij4';

// CORS headers
const CORS_HEADERS = {
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Headers': 'Content-Type',
    'Access-Control-Allow-Methods': 'POST, OPTIONS'
};

const PRICING = {
    '1-5': {
        ILS: 20,
        USD: 5.50,
        EUR: 5.00,
        RUB: 500
    },
    '6-15': {
        ILS: 18,
        USD: 4.95,
        EUR: 4.50,
        RUB: 450
    },
    '16-25': {
        ILS: 16,
        USD: 4.40,
        EUR: 4.00,
        RUB: 400
    },
    '26+': {
        ILS: 14,
        USD: 3.85,
        EUR: 3.50,
        RUB: 350
    }
};

function calculatePrice(photoCount, currency) {
    const tier = photoCount <= 5 ? '1-5' :
                 photoCount <= 15 ? '6-15' :
                 photoCount <= 25 ? '16-25' : '26+';
    
    const pricePerPhoto = PRICING[tier]?.[currency] || PRICING[tier]?.['USD'];
    const total = pricePerPhoto * photoCount;

    return { 
        total,
        pricePerPhoto,
        tier
    };
}

// Generate Cloudinary console folder search URL
function getCloudinaryFolderUrl(folderPath) {
    return `https://console.cloudinary.com/app/${CLOUDINARY_CLOUD_ID}/assets/media_library/folders/search?q=${encodeURIComponent(folderPath)}`;
}

// Migrate photos from leads folder to orders folder in Cloudinary
async function migrateLeadToOrdersFolder(leadId) {
    const sourceFolder = `livingpicture/leads/${leadId}`;
    const targetFolder = `livingpicture/orders/${leadId}`;
    
    console.log(`=== Starting Cloudinary folder migration ===`);
    console.log(`Source: ${sourceFolder}`);
    console.log(`Target: ${targetFolder}`);
    
    // Check if Cloudinary credentials are configured
    if (!process.env.CLOUDINARY_API_KEY || !process.env.CLOUDINARY_API_SECRET) {
        console.warn('Cloudinary credentials not configured, skipping folder migration');
        return { 
            success: false, 
            error: 'Cloudinary credentials not configured',
            sourceFolder,
            targetFolder
        };
    }
    
    try {
        // First, check if source folder has any assets
        const searchResult = await cloudinary.search
            .expression(`folder:${sourceFolder}`)
            .max_results(100)
            .execute();
        
        if (!searchResult.resources || searchResult.resources.length === 0) {
            console.log(`No assets found in source folder: ${sourceFolder}`);
            return { 
                success: true, 
                migratedCount: 0, 
                message: 'No assets to migrate',
                sourceFolder,
                targetFolder,
                newFolderUrl: getCloudinaryFolderUrl(targetFolder)
            };
        }
        
        console.log(`Found ${searchResult.resources.length} assets to migrate`);
        
        // Move each asset to the orders folder
        const migratedAssets = [];
        const failedAssets = [];
        
        for (const asset of searchResult.resources) {
            const oldPublicId = asset.public_id;
            const fileName = oldPublicId.split('/').pop();
            const newPublicId = `${targetFolder}/${fileName}`;
            
            try {
                await cloudinary.uploader.rename(oldPublicId, newPublicId);
                migratedAssets.push({ oldPublicId, newPublicId });
                console.log(`✓ Migrated: ${oldPublicId} -> ${newPublicId}`);
            } catch (renameError) {
                console.error(`✗ Failed to migrate ${oldPublicId}:`, renameError.message);
                failedAssets.push({ oldPublicId, error: renameError.message });
            }
        }
        
        console.log(`=== Migration complete ===`);
        console.log(`Successfully migrated: ${migratedAssets.length}`);
        console.log(`Failed: ${failedAssets.length}`);
        
        return {
            success: true,
            migratedCount: migratedAssets.length,
            failedCount: failedAssets.length,
            sourceFolder,
            targetFolder,
            newFolderUrl: getCloudinaryFolderUrl(targetFolder),
            migratedAssets,
            failedAssets
        };
    } catch (error) {
        console.error('Error during folder migration:', error);
        return { 
            success: false, 
            error: error.message,
            sourceFolder,
            targetFolder
        };
    }
}

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

    const { leadId, photoCount, currency, ...leadData } = requestBody;

    // Calculate pricing
    const pricing = calculatePrice(photoCount, currency);

    // If this is just a price check, return the pricing and exit
    if (leadId === 'temp-price-check') {
        return {
            statusCode: 200,
            headers: {
                'Access-Control-Allow-Origin': '*',
                'Access-Control-Allow-Headers': 'Content-Type',
                'Content-Type': 'application/json'
            },
            body: JSON.stringify({ pricing })
        };
    }

    // Airtable Base
    const base = new Airtable({ apiKey: AIRTABLE_API_KEY }).base(AIRTABLE_BASE_ID);
    const table = base(AIRTABLE_LEADS_TABLE);

    try {
        // Extract and validate required fields
        const {
            leadId,
            persistentUserId,
            step,
            memoryTitle,
            songChoice,
            photoCount,
            imageUrls,
            photosFolder,
            customerName,
            customerEmail,
            country,
            currency,
            totalAmount,
            orderId,
            utmSource,
            utmCampaign,
            detectedCurrency,
            selectedCurrency,
            sessionId,
            createdAt,
            updatedAt
        } = requestBody;
        
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
                    hasImageUrls: !!imageUrls,
                    hasPhotosFolder: !!photosFolder,
                    otherFields: Object.keys(requestBody)
                }
            });
        }

        let pricingData = {};
        if (photoCount && currency) {
            pricingData = calculatePrice(photoCount, currency);
        }

        const rawAmountValue = (totalAmount !== undefined && totalAmount !== null && totalAmount !== '')
            ? Number(totalAmount)
            : (pricingData && pricingData.total !== undefined ? Number(pricingData.total) : undefined);

        const imageUrlsValue = Array.isArray(imageUrls)
            ? imageUrls.filter(Boolean).join('\n')
            : (typeof imageUrls === 'string' ? imageUrls : undefined);

        const photosFolderValue = (typeof photosFolder === 'string' && photosFolder.trim())
            ? photosFolder.trim()
            : undefined;

        const airtableData = {
            leadId,
            persistentUserId,
            updatedAt: updatedAt || new Date().toISOString(),
            memoryTitle,
            songChoice,
            photoCount,
            imageUrls: photosFolderValue || imageUrlsValue, // Temporary: use existing field
            customerName,
            customerEmail,
            country,
            currency,
            RawAmount: Number.isFinite(rawAmountValue) ? rawAmountValue : undefined,
            utmSource,
            utmCampaign,
            detectedCurrency,
            selectedCurrency,
            sessionId,
            step,
            orderId,
        };

        // Remove undefined fields to avoid overwriting existing data with nulls
        Object.keys(airtableData).forEach(key => airtableData[key] === undefined && delete airtableData[key]);

        // Find existing record by leadId
        const records = await base(AIRTABLE_LEADS_TABLE).select({
            filterByFormula: `{leadId} = '${leadId}'`,
            maxRecords: 1
        }).firstPage();

        let airtableRecord;
        if (records.length > 0) {
            // Update existing record
            const recordToUpdate = records[0];

            // Backfill createdAt only if it is missing on the existing record
            if (!recordToUpdate.fields || !recordToUpdate.fields.createdAt) {
                airtableData.createdAt = createdAt || new Date().toISOString();
            }

            const updatedRecords = await base(AIRTABLE_LEADS_TABLE).update([{
                id: recordToUpdate.id,
                fields: airtableData
            }]);
            airtableRecord = updatedRecords[0];
            console.log('Airtable record updated:', airtableRecord.id);
        } else {
            // Create new record
            airtableData.createdAt = createdAt || new Date().toISOString();
            const createdRecords = await base(AIRTABLE_LEADS_TABLE).create([{
                fields: airtableData
            }]);

            airtableRecord = createdRecords[0];
            console.log('Airtable record created:', airtableRecord.id);
        }

        // ========== POST-PAYMENT WORKFLOW ==========
        // When step is 'PAID', migrate photos to orders folder and create Order record
        if (step === 'PAID') {
            console.log('=== Processing PAID step - Post-Payment Workflow ===');
            
            // Step 1: Migrate photos from leads to orders folder
            const migrationResult = await migrateLeadToOrdersFolder(leadId);
            console.log('Migration result:', JSON.stringify(migrationResult, null, 2));
            
            // Step 2: Create Order record in Airtable Orders table
            const AIRTABLE_ORDERS_TABLE = process.env.AIRTABLE_ORDERS_TABLE || 'Orders';
            const now = new Date().toISOString();
            
            // Get the lead record data for the order
            const leadRecord = airtableRecord.fields;
            
            // Build the new photosFolder URL pointing to orders location
            const newPhotosFolder = migrationResult.success 
                ? migrationResult.newFolderUrl 
                : getCloudinaryFolderUrl(`livingpicture/orders/${leadId}`);
            
            const orderFields = {
                leadId: leadId,
                orderId: orderId || `ord_${leadId}`,
                persistentUserId: persistentUserId || leadRecord.persistentUserId,
                createdAt: now,
                paidAt: now,
                paymentStatus: 'PAID',
                customerName: customerName || leadRecord.customerName,
                customerEmail: customerEmail || leadRecord.customerEmail,
                country: country || leadRecord.country,
                memoryTitle: memoryTitle || leadRecord.memoryTitle,
                songChoice: songChoice || leadRecord.songChoice,
                photoCount: photoCount || leadRecord.photoCount,
                photosFolder: newPhotosFolder,
                currency: currency || leadRecord.currency,
                totalAmount: Number.isFinite(rawAmountValue) ? rawAmountValue : (leadRecord.RawAmount || 0),
                detectedCurrency: detectedCurrency || leadRecord.detectedCurrency,
                selectedCurrency: selectedCurrency || leadRecord.selectedCurrency,
                sessionId: sessionId || leadRecord.sessionId,
                migrationStatus: migrationResult.success ? 'SUCCESS' : 'FAILED',
                migratedPhotoCount: migrationResult.migratedCount || 0,
            };
            
            // Remove undefined fields
            Object.keys(orderFields).forEach(key => orderFields[key] === undefined && delete orderFields[key]);
            
            // Safety check: Only create order if migration was attempted
            if (migrationResult.success || migrationResult.error === 'Cloudinary credentials not configured') {
                console.log('=== Creating Order record in Airtable ===');
                console.log('Order fields:', JSON.stringify(orderFields, null, 2));
                
                try {
                    const createdOrder = await base(AIRTABLE_ORDERS_TABLE).create([{ fields: orderFields }]);
                    console.log('✓ Order record created successfully:', createdOrder[0].id);
                    
                    return createResponse(200, {
                        ok: true,
                        leadId: leadId,
                        orderId: orderFields.orderId,
                        airtableLeadId: airtableRecord.id,
                        airtableOrderId: createdOrder[0].id,
                        pricing: pricingData,
                        migration: {
                            success: migrationResult.success,
                            migratedCount: migrationResult.migratedCount || 0,
                            newPhotosFolder: newPhotosFolder
                        },
                        message: 'Payment processed - Order created successfully'
                    });
                } catch (orderError) {
                    console.error('✗ Failed to create Order record:', orderError.message);
                    return createResponse(500, {
                        ok: false,
                        error: 'Order Creation Failed',
                        message: orderError.message,
                        leadId: leadId,
                        migration: migrationResult
                    });
                }
            } else {
                console.error('✗ Migration failed, skipping Order creation');
                return createResponse(500, {
                    ok: false,
                    error: 'Migration Failed',
                    message: 'Could not migrate photos to orders folder',
                    leadId: leadId,
                    migration: migrationResult
                });
            }
        }
        // ========== END POST-PAYMENT WORKFLOW ==========

        return createResponse(200, {
            ok: true,
            leadId: airtableRecord.fields.leadId,
            airtableId: airtableRecord.id,
            pricing: pricingData,
            message: 'Lead upserted successfully'
        });

    } catch (error) {
        console.error('=== Error processing lead ===');
        console.error('Error message:', error.message);
        console.error('Error stack:', error.stack);
        
        return createResponse(500, {
            ok: false,
            error: 'Internal Server Error',
            message: error.message || 'An unexpected error occurred while processing your request',
            type: error.name,
            statusCode: error.statusCode
        });
    }
};