class LeadTracker {
    constructor() {
        this.leadId = null;
        this.sessionId = null;
        this.persistentUserId = null;
        this.pendingUpdate = null;
        this.isUpdating = false;
        this.retryCount = 0;
        this.MAX_RETRIES = 1;
        this.DEBOUNCE_DELAY = 1000; // 1 second debounce
        
        this.initialize();
    }

    initialize() {
        // Check localStorage for persistentUserId, create if doesn't exist
        this.persistentUserId = localStorage.getItem('persistentUserId');
        if (!this.persistentUserId) {
            this.persistentUserId = `user_${this.generateId()}`;
            localStorage.setItem('persistentUserId', this.persistentUserId);
        }
        
        // Always generate a fresh leadId + sessionId on each page load.
        // This ensures every new visit/order attempt creates a NEW Leads row in Airtable.
        this.leadId = `lead_${this.generateId()}`;
        this.sessionId = `sess_${this.generateId()}`;

        const now = new Date().toISOString();
        const createdAt = now;
        
        // Detect currency based on geo/browser (stored when first detected)
        const detectedCurrency = localStorage.getItem('detectedCurrency') || this.detectCurrencyFromBrowser();
        // Selected currency is what user chose in dropdown
        const selectedCurrency = localStorage.getItem('preferredCurrency') || detectedCurrency;
        
        // Initialize with default data
        this.leadData = {
            leadId: this.leadId,
            persistentUserId: this.persistentUserId,
            createdAt: createdAt,
            updatedAt: now,
            sessionId: this.sessionId,
            step: 'STORE_VIEW',
            country: this.getUserCountry(),
            detectedCurrency: detectedCurrency,
            selectedCurrency: selectedCurrency,
            currency: selectedCurrency,
            userAgent: navigator.userAgent,
            screenResolution: `${window.screen.width}x${window.screen.height}`,
            referrer: document.referrer || 'direct',
            utmSource: new URLSearchParams(window.location.search).get('utm_source') || undefined,
            utmCampaign: new URLSearchParams(window.location.search).get('utm_campaign') || undefined,
            utmParams: this.getUtmParams(),
            pageUrl: window.location.href,
            timestamp: now
        };

        Object.keys(this.leadData).forEach(key => this.leadData[key] === undefined && delete this.leadData[key]);
    }
    
    detectCurrencyFromBrowser() {
        // Try to detect currency from browser locale
        try {
            const locale = navigator.language || navigator.userLanguage || 'he-IL';
            const country = locale.split('-')[1]?.toUpperCase() || 'IL';
            
            // Map countries to currencies
            const countryCurrencyMap = {
                'IL': 'ILS',
                'US': 'USD',
                'GB': 'USD',
                'EU': 'EUR',
                'DE': 'EUR',
                'FR': 'EUR',
                'IT': 'EUR',
                'ES': 'EUR',
                'RU': 'RUB'
            };
            
            const detected = countryCurrencyMap[country] || 'ILS';
            localStorage.setItem('detectedCurrency', detected);
            return detected;
        } catch (e) {
            return 'ILS';
        }
    }

    generateId() {
        if (typeof crypto !== 'undefined' && typeof crypto.randomUUID === 'function') {
            return crypto.randomUUID();
        }

        return Math.random().toString(36).substring(2, 15) +
               Math.random().toString(36).substring(2, 15);
    }

    getUserCountry() {
        // Try to get country from browser or use a default
        try {
            return (navigator.language || navigator.userLanguage || '').split('-')[1] || 'IL';
        } catch (e) {
            return 'IL'; // Default to Israel
        }
    }

    getUtmParams() {
        const params = new URLSearchParams(window.location.search);
        const utmParams = {};
        
        ['utm_source', 'utm_medium', 'utm_campaign', 'utm_term', 'utm_content'].forEach(param => {
            const value = params.get(param);
            if (value) utmParams[param] = value;
        });
        
        return Object.keys(utmParams).length > 0 ? JSON.stringify(utmParams) : '';
    }

    async updateLead(data, immediate = false) {
        // Merge new data with existing lead data
        this.leadData = {
            ...this.leadData,
            ...data,
            updatedAt: new Date().toISOString(),
            timestamp: new Date().toISOString()
        };

        // Debounce the API call
        if (this.pendingUpdate) {
            clearTimeout(this.pendingUpdate);
        }

        if (immediate) {
            return this.sendLeadData();
        }

        this.pendingUpdate = setTimeout(() => {
            this.sendLeadData();
        }, this.DEBOUNCE_DELAY);
    }

    async sendLeadData() {
        if (this.isUpdating) {
            // If already updating, queue the next update
            this.pendingUpdate = setTimeout(() => this.sendLeadData(), 1000);
            return;
        }

        this.isUpdating = true;
        
        try {
            const functionUrl = '/.netlify/functions/lead-upsert';

            const response = await fetch(functionUrl, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                },
                body: JSON.stringify(this.leadData)
            });

            if (!response.ok) {
                let errorDetails = '';
                try {
                    errorDetails = await response.text();
                } catch (e) {
                    errorDetails = '';
                }
                throw new Error(`HTTP error! status: ${response.status}${errorDetails ? ` | ${errorDetails}` : ''}`);
            }

            const result = await response.json();
            this.retryCount = 0; // Reset retry count on success
            return result;
            
        } catch (error) {
            console.error('Error updating lead:', error);
            console.error('Lead payload (keys):', Object.keys(this.leadData || {}));
            
            // Retry once if we haven't exceeded max retries
            if (this.retryCount < this.MAX_RETRIES) {
                this.retryCount++;
                setTimeout(() => this.sendLeadData(), 2000); // Retry after 2 seconds
            }
            
            return { ok: false, error: error.message };
        } finally {
            this.isUpdating = false;
        }
    }

    // Helper method to track step changes
    trackStep(step, additionalData = {}) {
        return this.updateLead({
            step,
            ...additionalData
        }, true); // Immediate update for step changes
    }
}

// Initialize and expose the tracker
window.leadTracker = new LeadTracker();

// Track page view on load
document.addEventListener('DOMContentLoaded', () => {
    // Determine the current step based on the page
    let step = 'STORE_VIEW';
    
    if (window.location.pathname.includes('store.html') || window.location.pathname === '/store' || window.location.pathname === '/store/') {
        // You can add more granular step tracking here based on the current view
        step = 'STORE_VIEW';
    } else if (window.location.pathname.includes('thanks.html') || window.location.pathname.includes('thank-you.html')) {
        step = 'PAID';
    } else if (window.location.pathname.includes('payment-failed.html')) {
        step = 'PENDING_PAYMENT';
    }
    
    // Track the page view
    window.leadTracker.trackStep(step, {
        pageUrl: window.location.href,
        referrer: document.referrer || 'direct'
    });
});

// Track beforeunload event
window.addEventListener('beforeunload', () => {
    // Send any pending updates before the user leaves
    if (window.leadTracker.pendingUpdate) {
        clearTimeout(window.leadTracker.pendingUpdate);
        window.leadTracker.sendLeadData();
    }
});
