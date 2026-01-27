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

// Validate customer details
function validateCustomerDetails() {
    const name = document.getElementById('customer-name').value.trim();
    const email = document.getElementById('customer-email').value.trim();
    const country = document.getElementById('customer-country').value;
    let isValid = true;

    if (!name) {
        showInputError(document.getElementById('customer-name'), 'Name is required');
        isValid = false;
    }

    if (!email || !/\S+@\S+\.\S+/.test(email)) {
        showInputError(document.getElementById('customer-email'), 'A valid email is required');
        isValid = false;
    }

    if (!country) {
        showInputError(document.getElementById('customer-country'), 'Country is required');
        isValid = false;
    }

    return isValid;
}

// Complete the purchase
async function completePurchase() {
    if (!validateCustomerDetails()) {
        return;
    }

    // Update form data with customer details
    formData.customer.name = document.getElementById('customer-name').value.trim();
    formData.customer.email = document.getElementById('customer-email').value.trim();
    formData.customer.country = document.getElementById('customer-country').value;
    formData.customer.phone = document.getElementById('customer-phone').value.trim();

    // Here you would typically integrate with a payment gateway
    // For now, we'll just show a success message
    showSuccess('Your order has been received!');

    // Optionally, reset the form or redirect
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

        isUploading = true;
        updatePhotoContinueButtonState();

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

async function updatePricingDisplay() {
    const photoCount = formData.photos.length;
    const currency = currentCurrency;
    const currencySymbol = CURRENCIES.find(c => c.code === currency)?.symbol || '$';

    const getTier = (count) => {
        if (count >= 26) return '26+';
        if (count >= 16) return '16-25';
        if (count >= 6) return '6-15';
        return '1-5';
    };

    const tier = getTier(photoCount);
    const pricePerPhoto = PRICING[tier][currency];
    const total = photoCount * pricePerPhoto;

    // Update form data
    formData.pricing = {
        currentTier: tier,
        pricePerPhoto: pricePerPhoto,
        totalPrice: total,
        currency: currency
    };

    // Update UI
    const totalPriceElement = document.getElementById('total-price');
    const photoCountText = document.getElementById('photo-count-text');
    const priceDetails = document.getElementById('price-details');

    if (totalPriceElement) {
        totalPriceElement.textContent = `${currencySymbol}${total.toFixed(2)}`;
    }

    if (photoCountText) {
        photoCountText.textContent = `${photoCount} ${photoCount === 1 ? 'photo' : 'photos'}`;
    }

    if (priceDetails) {
        if (photoCount === 0) {
            priceDetails.textContent = 'Add photos to see your price per photo';
        } else {
            priceDetails.textContent = `${photoCount} ${photoCount === 1 ? 'photo' : 'photos'} • ${currencySymbol}${pricePerPhoto.toFixed(2)} each`;
        }
    }
}

// Generate a lightweight fingerprint for a file using metadata
function generateFileFingerprint(file) {
    // Use file name, size, and last modified time as a fingerprint
    return `${file.name}-${file.size}-${file.lastModified}`;
}

async function uploadToCloudinary(file) {
    const cloudName = window.CLOUDINARY_CLOUD_NAME || localStorage.getItem('CLOUDINARY_CLOUD_NAME');
    const uploadPreset = window.CLOUDINARY_UPLOAD_PRESET || localStorage.getItem('CLOUDINARY_UPLOAD_PRESET');

    if (!cloudName || !uploadPreset) {
        throw new Error('Cloudinary is not configured');
    }

    const formData = new FormData();
    formData.append('file', file);
    formData.append('upload_preset', uploadPreset);

    const response = await fetch(`https://api.cloudinary.com/v1_1/${cloudName}/image/upload`, {
        method: 'POST',
        body: formData
    });

    if (!response.ok) {
        let details = '';
        try {
            details = await response.text();
        } catch (e) {
            details = '';
        }
        throw new Error(`Cloudinary upload failed: ${response.status}${details ? ` | ${details}` : ''}`);
    }

    return response.json();
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

    // Process files with optimized concurrency control
    const processFilesOptimized = async (filesToProcess) => {
        const newPhotos = [];
        let processed = 0;

        const processFile = async (file) => {
            // Check file type first
            if (!file.type.startsWith('image/')) {
                console.log('Skipping non-image file:', file.name);
                return { success: false, file, error: 'Not an image' };
            }

            // Generate file fingerprint
            const fileFingerprint = `${file.name}-${file.size}-${file.lastModified}`;

            // Check for duplicates
            if (existingHashes.has(fileFingerprint)) {
                duplicateCount++;
                return { success: false, file, error: 'Duplicate file' };
            }

            // Mark as processed
            existingHashes.add(fileFingerprint);

            // Create object URL
            const objectUrl = URL.createObjectURL(file);

            // Create photo object and add immediately so the UI shows "Uploading..."
            const photo = {
                id: Date.now() + '-' + Math.random().toString(36).substr(2, 9),
                previewUrl: objectUrl,
                file: file,
                name: file.name,
                size: file.size,
                fileFingerprint: fileFingerprint,
                uploadStatus: 'uploading'
            };

            formData.photos.push(photo);
            newPhotos.push(photo);
            renderPhotoGrid();
            updatePhotoContinueButtonState();

            try {
                const uploadResult = await uploadToCloudinary(file);
                photo.permanentUrl = uploadResult.secure_url;
                photo.publicId = uploadResult.public_id;
                photo.uploadStatus = 'uploaded';
            } catch (e) {
                console.error('Cloudinary upload failed for', file.name, e);
                photo.uploadStatus = 'failed';
            }

            renderPhotoGrid();
            updatePhotoContinueButtonState();

            return { success: true, file, photo };
        };

        const processBatch = async (batch) => {
            const batchPromises = batch.map(file =>
                processFile(file).then(result => {
                    processed++;
                    if (processed % 2 === 0 || processed === filesToProcess.length) {
                        updateProgress(processed, filesToProcess.length);
                    }
                    return result;
                })
            );

            return Promise.all(batchPromises);
        };

        const batchSize = maxConcurrent;
        for (let i = 0; i < filesToProcess.length; i += batchSize) {
            const batch = filesToProcess.slice(i, i + batchSize);
            await processBatch(batch);
        }

        return newPhotos;
    };

    try {
        const newPhotos = await processFilesOptimized(validFiles);

        if (duplicateCount > 0) {
            showError(`You tried to upload ${duplicateCount} duplicate photos which were skipped.`);
        }

        if (window.leadTracker) {
            if (formData.photos.length > 0) {
                window.leadTracker.updateLead({
                    imageUrls: formData.photos.map(p => p.permanentUrl).filter(Boolean),
                    photoCount: formData.photos.length,
                    step: 'PHOTOS_UPLOADED'
                });
            }
        }
        if (newPhotos.length > 0) {
            showSuccess(`Added ${newPhotos.length} photo${newPhotos.length > 1 ? 's' : ''}`);
        }

        renderPhotoGrid();
        updatePhotoCounter();
        updatePricingDisplay();
        updatePhotoContinueButtonState();

        saveToLocalStorage();
    } catch (error) {
        console.error('Error processing files:', error);
        showError('An error occurred while processing your photos. Please try again.');
    } finally {
        setLoading(false);
        isUploading = false;
        updatePhotoContinueButtonState();

        const fileInput = document.getElementById('photo-upload');
        if (fileInput) {
            fileInput.value = '';
        }
    }
}

// Load saved data
async function loadSavedData() {
    const savedData = localStorage.getItem('memoryCreatorData');
    if (savedData) {
        try {
            const parsedData = JSON.parse(savedData);

            const savedAt = new Date(parsedData.savedAt);
            const now = new Date();
            const hoursDiff = Math.abs(now - savedAt) / 36e5;

            if (hoursDiff < 24) {
                // Only restore non-photo data directly
                formData.memoryName = parsedData.memoryName || '';
                formData.music = parsedData.music || null;
                formData.customer = parsedData.customer || null;
                formData.pricing = parsedData.pricing || null;
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
                    // Do not update the next button state here
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

                updatePhotoContinueButtonState();
                updateOrderSummary();
            } else {
                // Clear old data
                clearFormData();
            }
        } catch (e) {
            console.error('Error loading saved data:', e);
            clearFormData();
        }
    }
}

// Update order summary
function updateOrderSummary() {
    const currencyEl = document.getElementById('summary-currency');
    const totalEl = document.getElementById('order-total-price');

    if (currencyEl) {
        currencyEl.textContent = currentCurrency || '-';
    }

    if (summaryName) {
        summaryName.textContent = formData.memoryName || '-';
    }

    if (summaryPhotoCount) {
        summaryPhotoCount.textContent = String((formData.photos || []).length);
    }

    if (summaryMusic) {
        if (formData.music && formData.music.teamChoose) {
            summaryMusic.textContent = 'Team choice';
        } else if (formData.music && formData.music.songName && formData.music.artistName) {
            summaryMusic.textContent = `${formData.music.songName} by ${formData.music.artistName}`;
        } else {
            summaryMusic.textContent = '-';
        }
    }

    if (totalEl) {
        const currencySymbol = CURRENCIES.find(c => c.code === currentCurrency)?.symbol || '$';
        const total = Number(formData?.pricing?.totalPrice || 0);
        totalEl.textContent = `${currencySymbol}${total.toFixed(2)}`;
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