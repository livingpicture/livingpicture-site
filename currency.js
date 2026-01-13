// Currency configuration
const CURRENCIES = [
    { code: 'ILS', symbol: '₪', name: 'Israeli Shekel' },
    { code: 'USD', symbol: '$', name: 'US Dollar' },
    { code: 'EUR', symbol: '€', name: 'Euro' },
    { code: 'RUB', symbol: '₽', name: 'Russian Ruble' }
];

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

// Get currency from localStorage or detect from IP
async function getCurrency() {
    // Check localStorage first
    let currency = localStorage.getItem('lp_currency');
    
    if (!currency) {
        // If not set, detect from IP
        try {
            const response = await fetch('https://ipapi.co/json/');
            const data = await response.json();
            
            // Map country to currency
            const countryToCurrency = {
                'IL': 'ILS', // Israel
                'US': 'USD', // United States
                'RU': 'RUB', // Russia
                // EU countries
                'AT': 'EUR', 'BE': 'EUR', 'BG': 'EUR', 'HR': 'EUR', 'CY': 'EUR',
                'CZ': 'EUR', 'DK': 'EUR', 'EE': 'EUR', 'FI': 'EUR', 'FR': 'EUR',
                'DE': 'EUR', 'GR': 'EUR', 'HU': 'EUR', 'IE': 'EUR', 'IT': 'EUR',
                'LV': 'EUR', 'LT': 'EUR', 'LU': 'EUR', 'MT': 'EUR', 'NL': 'EUR',
                'PL': 'EUR', 'PT': 'EUR', 'RO': 'EUR', 'SK': 'EUR', 'SI': 'EUR',
                'ES': 'EUR', 'SE': 'EUR'
            };
            
            currency = countryToCurrency[data.country_code] || 'USD';
            localStorage.setItem('lp_currency', currency);
        } catch (error) {
            console.error('Error detecting currency from IP:', error);
            currency = 'USD'; // Fallback to USD
        }
    }
    
    return currency;
}

// Format price based on currency
function formatPrice(amount, currency) {
    const currencyObj = CURRENCIES.find(c => c.code === currency) || CURRENCIES[0];
    return `${currencyObj.symbol}${amount.toFixed(currency === 'ILS' || currency === 'JPY' ? 0 : 2)}`;
}

// Calculate total price based on photo count and currency
function calculateTotal(photoCount, currency) {
    const packageKey = photoCount <= 5 ? '1-5' :
                     photoCount <= 15 ? '6-15' :
                     photoCount <= 25 ? '16-25' : '26+';
    
    const pricePerPhoto = PRICING[packageKey][currency] || PRICING[packageKey]['USD'];
    return {
        total: pricePerPhoto * photoCount,
        perPhoto: pricePerPhoto,
        package: packageKey
    };
}

// Create currency dropdown HTML
function createCurrencyDropdown(currentCurrency, className = '') {
    return `
        <div class="currency-selector ${className}">
            <select class="currency-dropdown" aria-label="Select currency">
                ${CURRENCIES.map(currency => 
                    `<option value="${currency.code}" ${currentCurrency === currency.code ? 'selected' : ''}>
                        ${currency.code} (${currency.symbol})
                    </option>`
                ).join('')}
            </select>
        </div>
    `;
}

// Initialize currency selector
document.addEventListener('DOMContentLoaded', async () => {
    const currency = await getCurrency();
    
    // Initialize all currency dropdowns
    document.querySelectorAll('.currency-dropdown').forEach(dropdown => {
        // Set initial value
        dropdown.value = currency;
        
        // Add change event listener
        dropdown.addEventListener('change', (e) => {
            const newCurrency = e.target.value;
            localStorage.setItem('lp_currency', newCurrency);
            
            // Dispatch custom event for other components to listen to
            document.dispatchEvent(new CustomEvent('currencyChanged', { 
                detail: { currency: newCurrency } 
            }));
        });
    });
    
    // Dispatch initial currency load event
    document.dispatchEvent(new CustomEvent('currencyLoaded', { 
        detail: { currency } 
    }));
});
