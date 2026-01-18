const { handler } = require('./calculate-price');

// Mock the event object
const createMockEvent = (queryParams = {}) => ({
  httpMethod: 'GET',
  queryStringParameters: queryParams,
  headers: {}
});

describe('Pricing Function', () => {
  test('should return correct price for 5 photos in ILS', async () => {
    const event = createMockEvent({ photoCount: '5', currency: 'ILS' });
    const response = await handler(event);
    const body = JSON.parse(response.body);
    
    expect(response.statusCode).toBe(200);
    expect(body.ok).toBe(true);
    expect(body.data.photoCount).toBe(5);
    expect(body.data.pricePerPhoto).toBe(40); // 5-9 bracket
    expect(body.data.subtotal).toBe(200); // 5 * 40
    expect(body.data.currency).toBe('ILS');
  });

  test('should return correct price for 15 photos in USD', async () => {
    const event = createMockEvent({ photoCount: '15', currency: 'USD' });
    const response = await handler(event);
    const body = JSON.parse(response.body);
    
    expect(response.statusCode).toBe(200);
    expect(body.ok).toBe(true);
    expect(body.data.photoCount).toBe(15);
    expect(body.data.currency).toBe('USD');
    
    // 35 ILS / 3.5 (exchange rate) = 10 USD per photo
    const expectedPricePerPhoto = 35 / 3.5;
    expect(body.data.pricePerPhoto).toBeCloseTo(expectedPricePerPhoto, 2);
  });

  test('should handle missing photoCount parameter', async () => {
    const event = createMockEvent({ currency: 'ILS' });
    const response = await handler(event);
    const body = JSON.parse(response.body);
    
    expect(response.statusCode).toBe(400);
    expect(body.ok).toBe(false);
    expect(body.error).toContain('Missing required parameter');
  });

  test('should handle invalid photoCount', async () => {
    const event = createMockEvent({ photoCount: 'invalid', currency: 'ILS' });
    const response = await handler(event);
    const body = JSON.parse(response.body);
    
    expect(response.statusCode).toBe(400);
    expect(body.ok).toBe(false);
  });

  test('should handle CORS preflight request', async () => {
    const event = {
      httpMethod: 'OPTIONS',
      headers: {}
    };
    
    const response = await handler(event);
    expect(response.statusCode).toBe(204);
    expect(response.headers['Access-Control-Allow-Origin']).toBe('*');
  });
});
