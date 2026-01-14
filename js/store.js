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
    // Next step buttons
    Object.keys(nextButtons).forEach(buttonId => {
        const button = document.getElementById(buttonId);
        if (button) {
            button.addEventListener('click', (e) => {
                e.preventDefault();
                
                // Check if the button is enabled using our custom data attribute
                if (button.classList.contains('btn-disabled')) {
                    // If the button is visually disabled, run validation to show appropriate error
                    if (currentStep === 1) {
                        saveCurrentStep();
                    } else if (currentStep === 2) {
                        validatePhotoUpload();
                    } else if (currentStep === 3) {
                        validateMusicInputs();
                    }
                    return; // Don't proceed
                }
                
                const nextStep = nextButtons[buttonId];
                
                // Save current step data and validate if needed
                if (currentStep === 1) { // Memory name step
                    if (!saveCurrentStep()) {
                        return; // Don't proceed if validation fails
                    }
                } else if (currentStep === 2) { // Photo upload step
                    if (!validatePhotoUpload()) {
                        return; // Don't proceed if validation fails
                    }
                    saveCurrentStep();
                } else if (currentStep === 3) { // Music step
                    if (!validateMusicInputs() || !saveCurrentStep()) {
                        return; // Don't proceed if validation fails
                    }
                } else {
                    saveCurrentStep();
                }
                
                if (nextStep === 'complete') {
                    completePurchase();
                } else {
                    showStep(nextStep);
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

// Show a specific step
function showStep(stepNumber) {
    let canProceed = true;
    
    // If trying to move to step 2, validate step 1 first
    if (stepNumber === 2 && currentStep === 1) {
        if (!saveCurrentStep()) {
            // If validation fails, don't proceed to next step
            canProceed = false;
        }
    }
    
    // If trying to move to step 3, validate step 2 (photo upload)
    if (stepNumber === 3 && currentStep === 2) {
        if (!validatePhotoUpload()) {
            // If validation fails, don't proceed to next step
            canProceed = false;
        }
    }
    
    // Only proceed with step change if validation passed
    if (canProceed) {
        // Hide all steps
        document.querySelectorAll('.store-step').forEach(step => {
            step.classList.remove('active');
        });
        
        // Show the selected step
        const stepElement = document.getElementById(`step-${stepNumber}`);
        if (stepElement) {
            stepElement.classList.add('active');
        }
        
        // Update active state in progress steps
        document.querySelectorAll('.step').forEach(step => {
            if (parseInt(step.getAttribute('data-step')) === stepNumber) {
                step.classList.add('active');
            } else {
                step.classList.remove('active');
            }
        });
        
        // Update progress bars
        const progress = (stepNumber / 4) * 100;
        
        // Update desktop progress bar
        const desktopProgress = document.querySelector('.progress');
        if (desktopProgress) {
            desktopProgress.style.width = `${progress}%`;
        }
        
        // Update mobile progress bar
        const mobileProgressBar = document.getElementById('mobile-progress-bar');
        if (mobileProgressBar) {
            mobileProgressBar.style.width = `${progress}%`;
        }
        
        // Update mobile step indicator
        const currentStepElement = document.getElementById('current-step');
        if (currentStepElement) {
            currentStepElement.textContent = stepNumber;
        }
        
        // Scroll to top of the step
        window.scrollTo({
            top: 0,
            behavior: 'smooth'
        });
        
        // Validate the current step
        validateCurrentStep(stepNumber);
        
        // Update current step
        currentStep = stepNumber;
        
        // Update UI based on the current step
        updateUIForStep(stepNumber);
        
        return true;
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
function validateCurrentStep(stepNumber) {
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
}

// Update the next button state
function updateNextButton(buttonId, isEnabled) {
    const button = document.getElementById(buttonId);
    if (button) {
        // Always enable the button to allow click events
        button.disabled = false;

        // Store the enabled state as a data attribute for validation
        button.dataset.enabled = isEnabled;

        // Add/remove a class for visual feedback
        if (!isEnabled) {
            button.classList.add('btn-disabled');
        } else {
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

// Process selected files
async function processFiles(files) {
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
        progressText.textContent = `Processing ${processed} of ${total} photos...`;
    };

    // Start loading
    setLoading(true);
    updateProgress(0, files.length);

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
        if (!pendingUIUpdate) {
            pendingUIUpdate = true;
            requestAnimationFrame(() => {
                renderPhotoGrid();
                updatePricingDisplay();
                updatePhotoCounter();
                pendingUIUpdate = false;
                lastUpdateTime = performance.now();
            });
        }
    };

    // Process files with optimized concurrency control
    const processFilesOptimized = async (filesToProcess) => {
        const results = [];
        const processing = new Set();
        const newPhotos = [];
        let processed = 0;

        // Process files with controlled concurrency
        const processFile = async (file) => {
            // Check file type first (fast check before hashing)
            if (!file.type.startsWith('image/')) {
                console.log('Skipping non-image file:', file.name);
                return { success: false, file, error: 'Not an image' };
            }

            // Generate file fingerprint (quick hash based on name, size, and last modified)
            const fileFingerprint = `${file.name}-${file.size}-${file.lastModified}`;

            // Check for duplicates
            if (existingHashes.has(fileFingerprint)) {
                duplicateCount++;
                return { success: false, file, error: 'Duplicate file' };
            }

            // Mark as processed
            existingHashes.add(fileFingerprint);

            // Create object URL (this is the most expensive part)
            const objectUrl = URL.createObjectURL(file);

            // Create photo object
            const photo = {
                id: Date.now() + '-' + Math.random().toString(36).substr(2, 9),
                previewUrl: objectUrl,
                file: file,
                name: file.name,
                size: file.size,
                fileFingerprint: fileFingerprint
            };

            // Add to results
            return { success: true, file, photo };
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
async function completePurchase() {
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

    try {
        // Generate order ID using crypto.randomUUID if available, or fallback to timestamp
        const orderId = typeof crypto !== 'undefined' && crypto.randomUUID 
            ? `LP-${crypto.randomUUID()}` 
            : `LP-${Date.now()}-${Math.floor(Math.random()*1e6)}`;

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

        // Call Netlify function to create PayPlus payment
        const functionUrl = window.location.hostname === 'localhost' || window.location.protocol === 'file:'
            ? 'https://livingpicture.netlify.app/.netlify/functions/payplus-create-payment'
            : '/.netlify/functions/payplus-create-payment';
            
        const response = await fetch(functionUrl, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
            },
            body: JSON.stringify({
                amount: formData.pricing?.totalPrice || 0,
                currency: currency,
                leadId: window.leadTracker?.leadId || `lead_${Date.now()}`,
                orderId: orderId
            })
        });

        const result = await response.json();

        if (result.ok && result.paymentUrl) {
            // Redirect to PayPlus payment page
            window.location.href = result.paymentUrl;
        } else {
            throw new Error(result.error || 'Failed to create payment');
        }
    } catch (error) {
        console.error('Payment error:', error);
        
        // Show error to user
        if (typeof showError === 'function') {
            showError('Payment processing failed. Please try again.');
        } else {
            alert('Payment processing failed. Please try again.');
        }

        // Restore button state
        if (completeBtn) {
            completeBtn.disabled = false;
            completeBtn.innerHTML = originalBtnText;
        }

        // Optionally redirect to payment failed page
        // window.location.href = 'payment-failed.html';
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

// Complete purchase is implemented above with PayPlus integration

// Initialize the store when the DOM is loaded
document.addEventListener('DOMContentLoaded', () => {
    // Make sure all required elements exist
    const fileInput = document.getElementById('photo-upload');
    const browseBtn = document.getElementById('browse-files');
    const completePurchaseBtn = document.getElementById('complete-purchase');
    
    // Initialize the store
    initStore();
    
    // Add direct event listener for Complete Purchase button
    if (completePurchaseBtn) {
        completePurchaseBtn.addEventListener('click', async (e) => {
            e.preventDefault();
            
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
            
            // Save current step data
            saveCurrentStep();
            
            // Proceed with payment
            await completePurchase();
        });
    }
    
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