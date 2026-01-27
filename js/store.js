const PRICING_TIERS = [
    { photos: '1-5', price: 20 },
    { photos: '6-10', price: 18 },
    { photos: '11-20', price: 15 },
    { photos: '21+', price: 12 },
];
let currentCurrency = 'ILS';

let isUploading = false;

// Store the current step and form data
let currentStep = 1;
const formData = {
    leadId: null,
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

    // Always bind this visit to the current (fresh) leadId
    if (window.leadTracker && window.leadTracker.leadId) {
        formData.leadId = window.leadTracker.leadId;
    }
    
    // Set up event listeners
    setupEventListeners();
    
    // Initialize the first step
    showStep(1);
    
    // Render music options
    renderMusicOptions();
}

function handleCurrencyUpdate(newCurrency) {
    currentCurrency = newCurrency;
    formData.currency = newCurrency;
    updateAllPrices();
    document.querySelectorAll('.currency-dropdown').forEach(select => {
        select.value = newCurrency;
    });
}

document.addEventListener('currencyLoaded', (e) => {
    handleCurrencyUpdate(e.detail.currency);
});

document.addEventListener('currencyChanged', (e) => {
    if (e.target.classList.contains('currency-dropdown')) {
        handleCurrencyUpdate(e.detail.currency);
    }
});

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
                if (buttonId === 'next-to-photos') {
                    console.log('Button clicked');
                }
                const nextStep = nextButtons[buttonId];
                
                // Save current step data and validate
                if (!saveCurrentStep()) {
                    return; // Don't proceed if validation fails
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
                if (window.leadTracker) {
                    window.leadTracker.updateLead({ songChoice: `${formData.music.songName} by ${formData.music.artistName}`, step: 'SONG_SELECTED' });
                }
                
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
            if (window.leadTracker) {
                window.leadTracker.updateLead({ memoryTitle: e.target.value, step: 'STORE_VIEW' });
            } else {
                console.warn('leadTracker not available yet.');
            }
        });

        const commitMemoryTitle = async (e) => {
            if (!window.leadTracker) return;
            const value = (e?.target?.value || '').trim();
            if (!value) return;
            try {
                await window.leadTracker.updateLead({ memoryTitle: value, step: 'STORE_VIEW' }, true);
            } catch (err) {
                console.warn('Failed to commit memoryTitle to lead tracker:', err);
            }
        };

        memoryNameInput.addEventListener('blur', commitMemoryTitle);
        memoryNameInput.addEventListener('change', commitMemoryTitle);
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
    selectSongRadio.addEventListener('change', () => {
        updateMusicSelectionUI();
        if (window.leadTracker) {
            window.leadTracker.updateLead({ songChoice: 'choose-song', step: 'SONG_SELECTED' });
        }
    });
    teamChooseRadio.addEventListener('change', () => {
        updateMusicSelectionUI();
        if (window.leadTracker) {
            window.leadTracker.updateLead({ songChoice: 'team-choose', step: 'SONG_SELECTED' });
        }
    });
    
    // Music input validation
    songNameInput.addEventListener('input', validateMusicInputs);
    artistNameInput.addEventListener('input', validateMusicInputs);
}

// Save data to local storage
function saveToLocalStorage() {
    try {
        localStorage.setItem('formData', JSON.stringify(formData));
    } catch (e) {
        console.error('Could not save to local storage:', e);
    }
}

function showError(message) {
    const errorElement = document.getElementById('photo-upload-error');
    if (errorElement) {
        const errorText = errorElement.querySelector('.error-text') || errorElement.querySelector('span');
        if (errorText) {
            errorText.textContent = message;
        }
        errorElement.style.display = 'flex';
        errorElement.classList.remove('shake');
        void errorElement.offsetWidth;
        errorElement.classList.add('shake');
    }
    console.error(message);
}

function showSuccess(message) {
    console.log(message);
}

function clearPhotoUploadError() {
    const errorElement = document.getElementById('photo-upload-error');
    if (errorElement) {
        errorElement.style.display = 'none';
        errorElement.classList.remove('shake');
    }
}

function showInputError(inputEl, message) {
    if (!inputEl) return;
    const group = inputEl.closest('.form-group');
    if (group) {
        group.classList.add('error');
        const errorEl = group.querySelector('.error-message');
        if (errorEl) {
            errorEl.textContent = message;
        }
    }
}

function renderMusicOptions() {
    updateMusicSelectionUI();
}

function updateMusicSelectionUI() {
    const songForm = document.getElementById('song-selection-form');
    const teamNote = document.getElementById('team-choose-note');

    const isTeamChoose = !!(teamChooseRadio && teamChooseRadio.checked);
    if (formData.music) {
        formData.music.teamChoose = isTeamChoose;
        formData.music.custom = !isTeamChoose;
    }

    if (songForm) {
        songForm.style.display = isTeamChoose ? 'none' : 'block';
    }
    if (teamNote) {
        teamNote.style.display = isTeamChoose ? 'block' : 'none';
    }

    validateMusicInputs();
}

function validateMusicInputs() {
    if (!formData.music) {
        formData.music = { songName: '', artistName: '', custom: true, teamChoose: false };
    }

    const isTeamChoose = !!(teamChooseRadio && teamChooseRadio.checked);
    if (isTeamChoose) {
        updateNextButton('next-to-checkout', true);
        return true;
    }

    const song = (songNameInput?.value || '').trim();
    const artist = (artistNameInput?.value || '').trim();
    formData.music.songName = song;
    formData.music.artistName = artist;

    const hasValidInput = !!(song && artist);
    updateNextButton('next-to-checkout', hasValidInput);
    return hasValidInput;
}

function showStep(step) {
    currentStep = step;
    stepSections.forEach(section => section.classList.remove('active'));
    const activeSection = document.getElementById(`step-${step}`);
    if (activeSection) {
        activeSection.classList.add('active');
    }

    steps.forEach(s => s.classList.remove('active'));
    const activeStepIndicator = document.querySelector(`.step[data-step="${step}"]`);
    if (activeStepIndicator) {
        activeStepIndicator.classList.add('active');
    }

    const progress = document.querySelector('.progress');
    if (progress) {
        progress.style.width = `${(step / 4) * 100}%`;
    }

    const currentStepEl = document.getElementById('current-step');
    if (currentStepEl) {
        currentStepEl.textContent = String(step);
    }

    updateUIForStep(step);
}

function saveCurrentStep() {
    if (currentStep === 1) {
        formData.memoryName = (memoryNameInput?.value || '').trim();
        const ok = !!formData.memoryName;
        updateNextButton('next-to-photos', ok);
        saveToLocalStorage();
        return ok;
    }

    if (currentStep === 2) {
        const ok = validatePhotoUpload();
        saveToLocalStorage();
        return ok;
    }

    if (currentStep === 3) {
        const ok = validateMusicInputs();
        saveToLocalStorage();
        return ok;
    }

    if (currentStep === 4) {
        const ok = validateCustomerDetails();
        saveToLocalStorage();
        return ok;
    }

    return true;
}

// Validate photo upload
function validatePhotoUpload() {
    const dropZone = document.getElementById('drop-zone');
    const errorElement = document.getElementById('photo-upload-error');

    // Check if there are any photos
    const hasPhotos = formData.photos && formData.photos.length > 0;
    const anyUploading = hasPhotos && formData.photos.some(p => p.uploadStatus === 'uploading');
    const anyFailed = hasPhotos && formData.photos.some(p => p.uploadStatus === 'failed');
    const allPhotosUploaded = hasPhotos && formData.photos.every(p => p.uploadStatus === 'uploaded');

    if (!hasPhotos) {
        // Show error state
        if (dropZone) {
            dropZone.classList.add('error');
            // Force reflow to ensure the animation plays
            void dropZone.offsetWidth;
        }
        if (errorElement) {
            // Update error message text
            const errorText = errorElement.querySelector('.error-text') || errorElement.querySelector('span');
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

        updatePhotoContinueButtonState();

        return false;
    }

    if (anyUploading) {
        if (errorElement) {
            const errorText = errorElement.querySelector('.error-text') || errorElement.querySelector('span');
            if (errorText) {
                errorText.textContent = 'Please wait for all photos to finish uploading.';
            }
            errorElement.style.display = 'flex';
        }
        updatePhotoContinueButtonState();
        return false;
    }

    if (anyFailed || !allPhotosUploaded) {
        if (dropZone) {
            dropZone.classList.add('error');
            void dropZone.offsetWidth;
        }

        if (errorElement) {
            const errorText = errorElement.querySelector('.error-text') || errorElement.querySelector('span');
            if (errorText) {
                errorText.textContent = 'Some photos failed to upload. Please remove and re-add them (or check your connection) to continue.';
            }
            errorElement.style.display = 'flex';
        }
        updatePhotoContinueButtonState();
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

    updatePhotoContinueButtonState();
    return true;
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
            }
            updatePhotoContinueButtonState();
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

            if (window.leadTracker && typeof window.leadTracker.trackStep === 'function') {
                const songChoice = (formData.music && formData.music.teamChoose)
                    ? 'team-choose'
                    : (formData.music && formData.music.songName && formData.music.artistName)
                        ? `${formData.music.songName} by ${formData.music.artistName}`
                        : undefined;

                window.leadTracker.trackStep('SONG_SELECTED', songChoice ? { songChoice } : {});
            }
            break;
        
        case 4:
            // Update order summary
            updateOrderSummary();

            if (window.leadTracker && typeof window.leadTracker.trackStep === 'function') {
                window.leadTracker.trackStep('DETAILS_ENTERED');
            }
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
        button.disabled = !isEnabled;
        if (isEnabled) {
            button.classList.remove('btn-disabled');
        } else {
            button.classList.add('btn-disabled');
        }
    }
}

function updatePhotoContinueButtonState() {
    const btn = document.getElementById('next-to-music');
    if (!btn) return;

    if (isUploading) {
        btn.disabled = true;
        btn.classList.add('btn-disabled');
        btn.innerHTML = '<i class="fas fa-spinner fa-spin"></i> Uploading Photos...';
        return;
    }

    const allUploaded = formData.photos.length > 0 && formData.photos.every(p => p.uploadStatus === 'uploaded');
    btn.disabled = !allUploaded;
    if (allUploaded) {
        btn.classList.remove('btn-disabled');
    } else {
        btn.classList.add('btn-disabled');
    }
    btn.textContent = 'Continue';
}

function renderPhotoGrid() {
    if (!photoGrid) return;

    photoGrid.innerHTML = '';

    (formData.photos || []).forEach(photo => {
        const item = document.createElement('div');
        item.className = 'photo-item';
        item.dataset.photoId = photo.id;

        const img = document.createElement('img');
        img.className = 'photo-thumbnail';
        img.alt = photo.name || 'Uploaded photo';
        img.src = photo.previewUrl || photo.permanentUrl || '';

        const removeBtn = document.createElement('button');
        removeBtn.className = 'remove-photo';
        removeBtn.type = 'button';
        removeBtn.innerHTML = '<i class="fas fa-times"></i>';
        removeBtn.addEventListener('click', () => removePhotoById(photo.id));

        item.appendChild(img);

        if (photo.uploadStatus === 'uploading') {
            const overlay = document.createElement('div');
            overlay.className = 'thumbnail-overlay';
            overlay.innerHTML = '<div class="overlay-content"><i class="fas fa-spinner fa-spin"></i><span>Uploading...</span></div>';
            item.appendChild(overlay);
        }

        if (photo.uploadStatus === 'failed') {
            const overlay = document.createElement('div');
            overlay.className = 'thumbnail-overlay failed';
            overlay.innerHTML = `
                <div class="overlay-content">
                    <i class="fas fa-exclamation-circle"></i>
                    <span>Upload failed</span>
                    <div class="overlay-actions">
                        <button type="button" class="retry-upload">Retry</button>
                        <button type="button" class="remove-failed">Remove</button>
                    </div>
                </div>
            `;

            overlay.querySelector('.retry-upload')?.addEventListener('click', () => retryUploadById(photo.id));
            overlay.querySelector('.remove-failed')?.addEventListener('click', () => removePhotoById(photo.id));
            item.appendChild(overlay);
        }

        item.appendChild(removeBtn);
        photoGrid.appendChild(item);
    });
}

async function retryUploadById(photoId) {
    const photo = (formData.photos || []).find(p => p.id === photoId);
    if (!photo || !photo.file) return;

    isUploading = true;
    photo.uploadStatus = 'uploading';
    renderPhotoGrid();
    updatePhotoContinueButtonState();

    try {
        const uploadResult = await uploadToCloudinary(photo.file);
        photo.permanentUrl = uploadResult.secure_url;
        photo.publicId = uploadResult.public_id;
        photo.uploadStatus = 'uploaded';
    } catch (e) {
        console.error('Retry upload failed for', photo.name, e);
        photo.uploadStatus = 'failed';
        showError('Upload failed again. Please remove and re-add the photo (or check your connection).');
    } finally {
        isUploading = (formData.photos || []).some(p => p.uploadStatus === 'uploading');
        renderPhotoGrid();
        updatePhotoContinueButtonState();
        saveToLocalStorage();
    }
}

function removePhotoById(photoId) {
    const idx = (formData.photos || []).findIndex(p => p.id === photoId);
    if (idx === -1) return;
    const [removed] = formData.photos.splice(idx, 1);
    if (removed?.previewUrl) {
        try { URL.revokeObjectURL(removed.previewUrl); } catch (e) {}
    }
    isUploading = (formData.photos || []).some(p => p.uploadStatus === 'uploading');
    renderPhotoGrid();
    updatePhotoCounter();
    updatePricingDisplay();
    updatePhotoContinueButtonState();
    saveToLocalStorage();
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
document.addEventListener('DOMContentLoaded', async () => {
    // Ensure leadTracker is initialized before anything else
    if (window.leadTracker && typeof window.leadTracker.init === 'function') {
        await window.leadTracker.init();
    }

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

            if (window.leadTracker) {
                await window.leadTracker.updateLead({
                    customerName: formData.customer?.name,
                    customerEmail: formData.customer?.email,
                    country: formData.customer?.country,
                    currency: formData.currency,
                    totalAmount: formData.pricing?.totalPrice,
                    photoCount: formData.photos?.length || 0,
                    step: 'DETAILS_ENTERED'
                }, true);
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
        'customer-phone': ''
    };

    const commitDetailsToLead = async () => {
        if (!window.leadTracker) return;

        const nameInput = document.getElementById('customer-name');
        const emailInput = document.getElementById('customer-email');
        const countrySelect = document.getElementById('customer-country');
        const phoneInput = document.getElementById('customer-phone');

        formData.customer.name = nameInput ? nameInput.value.trim() : formData.customer.name;
        formData.customer.email = emailInput ? emailInput.value.trim() : formData.customer.email;
        formData.customer.country = countrySelect ? countrySelect.value : formData.customer.country;
        formData.customer.phone = phoneInput ? phoneInput.value.trim() : formData.customer.phone;

        try {
            await window.leadTracker.updateLead({
                customerName: formData.customer?.name,
                customerEmail: formData.customer?.email,
                country: formData.customer?.country,
                step: 'DETAILS_ENTERED'
            }, true);
        } catch (err) {
            console.warn('Failed to commit customer details to lead tracker:', err);
        }
    };
    
    Object.keys(customerFields).forEach(fieldId => {
        const field = document.getElementById(fieldId);
        if (!field) return;

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

        field.addEventListener('blur', commitDetailsToLead);
        field.addEventListener('change', commitDetailsToLead);
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