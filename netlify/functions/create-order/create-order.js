exports.handler = async (event, context) => {
    return {
        statusCode: 200,
        body: JSON.stringify({ ok: true, message: 'Order created' })
    };
};
