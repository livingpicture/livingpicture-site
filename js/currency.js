// Currency configuration
const CURRENCIES = [
    { code: 'ILS', symbol: '₪', name: 'Israeli Shekel' },
    { code: 'USD', symbol: '$', name: 'US Dollar' },
    { code: 'EUR', symbol: '€', name: 'Euro' },
    { code: 'RUB', symbol: '₽', name: 'Russian Ruble' }
];

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

// Initialize currency selectors
document.addEventListener('DOMContentLoaded', async () => {
    const currency = await getCurrency();

    // Find all containers and inject the dropdown
    document.querySelectorAll('.currency-selector-container').forEach(container => {
        container.innerHTML = createCurrencyDropdown(currency);
    });

    // Add event listeners to all newly created dropdowns
    document.querySelectorAll('.currency-dropdown').forEach(dropdown => {
        dropdown.addEventListener('change', (e) => {
            const newCurrency = e.target.value;
            localStorage.setItem('lp_currency', newCurrency);

            // Dispatch the event from the dropdown itself
            e.target.dispatchEvent(new CustomEvent('currencyChanged', {
                detail: { currency: newCurrency },
                bubbles: true // Allow the event to bubble up to the document
            }));
        });
    });

    // Dispatch initial event to set prices on page load
    document.dispatchEvent(new CustomEvent('currencyLoaded', {
        detail: { currency }
    }));
});
