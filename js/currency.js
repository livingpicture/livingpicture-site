/**
 * Currency Manager - Single source of truth for currency data and functionality
 * 
 * This module handles all currency-related functionality including:
 * - Currency conversion
 * - Price formatting
 * - Currency detection
 * - Price calculations
 */
window.CurrencyManager = (function() {
    'use strict';

    // Private variables
    const CURRENCIES = {
        'ILS': { symbol: '₪', name: 'Israeli Shekel', decimalDigits: 0 },
        'USD': { symbol: '$', name: 'US Dollar', decimalDigits: 2 },
        'EUR': { symbol: '€', name: 'Euro', decimalDigits: 2 },
        'RUB': { symbol: '₽', name: 'Russian Ruble', decimalDigits: 0 }
    };

    // Pricing in different currencies (prices per photo)
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

    // Current currency (default to ILS)
    let currentCurrency = 'ILS';

    /**
     * Format a price in the current currency
     * @param {number} amount - The amount to format
     * @param {string} [currency=currentCurrency] - The currency code (defaults to current currency)
     * @returns {string} Formatted price string
     */
    function formatPrice(amount, currency = currentCurrency) {
        if (!CURRENCIES[currency]) {
            console.warn(`Unknown currency: ${currency}, defaulting to ILS`);
            currency = 'ILS';
        }
        
        const currencyData = CURRENCIES[currency];
        const formattedAmount = amount.toLocaleString(undefined, {
            minimumFractionDigits: currencyData.decimalDigits,
            maximumFractionDigits: currencyData.decimalDigits
        });
        
        return `${currencyData.symbol}${formattedAmount}`;
    }

    /**
     * Get the price for a given number of photos in the current currency
     * @param {number} numPhotos - Number of photos
     * @param {string} [currency=currentCurrency] - The currency code (defaults to current currency)
     * @returns {number} Price per photo
     */
    function getPricePerPhoto(numPhotos, currency = currentCurrency) {
        let priceTier = '26+';
        
        if (numPhotos <= 5) priceTier = '1-5';
        else if (numPhotos <= 15) priceTier = '6-15';
        else if (numPhotos <= 25) priceTier = '16-25';
        
        return PRICING[priceTier]?.[currency] || PRICING[priceTier]?.ILS || 0;
    }

    /**
     * Calculate the total price for a given number of photos
     * @param {number} numPhotos - Number of photos
     * @param {string} [currency=currentCurrency] - The currency code (defaults to current currency)
     * @returns {number} Total price
     */
    function calculateTotalPrice(numPhotos, currency = currentCurrency) {
        return numPhotos * getPricePerPhoto(numPhotos, currency);
    }

    /**
     * Get the current currency
     * @returns {string} Current currency code
     */
    function getCurrentCurrency() {
        return currentCurrency;
    }

    /**
     * Set the current currency
     * @param {string} currency - The currency code to set
     */
    function setCurrency(currency) {
        if (CURRENCIES[currency]) {
            currentCurrency = currency;
            localStorage.setItem('lp_currency', currency);
            
            // Dispatch event to notify about currency change
            document.dispatchEvent(new CustomEvent('currencyChanged', { 
                detail: { currency } 
            }));
        } else {
            console.warn(`Attempted to set unknown currency: ${currency}`);
        }
    }

    /**
     * Initialize the currency manager
     * @returns {Promise<string>} The detected or set currency
     */
    async function init() {
        // Try to get from localStorage first
        const savedCurrency = localStorage.getItem('lp_currency');
        if (savedCurrency && CURRENCIES[savedCurrency]) {
            currentCurrency = savedCurrency;
            return currentCurrency;
        }

        // If not in localStorage, try to detect from browser
        try {
            // Try to get currency from browser's language
            const browserLang = navigator.language || 'en-US';
            const region = new Intl.Locale(browserLang).region;
            
            // Map of region codes to our supported currencies
            const regionToCurrency = {
                'IL': 'ILS',  // Israel
                'US': 'USD',  // United States
                'GB': 'GBP',  // United Kingdom
                'EU': 'EUR',  // European Union
                'RU': 'RUB'   // Russia
                // Add more mappings as needed
            };
            
            if (region && regionToCurrency[region]) {
                currentCurrency = regionToCurrency[region];
                localStorage.setItem('lp_currency', currentCurrency);
            }
        } catch (e) {
            console.warn('Could not detect currency from browser, using default', e);
        }
        
        return currentCurrency;
    }

    // Public API
    return {
        init,
        formatPrice,
        getPricePerPhoto,
        calculateTotalPrice,
        getCurrentCurrency,
        setCurrency,
        getCurrencies: () => ({ ...CURRENCIES }),
        getPricing: () => ({ ...PRICING })
    };
})();

// Auto-initialize
document.addEventListener('DOMContentLoaded', () => {
    CurrencyManager.init().then(currency => {
        console.log(`Currency Manager initialized with ${currency}`);
    });
});
