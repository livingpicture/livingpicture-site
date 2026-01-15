// Currency configuration
let currentCurrency = 'ILS';
const CURRENCIES = {
    'ILS': { symbol: '₪', name: 'Israeli Shekel' },
    'USD': { symbol: '$', name: 'US Dollar' },
    'EUR': { symbol: '€', name: 'Euro' },
    'RUB': { symbol: '₽', name: 'Russian Ruble' }
};

// Pricing in different currencies (prices per photo)
const PRICING = {
    '1-5': {
        ILS: 18,
        USD: 4.80,
        EUR: 4.50,
        RUB: 445
    },
    '6-15': {
        ILS: 16,
        USD: 4.20,
        EUR: 4.00,
        RUB: 395
    },
    '16-25': {
        ILS: 14,
        USD: 3.70,
        EUR: 3.50,
        RUB: 345
    },
    '26+': {
        ILS: 12,
        USD: 3.10,
        EUR: 2.90,
        RUB: 295
    }
};

// Store the current step and form data
let currentStep = 1;
const formData = {
    memoryName: '',
    photos: [],
    music: {
        songName: '',
        artistName: '',
        custom: true,
        teamChoose: false
    },
    customer: {
        name: '',
        email: '',
        country: '',
        phone: ''
    },
    currency: 'ILS',
    pricing: {
        currentTier: '1-5',
        pricePerPhoto: 20,
        totalPrice: 0
    },
    savedAt: null
};

// DOM Elements
const progressFill = document.querySelector('.progress-fill');
const steps = document.querySelectorAll('.step');
const stepSections = document.querySelectorAll('.store-step');
const songNameInput = document.getElementById('song-name');
const artistNameInput = document.getElementById('artist-name');
const nextButtons = {
    'next-to-photos': 2,
    'next-to-music': 3,
    'next-to-checkout': 4,
    'complete-purchase': 'complete'
};
const backButtons = {
    'back-to-name': 1,
    'back-to-photos': 2,
    'back-to-music': 3
};
const memoryNameInput = document.getElementById('memory-name');
const photoUploadInput = document.getElementById('photo-upload');
const browseFilesBtn = document.getElementById('browse-files');
const dropZone = document.getElementById('drop-zone');
const photoGrid = document.getElementById('photo-grid');
const musicOptionsContainer = document.getElementById('music-options');
const summaryName = document.getElementById('summary-name');
const summaryPhotoCount = document.getElementById('summary-photo-count');
const summaryMusic = document.getElementById('summary-music');
const successModal = document.getElementById('success-modal');
const closeModalBtn = document.getElementById('close-modal');
const chooseSongOption = document.getElementById('choose-song-option');
const teamChooseOption = document.getElementById('team-choose-option');
const songSelectionForm = document.getElementById('song-selection-form');
const teamChooseNote = document.getElementById('team-choose-note');
const selectSongRadio = document.getElementById('select-song');
const teamChooseRadio = document.getElementById('team-choose');

// Clear error message when typing in memory name field
if (memoryNameInput) {
    memoryNameInput.addEventListener('input', function() {
        const formGroup = this.closest('.form-group');
        if (formGroup) {
            formGroup.classList.remove('error');
            this.classList.remove('error');
            const errorElement = document.getElementById('memory-name-error');
            if (errorElement) {
                errorElement.remove();
            }
        }
    });
}

// Initialize the store
function initStore() {
    // Load saved data if exists
    loadSavedData();
    
    // Set up event listeners
    setupEventListeners();
    
    // Initialize currency
    initCurrency();
    
    // Initialize the first step
    showStep(1);
    
    // Render music options
    renderMusicOptions();
}

// Initialize currency
async function initCurrency() {
    // Check if we have a saved currency
    const savedCurrency = localStorage.getItem('lp_currency');
    
    if (savedCurrency && CURRENCIES[savedCurrency]) {
        currentCurrency = savedCurrency;
    } else {
        // Try to detect currency from IP
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
            
            const detectedCurrency = countryToCurrency[data.country_code] || 'USD';
            currentCurrency = detectedCurrency;
            localStorage.setItem('lp_currency', detectedCurrency);
        } catch (error) {
            console.error('Error detecting currency from IP:', error);
            currentCurrency = 'USD';
        }
    }
    
    // Update currency in form data
    formData.currency = currentCurrency;
    
    // Create currency dropdowns
    createCurrencyDropdowns();
    
    // Update prices with current currency
    updateAllPrices();
}

// Create currency dropdowns
function createCurrencyDropdowns() {
    const containers = [
        { id: 'currency-selector-container', className: 'currency-dropdown' },
        { id: 'pricing-currency-selector', className: 'pricing-currency-dropdown' }
    ];
    
    containers.forEach(container => {
        const element = document.getElementById(container.id);
        if (element) {
            let html = `<select class="${container.className}" aria-label="Select currency">`;
            
            for (const [code, currency] of Object.entries(CURRENCIES)) {
                const selected = currentCurrency === code ? ' selected' : '';
                html += `<option value="${code}"${selected}>${code} (${currency.symbol})</option>`;
            }
            
            html += '</select>';
            element.innerHTML = html;
            
            // Add event listener
            const select = element.querySelector('select');
            select.addEventListener('change', handleCurrencyChange);
        }
    });
}

// Handle currency change
function handleCurrencyChange(e) {
    const newCurrency = e.target.value;
    if (newCurrency !== currentCurrency && CURRENCIES[newCurrency]) {
        currentCurrency = newCurrency;
        formData.currency = newCurrency;
        localStorage.setItem('lp_currency', newCurrency);
        updateAllPrices();
        
        // Update all dropdowns
        document.querySelectorAll('.currency-dropdown, .pricing-currency-dropdown').forEach(select => {
            if (select.value !== newCurrency) {
                select.value = newCurrency;
            }
        });
    }
}

// Update all prices on the page
function updateAllPrices() {
    updatePricingDisplay();
    updateOrderSummary();
}

// Set up all event listeners
function setupEventListeners() {
    // Track if files are currently being processed
    let isProcessingFiles = false;

    // Next step buttons
    Object.keys(nextButtons).forEach(buttonId => {
        const button = document.getElementById(buttonId);
        if (button) {
            button.addEventListener('click', async (e) => {
                e.preventDefault();
                
                const nextStep = nextButtons[buttonId];
                
                // Step 1: Memory Name → Photos
                if (currentStep === 1) {
                    if (!saveCurrentStep()) return;
                    
                    try {
                        console.log('Syncing memory name to Airtable...');
                        await syncLeadToAirtable();
                        console.log('Memory name synced successfully');
                    } catch (error) {
                        console.error('Error syncing memory name:', error);
                        showError('Warning: Could not save progress. Your data will be saved locally.');
                    }
                    await showStep(2);
                    return;
                }
                
                // Step 2: Photos → Music
                if (currentStep === 2) {
                    // Only validate if no photos are selected at all
                    if (!formData.photos || formData.photos.length === 0) {
                        validatePhotoUpload();
                        return;
                    }
                    
                    // If we have photos, proceed even if files are still processing
                    saveCurrentStep();
                    try {
                        console.log('Syncing photos to Airtable before music step...');
                        await syncLeadToAirtable();
                        console.log('Photos synced successfully, proceeding to music step');
                    } catch (error) {
                        console.error('Error syncing photos:', error);
                        showError('Warning: Could not save photos. Your data will be saved locally.');
                    }
                    await showStep(3);
                    return;
                }
                
                // Step 3: Music → Checkout
                if (currentStep === 3) {
                    if (!validateMusicInputs() || !saveCurrentStep()) return;
                    
                    try {
                        console.log('Syncing music selection to Airtable...');
                        await syncLeadToAirtable();
                        console.log('Music selection synced successfully');
                    } catch (error) {
                        console.error('Error syncing music selection:', error);
                        showError('Warning: Could not save music selection. Your data will be saved locally.');
                    }
                    await showStep(4);
                    return;
                }
                
                // Step 4: Checkout → Complete
                if (currentStep === 4 && nextStep === 'complete') {
                    try {
                        // Update status to PENDING_PAYMENT before payment
                        console.log('Updating lead status to PENDING_PAYMENT...');
                        formData.status = 'PENDING_PAYMENT';
                        await syncLeadToAirtable();
                        console.log('Lead status updated to PENDING_PAYMENT');
                    } catch (error) {
                        console.error('Error updating lead status:', error);
                        // Still proceed with payment
                    }
                    completePurchase();
                    return;
                }
            });
        }
    });
    
    // Add input event listeners for music step
    if (songNameInput && artistNameInput) {
        const musicInputs = [songNameInput, artistNameInput];
        musicInputs.forEach(input => {
            input.addEventListener('input', () => {
                // Update form data on input
                formData.music.songName = songNameInput.value.trim();
                formData.music.artistName = artistNameInput.value.trim();
                
                // Enable/disable next button based on input
                const hasValidInput = formData.music.songName && formData.music.artistName;
                updateNextButton('next-to-checkout', hasValidInput);
            });
            
            // Add focus/blur effects
            input.addEventListener('focus', (e) => {
                e.target.parentElement.classList.add('focused');
            });
            
            input.addEventListener('blur', (e) => {
                e.target.parentElement.classList.remove('focused');
            });
        });
    }
    
    // Back buttons
    Object.keys(backButtons).forEach(buttonId => {
        const button = document.getElementById(buttonId);
        if (button) {
            button.addEventListener('click', (e) => {
                e.preventDefault();
                const prevStep = backButtons[buttonId];
                showStep(prevStep);
            });
        }
    });
    
    // Memory name input
    if (memoryNameInput) {
        memoryNameInput.addEventListener('input', (e) => {
            formData.memoryName = e.target.value;
            saveToLocalStorage();
            updateNextButton('next-to-photos', e.target.value.trim() !== '');
        });
    }
    
    // Initialize file upload handling after DOM is fully loaded
    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', setupFileUpload);
    } else {
        // DOM is already ready
        setTimeout(setupFileUpload, 0);
    }
    
    // Drag and drop for photos
    if (dropZone) {
        ['dragenter', 'dragover', 'dragleave', 'drop'].forEach(eventName => {
            dropZone.addEventListener(eventName, preventDefaults, false);
        });
        
        ['dragenter', 'dragover'].forEach(eventName => {
            dropZone.addEventListener(eventName, highlight, false);
        });
        
        ['dragleave', 'drop'].forEach(eventName => {
            dropZone.addEventListener(eventName, unhighlight, false);
        });
        
        dropZone.addEventListener('drop', handleDrop, false);
    }
    
    // Close modal
    if (closeModalBtn) {
        closeModalBtn.addEventListener('click', () => {
            successModal.classList.remove('active');
        });
    }
    
    // Music selection options
    chooseSongOption.addEventListener('click', () => {
        selectSongRadio.checked = true;
        updateMusicSelectionUI();
    });
    
    teamChooseOption.addEventListener('click', () => {
        teamChooseRadio.checked = true;
        updateMusicSelectionUI();
    });
    
    // Radio button changes
    selectSongRadio.addEventListener('change', updateMusicSelectionUI);
    teamChooseRadio.addEventListener('change', updateMusicSelectionUI);
    
    // Music input validation
    songNameInput.addEventListener('input', validateMusicInputs);
    artistNameInput.addEventListener('input', validateMusicInputs);
}

// Validate photo upload
function validatePhotoUpload() {
    const dropZone = document.getElementById('drop-zone');
    const errorElement = document.getElementById('photo-upload-error');
    
    // Check if there are any photos
    const hasPhotos = formData.photos && formData.photos.length > 0;
    
    if (!hasPhotos) {
        // Show error state
        if (dropZone) {
            dropZone.classList.add('error');
            // Force reflow to ensure the animation plays
            void dropZone.offsetWidth;
        }
        if (errorElement) {
            // Update error message text
            const errorText = errorElement.querySelector('span');
            if (errorText) {
                errorText.textContent = 'Please upload at least one photo to continue';
            }
            
            // Make sure error is visible
            errorElement.style.display = 'flex';
            errorElement.style.visibility = 'visible';
            errorElement.style.opacity = '1';
            errorElement.style.position = 'static';
            errorElement.style.marginTop = '1rem';
            
            // Log for debugging
            console.log('Showing error message: Please upload at least one photo to continue');
        }
        
        // Scroll to the upload area
        const uploadArea = document.querySelector('.photo-upload-container');
        if (uploadArea) {
            uploadArea.scrollIntoView({ behavior: 'smooth', block: 'center' });
        }
        
        // Ensure the next button is disabled
        updateNextButton('next-to-music', false);
        
        return false;
    }
    
    // Clear error state if we have photos
    if (dropZone) {
        dropZone.classList.remove('error');
    }
    if (errorElement) {
        errorElement.style.display = 'none';
        errorElement.style.visibility = 'hidden';
        errorElement.style.opacity = '0';
    }
    
    // Enable the next button
    updateNextButton('next-to-music', true);
    
    return true;
}

// Sync lead data to Airtable
async function syncLeadToAirtable() {
    try {
        // Only sync if we have at least some data
        if (!formData) {
            console.log('[Airtable Sync] No form data available for sync');
            return null;
        }

        // Map step number to Single Select values
        const stepMapping = {
            1: 'STEP_1',
            2: 'STEP_2',
            3: 'STEP_3',
            4: 'CHECKOUT'
        };
        
        // Get current step in the correct format
        const currentStepValue = stepMapping[currentStep] || 'STEP_1';
        
        // Get all image URLs, ensuring they're valid Cloudinary URLs and convert to comma-separated string
        const imageUrlsArray = (formData.photos || [])
            .map(photo => (photo.permanentUrl || '').trim())
            .filter(url => url && typeof url === 'string' && url.startsWith('https://res.cloudinary.com'));
        
        const imageUrlsString = imageUrlsArray.join(','); // Convert to comma-separated string

        // Prepare lead data according to Airtable Leads schema
        const leadData = {
            // Required fields
            leadId: window.leadTracker?.leadId || `lead_${Math.random().toString(36).substr(2, 9)}`,
            step: currentStepValue,
            
            // Customer information
            customerEmail: (formData.customer?.email || '').trim(),
            customerName: (formData.customer?.name || '').trim(),
            customerPhone: (formData.customer?.phone || '').trim(),
            country: (formData.customer?.country || 'Israel').trim(),
            
            // Memory information
            memoryTitle: (formData.memoryTitle || formData.memoryName || '').trim(),
            photoCount: formData.photos?.length || 0,
            packageKey: formData.pricing?.currentTier || '1-5',
            imageUrls: imageUrlsString, // ✅ Already a comma-separated string
            
            // Financial information
            totalAmount: formData.pricing?.totalPrice || 0,
            currency: (formData.currency || 'ILS').toUpperCase(),
            
            // Music selection
            songChoice: formData.music?.songName 
                ? `${formData.music.songName}${formData.music.artistName ? ' by ' + formData.music.artistName : ''}`.trim()
                : '',
                
            // System fields
            updatedAt: new Date().toISOString(),
            createdAt: formData.createdAt || new Date().toISOString()
        };
        
        // Update leadTracker with the leadId
        if (window.leadTracker && !window.leadTracker.leadId) {
            window.leadTracker.leadId = leadData.leadId;
        }

        console.log('[Airtable Sync] Syncing lead to Airtable:', {
            leadId: leadData.leadId,
            step: leadData.step,
            imageUrlCount: imageUrlsArray.length,
            hasEmail: !!leadData.customerEmail,
            hasMemoryTitle: !!leadData.memoryTitle,
            photoCount: leadData.photoCount,
            fields: Object.keys(leadData)
        });

        // Call the Netlify function with timeout
        const controller = new AbortController();
        const timeoutId = setTimeout(() => controller.abort(), 15000); // 15 second timeout

        try {
            const response = await fetch('/.netlify/functions/lead-upsert', {
                method: 'POST',
                headers: { 
                    'Content-Type': 'application/json',
                    'Accept': 'application/json'
                },
                body: JSON.stringify(leadData),
                signal: controller.signal
            });

            clearTimeout(timeoutId);

            // Log response status
            console.log('[Airtable Sync] Response status:', response.status, response.statusText);

            if (!response.ok) {
                const errorText = await response.text();
                console.error('[Airtable Sync] HTTP error response:', {
                    status: response.status,
                    statusText: response.statusText,
                    body: errorText
                });
                
                const error = new Error(`HTTP error! status: ${response.status}`);
                error.response = { 
                    status: response.status, 
                    statusText: response.statusText, 
                    data: errorText 
                };
                throw error;
            }

            const responseData = await response.json();
            console.log('[Airtable Sync] ✅ Lead synced successfully:', { 
                leadId: leadData.leadId, 
                step: leadData.step,
                action: responseData.action 
            });
            
            return responseData;
            
        } catch (error) {
            if (error.name === 'AbortError') {
                console.error('[Airtable Sync] Request timeout after 15 seconds');
                throw new Error('Request timeout - please check your connection');
            }
            
            console.error('[Airtable Sync] Error in sync request:', {
                error: error.message,
                name: error.name,
                status: error.response?.status,
                statusText: error.response?.statusText,
                leadId: leadData.leadId,
                step: leadData.step
            });
            throw error;
        }
    } catch (error) {
        console.error('[Airtable Sync] ❌ Error in syncLeadToAirtable:', {
            message: error.message,
            stack: error.stack,
            currentStep: currentStep
        });
        // Don't show error to user as this is a background sync
        return null;
    }
}

// Show a specific step
async function showStep(stepNumber) {
    // 1. First, sync with Airtable at the beginning of step transition
    try {
        console.log(`[Airtable Sync] Starting sync before step transition from ${currentStep} to ${stepNumber}...`);
        const syncResult = await syncLeadToAirtable();
        if (syncResult && syncResult.leadId) {
            console.log(`[Airtable Sync] Successfully synced lead ${syncResult.leadId} at step ${currentStep}`);
        } else {
            console.warn('[Airtable Sync] Sync completed but no lead ID was returned');
        }
    } catch (error) {
        console.error('[Airtable Sync] Error during sync before step change:', {
            error: error.message,
            step: currentStep,
            nextStep: stepNumber,
            timestamp: new Date().toISOString()
        });
        // Continue with step change even if sync fails, but show a warning
        showError('Warning: Could not save progress to our servers. Your data will be saved locally.');
    }
    
    // 2. Validate current step before proceeding
    let canProceed = true;
    
    // Validate step 1 when moving to step 2
    if (stepNumber === 2 && currentStep === 1) {
        if (!saveCurrentStep()) {
            console.log('Step 1 validation failed');
            return false;
        }
    }
    
    // Validate photo upload when moving to step 3
    if (stepNumber === 3 && currentStep === 2) {
        if (!validatePhotoUpload()) {
            console.log('Photo upload validation failed');
            return false;
        }
    }
    
    // Only proceed with step change if validation passed
    if (canProceed) {
        // 3. Update UI to show loading state
        const nextButton = document.querySelector(`[data-next-to="${stepNumber}"]`);
        if (nextButton) {
            nextButton.classList.add('loading');
            nextButton.disabled = true;
        }
        
        try {
            // 4. Hide all steps
            document.querySelectorAll('.store-step').forEach(step => {
                step.classList.remove('active');
            });
            
            // 5. Show the selected step
            const stepElement = document.getElementById(`step-${stepNumber}`);
            if (stepElement) {
                stepElement.classList.add('active');
            }
            
            // 6. Update progress indicators
            updateProgressIndicators(stepNumber);
            
            // 7. Update current step
            const previousStep = currentStep;
            currentStep = stepNumber;
            
            // 8. Save the current step data
            saveCurrentStep();
            
            // 9. Validate the new step
            validateCurrentStep(stepNumber);
            
            // 10. Update UI for the new step
            updateUIForStep(stepNumber);
            
            // 11. Track the step change
            trackStepChange(stepNumber, previousStep);
            
            return true;
            
        } catch (error) {
            console.error('Error during step transition:', error);
            return false;
        } finally {
            // 12. Remove loading state
            if (nextButton) {
                nextButton.classList.remove('loading');
                nextButton.disabled = false;
            }
        }
    }
    
    return false;
}

// Validate music inputs and show inline errors
function validateMusicInputs() {
    // If team choose is selected, always return true
    if (teamChooseRadio && teamChooseRadio.checked) {
        // Clear any existing errors
        clearMusicInputErrors();
        return true;
    }
    
    // For manual song selection, validate both fields
    const songName = songNameInput ? songNameInput.value.trim() : '';
    const artistName = artistNameInput ? artistNameInput.value.trim() : '';
    let isValid = true;
    
    // Clear previous errors
    clearMusicInputErrors();
    
    // Validate song name
    if (!songName) {
        showInputError(songNameInput, 'Please enter a song name');
        isValid = false;
    }
    
    // Validate artist name
    if (!artistName) {
        showInputError(artistNameInput, 'Please enter an artist name');
        isValid = false;
    }
    
    // Update next button state
    updateNextButton('next-to-checkout', isValid);
    
    return isValid;
}

// Show error for a specific input field
function showInputError(inputElement, message) {
    if (!inputElement) return;
    
    // Add error class to input
    inputElement.classList.add('error');
    
    // Create or update error message
    let errorElement = inputElement.nextElementSibling;
    if (!errorElement || !errorElement.classList.contains('error-message')) {
        errorElement = document.createElement('div');
        errorElement.className = 'error-message';
        inputElement.parentNode.insertBefore(errorElement, inputElement.nextSibling);
    }
    
    errorElement.textContent = message;
    errorElement.style.display = 'block';
    
    // Scroll to the first error
    inputElement.scrollIntoView({ behavior: 'smooth', block: 'center' });
}

// Clear all music input errors
function clearMusicInputErrors() {
    const inputs = [songNameInput, artistNameInput];
    inputs.forEach(input => {
        if (input) {
            input.classList.remove('error');
            const errorElement = input.nextElementSibling;
            if (errorElement && errorElement.classList.contains('error-message')) {
                errorElement.style.display = 'none';
            }
        }
    });
}

// Show error message
function showError(message) {
    console.error(message);
    const errorElement = document.getElementById('photo-upload-error');
    if (errorElement) {
        errorElement.style.display = 'flex';
        const errorText = errorElement.querySelector('span');
        if (errorText) {
            errorText.textContent = message;
        }
    }
}

// Show success message
function showSuccess(message) {
    console.log('Success:', message);
    // Create or find success message element
    let successElement = document.getElementById('success-message');
    
    if (!successElement) {
        successElement = document.createElement('div');
        successElement.id = 'success-message';
        successElement.style.position = 'fixed';
        successElement.style.top = '20px';
        successElement.style.left = '50%';
        successElement.style.transform = 'translateX(-50%)';
        successElement.style.backgroundColor = '#4CAF50';
        successElement.style.color = 'white';
        successElement.style.padding = '15px 25px';
        successElement.style.borderRadius = '4px';
        successElement.style.zIndex = '1000';
        successElement.style.boxShadow = '0 2px 10px rgba(0, 0, 0, 0.2)';
        successElement.style.display = 'none';
        document.body.appendChild(successElement);
    }
    
    // Set message and show
    successElement.textContent = message;
    successElement.style.display = 'block';
    
    // Auto-hide after 3 seconds
    setTimeout(() => {
        successElement.style.display = 'none';
    }, 3000);
}

// Clear photo upload error message
function clearPhotoUploadError() {
    const errorElement = document.getElementById('photo-upload-error');
    const dropZone = document.getElementById('drop-zone');
    
    if (errorElement) {
        errorElement.style.display = 'none';
        errorElement.style.visibility = 'hidden';
        errorElement.style.opacity = '0';
    }
    
    if (dropZone) {
        dropZone.classList.remove('error');
    }
}

// Update UI based on current step
function updateUIForStep(step) {
    switch (step) {
        case 1:
            // Set focus on the input field
            if (memoryNameInput) {
                memoryNameInput.focus();
                // Move cursor to the end
                const len = memoryNameInput.value.length;
                memoryNameInput.setSelectionRange(len, len);
            }
            break;
            
        case 2:
            // Update photo grid if we have photos
            if (formData.photos && formData.photos.length > 0) {
                renderPhotoGrid();
                updateNextButton('next-to-music', true);
            } else {
                updateNextButton('next-to-music', false);
            }
            break;
            
        case 3:
            // Set focus on song name input
            if (songNameInput) {
                songNameInput.focus();
                
                // Pre-fill if we have data
                if (formData.music) {
                    songNameInput.value = formData.music.songName || '';
                    artistNameInput.value = formData.music.artistName || '';
                }
                
                // Update button state based on existing data
                const hasValidInput = formData.music.songName && formData.music.artistName;
                updateNextButton('next-to-checkout', hasValidInput);
            }
            break;
            
        case 4:
            // Update order summary
            updateOrderSummary();
            break;
    }
}

// Validate the current step based on step number
async function validateCurrentStep(stepNumber) {
    switch (stepNumber) {
        case 1: // Name step
            return formData.memoryName && formData.memoryName.trim() !== '';
        case 2: // Photos step
            return formData.photos && formData.photos.length > 0;
        case 3: // Music step
            if (teamChooseRadio && teamChooseRadio.checked) {
                return true; // Team choose option is always valid
            }
            return !!(formData.music && formData.music.songName && formData.music.artistName);
        case 4: // Customer details step
            return validateCustomerDetails();
        default:
            return false;
    }
function updateNextButton(buttonId, isEnabled) {
    const button = document.getElementById(buttonId);
    if (!button) return;

    // Always update the disabled state based on isEnabled
    button.disabled = !isEnabled;
    
    // Only toggle the btn-disabled class if the state is changing
    // This prevents visual flicker
    if (isEnabled) {
        if (button.classList.contains('btn-disabled')) {
            button.classList.remove('btn-disabled');
        }
    }
}

// Handle file selection
async function handleFileSelect(e) {
    // Prevent default to handle everything ourselves
    e.preventDefault();

    // Get files from the event
    const files = e.target.files || (e.dataTransfer && e.dataTransfer.files);

    // Process files if we have any
    if (files && files.length > 0) {
        console.log('Files selected:', files.length);
        // Clear any existing error when new files are selected
        clearPhotoUploadError();

        try {
            // Process the files and wait for completion
            await processFiles(files);
        } catch (error) {
            console.error('Error in handleFileSelect:', error);
            showError('Failed to process files. Please try again.');
        }
    } else {
        // If no files were selected, validate to show error
        validatePhotoUpload();
    }
}

// Set up file upload handling with proper event delegation
function setupFileUpload() {
    // Get the file input and browse button
    const fileInput = document.getElementById('photo-upload');
    const browseBtn = document.getElementById('browse-files');

    if (!fileInput || !browseBtn) return;

    // Remove any existing event listeners by cloning the elements
    const newInput = fileInput.cloneNode(true);
    const newBrowseBtn = browseBtn.cloneNode(true);

    // Replace the original elements with clones to remove existing listeners
    if (fileInput.parentNode) {
        fileInput.parentNode.replaceChild(newInput, fileInput);
    }
    if (browseBtn.parentNode) {
        browseBtn.parentNode.replaceChild(newBrowseBtn, browseBtn);
    }

    // Handle click on browse button
    newBrowseBtn.addEventListener('click', function (e) {
        e.preventDefault();
        e.stopPropagation();
        newInput.click();
    }, true); // Use capture phase to ensure we catch the event first

    // Handle file selection
    newInput.addEventListener('change', function (e) {
        if (e.target.files && e.target.files.length > 0) {
            handleFileSelect(e);
            // Reset the input after handling
            this.value = '';
            // Stop any event propagation
            e.stopPropagation();
        }
    }, true); // Use capture phase

    // Prevent any other click handlers from interfering
    newInput.addEventListener('click', function (e) {
        e.stopPropagation();
    }, true);
}

// Calculate the current pricing tier based on number of photos
function calculatePricingTier(photoCount) {
    if (photoCount >= 26) return '26+';
    if (photoCount >= 16) return '16-25';
    if (photoCount >= 6) return '6-15';
    return '1-5';
}

// Get price per photo based on tier and currency
function getPricePerPhoto(tier, currency) {
    return PRICING[tier]?.[currency] || PRICING['1-5'][currency];
}

// Calculate total price based on number of photos and current currency
function calculateTotalPrice(photoCount) {
    if (photoCount === 0) return 0;
    const tier = calculatePricingTier(photoCount);
    const pricePerPhoto = getPricePerPhoto(tier, currentCurrency);
    return photoCount * pricePerPhoto;
}

// Update the pricing display
function updatePricingDisplay() {
    const photoCount = formData.photos.length;
    const tier = calculatePricingTier(photoCount);
    const pricePerPhoto = getPricePerPhoto(tier, currentCurrency);
    const totalPrice = calculateTotalPrice(photoCount);
    const currencySymbol = CURRENCIES[currentCurrency]?.symbol || '$';

    // Update form data
    formData.pricing = {
        currentTier: tier,
        pricePerPhoto: pricePerPhoto,
        totalPrice: totalPrice,
        currency: currentCurrency
    };

    // Update UI
    const totalPriceElement = document.getElementById('total-price');
    const photoCountText = document.getElementById('photo-count-text');
    const priceDetails = document.getElementById('price-details');
    const incentiveElement = document.getElementById('pricing-incentive');

    // Update total price with currency symbol
    if (totalPriceElement) {
        totalPriceElement.textContent = `${currencySymbol}${totalPrice.toFixed(2)}`;
    }

    // Update photo count in the total label
    if (photoCountText) {
        photoCountText.textContent = `${photoCount} ${photoCount === 1 ? 'photo' : 'photos'}`;
    }

    // Update price details with currency symbol
    if (priceDetails) {
        if (photoCount === 0) {
            priceDetails.textContent = 'Add photos to see your price per photo';
        } else {
            priceDetails.textContent = `${photoCount} ${photoCount === 1 ? 'photo' : 'photos'} • ${currencySymbol}${pricePerPhoto.toFixed(2)} each`;
        }
    }

    // Update incentive message with dynamic pricing encouragement
    if (incentiveElement) {
        const currentTier = tier;
        let nextTier = null;
        
        // Find the next pricing tier (if any)
        if (photoCount < 6) {
            nextTier = '6-15';
        } else if (photoCount < 16) {
            nextTier = '16-25';
        } else if (photoCount < 26) {
            nextTier = '26+';
        }

        if (nextTier) {
            const nextTierMin = parseInt(nextTier.split('-')[0]);
            const photosNeeded = nextTierMin - photoCount;
            const nextPricePerPhoto = getPricePerPhoto(nextTier, currentCurrency);
            const priceDiff = pricePerPhoto - nextPricePerPhoto;
            
            // Only show if there's a price difference and we need more photos
            if (priceDiff > 0 && photosNeeded > 0) {
                const percentOff = Math.round((priceDiff / pricePerPhoto) * 100);
                incentiveElement.innerHTML = `
                    <div class="incentive-message">
                        <i class="fas fa-tag"></i>
                        <span>Add ${photosNeeded} more photo${photosNeeded > 1 ? 's' : ''} to save ${percentOff}% per photo</span>
                        <div class="progress-container">
                            <div class="progress-bar" style="width: ${(photoCount / nextTierMin) * 100}%"></div>
                            <div class="progress-text">${photoCount}/${nextTierMin}</div>
                        </div>
                    </div>
                `;
                incentiveElement.style.display = 'flex';
                return;
            }
        }

        // If no next tier or already at the best price
        if (photoCount > 0) {
            incentiveElement.innerHTML = `
                <div class="incentive-message best-price">
                    <i class="fas fa-check-circle"></i>
                    <span>You're getting the best price at ${currencySymbol}${pricePerPhoto.toFixed(2)} per photo!</span>
                </div>
            `;
            incentiveElement.style.display = 'flex';
        } else {
            incentiveElement.style.display = 'none';
        }
    }

    return totalPrice > 0;
}

// Generate a lightweight fingerprint for a file using metadata
function generateFileFingerprint(file) {
    // Use file name, size, and last modified time as a fingerprint
    // This is much faster than hashing the entire file
    return `${file.name}-${file.size}-${file.lastModified}`;
}

// Track file processing and upload state
let isProcessingFiles = false;
let isUploadingToCloudinary = false;

// Cloudinary configuration
const CLOUDINARY_CLOUD_NAME = 'dojuekij4';
const CLOUDINARY_UPLOAD_PRESET = 'livingpicture_orders_unsigned';

/**
 * Uploads a file to Cloudinary
 * @param {File} file - The file to upload
 * @returns {Promise<Object>} The Cloudinary upload response
 */
async function uploadToCloudinary(file) {
    const formData = new FormData();
    formData.append('file', file);
    formData.append('upload_preset', CLOUDINARY_UPLOAD_PRESET);
    
    try {
        const response = await fetch(`https://api.cloudinary.com/v1_1/${CLOUDINARY_CLOUD_NAME}/image/upload`, {
            method: 'POST',
            body: formData
        });
        
        if (!response.ok) {
            const error = await response.json();
            throw new Error(error.message || 'Failed to upload image to Cloudinary');
        }
        
        return await response.json();
    } catch (error) {
        console.error('Error uploading to Cloudinary:', error);
        throw error;
    }
}

// Re-enable file input after processing
function reenableFileInput() {
    const fileInput = document.getElementById('photo-upload');
    const browseBtn = document.getElementById('browse-files');
    
    if (fileInput && browseBtn) {
        // Reset the file input
        fileInput.value = '';
        
        // Re-enable the browse button
        browseBtn.disabled = false;
        browseBtn.innerHTML = 'Add More Photos';
        browseBtn.classList.remove('processing');
        
        // Reset processing flags
        isProcessingFiles = false;
        isUploadingToCloudinary = false;
    }
}

/**
 * Uploads an image file to Cloudinary
 * @param {File} file - The image file to upload
 * @returns {Promise<Object>} - The Cloudinary upload response
 */
async function uploadImageToCloudinary(file) {
    const formData = new FormData();
    formData.append('file', file);
    formData.append('upload_preset', CLOUDINARY_UPLOAD_PRESET);
    
    try {
        const response = await fetch(`https://api.cloudinary.com/v1_1/${CLOUDINARY_CLOUD_NAME}/image/upload`, {
            method: 'POST',
            body: formData
        });
        
        if (!response.ok) {
            const error = await response.json();
            throw new Error(error.message || 'Failed to upload image to Cloudinary');
        }
        
        return await response.json();
    } catch (error) {
        console.error('Error uploading to Cloudinary:', error);
        throw error;
    }
}

// Process selected files
async function processFiles(files) {
    // Set processing flag
    isProcessingFiles = true;
    const validImageTypes = ['image/jpeg', 'image/png', 'image/webp'];
    const heicTypes = ['image/heic', 'image/heif', 'image/heif-sequence'];

    // Check for HEIC files first to show specific error
    const heicFiles = Array.from(files).filter(file => heicTypes.some(type =>
        file.type.toLowerCase().includes(type.split('/')[1])
    ));

    if (heicFiles.length > 0) {
        showError('HEIC/HEIF files are not supported. Please convert to JPG or PNG before uploading.');
        return;
    }

    // Check for other valid image types
    const validFiles = Array.from(files).filter(file =>
        validImageTypes.includes(file.type.toLowerCase())
    );

    if (validFiles.length === 0) {
        showError('Please select valid image files (JPEG, PNG, or WebP)');
        return;
    }

    // Get DOM elements
    const fileInput = document.getElementById('photo-upload');
    const browseBtn = document.getElementById('browse-files');
    const progressContainer = document.getElementById('upload-progress');
    const progressBar = document.getElementById('upload-progress-bar');
    const progressText = document.getElementById('upload-progress-text');

    if (!fileInput || !browseBtn || !progressContainer || !progressBar || !progressText) return;

    // Function to trigger file input
    const triggerFileInput = () => {
        fileInput.click();
    };

    // Set up event listener for browse button
    browseBtn.addEventListener('click', triggerFileInput);

    // Store original button HTML to restore later
    const originalBtnHTML = browseBtn.innerHTML;

    // Set loading state
    const setLoading = (isLoading) => {
        if (isLoading) {
            browseBtn.innerHTML = '<i class="fas fa-spinner fa-spin"></i> Processing...';
            browseBtn.classList.add('processing');
            progressContainer.style.display = 'block';
        } else {
            // Restore button
            browseBtn.innerHTML = originalBtnHTML;
            browseBtn.classList.remove('processing');

            // Fade out progress bar
            setTimeout(() => {
                progressContainer.style.opacity = '0';
                setTimeout(() => {
                    progressContainer.style.display = 'none';
                    progressContainer.style.opacity = '1';
                    progressBar.style.width = '0%';
                }, 300);
            }, 500);
        }
    };

    // Update progress
    const updateProgress = (processed, total) => {
        const percent = Math.round((processed / total) * 100);
        progressBar.style.width = `${percent}%`;
        const statusText = isUploadingToCloudinary ? 'Uploading' : 'Processing';
        progressText.textContent = `${statusText} ${processed} of ${total} photos...`;
        
        // Update next button state based on upload status
        if (isUploadingToCloudinary) {
            updateNextButton('next-to-music', false);
            const nextBtn = document.getElementById('next-to-music');
            if (nextBtn) {
                nextBtn.innerHTML = '<i class="fas fa-spinner fa-spin"></i> Uploading...';
            }
        } else if (processed > 0) {
            updateNextButton('next-to-music', true);
            const nextBtn = document.getElementById('next-to-music');
            if (nextBtn) {
                nextBtn.innerHTML = 'Continue <i class="fas fa-arrow-right"></i>';
            }
        }
    };

    // Start loading
    setLoading(true);
    isUploadingToCloudinary = true; // Start in uploading state
    updateProgress(0, files.length);
    
    // Disable next button during initial processing
    updateNextButton('next-to-music', false);

    // Check total size
    const totalSize = Array.from(files).reduce((total, file) => total + file.size, 0);
    const maxTotalSize = 120 * 1024 * 1024; // 120MB

    // Format bytes to human-readable string
    const formatFileSize = (bytes) => {
        if (bytes === 0) return '0 Bytes';
        const k = 1024;
        const sizes = ['Bytes', 'KB', 'MB', 'GB'];
        const i = Math.floor(Math.log(bytes) / Math.log(k));
        return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
    };

    if (totalSize > maxTotalSize) {
        const currentSize = formatFileSize(totalSize);
        const maxSize = formatFileSize(maxTotalSize);
        showError(`Total file size (${currentSize}) exceeds the maximum allowed (${maxSize}). Please upload fewer or smaller photos.`);
        reenableFileInput();
        return;
    }

    // Check for duplicate files
    const existingHashes = new Set(formData.photos.map(photo => photo.fileFingerprint));
    let duplicateCount = 0;
    let processedCount = 0;
    const fileArray = Array.from(files);
    const totalFiles = fileArray.length;
    let pendingUIUpdate = false;
    let lastUpdateTime = 0;
    let lastProgressUpdate = 0;

    // Determine concurrency based on device type (mobile or desktop)
    const isMobile = window.innerWidth <= 768; // Common breakpoint for mobile devices
    // Mobile: 2-3 concurrent, Desktop: 4-6 concurrent based on device capabilities
    const maxConcurrent = isMobile ?
        Math.min(3, Math.max(2, navigator.hardwareConcurrency || 2)) : // Mobile: 2-3
        Math.min(6, Math.max(4, navigator.hardwareConcurrency || 4)); // Desktop: 4-6

    // Batch UI updates using requestAnimationFrame
    const scheduleUIUpdate = () => {
        // Immediately enable the next button if we have photos
        if (formData.photos.length > 0) {
            updateNextButton('next-to-music', true);
        }

        if (!pendingUIUpdate) {
            pendingUIUpdate = true;
            requestAnimationFrame(() => {
                renderPhotoGrid();
                updatePricingDisplay();
                updatePhotoCounter();
                pendingUIUpdate = false;
                lastUpdateTime = performance.now();
                
                // Ensure button state is correct after UI updates
                validatePhotoUpload();
            });
        }
    };

    // Process a single file
    const processFile = async (file) => {
        try {
            const imageData = await getImageData(file);
            
            if (imageData.error) {
                return { success: false, file, error: imageData.error };
            }

            // Upload to Cloudinary
            const cloudinaryResponse = await uploadImageToCloudinary(file);
            
            // Create photo object with Cloudinary URL
            const photo = {
                id: `photo-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
                file,
                previewUrl: URL.createObjectURL(file),
                permanentUrl: cloudinaryResponse.secure_url,
                orientation: imageData.orientation,
                width: imageData.width,
                height: imageData.height,
                order: formData.photos.length + newPhotos.length + 1,
                isCover: formData.photos.length + newPhotos.length === 0
            };

            // Add to new photos and update UI
            newPhotos.push(photo);
            processedCount++;
            updateProgress(processedCount, totalFiles);
            
            // Update formData and sync to Airtable if this is the last photo
            if (processedCount === totalFiles) {
                formData.photos = [...formData.photos, ...newPhotos];
                // Sync to Airtable after all photos are processed
                syncLeadToAirtable().catch(error => {
                    console.error('Error syncing after photo upload:', error);
                });
            }
            scheduleUIUpdate();

            // Enable next button as soon as we have at least one photo
            if (newPhotos.length === 1) {
                updateNextButton('next-to-music', true);
            }

            return { success: true, file, photo };
        } catch (error) {
            console.error('Error processing file:', file.name, error);
            return { 
                success: false, 
                file, 
                error: error.message || 'Upload failed' 
            };
        } finally {
            processing.delete(file);
            
            // If this was the last file, update the UI state
            if (processing.size === 0) {
                isUploadingToCloudinary = false;
                if (nextBtn && newPhotos.length > 0) {
                    nextBtn.disabled = false;
                    nextBtn.innerHTML = 'Continue <i class="fas fa-arrow-right"></i>';
                }
            }
        }
    };

    // Process a batch of files
        const processBatch = async (batch) => {
            const batchPromises = batch.map(file =>
                processFile(file).then(result => {
                    if (result.success) {
                        formData.photos.push(result.photo);
                        newPhotos.push(result.photo);
                    }

                    // Update progress
                    processed++;

                    // Update progress more efficiently (throttled)
                    if (processed % 2 === 0 || processed === filesToProcess.length) {
                        updateProgress(processed, filesToProcess.length);

                        // Update UI in batches
                        if (processed % 5 === 0 || processed === filesToProcess.length) {
                            scheduleUIUpdate();
                        }
                    }

                    return result;
                })
            );

            return Promise.all(batchPromises);
        };

        // Process files in batches with controlled concurrency
        const batchSize = maxConcurrent;
        for (let i = 0; i < filesToProcess.length; i += batchSize) {
            const batch = filesToProcess.slice(i, i + batchSize);
            await processBatch(batch);
        }

        return newPhotos;
    };

    // Start processing files
    try {
        const newPhotos = await processFilesOptimized(validFiles);

        // Final UI update
        if (newPhotos.length > 0) {
            updatePhotoGrid();
            updatePhotoCounter();
            updatePricingDisplay();
            showSuccess(`Added ${newPhotos.length} photo${newPhotos.length > 1 ? 's' : ''}`);
            
            // Update the next button state after successful file processing
            validatePhotoUpload();
        }

    } catch (error) {
        console.error('Error processing files:', error);
        showError('An error occurred while processing your photos. Please try again.');
    } finally {
        // Clean up
        setLoading(false);
        // Re-enable file input by resetting it
        const fileInput = document.getElementById('photo-upload');
        if (fileInput) {
            fileInput.value = '';
        }
        // Reset processing flag
        isProcessingFiles = false;
    }
}

// Re-render the photo grid
function updatePhotoGrid() {
    const photoGrid = document.querySelector('.photo-grid');
    if (!photoGrid) return;

    // Clear existing content
    photoGrid.innerHTML = '';

    // Add photos to grid
    formData.photos.forEach(photo => {
        const photoItem = document.createElement('div');
        photoItem.className = 'photo-item';
        photoItem.innerHTML = `
            <img src="${photo.previewUrl}" alt="${photo.name}">
            <button class="remove-photo" onclick="removePhoto('${photo.id}')">
                <i class="fas fa-times"></i>
            </button>
        `;
        photoGrid.appendChild(photoItem);
    });
}

// Update photo counter with dynamic message
function updatePhotoCounter() {
    const photoCounter = document.getElementById('photo-counter');
    if (!photoCounter) return;

    const count = formData.photos.length;

    let message = '';
    if (count === 0) {
        photoCounter.style.display = 'none';
        return;
    } else if (count === 1) {
        message = '1 memory selected ✨ You\'re off to a beautiful start.';
    } else if (count < 5) {
        message = `${count} memories selected ✨ Keep them coming!`;
    } else if (count < 10) {
        message = `${count} memories selected ✨ What a wonderful collection!`;
    } else {
        message = `${count} memories selected ✨ This is truly special!`;
    }

    photoCounter.innerHTML = `
        <div class="count">${message.split('✨')[0].trim()}</div>
        <div class="message">✨ ${message.split('✨')[1].trim()}</div>
    `;
    photoCounter.style.display = 'block';
}

// Render photo grid with show more functionality
function renderPhotoGrid() {
    if (!photoGrid) return;

    const showMoreBtn = document.getElementById('show-more-btn');
    const maxVisiblePhotos = 6;
    const totalPhotos = formData.photos.length;
    let showAll = photoGrid.classList.contains('show-all');

    if (totalPhotos === 0) {
        photoGrid.innerHTML = '';
        updatePhotoCounter();
        if (showMoreBtn) showMoreBtn.style.display = 'none';
        return;
    }

    // Determine how many photos to show
    const photosToShow = showAll ? totalPhotos : Math.min(totalPhotos, maxVisiblePhotos);

    // Render all photos but only show the limited set initially
    photoGrid.innerHTML = formData.photos.map((photo, index) => `
        <div class="photo-item" data-photo-id="${photo.id}" ${index >= maxVisiblePhotos && !showAll ? 'style="display:none;"' : ''}>
            <img src="${photo.previewUrl}" alt="Uploaded memory" loading="lazy">
            <button class="remove-photo" data-photo-id="${photo.id}" aria-label="Remove photo">
                <i class="fas fa-times"></i>
            </button>
        </div>
    `).join('');

    // Update show more button visibility
    if (showMoreBtn) {
        if (totalPhotos > maxVisiblePhotos) {
            showMoreBtn.style.display = 'block';
            showMoreBtn.textContent = showAll ? 'Show Less' : `Show ${totalPhotos - maxVisiblePhotos} More`;

            // Toggle show all photos
            showMoreBtn.onclick = () => {
                const isShowingAll = photoGrid.classList.toggle('show-all');
                showMoreBtn.textContent = isShowingAll ? 'Show Less' : `Show ${totalPhotos - maxVisiblePhotos} More`;

                // Show/hide photos
                const photoItems = photoGrid.querySelectorAll('.photo-item');
                photoItems.forEach((item, index) => {
                    if (index >= maxVisiblePhotos) {
                        item.style.display = isShowingAll ? 'block' : 'none';
                    }
                });

                // Toggle the limited class for the gradient effect
                photoGrid.classList.toggle('limited', !isShowingAll);
            };

            // Apply limited class if not showing all
            if (!showAll) {
                photoGrid.classList.add('limited');
            } else {
                photoGrid.classList.remove('limited');
            }
        } else {
            showMoreBtn.style.display = 'none';
            photoGrid.classList.remove('limited');
        }
    }

    // Add event listeners to remove buttons
    document.querySelectorAll('.remove-photo').forEach(button => {
        button.addEventListener('click', (e) => {
            e.stopPropagation();
            const photoId = button.getAttribute('data-photo-id');
            removePhoto(photoId);
        });
    });

    // Update the photo counter
    updatePhotoCounter();
}

// Remove a photo
function removePhoto(photoId) {
    // Find the photo to be removed and clean up its object URL
    const photoToRemove = formData.photos.find(photo => photo.id === photoId);
    if (photoToRemove && photoToRemove.previewUrl) {
        URL.revokeObjectURL(photoToRemove.previewUrl);
    }

    // Remove the photo from the array
    formData.photos = formData.photos.filter(photo => photo.id !== photoId);

    // Update pricing
    updatePricingDisplay();

    // Save and update UI
    saveToLocalStorage();
    renderPhotoGrid();
    updateNextButton('next-to-music', formData.photos.length > 0);
    updateOrderSummary(); // Update the order summary after removing a photo
}

// Render music options
function renderMusicOptions() {
    if (!musicOptionsContainer) return;

    musicOptionsContainer.innerHTML = musicOptions.map(music => `
        <div class="music-option" data-music-id="${music.id}">
            <div class="music-cover">
                <i class="fas fa-music"></i>
            </div>
            <div class="music-info">
                <div class="music-title">${music.title}</div>
                <div class="music-duration">${music.duration}</div>
            </div>
            <button class="play-button" data-music-id="${music.id}" aria-label="Play ${music.title}">
                <i class="fas fa-play"></i>
            </button>
        </div>
    `).join('');

    // Add event listeners to music options
    document.querySelectorAll('.music-option').forEach(option => {
        option.addEventListener('click', (e) => {
            // Don't trigger if clicking the play button
            if (e.target.closest('.play-button')) return;

            const musicId = option.getAttribute('data-music-id');
            selectMusic(musicId);
        });
    });

    // Add event listeners to play buttons
    document.querySelectorAll('.play-button').forEach(button => {
        button.addEventListener('click', (e) => {
            e.stopPropagation();
            const musicId = button.getAttribute('data-music-id');
            toggleMusicPreview(musicId, button);
        });
    });
}

// Select music
function selectMusic(musicId) {
    // Update UI
    document.querySelectorAll('.music-option').forEach(option => {
        option.classList.remove('selected');
    });

    const selectedOption = document.querySelector(`.music-option[data-music-id="${musicId}"]`);
    if (selectedOption) {
        selectedOption.classList.add('selected');
    }

    // Update form data
    formData.music = musicId;
    saveToLocalStorage();

    // Enable next button
    updateNextButton('next-to-checkout', true);
}

// Update music selection UI based on user choice
function updateMusicSelectionUI() {
    if (!teamChooseRadio || !chooseSongOption || !teamChooseOption) return;

    const isTeamChoose = teamChooseRadio.checked;

    // Update visual state
    if (isTeamChoose) {
        // For team choose option
        chooseSongOption.classList.remove('selected');
        teamChooseOption.classList.add('selected');
        if (songSelectionForm) songSelectionForm.style.display = 'none';
        if (teamChooseNote) teamChooseNote.style.display = 'block';
    } else {
        // For manual song selection
        chooseSongOption.classList.add('selected');
        teamChooseOption.classList.remove('selected');
        if (songSelectionForm) songSelectionForm.style.display = 'block';
        if (teamChooseNote) teamChooseNote.style.display = 'none';
    }

    // Update form data and validate
    saveCurrentStep();

    // Update button state
    const nextButton = document.getElementById('next-to-checkout');
    if (nextButton) {
        nextButton.disabled = !(isTeamChoose || (songNameInput?.value.trim() && artistNameInput?.value.trim()));
    }
}

// Update order summary
function updateOrderSummary() {
    const summaryName = document.getElementById('summary-name');
    const summaryPhotoCount = document.getElementById('summary-photo-count');
    const summaryMusic = document.getElementById('summary-music');
    const summaryCurrency = document.getElementById('summary-currency');
    
    // Get currency symbol
    const currencySymbol = CURRENCIES[formData.currency || 'ILS']?.symbol || '₪';
    
    // Update memory name
    if (summaryName) {
        summaryName.textContent = formData.memoryName || '-';
    }

    // Update photo count
    const photoCount = formData.photos ? formData.photos.length : 0;
    if (summaryPhotoCount) {
        summaryPhotoCount.textContent = `${photoCount} ${photoCount === 1 ? 'photo' : 'photos'}`;
    }

    // Update music selection
    if (summaryMusic) {
        if (formData.music && formData.music.songName && formData.music.artistName) {
            summaryMusic.textContent = `${formData.music.songName} by ${formData.music.artistName}`;
        } else if (formData.music && formData.music.teamChoose) {
            summaryMusic.textContent = 'Our team will choose the perfect song';
        } else {
            summaryMusic.textContent = 'No music selected';
        }
    }
    
    // Update currency display
    if (summaryCurrency) {
        const currencyName = CURRENCIES[formData.currency || 'ILS']?.name || 'Israeli Shekel';
        summaryCurrency.textContent = `${formData.currency || 'ILS'} (${currencyName})`;
    }

    // Update the order total price with currency symbol
    const orderTotalElement = document.getElementById('order-total-price');
    if (orderTotalElement && formData.pricing) {
        orderTotalElement.textContent = `${currencySymbol}${formData.pricing.totalPrice?.toFixed(2) || '0.00'}`;
    }
}

// Complete purchase
function completePurchase() {
    // Show loading state
    const completeBtn = document.getElementById('complete-purchase');
    const originalBtnText = completeBtn ? completeBtn.innerHTML : '';
    
    // Get the current currency information
    const currency = formData.currency || 'ILS';
    const currencySymbol = CURRENCIES[currency]?.symbol || '₪';

    if (completeBtn) {
        completeBtn.disabled = true;
        completeBtn.innerHTML = '<i class="fas fa-spinner fa-spin"></i> Processing...';
    }

    // Process the payment (in a real implementation, this would be an API call to your payment processor)
    const isPaymentSuccessful = true; // Assume success in production
    const orderId = 'LP-' + new Date().getTime(); // Use timestamp for order ID

    // Save order data to localStorage for the thank you page
    const orderData = {
        orderId: orderId,
        date: new Date().toISOString(),
        email: formData.customer?.email || '',
        memoryName: formData.memoryName || 'My Memory',
        photoCount: formData.photos?.length || 0,
        items: formData.photos || [],
        total: formData.pricing?.totalPrice || 0,
        currency: currency,
        currencySymbol: currencySymbol,
        pricing: {
            tier: formData.pricing?.currentTier || '1-5',
            pricePerPhoto: formData.pricing?.pricePerPhoto || 0,
            totalPrice: formData.pricing?.totalPrice || 0
        },
        customer: formData.customer || {}
    };

    localStorage.setItem('livingPictureOrder', JSON.stringify(orderData));

    // Process payment immediately
    if (isPaymentSuccessful) {
            // Payment successful - redirect to thanks.html
            window.location.href = 'thanks.html?order=' + orderId;
            // Clear the form data after successful purchase
            clearFormData();
        } else {
            // Payment failed - redirect to payment-failed.html
            window.location.href = 'payment-failed.html';

            // Restore button state if still on the same page
            if (completeBtn) {
                completeBtn.disabled = false;
                completeBtn.innerHTML = originalBtnText;
            }
        }
}

// Handle payment retry from payment-failed.html
function retryPayment() {
    // This function can be called from the payment-failed page
    // to return to the checkout step
    if (window.location.pathname.includes('payment-failed.html')) {
        window.location.href = 'store.html#checkout';
    }
}

// Show success modal
function showSuccessModal() {
    if (successModal) {
        successModal.classList.add('active');
    }
}

// Save current step data
function saveCurrentStep() {
    // Set validation attempted flag to true when trying to proceed
    if (currentStep === 4) {
        validationAttempted = true;
    }
    
    switch (currentStep) {
        case 1: {
            const memoryName = memoryNameInput ? memoryNameInput.value.trim() : '';
            formData.memoryName = memoryName;

            // Validate memory name
            if (!memoryName) {
                // Show error message and highlight the input
                if (memoryNameInput) {
                    const formGroup = memoryNameInput.closest('.form-group');
                    if (formGroup) {
                        formGroup.classList.add('error');
                        memoryNameInput.classList.add('error');

                        // Create or update error message
                        let errorElement = document.getElementById('memory-name-error');
                        if (!errorElement) {
                            errorElement = document.createElement('div');
                            errorElement.id = 'memory-name-error';
                            errorElement.className = 'error-message';
                            // Insert after the form group
                            formGroup.parentNode.insertBefore(errorElement, formGroup.nextSibling);
                        }
                        errorElement.textContent = 'Please enter a name for your memory';
                        errorElement.style.display = 'block';
                    }
                }
                return false;
            } else {
                // Remove error state if it exists
                if (memoryNameInput) {
                    const formGroup = memoryNameInput.closest('.form-group');
                    if (formGroup) {
                        formGroup.classList.remove('error');
                        memoryNameInput.classList.remove('error');
                        const errorElement = document.getElementById('memory-name-error');
                        if (errorElement) {
                            errorElement.remove();
                        }
                    }
                }
            }
            break;
        }
        case 3: {
            // Save music selection
            if (selectSongRadio && selectSongRadio.checked) {
                const songName = songNameInput ? songNameInput.value.trim() : '';
                const artistName = artistNameInput ? artistNameInput.value.trim() : '';

                // Validate the fields
                if (!songName || !artistName) {
                    validateMusicInputs();
                    return false;
                }

                formData.music = {
                    songName: songName,
                    artistName: artistName,
                    custom: true,
                    teamChoose: false
                };
            } else if (teamChooseRadio && teamChooseRadio.checked) {
                // Clear any existing errors when team choose is selected
                clearMusicInputErrors();

                formData.music = {
                    songName: '',
                    artistName: '',
                    custom: false,
                    teamChoose: true
                };

                // Enable the next button when team choose is selected
                updateNextButton('next-to-checkout', true);
            } else {
                // If neither is selected (shouldn't happen with UI controls)
                showError('Please select a music option');
                return false;
            }
            break;
        }
        case 4: {
            // Validate customer details
            return validateCustomerDetails();
        }
    }

    saveToLocalStorage();
    return true;
}

// Save to local storage
function saveToLocalStorage() {
    formData.savedAt = new Date().toISOString();

    // Create a copy of formData without the actual file data to save space
    const dataToStore = {
        memoryName: formData.memoryName,
        photos: formData.photos.map(photo => ({
            id: photo.id,
            name: photo.name,
            size: photo.size,
            type: photo.file?.type || ''
        })),
        music: formData.music,
        customer: formData.customer,
        pricing: formData.pricing,
        currency: formData.currency || 'ILS',  // Ensure currency is saved
        savedAt: formData.savedAt
    };

    try {
        localStorage.setItem('memoryCreatorData', JSON.stringify(dataToStore));
    } catch (e) {
        console.warn('Could not save to local storage:', e);
        // If we can't save, at least try to clear old data and save the most important info
        if (e.name === 'QuotaExceededError') {
            const minimalData = {
                memoryName: formData.memoryName,
                photoCount: formData.photos.length,
                music: formData.music,
                customer: formData.customer,
                pricing: {
                    tier: formData.pricing?.currentTier || '1-5',
                    pricePerPhoto: formData.pricing?.pricePerPhoto || 20,
                    totalPrice: formData.pricing?.totalPrice || 0,
                    currency: formData.currency || 'ILS',
                    currencySymbol: CURRENCIES[formData.currency || 'ILS']?.symbol || '₪'
                },
                timestamp: new Date().toISOString()
            };
            localStorage.setItem('memoryCreationData', JSON.stringify(minimalData));
        }
    }
}

// Load saved data
function loadSavedData() {
    try {
        const savedData = localStorage.getItem('memoryCreatorData');
        if (!savedData) return;

        const parsedData = JSON.parse(savedData);

        // Only load data that's less than 24 hours old
        const savedAt = new Date(parsedData.savedAt);
        const now = new Date();
        const hoursDiff = Math.abs(now - savedAt) / 36e5;

        if (hoursDiff < 24) {
            // Only restore non-photo data directly
            formData.memoryName = parsedData.memoryName || '';
            formData.music = parsedData.music || null;
            formData.customer = parsedData.customer || null;
            formData.pricing = parsedData.pricing || null;
            formData.currency = parsedData.currency || 'ILS';  // Load saved currency or default to ILS
            formData.savedAt = parsedData.savedAt;
            
            // Update the current currency variable
            if (parsedData.currency && CURRENCIES[parsedData.currency]) {
                currentCurrency = parsedData.currency;
            }

            // Restore pricing data or initialize with default
            if (parsedData.pricing) {
                formData.pricing = parsedData.pricing;
            } else {
                formData.pricing = {
                    currentTier: PRICING_TIERS[0],
                    totalPrice: 0
                };
            }

            // Update form fields
            if (memoryNameInput && formData.memoryName) {
                memoryNameInput.value = formData.memoryName;
                updateNextButton('next-to-photos', true);
            }

            // If we have photo metadata but no actual photo data (from a previous session)
            if (parsedData.photos && parsedData.photos.length > 0) {
                // Update pricing display with the loaded photo count
                updatePricingDisplay();
                updateNextButton('next-to-music', true);
            }

            if (formData.music) {
                updateNextButton('next-to-checkout', true);
            }

            if (formData.customer) {
                const { name, email, country, phone } = formData.customer;
                const nameInput = document.getElementById('customer-name');
                const emailInput = document.getElementById('customer-email');
                const countrySelect = document.getElementById('customer-country');
                const phoneInput = document.getElementById('customer-phone');

                if (nameInput && name) nameInput.value = name;
                if (emailInput && email) emailInput.value = email;
                if (countrySelect && country) countrySelect.value = country;
                if (phoneInput && phone) phoneInput.value = phone;
            }
        } else {
            // Clear old data
            clearFormData();
        }
    } catch (e) {
        console.error('Error loading saved data:', e);
        clearFormData();
    }
}

// Clear form data
function clearFormData() {
    // Revoke all object URLs before clearing the photos array
    if (formData.photos && Array.isArray(formData.photos)) {
        formData.photos.forEach(photo => {
            if (photo.previewUrl) {
                URL.revokeObjectURL(photo.previewUrl);
            }
        });
    }

    // Clear the form data object
    formData.memoryName = '';
    formData.photos = [];
    formData.music = {
        songName: '',
        artistName: '',
        custom: true,
        teamChoose: false
    };
    formData.customer = {
        name: '',
        email: '',
        country: '',
        phone: ''
    };
    formData.pricing = {
        currentTier: PRICING_TIERS[0],
        totalPrice: 0
    };
    formData.savedAt = null;

    // Update pricing display
    updatePricingDisplay();

    // Clear local storage
    localStorage.removeItem('memoryCreatorData');

    // Reset form fields
    if (memoryNameInput) {
        memoryNameInput.value = '';
    }

    if (songNameInput && artistNameInput) {
        songNameInput.value = '';
        artistNameInput.value = '';
    }

    // Reset UI
    if (photoGrid) {
        photoGrid.innerHTML = '';
    }

    // Reset buttons
    updateNextButton('next-to-photos', false);
    updateNextButton('next-to-music', false);
    updateNextButton('next-to-checkout', false);
}

// Drag and drop helpers
function preventDefaults(e) {
    e.preventDefault();
    e.stopPropagation();
}

function highlight() {
    dropZone.classList.add('active');
}

function unhighlight() {
    dropZone.classList.remove('active');
}

function handleDrop(e) {
    const dt = e.dataTransfer;
    const files = dt.files;

    if (files.length > 0) {
        handleFileSelect({ dataTransfer: { files } });
    }
}

// Save progress and redirect to home page
function saveAndContinueLater() {
    // Save current progress
    saveCurrentStep();
    saveToLocalStorage();

    // Show success message
    showSuccessModal();

    // Redirect to home page after a short delay
    setTimeout(() => {
        window.location.href = 'index.html';
    }, 2000);
}

// Track if validation has been attempted
let validationAttempted = false;

// Validate customer details
function validateCustomerDetails() {
    // Only show errors if validation has been attempted
    if (!validationAttempted) {
        // Just validate without showing errors on initial load
        const nameInput = document.getElementById('customer-name');
        const emailInput = document.getElementById('customer-email');
        const countrySelect = document.getElementById('customer-country');
        const phoneInput = document.getElementById('customer-phone');
        
        // Save values if they exist
        if (nameInput) formData.customer.name = nameInput.value.trim();
        if (emailInput) formData.customer.email = emailInput.value.trim();
        if (countrySelect) formData.customer.country = countrySelect.value;
        if (phoneInput) formData.customer.phone = phoneInput.value.trim();
        
        return true;
    }
    
    // Get form elements
    const nameInput = document.getElementById('customer-name');
    const emailInput = document.getElementById('customer-email');
    const countrySelect = document.getElementById('customer-country');
    const phoneInput = document.getElementById('customer-phone');
    
    // Reset error states
    document.querySelectorAll('.form-group').forEach(group => {
        group.classList.remove('error');
        const errorEl = group.querySelector('.error-message');
        if (errorEl) errorEl.textContent = '';
    });
    
    let isValid = true;
    
    // Validate name
    if (!nameInput.value.trim()) {
        showFieldError('name-error', 'Please enter your full name');
        nameInput.closest('.form-group').classList.add('error');
        isValid = false;
    } else {
        formData.customer.name = nameInput.value.trim();
    }
    
    // Validate email
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailInput.value.trim()) {
        showFieldError('email-error', 'Please enter your email address');
        emailInput.closest('.form-group').classList.add('error');
        isValid = false;
    } else if (!emailRegex.test(emailInput.value.trim())) {
        showFieldError('email-error', 'Please enter a valid email address');
        emailInput.closest('.form-group').classList.add('error');
        isValid = false;
    } else {
        formData.customer.email = emailInput.value.trim();
    }
    
    // Validate country
    if (!countrySelect.value) {
        showFieldError('country-error', 'Please select your country');
        countrySelect.closest('.form-group').classList.add('error');
        isValid = false;
    } else {
        formData.customer.country = countrySelect.value;
    }
    
    // Save phone number if provided
    formData.customer.phone = phoneInput.value.trim();
    
    return isValid;
}

// Show error message for a specific field
function showFieldError(fieldId, message) {
    const errorElement = document.getElementById(fieldId);
    if (errorElement) {
        errorElement.textContent = message;
    }
}

// Complete purchase
async function completePurchase() {
    // Set validation attempted flag to true
    validationAttempted = true;
    
    // First validate customer details
    if (!validateCustomerDetails()) {
        // Scroll to the first error
        const firstError = document.querySelector('.form-group.error');
        if (firstError) {
            firstError.scrollIntoView({ behavior: 'smooth', block: 'center' });
        }
        return;
    }

    const completeBtn = document.getElementById('complete-purchase');
    const originalBtnText = completeBtn ? completeBtn.innerHTML : '';
    
    try {
        // Show loading state
        if (completeBtn) {
            completeBtn.disabled = true;
            completeBtn.innerHTML = '<i class="fas fa-spinner fa-spin"></i> Processing...';
        }

        // Get the current currency information
        const currency = formData.currency || 'ILS';
        const currencySymbol = CURRENCIES[currency]?.symbol || '₪';

        // Ensure all photos have permanent URLs before proceeding
        const photosWithPermanentUrls = formData.photos?.filter(photo => photo.permanentUrl) || [];
        
        if (photosWithPermanentUrls.length === 0 && (formData.photos?.length || 0) > 0) {
            throw new Error('Some photos are still being processed. Please wait and try again.');
        }
        
        // Recalculate total price to ensure it's up to date
        const photoCount = photosWithPermanentUrls.length;
        const tier = calculatePricingTier(photoCount);
        const pricePerPhoto = getPricePerPhoto(tier, currency);
        const calculatedTotalPrice = photoCount * pricePerPhoto;
        
        // Update formData with recalculated pricing
        formData.pricing = {
            currentTier: tier,
            pricePerPhoto: pricePerPhoto,
            totalPrice: calculatedTotalPrice,
            currency: currency
        };
        
        // Prepare order data for payment
        const orderData = {
            leadId: window.leadTracker?.leadId || `lead_${Date.now()}`,
            customerEmail: formData.customer?.email || '',
            customerName: formData.customer?.name || '',
            customerPhone: formData.customer?.phone || '',
            country: formData.customer?.country || '',
            memoryTitle: formData.memoryName || 'My Memory',
            songChoice: formData.music?.songName ? 
                `${formData.music.songName} by ${formData.music.artistName || 'Unknown Artist'}` : '',
            photoCount: photoCount,
            packageKey: tier,
            totalAmount: calculatedTotalPrice,
            currency: currency,
            imageUrls: photosWithPermanentUrls.map(photo => photo.permanentUrl),
            paymentProvider: 'payplus',
            step: 'CHECKOUT',
            status: 'PENDING_PAYMENT',
            successUrl: `${window.location.origin}/thanks.html`,
            cancelUrl: `${window.location.origin}/checkout.html`,
            callbackUrl: `${window.location.origin}/.netlify/functions/payplus-callback`
        };
        
        // Verify the calculated total matches the expected total
        if (Math.abs(calculatedTotalPrice - (formData.pricing?.totalPrice || 0)) > 0.01) {
            console.warn(`Price mismatch: calculated ${calculatedTotalPrice} vs stored ${formData.pricing?.totalPrice}`);
            // Use the calculated price as it's more reliable
            formData.pricing.totalPrice = calculatedTotalPrice;
        }

        // Log the order data before making the payment request
        console.log('Attempting to create order and process payment...', {
            url: '/.netlify/functions/payplus-create-payment',
            method: 'POST',
            payload: {
                ...orderData,
                imageUrls: orderData.imageUrls.slice(0, 2).concat(['...']) // Show first 2 URLs for logging
            }
        });

        try {
            // Update lead status to PENDING_PAYMENT
            await window.leadTracker?.updateLead({
                ...orderData,
                step: 'CHECKOUT',
                status: 'PENDING_PAYMENT',
                paymentstatus: 'PENDING'
            }, true);

            // Call the PayPlus create payment function to get payment URL
            const paymentEndpoint = '/.netlify/functions/payplus-create-payment';
            console.log('Sending payment request to:', paymentEndpoint);
            
            const response = await fetch(paymentEndpoint, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                },
                body: JSON.stringify({
                    ...orderData,
                    // Ensure imageUrls is an array of strings
                    imageUrls: Array.isArray(orderData.imageUrls) ? orderData.imageUrls : []
                })
            });

            console.log('Payment request completed with status:', response.status);
            
            const result = await response.json().catch(e => ({
                error: 'Failed to parse response',
                details: e.message
            }));

            console.log('Payment API response:', {
                status: response.status,
                ok: response.ok,
                result: result
            });

            if (!response.ok) {
                const errorMessage = result.message || 'Failed to process payment';
                console.error('Payment processing failed:', {
                    status: response.status,
                    error: errorMessage,
                    details: result.details || 'No additional details'
                });
                throw new Error(errorMessage);
            }

            // Log successful payment creation
            console.log('Payment created successfully, redirecting to:', result.payment_url);

            // Redirect to PayPlus payment page
            if (result.payment_url) {
                window.location.href = result.payment_url;
            } else {
                const errorMsg = 'No payment URL received from server';
                console.error(errorMsg, { response: result });
                throw new Error(errorMsg);
            }

            // Save order data to localStorage for the thank you page
            const orderDisplayData = {
                orderId: result.orderId || `TEMP-${Date.now()}`,
                date: new Date().toISOString(),
                email: orderData.customerEmail,
                memoryName: orderData.memoryTitle,
                photoCount: orderData.photoCount,
                total: orderData.totalAmount,
                currency: orderData.currency,
                currencySymbol: currencySymbol,
                status: 'PENDING_PAYMENT'
            };

            localStorage.setItem('livingPictureOrder', JSON.stringify(orderDisplayData));
            
        } catch (error) {
            // Enhanced error logging
            console.error('Error processing payment:', {
                error: error.message,
                stack: error.stack,
                orderData: {
                    ...orderData,
                    imageUrls: orderData.imageUrls ? `[${orderData.imageUrls.length} URLs]` : 'none'
                }
            });
            
            // User-friendly error message
            const errorMessage = error.message.includes('network') 
                ? 'Network error. Please check your connection and try again.'
                : `Payment processing failed: ${error.message}. Please try again or contact support.`;
                
            showError(errorMessage);
            
            // Update lead status to PAYMENT_FAILED
            try {
                console.log('Attempting to update lead status to PAYMENT_FAILED');
                await syncLeadToAirtable();
                console.log('Successfully updated lead status to PAYMENT_FAILED');
            } catch (syncError) {
                console.error('Failed to update lead status after payment failure:', {
                    error: syncError.message,
                    stack: syncError.stack
                });
            }
            
            // Show error message
            showError(error.message || 'Failed to initialize payment. Please try again.');
            
            // Re-enable the complete button
            if (completeBtn) {
                completeBtn.disabled = false;
                completeBtn.innerHTML = originalBtnText;
            }
        }
    } catch (error) {
        console.error('Payment processing error:', error);
        showError('An error occurred while processing your payment. Please try again.');
        
        // Re-enable the complete button
        if (completeBtn) {
            completeBtn.disabled = false;
            completeBtn.innerHTML = originalBtnText;
        }
    }
}

// Add lead-tracking script
const leadTrackingScript = document.createElement('script');
leadTrackingScript.src = 'js/lead-tracking.js';
document.head.appendChild(leadTrackingScript);

// Initialize the store when the DOM is loaded
document.addEventListener('DOMContentLoaded', () => {
    // Make sure all required elements exist
    const fileInput = document.getElementById('photo-upload');
    const browseBtn = document.getElementById('browse-files');
    
    // Initialize the store
    initStore();
    
    // Add event listeners for Continue Later buttons
    const saveLaterBtns = [
        document.getElementById('save-later-photos'),
        document.getElementById('save-later-music'),
        document.getElementById('save-later-checkout')
    ];
    
    saveLaterBtns.forEach(btn => {
        if (btn) {
            btn.addEventListener('click', saveAndContinueLater);
        }
    });
    
    // Add input event listeners to customer detail fields to clear errors when typing
    const customerFields = {
        'customer-name': 'name-error',
        'customer-email': 'email-error',
        'customer-country': 'country-error',
        'customer-phone': '' // No error for optional field
    };
    
    Object.keys(customerFields).forEach(fieldId => {
        const field = document.getElementById(fieldId);
        if (field) {
            field.addEventListener('input', () => {
                const errorId = customerFields[fieldId];
                if (errorId) {
                    const errorElement = document.getElementById(errorId);
                    if (errorElement) {
                        errorElement.textContent = '';
                    }
                }
                const formGroup = field.closest('.form-group');
                if (formGroup) {
                    formGroup.classList.remove('error');
                }
            });
        }
    });
    
    // Remove any existing event listeners to prevent duplicates
    if (fileInput) {
        const newFileInput = fileInput.cloneNode(true);
        fileInput.parentNode.replaceChild(newFileInput, fileInput);
        
        // Add new event listener
        newFileInput.addEventListener('change', handleFileSelect);
        
        // Ensure browse button is properly connected to the new input
        if (browseBtn) {
            browseBtn.addEventListener('click', (e) => {
                e.preventDefault();
                newFileInput.click();
            });
        }
    }
});
