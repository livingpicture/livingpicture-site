class LeadTracker {
    constructor() {
        this.leadId = null;
        this.sessionId = null;
        this.pendingUpdate = null;
        this.isUpdating = false;
        this.retryCount = 0;
        this.MAX_RETRIES = 1;
        this.DEBOUNCE_DELAY = 1000; // 1 second debounce
        
        this.initialize();
    }

    initialize() {
        // Load or generate lead and session IDs
        this.leadId = localStorage.getItem('lp_leadId');
        this.sessionId = localStorage.getItem('lp_sessionId');
        
        // Generate new IDs if they don't exist
        if (!this.leadId) {
            this.leadId = `lead_${this.generateId()}`;
            localStorage.setItem('lp_leadId', this.leadId);
        }
        
        if (!this.sessionId) {
            this.sessionId = `sess_${this.generateId()}`;
            localStorage.setItem('lp_sessionId', this.sessionId);
        }
        
        // Initialize with default data
        this.leadData = {
            leadId: this.leadId,
            sessionId: this.sessionId,
            step: 'STEP_1',
            country: this.getUserCountry(),
            currency: localStorage.getItem('preferredCurrency') || 'ILS',
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
            const response = await fetch('/.netlify/functions/lead-upsert', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                },
                body: JSON.stringify(this.leadData)
            });

            if (!response.ok) {
                throw new Error(`HTTP error! status: ${response.status}`);
            }

            const result = await response.json();
            this.retryCount = 0; // Reset retry count on success
            return result;
            
        } catch (error) {
            console.error('Error updating lead:', error);
            
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
    // Send any pending updates before the user leaves
    if (window.leadTracker.pendingUpdate) {
        clearTimeout(window.leadTracker.pendingUpdate);
        window.leadTracker.sendLeadData();
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
