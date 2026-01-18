// netlify/functions/calculate-price/calculate-price.js
const FUNC_VERSION = "calculate-price@2026-01-15-1";

// Price brackets in ILS
const PRICE_BRACKETS = [
  { min: 1, max: 4, pricePerPhoto: 45 },
  { min: 5, max: 9, pricePerPhoto: 40 },
  { min: 10, max: 19, pricePerPhoto: 35 },
  { min: 20, max: 49, pricePerPhoto: 30 },
  { min: 50, max: 99, pricePerPhoto: 25 },
  { min: 100, max: Infinity, pricePerPhoto: 20 }
];

// Exchange rates (could be updated periodically from an API in production)
const EXCHANGE_RATES = {
  ILS: 1,
  USD: 3.5,  // Example rate, should be updated from a reliable source
  EUR: 3.8,  // Example rate, should be updated from a reliable source
  GBP: 4.5   // Example rate, should be updated from a reliable source
};

// Default currency
const DEFAULT_CURRENCY = 'ILS';

/**
 * Calculate the total price based on the number of photos and currency
 * @param {number} photoCount - Number of photos
 * @param {string} currency - Currency code (e.g., 'ILS', 'USD', 'EUR')
 * @returns {Object} - Object containing price details
 */
function calculatePrice(photoCount, currency = DEFAULT_CURRENCY) {
  // Validate input
  const count = parseInt(photoCount, 10);
  if (isNaN(count) || count < 1) {
    throw new Error('Invalid photo count. Must be a positive number.');
  }

  // Find the appropriate price bracket
  const bracket = PRICE_BRACKETS.find(b => count >= b.min && count <= b.max) || 
                 PRICE_BRACKETS[PRICE_BRACKETS.length - 1];
  
  // Calculate price in ILS
  const pricePerPhotoILS = bracket.pricePerPhoto;
  const subtotalILS = count * pricePerPhotoILS;
  
  // Convert to requested currency if needed
  const exchangeRate = EXCHANGE_RATES[currency.toUpperCase()] || 1;
  const pricePerPhoto = currency === 'ILS' ? pricePerPhotoILS : pricePerPhotoILS / exchangeRate;
  const subtotal = currency === 'ILS' ? subtotalILS : subtotalILS / exchangeRate;
  
  // Round to 2 decimal places for currency
  const formatCurrency = (amount) => parseFloat(amount.toFixed(2));
  
  return {
    photoCount: count,
    pricePerPhoto: formatCurrency(pricePerPhoto),
    subtotal: formatCurrency(subtotal),
    currency: currency.toUpperCase(),
    exchangeRate: currency !== 'ILS' ? exchangeRate : undefined,
    priceBracket: {
      min: bracket.min,
      max: bracket.max === Infinity ? '∞' : bracket.max,
      pricePerPhotoILS: pricePerPhotoILS
    },
    nextBracket: getNextBracket(count, pricePerPhotoILS)
  };
}

/**
 * Get information about the next price bracket (for showing savings)
 */
function getNextBracket(currentCount, currentPrice) {
  const currentIndex = PRICE_BRACKETS.findIndex(b => 
    currentCount >= b.min && currentCount <= b.max
  );
  
  if (currentIndex < 0 || currentIndex >= PRICE_BRACKETS.length - 1) {
    return null; // Already at the best bracket
  }
  
  const nextBracket = PRICE_BRACKETS[currentIndex + 1];
  const photosToNextBracket = nextBracket.min - currentCount;
  const savingsPerPhoto = currentPrice - nextBracket.pricePerPhoto;
  
  return {
    photosNeeded: photosToNextBracket,
    newPricePerPhoto: nextBracket.pricePerPhoto,
    potentialSavings: photosToNextBracket * savingsPerPhoto
  };
}

// Netlify function handler
exports.handler = async (event) => {
  // Set CORS headers
  const headers = {
    'Content-Type': 'application/json',
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Methods': 'GET, OPTIONS',
    'Access-Control-Allow-Headers': 'Content-Type',
    'X-Func-Version': FUNC_VERSION
  };

  // Handle CORS preflight
  if (event.httpMethod === 'OPTIONS') {
    return {
      statusCode: 204,
      headers,
      body: ''
    };
  }

  try {
    // Parse query parameters
    const { photoCount, currency = DEFAULT_CURRENCY } = event.queryStringParameters || {};
    
    if (!photoCount) {
      return {
        statusCode: 400,
        headers,
        body: JSON.stringify({
          ok: false,
          error: 'Missing required parameter: photoCount'
        })
      };
    }

    // Calculate price
    const priceInfo = calculatePrice(photoCount, currency);
    
    return {
      statusCode: 200,
      headers,
      body: JSON.stringify({
        ok: true,
        data: priceInfo
      })
    };
    
  } catch (error) {
    console.error('Error calculating price:', error);
    
    return {
      statusCode: 400,
      headers,
      body: JSON.stringify({
        ok: false,
        error: error.message || 'Failed to calculate price',
        ...(process.env.NODE_ENV === 'development' && { stack: error.stack })
      })
    };
  }
};
