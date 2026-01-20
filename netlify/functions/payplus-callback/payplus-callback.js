const Airtable = require('airtable');

function createResponse(statusCode, body) {
    return {
        statusCode,
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
    };
}

exports.handler = async (event, context) => {
    const { AIRTABLE_API_KEY, AIRTABLE_BASE_ID, AIRTABLE_ORDERS_TABLE } = process.env;
    const missingEnvVars = ['AIRTABLE_API_KEY', 'AIRTABLE_BASE_ID', 'AIRTABLE_ORDERS_TABLE'].filter(key => !process.env[key]);

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

    const metadata = data.data?.metadata || {};
    const leadId = metadata.leadId;
    const now = new Date().toISOString();

    if (!leadId) {
        console.error('Missing leadId in PayPlus metadata.');
        return createResponse(400, { ok: false, error: 'Missing leadId in payment metadata' });
    }

    let leadRecord = {};
    try {
        const records = await base('Leads').select({
            filterByFormula: `{leadId} = '${leadId}'`,
            maxRecords: 1
        }).firstPage();

        if (records.length > 0) {
            leadRecord = records[0].fields;
            console.log('Found lead record:', records[0].id);
        } else {
            console.warn(`Lead with leadId ${leadId} not found. Proceeding with data from metadata.`);
        }
    } catch (error) {
        console.error('Error fetching lead from Airtable:', error);
        // Proceeding with metadata even if lead fetch fails
    }

    const orderFields = {
        orderId: metadata.orderId || `ord_${transaction.uuid}`,
        createdAt: now,
        paymentstatus: 'PAID',
        customerEmail: data.customer?.email || leadRecord.customerEmail,
        customerName: data.customer?.name || leadRecord.customerName,
        country: data.customer?.country_iso || leadRecord.country,
        memoryTitle: leadRecord.memoryTitle || metadata.memoryTitle,
        songChoice: leadRecord.songChoice || metadata.songChoice,
        photoCount: Number(leadRecord.photoCount || metadata.photoCount) || undefined,
        packageKey: leadRecord.packageKey || metadata.packageKey,
        imageUrls: leadRecord.imageUrls || metadata.imageUrls,
        transactionId: transaction.uuid,
        paymentProvider: 'PayPlus',
        paymentStatusRaw: JSON.stringify(data),
        currency: transaction.currency,
        totalAmount: Number(transaction.amount_in_cents) / 100,
        payplusPaymentLink: data.payment_page_link,
        paidAt: now,
        fulfillmentStatus: 'NEW',
        leadId: leadId,
        detectedCurrency: leadRecord.detectedCurrency || metadata.detectedCurrency,
        selectedCurrency: leadRecord.selectedCurrency || metadata.selectedCurrency,
        // No 'notes' field in the user request, so it is omitted.
    };

    try {
        const createdRecord = await base(AIRTABLE_ORDERS_TABLE).create([{ fields: orderFields }]);
        console.log('Successfully created order in Airtable:', createdRecord[0].id);
        return createResponse(200, { ok: true, message: 'Order created successfully', orderId: createdRecord[0].id });
    } catch (error) {
        console.error('Error creating order record in Airtable:', error);
        return createResponse(500, { ok: false, error: 'Airtable Error', message: error.message });
    }
};
