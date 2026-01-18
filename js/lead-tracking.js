class LeadTracker {
    constructor() {
        // Core state
        this.leadId = null;
        this.sessionId = null;
        this.leadData = {};
        
        // Request handling
        this.pendingUpdate = null;
        this.isUpdating = false;
        this.requestQueue = [];
        this.activeRequests = new Set();
        
        // Configuration
        this.MAX_RETRIES = 3;
        this.DEBOUNCE_DELAY = 1000;
        this.SESSION_TIMEOUT = 30 * 60 * 1000; // 30 minutes
        this.MAX_CONCURRENT_REQUESTS = 3;
        this.DATA_VERSION = '1.1';
        
        // Session management
        this.lastActivity = Date.now();
        this.sessionTimeout = null;
        this.retryCounts = new Map(); // Track retry counts per request type
        
        // Initialize
        this.initialize();
        this.setupActivityListeners();
    }

    initialize() {
        try {
            // Try to load existing lead ID from localStorage with error handling
            try {
                this.leadId = localStorage.getItem('lp_leadId');
                this.loadLeadData();
            } catch (storageError) {
                console.error('Failed to load from localStorage:', storageError);
                // Attempt to recover by generating new IDs
                this.leadId = null;
                this.leadData = {};
            }

            // Generate new session ID
            this.sessionId = this.generateId();
            
            // Set up session timeout
            this.updateLastActivity();
            
            // Set up periodic sync
            this.setupPeriodicSync();
            
            // Handle page visibility changes
            document.addEventListener('visibilitychange', () => {
                if (document.visibilityState === 'visible') {
                    this.handlePageVisible();
                } else {
                    this.handlePageHidden();
                }
            });
            
            console.log('LeadTracker initialized with session:', this.sessionId);
        } catch (error) {
            console.error('Failed to initialize LeadTracker:', error);
            // Try to recover with minimal functionality
            this.leadId = this.generateId();
            this.sessionId = this.generateId();
            this.leadData = {};
        }
    }
    
    /**
     * Handle page becoming visible
     */
    handlePageVisible() {
        // Check if we need to sync data when the page becomes visible
        const lastSync = this.lastSuccessfulSync || 0;
        const timeSinceLastSync = Date.now() - lastSync;
        
        if (timeSinceLastSync > 5 * 60 * 1000) { // 5 minutes
            console.log('Page became visible after being hidden, syncing data...');
            this.syncPendingUpdates();
        }
    }
    
    /**
     * Handle page becoming hidden
     */
    handlePageHidden() {
        // Try to sync any pending updates before the page is hidden
        if (navigator.sendBeacon) {
            try {
                const data = JSON.stringify({
                    ...this.leadData,
                    _sessionEnd: true,
                    _lastActivity: this.lastActivity
                });
                
                navigator.sendBeacon('/.netlify/functions/lead-upsert', data);
            } catch (error) {
                console.error('Failed to send beacon:', error);
            }
        }
    }
    
    /**
     * Set up periodic sync of pending updates
     */
    setupPeriodicSync() {
        // Initial sync
        this.syncPendingUpdates();
        
        // Set up periodic sync every 5 minutes
        this.syncInterval = setInterval(() => {
            this.syncPendingUpdates();
        }, 5 * 60 * 1000);
        
        // Also sync when the page is about to be unloaded
        window.addEventListener('beforeunload', () => {
            this.handlePageHidden();
        });
    }
    
    /**
     * Clean up resources when the tracker is no longer needed
     */
    cleanup() {
        if (this.syncInterval) {
            clearInterval(this.syncInterval);
        }
        
        // Remove event listeners
        window.removeEventListener('beforeunload', this.handlePageHidden);
        document.removeEventListener('visibilitychange', this.handlePageVisible);
        
        // Clear any pending timeouts
        if (this.pendingUpdate) {
            clearTimeout(this.pendingUpdate);
            this.pendingUpdate = null;
        }
    }

    initializeStorage() {
        // Check if storage is available and not full
        if (!this.isStorageAvailable('localStorage')) {
            console.warn('localStorage is not available. Some features may be limited.');
            return;
        }

        // Initialize storage with versioning
        const storageVersion = localStorage.getItem('lp_storageVersion');
        if (storageVersion !== this.DATA_VERSION) {
            this.migrateStorage(storageVersion);
        }

        // Load or generate lead ID (persists across sessions)
        this.leadId = localStorage.getItem('lp_leadId');
        if (!this.leadId) {
            this.leadId = `lead_${this.generateId()}`;
            localStorage.setItem('lp_leadId', this.leadId);
        }
    }

    initializeSession() {
        // Generate new session ID with timestamp for better uniqueness
        this.sessionId = `sess_${this.generateId()}_${Date.now()}`;
        sessionStorage.setItem('lp_currentSessionId', this.sessionId);
        
        // Track session start
        this.sessionStart = new Date().toISOString();
        this.lastActivity = Date.now();
        
        // Set up session timeout
        this.sessionTimeout = setTimeout(
            () => this.handleSessionTimeout(),
            this.SESSION_TIMEOUT
        );
    }

    initializeEventListeners() {
        // Track user activity to extend session
        ['click', 'scroll', 'keypress', 'mousemove'].forEach(event => {
            document.addEventListener(event, this.handleUserActivity.bind(this), { passive: true });
        });

        // Handle page visibility changes
        document.addEventListener('visibilitychange', this.handleVisibilityChange.bind(this));
    }

    initializeLeadData() {
        // Load saved user data from localStorage
        this.loadUserData();
        
        // Get detected currency based on country
        const detectedCurrency = this.detectCurrencyFromCountry(this.getUserCountry());
        // Get selected currency from localStorage or use detected as fallback
        const selectedCurrency = localStorage.getItem('preferredCurrency') || detectedCurrency || 'ILS';

        this.leadData = {
            leadId: this.leadId,
            sessionId: this.sessionId,
            step: 'STEP_1',
            country: this.getUserCountry(),
            detectedCurrency: detectedCurrency,
            selectedCurrency: selectedCurrency,
            currency: selectedCurrency, // Keep for backward compatibility
            userAgent: navigator.userAgent,
            screenResolution: `${window.screen.width}x${window.screen.height}`,
            referrer: document.referrer || 'direct',
            utmParams: this.getUtmParams(),
            pageUrl: window.location.href,
            timestamp: new Date().toISOString()
        };
    }

    generateId() {
        return Math.random().toString(36).substring(2, 15) + 
               Math.random().toString(36).substring(2, 15);
    }
    
    // Load saved user data from localStorage
    loadUserData() {
        try {
            const savedData = localStorage.getItem('lp_userData');
            if (savedData) {
                this.userData = JSON.parse(savedData);
                this.prefillForms();
            } else {
                this.userData = {};
            }
        } catch (e) {
            console.error('Error loading user data:', e);
            this.userData = {};
        }
    }
    
    // Save user data to localStorage with validation and quota management
    saveUserData(data) {
        if (!data || typeof data !== 'object') {
            console.error('Invalid data format for saveUserData');
            return false;
        }

        try {
            // Validate data size
            const dataSize = JSON.stringify(data).length;
            const maxSize = 5 * 1024 * 1024; // 5MB max
            if (dataSize > maxSize) {
                console.error('Data size exceeds maximum allowed');
                return false;
            }

            // Check available quota
            const currentData = JSON.parse(localStorage.getItem('lp_userData') || '{}');
            const newData = { ...currentData, ...data, timestamp: Date.now() };
            
            // Clean up old data if needed
            if (JSON.stringify(newData).length > maxSize * 0.8) { // 80% of quota
                // Keep only the most recent data
                const cleanedData = Object.entries(newData)
                    .sort((a, b) => (b[1].timestamp || 0) - (a[1].timestamp || 0))
                    .slice(0, 50) // Keep only 50 most recent entries
                    .reduce((acc, [key, value]) => ({ ...acc, [key]: value }), {});
                
                localStorage.setItem('lp_userData', JSON.stringify(cleanedData));
            } else {
                localStorage.setItem('lp_userData', JSON.stringify(newData));
            }

            this.userData = newData;
            return true;
        } catch (e) {
            console.error('Error saving user data:', e);
            // Handle storage full error
            if (e.name === 'QuotaExceededError') {
                this.handleStorageFull();
            }
            return false;
        }
    }
    
    // Pre-fill forms with saved data
    prefillForms() {
        if (!this.userData) return;
        
        // Pre-fill contact forms
        document.querySelectorAll('form').forEach(form => {
            Object.entries(this.userData).forEach(([key, value]) => {
                const input = form.querySelector(`[name="${key}"]`);
                if (input && value) {
                    if (input.type === 'radio' || input.type === 'checkbox') {
                        input.checked = input.value === value;
                    } else {
                        input.value = value;
                    }
                }
            });
        });
    }

    getUserCountry() {
        // Try to get country from browser or use a default
        try {
            return (navigator.language || navigator.userLanguage || '').split('-')[1] || 'IL';
        } catch (e) {
            return 'IL'; // Default to Israel
        }
    }

    // Detect currency based on country code
    detectCurrencyFromCountry(countryCode) {
        const countryToCurrency = {
            'US': 'USD',
            'GB': 'GBP',
            'CA': 'CAD',
            'AU': 'AUD',
            'JP': 'JPY',
            'EU': 'EUR',
            'FR': 'EUR',
            'DE': 'EUR',
            'IT': 'EUR',
            'ES': 'EUR',
            'IL': 'ILS',
            'RU': 'RUB',
            // Add more country to currency mappings as needed
        };
        
        return countryToCurrency[countryCode] || 'USD'; // Default to USD if no mapping found
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
        // Check if this is user data we should save
        const userDataFields = ['name', 'email', 'phone', 'country', 'address', 'city', 'zip'];
        const userUpdate = {};
        
        // Extract user data to save
        Object.entries(data).forEach(([key, value]) => {
            if (userDataFields.includes(key) && value) {
                userUpdate[key] = value;
            }
        });
        
        // Save user data to localStorage
        if (Object.keys(userUpdate).length > 0) {
            this.saveUserData(userUpdate);
        }
        
        // Merge new data with existing lead data
        this.leadData = {
            ...this.leadData,
            ...data,
            leadId: this.leadId,
            sessionId: this.sessionId,
            timestamp: new Date().toISOString(),
            sessionStart: this.sessionStart,
            timeOnPage: Math.floor((Date.now() - new Date(this.sessionStart).getTime()) / 1000)
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
            // If already updating, queue the next update with debouncing
            if (this.pendingUpdate) {
                clearTimeout(this.pendingUpdate);
            }
            this.pendingUpdate = setTimeout(() => this.sendLeadData(), 1000);
            return;
        }

        this.isUpdating = true;
        
        try {
            // Check for queued failed updates first
            await this.processQueuedUpdates();
            
            // Prepare the data to send
            const dataToSend = { ...this.leadData };
            
            // Remove any empty or null values
            Object.keys(dataToSend).forEach(key => {
                if (dataToSend[key] === null || dataToSend[key] === undefined || dataToSend[key] === '') {
                    delete dataToSend[key];
                }
            });
            
            const response = await fetch('/.netlify/functions/lead-upsert', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                },
                body: JSON.stringify(dataToSend)
            });

            if (!response.ok) {
                throw new Error(`HTTP error! status: ${response.status}`);
            }

            const result = await response.json();
            this.retryCount = 0; // Reset retry count on success
            
            // Update last successful sync time
            this.lastSuccessfulSync = Date.now();
            
            return result;
            
        } catch (error) {
            console.error('Error updating lead:', error);
            
            // Retry with exponential backoff if we haven't exceeded max retries
            if (this.retryCount < this.MAX_RETRIES) {
                this.retryCount++;
                // Exponential backoff: 2^retryCount * 1000 ms, with jitter
                const baseDelay = Math.min(1000 * Math.pow(2, this.retryCount - 1), 30000);
                const jitter = Math.random() * 1000; // Add up to 1s jitter
                const delay = Math.floor(baseDelay + jitter);
                
                console.log(`Retry ${this.retryCount}/${this.MAX_RETRIES} in ${delay}ms`);
                return new Promise(resolve => {
                    setTimeout(async () => {
                        const result = await this.sendLeadData();
                        resolve(result);
                    }, delay);
                });
            } else {
                // If we've exhausted retries, store the data for later
                console.warn('Max retries reached, queuing update for later');
                this.queueFailedUpdate(this.leadData);
                return { ok: false, error: error.message, queued: true };
            }
        } finally {
            this.isUpdating = false;
        }
    }

    // Handle user activity to extend session
    handleUserActivity() {
        this.lastActivity = Date.now();
        // Reset session timeout
        clearTimeout(this.sessionTimeout);
        this.sessionTimeout = setTimeout(
            () => this.handleSessionTimeout(),
            this.SESSION_TIMEOUT
        );
    }

    // Handle page visibility changes
    handleVisibilityChange() {
        if (document.visibilityState === 'visible') {
            // Check if session expired while tab was in background
            const timeInactive = Date.now() - this.lastActivity;
            if (timeInactive >= this.SESSION_TIMEOUT) {
                this.handleSessionTimeout();
            } else {
                // Reset session timeout with remaining time
                clearTimeout(this.sessionTimeout);
                this.sessionTimeout = setTimeout(
                    () => this.handleSessionTimeout(),
                    this.SESSION_TIMEOUT - timeInactive
                );
            }
        }
    }

    // Handle session timeout
    handleSessionTimeout() {
        // Log session end
        const sessionDuration = Math.floor((Date.now() - new Date(this.sessionStart).getTime()) / 1000);
        this.updateLead({
            event: 'session_end',
            sessionDuration,
            timestamp: new Date().toISOString()
        }, true);

        // Clear session data
        sessionStorage.removeItem('lp_currentSessionId');
    }

    // Check if storage is available
    isStorageAvailable(type) {
        try {
            const storage = window[type];
            const testKey = '__test_key__';
            storage.setItem(testKey, testKey);
            storage.removeItem(testKey);
            return true;
        } catch (e) {
            return e instanceof DOMException && (
                // everything except Firefox
                e.code === 22 ||
                // Firefox
                e.code === 1014 ||
                // test name field too, because code might not be present
                // everything except Firefox
                e.name === 'QuotaExceededError' ||
                // Firefox
                e.name === 'NS_ERROR_DOM_QUOTA_REACHED') &&
                // acknowledge QuotaExceededError only if there's something already stored
                storage.length !== 0;
        }
    }

    // Handle storage migration
    migrateStorage(oldVersion) {
        console.log(`Migrating storage from version ${oldVersion} to ${this.DATA_VERSION}`);
        
        // Example migration logic (add more as needed)
        if (!oldVersion) {
            // Initial version
            const oldData = localStorage.getItem('userData');
            if (oldData) {
                localStorage.setItem('lp_userData', oldData);
                localStorage.removeItem('userData');
            }
        }
        
        // Update storage version
        localStorage.setItem('lp_storageVersion', this.DATA_VERSION);
    }

    // Handle storage full error
    handleStorageFull() {
        console.warn('Storage is full, cleaning up old data...');
        
        // Clear old data to free up space
        const keysToKeep = ['lp_leadId', 'lp_storageVersion', 'lp_userData'];
        Object.keys(localStorage).forEach(key => {
            if (!keysToKeep.includes(key)) {
                localStorage.removeItem(key);
            }
        });
        
        // If still full, clear old user data
        try {
            const userData = JSON.parse(localStorage.getItem('lp_userData') || '{}');
            const entries = Object.entries(userData);
            if (entries.length > 10) {
                // Keep only the 10 most recent entries
                const recentData = entries
                    .sort((a, b) => (b[1].timestamp || 0) - (a[1].timestamp || 0))
                    .slice(0, 10)
                    .reduce((acc, [key, value]) => ({ ...acc, [key]: value }), {});
                
                localStorage.setItem('lp_userData', JSON.stringify(recentData));
            }
        } catch (e) {
            console.error('Error during storage cleanup:', e);
        }
    }

    // Queue failed updates for later retry
    queueFailedUpdate(data) {
        try {
            const queue = JSON.parse(localStorage.getItem('lp_failedUpdates') || '[]');
            queue.push({
                data,
                timestamp: Date.now(),
                retryCount: 0
            });
            localStorage.setItem('lp_failedUpdates', JSON.stringify(queue));
        } catch (e) {
            console.error('Failed to queue update:', e);
        }
    }

    // Process any queued updates
    async processQueuedUpdates() {
        try {
            const queue = JSON.parse(localStorage.getItem('lp_failedUpdates') || '[]');
            if (queue.length === 0) return;
            
            const updatedQueue = [];
            const maxRetries = 3;
            
            // Process each queued update
            for (const item of queue) {
                if (item.retryCount >= maxRetries) {
                    console.warn('Max retries reached for queued update:', item);
                    continue;
                }
                
                try {
                    const response = await fetch('/.netlify/functions/lead-upsert', {
                        method: 'POST',
                        headers: { 'Content-Type': 'application/json' },
                        body: JSON.stringify(item.data)
                    });
                    
                    if (!response.ok) {
                        throw new Error(`HTTP error! status: ${response.status}`);
                    }
                    
                    console.log('Successfully sent queued update');
                } catch (error) {
                    console.warn('Failed to send queued update, will retry later:', error);
                    updatedQueue.push({
                        ...item,
                        retryCount: item.retryCount + 1,
                        lastError: error.message,
                        lastRetry: new Date().toISOString()
                    });
                }
            }
            
            // Save the updated queue
            localStorage.setItem('lp_failedUpdates', JSON.stringify(updatedQueue));
            
        } catch (e) {
            console.error('Error processing queued updates:', e);
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
    let step = 'STEP_1';
    
    if (window.location.pathname.includes('store.html')) {
        // You can add more granular step tracking here based on the current view
        step = 'STORE_VIEW';
    } else if (window.location.pathname.includes('thanks.html')) {
        step = 'PAID';
    } else if (window.location.pathname.includes('payment-failed.html')) {
        step = 'FAILED';
    }
    
    // Track the page view
    window.leadTracker.trackStep(step, {
        pageUrl: window.location.href,
        referrer: document.referrer || 'direct'
    });
});

// Track beforeunload event
window.addEventListener('beforeunload', () => {
    // Clean up session timeout
    if (window.leadTracker.sessionTimeout) {
        clearTimeout(window.leadTracker.sessionTimeout);
    }
    
    // Send any pending updates before the user leaves
    if (window.leadTracker.pendingUpdate) {
        clearTimeout(window.leadTracker.pendingUpdate);
        // Use sendBeacon for more reliable delivery during page unload
        const data = JSON.stringify(window.leadTracker.leadData);
        if (navigator.sendBeacon) {
            const blob = new Blob([data], { type: 'application/json' });
            navigator.sendBeacon('/.netlify/functions/lead-upsert', blob);
        } else {
            // Fallback to sync XHR if sendBeacon is not available
            const xhr = new XMLHttpRequest();
            xhr.open('POST', '/.netlify/functions/lead-upsert', false); // Synchronous
            xhr.setRequestHeader('Content-Type', 'application/json');
            xhr.send(data);
        }
    }

    // Add contact form submission handler
    const contactForm = document.querySelector('form:not([action*="#"])'); // Exclude forms with # in action
    if (contactForm) {
        contactForm.addEventListener('submit', async (e) => {
            e.preventDefault();
            
            try {
                // Get form data
                const formData = new FormData(contactForm);
                const formValues = Object.fromEntries(formData.entries());
                
                // Update lead with form data
                await window.leadTracker.updateLead({
                    ...formValues,
                    formType: 'contact',
                    formName: contactForm.getAttribute('name') || 'contactForm',
                    pageUrl: window.location.href,
                    timestamp: new Date().toISOString()
                }, true); // Immediate update for form submissions

                // Show success message
                const submitButton = contactForm.querySelector('button[type="submit"]');
                const originalText = submitButton.textContent;
                
                submitButton.disabled = true;
                submitButton.textContent = 'Sending...';
                
                // Optional: You can add a more sophisticated success message
                setTimeout(() => {
                    submitButton.textContent = 'Message Sent!';
                    contactForm.reset();
                    
                    // Reset button after 3 seconds
                    setTimeout(() => {
                        submitButton.disabled = false;
                        submitButton.textContent = originalText;
                    }, 3000);
                }, 1000);
                
            } catch (error) {
                console.error('Form submission error:', error);
                alert('There was an error sending your message. Please try again.');
                
                // Re-enable the submit button
                const submitButton = contactForm.querySelector('button[type="submit"]');
                submitButton.disabled = false;
                submitButton.textContent = submitButton.getAttribute('data-original-text') || 'Send Message';
            }
        });
        
        // Store original button text for later restoration
        const submitButton = contactForm.querySelector('button[type="submit"]');
        if (submitButton) {
            submitButton.setAttribute('data-original-text', submitButton.textContent);
        }
    }
});
