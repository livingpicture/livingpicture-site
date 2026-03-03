exports.handler = async (event) => {
    // Handle CORS preflight
    if (event.httpMethod === 'OPTIONS') {
        return {
            statusCode: 200,
            headers: {
                'Access-Control-Allow-Origin': 'https://www.livingpicture.net',
                'Access-Control-Allow-Headers': 'Content-Type',
                'Access-Control-Allow-Methods': 'GET, OPTIONS',
                'Access-Control-Allow-Credentials': 'true'
            },
            body: ''
        };
    }

    if (event.httpMethod === 'GET') {
        return {
            statusCode: 200,
            headers: {
                'Content-Type': 'application/json',
                'Access-Control-Allow-Origin': 'https://www.livingpicture.net',
                'Access-Control-Allow-Headers': 'Content-Type',
                'Access-Control-Allow-Methods': 'GET, OPTIONS',
                'Access-Control-Allow-Credentials': 'true'
            },
            body: JSON.stringify({
                message: 'CORS test successful',
                timestamp: new Date().toISOString(),
                origin: event.headers.origin || 'No origin header'
            })
        };
    }

    return {
        statusCode: 405,
        headers: {
            'Access-Control-Allow-Origin': 'https://www.livingpicture.net',
            'Access-Control-Allow-Headers': 'Content-Type',
            'Access-Control-Allow-Methods': 'GET, OPTIONS',
            'Access-Control-Allow-Credentials': 'true'
        },
        body: JSON.stringify({ error: 'Method not allowed' })
    };
};
