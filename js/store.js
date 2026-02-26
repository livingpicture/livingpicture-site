const PRICING_TIERS = [
    { photos: '1-5', price: 1 },
    { photos: '6-15', price: 18 },
    { photos: '16-25', price: 15 },
    { photos: '26+', price: 12 },
];

let currentCurrency = 'ILS';

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
        pricePerPhoto: 1,
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

// Clear error message when typing in memory name field and re-validate button
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
        
        // Re-evaluate the next button state whenever user types
        const isValid = !!(this.value && this.value.trim());
        updateNextButton('next-to-photos', isValid);
        
        // Update form data
        formData.memoryName = this.value.trim();
    });
}

// Initialize the store
function initStore() {
    // FORCED LEAD REFRESH: Clear existing leadId for new session to ensure fresh start
    console.log(' Initializing store - checking for existing leadId...');
    const existingLeadId = localStorage.getItem('leadId');
    if (existingLeadId) {
        console.log(' Found existing leadId in localStorage, clearing for fresh session:', existingLeadId);
        localStorage.removeItem('leadId');
        localStorage.removeItem('memoryCreatorData');
        localStorage.removeItem('livingPictureOrder');
        console.log(' Cleared existing session data - new leadId will be generated');
    }
    
    // Load saved data if exists (after cleanup)
    loadSavedData();

    // Always bind this visit to the current (fresh) leadId
    if (window.leadTracker && window.leadTracker.leadId) {
        formData.leadId = window.leadTracker.leadId;
        console.log(' Bound to fresh leadId:', formData.leadId);
    }

    // Top-left back button: Always navigate to home page
    const topBackButton = document.querySelector('.back-button');
    if (topBackButton) {
        topBackButton.addEventListener('click', (e) => {
            e.preventDefault();
            window.location.href = 'index.html';
        });
    }

    // Set up event listeners
    setupEventListeners();

    // Initialize the first step
    showStep(1);

    // Render music options
    renderMusicOptions();
}

function getCloudinaryFolderPath() {
    // Ensure we always have a leadId; fallback to generated one if missing
    if (!formData.leadId) {
        formData.leadId = window.leadTracker?.leadId || `lead_${Math.floor(100000 + Math.random() * 900000)}`;
    }
    return 'livingpicture/leads/' + formData.leadId;
}

function getCloudinaryConsoleFolderLink() {
    const leadId = formData.leadId;
    if (!leadId) return '';
    // Use the exact format as shown in Cloudinary console URLs
    return `https://console.cloudinary.com/pm/c-dojuekij4/media-explorer/livingpicture/leads/${leadId}`;
}

// TODO: Implement lead-to-order migration after successful payment
// This function should be called in the payment success callback
async function migrateLeadToOrder(leadId) {
    /*
     * Implementation options:
     * 1. Use Cloudinary Admin API to move/rename folder from leads/ to orders/
     * 2. Duplicate folder contents to orders/ and optionally clean up leads/ later
     * 3. Update folder metadata to mark as converted order
     * 
     * Required Cloudinary Admin API endpoints:
     * - POST /admin/folders/rename (to move folder)
     * - POST /admin/assets/rename (to move assets if needed)
     * 
     * Example implementation:
     * 
     * const cloudinary = require('cloudinary').v2;
     * cloudinary.config({
     *   cloud_name: 'dojuekij4',
     *   api_key: 'your_admin_api_key',
     *   api_secret: 'your_admin_api_secret'
     * });
     * 
     * try {
     *   await cloudinary.api.rename_folder(
     *     `livingpicture/leads/${leadId}`,
     *     `livingpicture/orders/${leadId}`
     *   );
     *   console.log(`Successfully migrated lead ${leadId} to order`);
     * } catch (error) {
     *   console.error(`Failed to migrate lead ${leadId}:`, error);
     *   throw error;
     * }
     */
    
    console.log(`TODO: Migrate lead ${leadId} to orders directory after payment success`);
    
    // For now, just log the migration intent
    if (window.leadTracker) {
        await window.leadTracker.trackStep('LEAD_MIGRATED_TO_ORDER', { leadId });
    }
    
    return Promise.resolve();
}

// Helper function to get orders folder path (for post-payment use)
function getOrdersFolderPath(leadId) {
    const targetLeadId = leadId || formData.leadId;
    if (!targetLeadId) return '';
    return 'livingpicture/orders/' + targetLeadId;
}

// Helper function to check if lead has been converted to order
function isLeadConvertedToOrder() {
    // This could be stored in localStorage, formData, or checked via API
    return formData.orderStatus === 'completed' || formData.isConvertedOrder === true;
}

function handleCurrencyUpdate(newCurrency) {
    currentCurrency = newCurrency;
    formData.currency = newCurrency;
    updateAllPrices();

    document.querySelectorAll('.currency-dropdown').forEach(select => {
        select.value = newCurrency;
    });
    
    // Track selectedCurrency change in leadTracker
    if (window.leadTracker) {
        window.leadTracker.updateLead({
            selectedCurrency: newCurrency,
            currency: newCurrency
        });
    }
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

function updateNextButton(buttonId, isEnabled) {
    const button = document.getElementById(buttonId);
    if (!button) return;
    button.disabled = !isEnabled;
    if (isEnabled) {
        button.classList.remove('btn-disabled');
    } else {
        button.classList.add('btn-disabled');
    }
}

function updatePricingDisplay() {
    const photoCount = formData.photos?.length || 0;
    const currency = currentCurrency || formData.currency || 'ILS';
    const currencySymbol = CURRENCIES.find(c => c.code === currency)?.symbol || CURRENCIES.find(c => c.code === 'ILS')?.symbol || '₪';

    const getTier = (count) => {
        if (count >= 26) return '26+';
        if (count >= 16) return '16-25';
        if (count >= 6) return '6-15';
        return '1-5';
    };

    const tier = getTier(photoCount);
    // Use PRICING_TIERS array instead of undefined PRICING object
    const tierConfig = PRICING_TIERS.find(t => t.photos === tier);
    const pricePerPhoto = tierConfig ? tierConfig.price : 0;
    const total = photoCount * pricePerPhoto;

    formData.currency = currency;
    formData.pricing = {
        currentTier: tier,
        pricePerPhoto,
        totalPrice: total,
        currency
    };

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

function setupFileUpload() {
    const fileInput = document.getElementById('photo-upload');
    const browseBtn = document.getElementById('browse-files');

    if (!fileInput || !browseBtn) return;

    // Replace the elements with clones to clear any previously attached listeners
    const newInput = fileInput.cloneNode(true);
    const newBrowseBtn = browseBtn.cloneNode(true);

    if (fileInput.parentNode) {
        fileInput.parentNode.replaceChild(newInput, fileInput);
    }
    if (browseBtn.parentNode) {
        browseBtn.parentNode.replaceChild(newBrowseBtn, browseBtn);
    }

    newBrowseBtn.addEventListener('click', (e) => {
        e.preventDefault();
        e.stopPropagation();
        newInput.click();
    }, true);

    newInput.addEventListener('change', (e) => {
        if (e.target.files && e.target.files.length > 0) {
            handleFileSelect(e);
            // reset input so selecting the same file again triggers change
            e.target.value = '';
        }
        e.stopPropagation();
    }, true);

    newInput.addEventListener('click', (e) => {
        e.stopPropagation();
    }, true);
}

function validateMusicInputs() {
    // Check if "Let Us Choose" is selected (either via radio button or form data)
    if ((teamChooseRadio && teamChooseRadio.checked) || formData.music?.teamChoose) {
        updateNextButton('next-to-checkout', true);
        // Clear any music input errors when team choose is selected
        clearMusicInputErrors();
        return true;
    }

    const song = songNameInput ? songNameInput.value.trim() : '';
    const artist = artistNameInput ? artistNameInput.value.trim() : '';
    const isValid = !!(song && artist);
    updateNextButton('next-to-checkout', isValid);
    
    // Handle error states for music inputs
    if (songNameInput) {
        const songFormGroup = songNameInput.closest('.form-group');
        const songError = document.getElementById('song-name-error');
        
        if (!song) {
            songFormGroup?.classList.add('error');
            songNameInput.classList.add('error');
            if (songError) songError.style.display = 'block';
        } else {
            songFormGroup?.classList.remove('error');
            songNameInput.classList.remove('error');
            if (songError) songError.style.display = 'none';
        }
    }
    
    if (artistNameInput) {
        const artistFormGroup = artistNameInput.closest('.form-group');
        const artistError = document.getElementById('artist-name-error');
        
        if (!artist) {
            artistFormGroup?.classList.add('error');
            artistNameInput.classList.add('error');
            if (artistError) artistError.style.display = 'block';
        } else {
            artistFormGroup?.classList.remove('error');
            artistNameInput.classList.remove('error');
            if (artistError) artistError.style.display = 'none';
        }
    }
    
    return isValid;
}

// Clear music input errors
function clearMusicInputErrors() {
    if (songNameInput) {
        const songFormGroup = songNameInput.closest('.form-group');
        const songError = document.getElementById('song-name-error');
        songFormGroup?.classList.remove('error');
        songNameInput.classList.remove('error');
        if (songError) songError.style.display = 'none';
    }
    
    if (artistNameInput) {
        const artistFormGroup = artistNameInput.closest('.form-group');
        const artistError = document.getElementById('artist-name-error');
        artistFormGroup?.classList.remove('error');
        artistNameInput.classList.remove('error');
        if (artistError) artistError.style.display = 'none';
    }
}

async function handleFileSelect(e) {
    try {
        console.log('🎯 handleFileSelect triggered');
        if (e && typeof e.preventDefault === 'function') e.preventDefault();
        const files = e?.target?.files || e?.dataTransfer?.files;

        if (!files || files.length === 0) {
            console.log('No files selected');
            if (typeof validatePhotoUpload === 'function') validatePhotoUpload();
            return;
        }

        console.log(`Selected ${files.length} files for processing`);

        if (typeof clearPhotoUploadError === 'function') clearPhotoUploadError();
        
        // Process files with the new sequential function
        await processFiles(files);
        
        console.log('✅ File processing completed successfully');
        
    } catch (error) {
        console.error('💥 Error in handleFileSelect:', error);
        if (typeof showError === 'function') {
            showError('Failed to process files. Please try again.');
        } else {
            alert('Failed to process files. Please try again.');
        }
    }
}

// Process files with sequential upload for memory optimization
async function processFiles(files) {
    console.log('📸 Starting sequential file processing for', files.length, 'files');
    
    // Ensure leadId is available before processing
    if (!formData.leadId) {
        formData.leadId = window.leadTracker?.leadId || `lead_${Math.floor(100000 + Math.random() * 900000)}`;
        console.log('Initialized leadId for uploads:', formData.leadId);
    }

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

    if (!fileInput || !browseBtn || !progressContainer || !progressBar || !progressText) {
        console.error('Missing required DOM elements for file processing');
        return;
    }

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
    updateProgress(0, validFiles.length);

    // Lock the Continue button until Cloudinary uploads are done
    updateContinueToMusicButtonState();

    // Check total size
    const totalSize = Array.from(validFiles).reduce((total, file) => total + file.size, 0);
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
        setLoading(false);
        return;
    }

    // Check for duplicate files
    const existingHashes = new Set(formData.photos.map(photo => photo.fileFingerprint));
    const newPhotos = [];
    let processed = 0;
    let failedCount = 0;

    try {
        // Sequential upload - process files one by one to prevent memory crashes
        console.log('🔄 Starting sequential upload loop...');
        for (const file of validFiles) {
            console.log(`📁 Processing file ${processed + 1}/${validFiles.length}: ${file.name}`);
            
            // Check file type first (fast check before hashing)
            if (!file.type.startsWith('image/')) {
                console.log('Skipping non-image file:', file.name);
                continue;
            }

            // Generate file fingerprint (quick hash based on name, size, and last modified)
            const fileFingerprint = `${file.name}-${file.size}-${file.lastModified}`;

            // Check for duplicates
            if (existingHashes.has(fileFingerprint)) {
                console.log('Skipping duplicate file:', file.name);
                continue;
            }

            // Mark as processed
            existingHashes.add(fileFingerprint);

            // Create photo object with temporary placeholder
            const photo = {
                id: Date.now() + '-' + Math.random().toString(36).substr(2, 9),
                previewUrl: null, // Will be set after Cloudinary upload
                file: file,
                name: file.name,
                size: file.size,
                fileFingerprint: fileFingerprint,
                uploadStatus: 'uploading'
            };

            // Add to array immediately
            formData.photos.push(photo);
            newPhotos.push(photo);

            try {
                console.log(`☁️ Uploading ${file.name} to Cloudinary...`);
                // Upload to Cloudinary (sequential - one at a time)
                const uploadResult = await uploadToCloudinary(file);
                
                console.log(`✅ Upload successful for ${file.name}`);
                
                // Update photo with Cloudinary data and optimized thumbnail URL
                photo.permanentUrl = uploadResult.secure_url;
                photo.publicId = uploadResult.public_id;
                photo.uploadStatus = 'uploaded';
                
                // Create optimized thumbnail URL using Cloudinary dynamic transformations (w_200,c_limit)
                photo.previewUrl = uploadResult.secure_url.replace('/upload/', '/upload/w_200,c_limit/');
                
            } catch (uploadError) {
                console.error(`❌ Cloudinary upload failed for ${file.name}:`, uploadError);
                photo.uploadStatus = 'failed';
                photo.previewUrl = null;
                failedCount++;
                
                // Show specific error for this upload
                showError(`Failed to upload ${file.name}. Please check your connection and try again.`);
            }

            processed++;
            
            // Update progress after each file
            updateProgress(processed, validFiles.length);

            // Update UI after each file is processed (sequential updates)
            renderPhotoGrid();
            updateContinueToMusicButtonState();
            updatePricingDisplay();
            
            // Small delay to prevent overwhelming the UI
            await new Promise(resolve => setTimeout(resolve, 100));
        }

        console.log(`🏁 Sequential upload completed. Success: ${processed - failedCount}, Failed: ${failedCount}`);

        // Final updates
        if (newPhotos.length > 0) {
            const successCount = newPhotos.filter(p => p.uploadStatus === 'uploaded').length;
            showSuccess(`Added ${successCount} photo${successCount > 1 ? 's' : ''}${failedCount > 0 ? ` (${failedCount} failed)` : ''}`);
        }

        // Enable Continue only when all photos have permanent URLs
        const allPhotosUploaded = formData.photos.length > 0 && formData.photos.every(p => !!p.permanentUrl);
        if (!allPhotosUploaded && formData.photos.length > 0) {
            console.error('Some photos are missing permanentUrl; keeping Continue disabled.');
            showError('Some photos failed to upload. Please remove and re-add them (or check your connection) to continue.');
        }
        
        updateContinueToMusicButtonState();
        saveToLocalStorage();
        setLoading(false);

        // Track successful uploads
        if (window.leadTracker) {
            const successfulUploads = formData.photos.filter(photo => photo.uploadStatus === 'uploaded');
            
            if (successfulUploads.length > 0) {
                const folderPath = getCloudinaryFolderPath();
                const firstImageUrl = successfulUploads[0]?.permanentUrl || '';
                
                await window.leadTracker.trackStep('PHOTOS_UPLOADED', {
                    photosFolder: folderPath,
                    imageUrls: firstImageUrl,
                    photoCount: successfulUploads.length
                });
            }
        }

        return newPhotos;
        
    } catch (error) {
        console.error('💥 Critical error in processFiles:', error);
        showError('An error occurred while processing your photos. Please try again.');
        setLoading(false);
        throw error;
    }
}

function setupEventListeners() {
    // Next step buttons
    Object.keys(nextButtons).forEach(buttonId => {
        const button = document.getElementById(buttonId);
        if (!button) return;

        button.addEventListener('click', async (e) => {
            e.preventDefault();
            const nextStep = nextButtons[buttonId];
            const currentStepNum = currentStep;

            console.log(`🔍 Continue button clicked: currentStep=${currentStepNum}, nextStep=${nextStep}`);

            // Use saveCurrentStep for validation to ensure errors are displayed properly
            if (!saveCurrentStep()) {
                console.log(`❌ Validation failed for step ${currentStepNum}`);
                
                // Show appropriate error message based on current step
                let errorMessage = '';
                switch (currentStepNum) {
                    case 1:
                        errorMessage = 'Please enter a memory name before continuing.';
                        break;
                    case 2:
                        errorMessage = 'Please add at least one photo and wait for it to finish uploading before continuing.';
                        // Show specific photo upload error
                        const photoErrorElement = document.getElementById('photo-upload-error');
                        if (photoErrorElement) {
                            photoErrorElement.style.display = 'block';
                            photoErrorElement.textContent = errorMessage;
                        }
                        // Scroll user back to the upload area
                        const uploadArea = document.getElementById('drop-zone') || document.getElementById('photo-upload');
                        if (uploadArea) {
                            uploadArea.scrollIntoView({ behavior: 'smooth', block: 'center' });
                        }
                        break;
                    case 3:
                        errorMessage = 'Please select a song or choose team selection before continuing.';
                        break;
                    case 4:
                        // saveCurrentStep already calls validateCustomerDetails which shows errors
                        // Scroll to the first error
                        const firstError = document.querySelector('.form-group.error');
                        if (firstError) {
                            firstError.scrollIntoView({ behavior: 'smooth', block: 'center' });
                        }
                        break;
                }
                
                if (typeof showError === 'function') {
                    showError(errorMessage);
                } else {
                    alert(errorMessage);
                }
                return;
            }

            if (window.leadTracker && typeof window.leadTracker.trackStep === 'function') {
                try {
                    if (buttonId === 'next-to-photos') {
                        await window.leadTracker.trackStep('STORE_VIEW', {
                            memoryTitle: formData.memoryName || undefined
                        });
                    } else if (buttonId === 'next-to-music') {
                        const photosFolder = typeof getCloudinaryConsoleFolderLink === 'function'
                            ? getCloudinaryConsoleFolderLink()
                            : undefined;
                        await window.leadTracker.trackStep('PHOTOS_UPLOADED', {
                            photosFolder,
                            photoCount: (formData.photos || []).length
                        });
                    } else if (buttonId === 'next-to-checkout') {
                        const songChoice = formData.music?.teamChoose
                            ? 'team-choose'
                            : (formData.music?.songName && formData.music?.artistName
                                ? `${formData.music.songName} by ${formData.music.artistName}`
                                : undefined);
                        await window.leadTracker.trackStep('SONG_SELECTED', songChoice ? { songChoice } : {});
                    }
                } catch (err) {
                    console.warn('Failed to commit step transition to lead tracker:', err);
                }
            }

            if (nextStep === 'complete') {
                if (typeof completePurchase === 'function') await completePurchase();
                return;
            }

            showStep(nextStep);
        });
    });

    // Back buttons
    Object.keys(backButtons).forEach(buttonId => {
        const button = document.getElementById(buttonId);
        if (!button) return;
        button.addEventListener('click', (e) => {
            e.preventDefault();
            const targetStep = backButtons[buttonId];
            // If we're on step 1 and back is clicked, go to home
            if (currentStep === 1 && targetStep < 1) {
                // Use index.html for local testing, root for production
                if (window.location.protocol === 'file:') {
                    window.location.href = 'index.html';
                } else {
                    window.location.href = '/';
                }
            } else {
                showStep(targetStep);
            }
        });
    });

    // Music validation
    if (songNameInput) songNameInput.addEventListener('input', validateMusicInputs);
    if (artistNameInput) artistNameInput.addEventListener('input', validateMusicInputs);

    // Music selection radio buttons
    if (selectSongRadio) {
        selectSongRadio.addEventListener('change', () => {
            updateMusicSelectionUI();
            // Validate when choose song is selected (to disable button if fields are empty)
            validateMusicInputs();
        });
    }
    if (teamChooseRadio) {
        teamChooseRadio.addEventListener('change', () => {
            updateMusicSelectionUI();
            // Immediately validate when team choose is selected
            validateMusicInputs();
        });
    }

    // Music selection option clicks (for better UX)
    if (chooseSongOption) {
        chooseSongOption.addEventListener('click', () => {
            if (selectSongRadio) {
                selectSongRadio.checked = true;
                updateMusicSelectionUI();
                // Validate when choose song is selected (to disable button if fields are empty)
                validateMusicInputs();
            }
        });
    }
    if (teamChooseOption) {
        teamChooseOption.addEventListener('click', () => {
            if (teamChooseRadio) {
                teamChooseRadio.checked = true;
                updateMusicSelectionUI();
                // Immediately validate when team choose is selected
                validateMusicInputs();
            }
        });
    }

    // Setup drag and drop
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
    
    // Setup file input
    const fileInput = document.getElementById('photo-upload');
    if (fileInput) {
        fileInput.addEventListener('change', handleFileSelect);
    }
}

function validateCurrentStep(stepNumber) {
    switch (stepNumber) {
        case 1:
            return !!(formData.memoryName && formData.memoryName.trim());
        case 2: {
            const photos = formData.photos || [];
            if (photos.length === 0) return false;
            const allUploaded = photos.every(p => p.uploadStatus === 'uploaded');
            return allUploaded;
        }
        case 3: {
            // Team-choose is always valid. Otherwise require both song + artist.
            if (formData.music?.teamChoose) return true;
            return !!(formData.music?.songName && formData.music?.artistName);
        }
        case 4:
            return typeof validateCustomerDetails === 'function' ? validateCustomerDetails() : true;
        default:
            return true;
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
                updateContinueToMusicButtonState();
            } else {
                updateContinueToMusicButtonState();
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

            // Initialize music selection UI
            if (typeof updateMusicSelectionUI === 'function') {
                updateMusicSelectionUI();
            }

            if (window.leadTracker) {
                window.leadTracker.updateLead({ songChoice: 'choose-song', step: 'SONG_SELECTED' });
            }
            break;
            
        case 4:
            // Update order summary
            updateOrderSummary();

            if (window.leadTracker) {
                window.leadTracker.trackStep('DETAILS_ENTERED');
            }
            break;
    }
}

// Compress image before upload
async function compressImage(file, maxWidth = 1920, maxHeight = 1920, quality = 0.85) {
    return new Promise((resolve) => {
        const canvas = document.createElement('canvas');
        const ctx = canvas.getContext('2d');
        const img = new Image();
        
        img.onload = () => {
            // Calculate new dimensions
            let { width, height } = img;
            
            if (width > maxWidth || height > maxHeight) {
                const ratio = Math.min(maxWidth / width, maxHeight / height);
                width *= ratio;
                height *= ratio;
            }
            
            canvas.width = width;
            canvas.height = height;
            
            // Draw and compress
            ctx.drawImage(img, 0, 0, width, height);
            
            canvas.toBlob((blob) => {
                console.log(`Compressed ${file.name}: ${(file.size / 1024 / 1024).toFixed(2)}MB → ${(blob.size / 1024 / 1024).toFixed(2)}MB`);
                resolve(new File([blob], file.name, {
                    type: 'image/jpeg',
                    lastModified: Date.now()
                }));
            }, 'image/jpeg', quality);
        };
        
        img.onerror = () => {
            console.warn('Failed to load image for compression, using original');
            resolve(file);
        };
        
        img.src = URL.createObjectURL(file);
    });
}

// Upload a single file to Cloudinary using unsigned upload method
async function uploadToCloudinary(file) {
    // Ensure leadId is available before upload
    if (!formData.leadId) {
        formData.leadId = window.leadTracker?.leadId || `lead_${Math.floor(100000 + Math.random() * 900000)}`;
        console.log('Initialized leadId for uploads:', formData.leadId);
    }

    // Compress image before upload for mobile performance and memory efficiency
    let processedFile = file;
    if (file.size > 1024 * 1024) { // Only compress if larger than 1MB
        console.log(`Compressing ${file.name} before upload...`);
        processedFile = await compressImage(file);
    }

    const folderPath = getCloudinaryFolderPath();
    
    const formDataToUpload = new FormData();
    formDataToUpload.append('file', processedFile);
    
    // Use unsigned upload preset - this is the key change for unsigned uploads
    const unsignedPreset = window.CLOUDINARY_UPLOAD_PRESET || 'livingpicture_orders_unsigned';
    formDataToUpload.append('upload_preset', unsignedPreset);
    
    // Add folder parameter for organization
    formDataToUpload.append('folder', folderPath);
    
    // Generate unique public_id to avoid conflicts
    const timestamp = Date.now();
    const randomSuffix = Math.random().toString(36).substr(2, 6);
    const cleanFileName = file.name.split('.')[0].replace(/[^a-zA-Z0-9]/g, '_');
    const publicId = `${folderPath}/${cleanFileName}_${timestamp}_${randomSuffix}`;
    formDataToUpload.append('public_id', publicId);

    // Add quality and format optimizations for better performance
    formDataToUpload.append('quality', 'auto:good');
    formDataToUpload.append('fetch_format', 'auto');

    console.log('Uploading to Cloudinary (unsigned):', {
        file: file.name,
        originalSize: file.size,
        compressedSize: processedFile.size,
        compressionRatio: file.size !== processedFile.size ? `${((1 - processedFile.size / file.size) * 100).toFixed(1)}%` : 'N/A',
        type: processedFile.type,
        publicId: publicId,
        folder: folderPath,
        preset: unsignedPreset,
        leadId: formData.leadId,
        note: 'Using unsigned upload preset with optimizations'
    });

    try {
        // Use unsigned upload endpoint
        const response = await fetch('https://api.cloudinary.com/v1_1/dojuekij4/image/upload', {
            method: 'POST',
            body: formDataToUpload
        });

        console.log('Cloudinary response status:', response.status);

        if (!response.ok) {
            const errText = await response.text();
            console.error('Cloudinary HTTP error:', {
                status: response.status,
                statusText: response.statusText,
                body: errText,
                folder: folderPath,
                preset: unsignedPreset
            });
            throw new Error(`Cloudinary upload failed: ${response.statusText} | ${errText}`);
        }

        const result = await response.json();
        console.log('Cloudinary upload success:', {
            public_id: result.public_id,
            secure_url: result.secure_url,
            format: result.format,
            bytes: result.bytes,
            folder: result.folder || folderPath
        });

        // Ensure required fields exist
        if (!result.secure_url || !result.public_id) {
            console.error('Cloudinary response missing required fields:', result);
            throw new Error('Invalid Cloudinary response: missing required fields');
        }

        return {
            secure_url: result.secure_url,
            public_id: result.public_id,
            format: result.format,
            bytes: result.bytes,
            folder: result.folder || folderPath
        };
    } catch (error) {
        console.error('Cloudinary upload error:', error);
        throw error;
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
        const isUploading = photo.uploadStatus === 'uploading';
        const isFailed = photo.uploadStatus === 'failed';
        const isSuccess = photo.uploadStatus === 'uploaded';
        const stateClass = isUploading ? 'is-uploading' : (isFailed ? 'is-error' : (isSuccess ? 'is-success' : ''));
        const overlay = isUploading
            ? '<div class="photo-upload-overlay"><i class="fas fa-spinner fa-spin"></i></div>'
            : (isFailed
                ? `<div class="photo-upload-overlay photo-upload-overlay--error"><i class="fas fa-exclamation-triangle"></i><button class="photo-retry" data-photo-id="${photo.id}" type="button">Retry</button></div>`
                : (isSuccess ? '<div class="photo-upload-badge photo-upload-badge--success"><i class="fas fa-check-circle"></i></div>' : ''));

        const photoItem = document.createElement('div');
        photoItem.className = `photo-item ${stateClass}`.trim();
        photoItem.innerHTML = `
            <img src="${photo.previewUrl}" alt="${photo.name}">
            ${overlay}
            <button class="remove-photo" onclick="removePhoto('${photo.id}')">
                <i class="fas fa-times"></i>
            </button>
        `;
        photoGrid.appendChild(photoItem);
    });

    photoGrid.querySelectorAll('.photo-retry').forEach(btn => {
        btn.addEventListener('click', (e) => {
            e.preventDefault();
            e.stopPropagation();
            const id = btn.getAttribute('data-photo-id');
            retryPhotoUpload(id);
        });
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
    photoGrid.innerHTML = formData.photos.map((photo, index) => {
        const isUploading = photo.uploadStatus === 'uploading';
        const isFailed = photo.uploadStatus === 'failed';
        const isSuccess = photo.uploadStatus === 'uploaded';
        const stateClass = isUploading ? 'is-uploading' : (isFailed ? 'is-error' : (isSuccess ? 'is-success' : ''));
        const overlay = isUploading
            ? '<div class="photo-upload-overlay"><i class="fas fa-spinner fa-spin"></i></div>'
            : (isFailed
                ? `<div class="photo-upload-overlay photo-upload-overlay--error"><i class="fas fa-exclamation-triangle"></i><button class="photo-retry" data-photo-id="${photo.id}" type="button">Retry</button></div>`
                : (isSuccess ? '<div class="photo-upload-badge photo-upload-badge--success"><i class="fas fa-check-circle"></i></div>' : ''));

        return `
        <div class="photo-item ${stateClass}" data-photo-id="${photo.id}" ${index >= maxVisiblePhotos && !showAll ? 'style="display:none;"' : ''}>
            <img src="${photo.previewUrl}" alt="Uploaded memory" loading="lazy">
            ${overlay}
            <button class="remove-photo" data-photo-id="${photo.id}" aria-label="Remove photo">
                <i class="fas fa-times"></i>
            </button>
        </div>
    `;
    }).join('');

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
        button.addEventListener('click', async (e) => {
            e.stopPropagation();
            const photoId = button.getAttribute('data-photo-id');
            await removePhoto(photoId);
        });
    });

    document.querySelectorAll('.photo-retry').forEach(button => {
        button.addEventListener('click', (e) => {
            e.preventDefault();
            e.stopPropagation();
            const photoId = button.getAttribute('data-photo-id');
            retryPhotoUpload(photoId);
        });
    });

    // Update the photo counter
    updatePhotoCounter();
    updateContinueToMusicButtonState();
}

// Get current step number
function getCurrentStep() {
    const activeStep = document.querySelector('.store-step.active');
    if (activeStep) {
        const stepId = activeStep.id;
        const stepNumber = parseInt(stepId.replace('step-', ''));
        return stepNumber;
    }
    return null;
}

// Update the Continue to Music button state based on photo upload statuses
function updateContinueToMusicButtonState() {
    const photos = formData.photos || [];
    if (photos.length === 0) {
        updateNextButton('next-to-music', false);
        return;
    }

    const uploadingCount = photos.filter(p => p.uploadStatus === 'uploading').length;
    const failedCount = photos.filter(p => p.uploadStatus === 'error').length;
    const uploadedCount = photos.filter(p => p.uploadStatus === 'uploaded').length;

    const continueBtn = document.getElementById('next-to-music');
    if (!continueBtn) return;

    if (uploadingCount > 0) {
        updateNextButton('next-to-music', false);
        continueBtn.textContent = `Uploading ${uploadingCount}/${photos.length}...`;
    } else if (failedCount > 0) {
        updateNextButton('next-to-music', false);
        continueBtn.textContent = `Fix ${failedCount} error${failedCount > 1 ? 's' : ''} to continue`;
    } else if (uploadedCount === photos.length) {
        updateNextButton('next-to-music', true);
        continueBtn.textContent = 'Continue';
    } else {
        // Mixed or unknown state
        updateNextButton('next-to-music', false);
        continueBtn.textContent = 'Processing...';
    }
}

// Remove a photo
async function removePhoto(photoId) {
    console.log('=== removePhoto called ===', { photoId, totalPhotos: formData.photos.length });
    
    // Find the photo to be removed
    const photoToRemove = formData.photos.find(photo => photo.id === photoId);
    if (!photoToRemove) {
        console.warn('Photo not found:', photoId);
        return;
    }

    console.log('Photo to remove:', {
        id: photoToRemove.id,
        name: photoToRemove.name,
        publicId: photoToRemove.publicId,
        uploadStatus: photoToRemove.uploadStatus,
        leadId: formData.leadId
    });

    // If photo is uploaded to Cloudinary, delete it first
    if (photoToRemove.publicId && photoToRemove.uploadStatus === 'uploaded') {
        try {
            console.log('🗑️ Sending publicId for deletion:', photoToRemove.publicId);
            console.log('🗑️ PublicId type:', typeof photoToRemove.publicId);
            console.log('🗑️ PublicId length:', photoToRemove.publicId ? photoToRemove.publicId.length : 'null');
            console.log('Deleting photo from Cloudinary:', photoToRemove.publicId);
            console.log('Attempting to delete from Cloudinary...');
            console.log('Request payload:', {
                publicId: photoToRemove.publicId,
                leadId: formData.leadId
            });
            
            const response = await fetch('/.netlify/functions/delete-photo', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify({
                    publicId: photoToRemove.publicId,
                    leadId: formData.leadId
                })
            });

            console.log('Delete response status:', response.status);
            const result = await response.json();
            console.log('Delete response body:', result);
            
            if (result.ok) {
                console.log('✓ Successfully deleted from Cloudinary:', photoToRemove.publicId);
            } else {
                console.error('✗ Failed to delete from Cloudinary:', result.error);
                console.error('Full error response:', result);
                // Still remove from UI even if Cloudinary deletion fails
            }
        } catch (error) {
            console.error('✗ Error deleting photo from Cloudinary:', error);
            // Still remove from UI even if Cloudinary deletion fails
        }
    } else {
        console.log('Photo not uploaded to Cloudinary, skipping deletion', {
            hasPublicId: !!photoToRemove.publicId,
            uploadStatus: photoToRemove.uploadStatus
        });
    }

    // Clean up object URL
    if (photoToRemove.previewUrl) {
        URL.revokeObjectURL(photoToRemove.previewUrl);
    }

    // Remove the photo from the array
    formData.photos = formData.photos.filter(photo => photo.id !== photoId);
    console.log('Photo removed from array. Remaining photos:', formData.photos.length);

    // Update pricing
    updatePricingDisplay();

    // Save and update UI
    saveToLocalStorage();
    renderPhotoGrid();
    updateContinueToMusicButtonState();
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
        
        // Update form data for team choose
        formData.music.teamChoose = true;
        formData.music.songName = '';
        formData.music.artistName = '';
    } else {
        // For manual song selection
        chooseSongOption.classList.add('selected');
        teamChooseOption.classList.remove('selected');
        if (songSelectionForm) songSelectionForm.style.display = 'block';
        if (teamChooseNote) teamChooseNote.style.display = 'none';
        
        // Update form data for manual selection
        formData.music.teamChoose = false;
    }

    // Update form data and validate
    saveCurrentStep();

    // Update button state using updateNextButton for consistency
    const isValid = isTeamChoose || (songNameInput?.value.trim() && artistNameInput?.value.trim());
    updateNextButton('next-to-checkout', isValid);
}

// Update order summary
function updateOrderSummary() {
    const summaryName = document.getElementById('summary-name');
    const summaryPhotoCount = document.getElementById('summary-photo-count');
    const summaryMusic = document.getElementById('summary-music');
    const summaryCurrency = document.getElementById('summary-currency');
    
    // Get currency symbol
    const currencyCode = formData.currency || 'ILS';
    const currencyMeta = CURRENCIES.find(c => c.code === currencyCode) || CURRENCIES.find(c => c.code === 'ILS') || {};
    const currencySymbol = currencyMeta.symbol || CURRENCIES.find(c => c.code === 'ILS')?.symbol || '₪';
    
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
        const currencyName = currencyMeta.name || currencyCode;
        summaryCurrency.textContent = `${currencyCode} (${currencyName})`;
    }

    // Update the order total price with currency symbol
    const orderTotalElement = document.getElementById('order-total-price');
    if (orderTotalElement && formData.pricing) {
        orderTotalElement.textContent = `${currencySymbol}${formData.pricing.totalPrice?.toFixed(2) || '0.00'}`;
    }
}

// Complete purchase
async function completePurchase() {
    // Ensure we have the current leadId from formData
    const currentLeadId = formData.leadId || window.leadTracker?.leadId;
    console.log('🔄 Starting completePurchase with leadId:', currentLeadId);
    
    if (window.leadTracker && currentLeadId) {
        console.log('📋 Updating lead status to PENDING_PAYMENT for leadId:', currentLeadId);
        await window.leadTracker.updateLead({ step: 'PENDING_PAYMENT' }, true);
    } else {
        console.warn('⚠️ No leadTracker or leadId available for PENDING_PAYMENT update');
    }
    // Show loading state
    const completeBtn = document.getElementById('complete-purchase');
    const originalBtnText = completeBtn ? completeBtn.innerHTML : '';
    
    // Get the current currency information
    const currency = formData.currency || 'ILS';
    const currencySymbol = CURRENCIES.find(c => c.code === currency)?.symbol || CURRENCIES.find(c => c.code === 'ILS')?.symbol || '₪';

    if (completeBtn) {
        completeBtn.disabled = true;
        completeBtn.innerHTML = '<i class="fas fa-spinner fa-spin"></i> Processing...';
    }

    try {
        // Generate short, clean order number (5-6 digit random number)
        const orderNumber = Math.floor(10000 + Math.random() * 90000); // 5-digit number between 10000-99999
        const orderId = orderNumber.toString();

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
            if (window.leadTracker && typeof window.leadTracker.trackStep === 'function') {
                await window.leadTracker.trackStep('PENDING_PAYMENT', { orderId });
            }
            
            // CRITICAL: Clear localStorage to ensure fresh lead generation on next visit
            console.log('🧹 Cleaning up localStorage before payment redirection...');
            localStorage.removeItem('leadId');
            localStorage.removeItem('memoryCreatorData');
            localStorage.removeItem('livingPictureOrder');
            console.log('✅ localStorage cleared - ready for fresh start on next visit');
            
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

// Show success message
function showSuccess(message) {
    // Simple implementation: you can replace with a toast/modal if desired
    console.log('Success:', message);
    // Optionally use a temporary UI element
    const successEl = document.createElement('div');
    successEl.className = 'alert alert-success';
    successEl.textContent = message;
    successEl.style.position = 'fixed';
    successEl.style.top = '20px';
    successEl.style.right = '20px';
    successEl.style.zIndex = '9999';
    successEl.style.padding = '12px 20px';
    successEl.style.background = '#10b981';
    successEl.style.color = 'white';
    successEl.style.borderRadius = '6px';
    successEl.style.boxShadow = '0 4px 6px rgba(0,0,0,0.1)';
    document.body.appendChild(successEl);
    setTimeout(() => {
        if (successEl.parentNode) {
            successEl.parentNode.removeChild(successEl);
        }
    }, 4000);
}

// Show error message
function showError(message) {
    console.error('Error:', message);
    // Optionally use a temporary UI element
    const errorEl = document.createElement('div');
    errorEl.className = 'alert alert-error';
    errorEl.textContent = message;
    errorEl.style.position = 'fixed';
    errorEl.style.top = '20px';
    errorEl.style.right = '20px';
    errorEl.style.zIndex = '9999';
    errorEl.style.padding = '12px 20px';
    errorEl.style.background = '#ef4444';
    errorEl.style.color = 'white';
    errorEl.style.borderRadius = '6px';
    errorEl.style.boxShadow = '0 4px 6px rgba(0,0,0,0.1)';
    document.body.appendChild(errorEl);
    setTimeout(() => {
        if (errorEl.parentNode) {
            errorEl.parentNode.removeChild(errorEl);
        }
    }, 6000);
}

// Retry photo upload using unsigned upload method
async function retryPhotoUpload(photoId) {
    const photo = formData.photos.find(p => p.id === photoId);
    if (!photo) {
        console.error('Photo not found for retry:', photoId);
        return;
    }

    // Reset status
    photo.uploadStatus = 'uploading';
    photo.previewUrl = null;
    renderPhotoGrid();
    updateContinueToMusicButtonState();

    try {
        // Use the same uploadToCloudinary function for consistency
        const uploadResult = await uploadToCloudinary(photo.file);

        // Update photo with Cloudinary data
        photo.permanentUrl = uploadResult.secure_url;
        photo.publicId = uploadResult.public_id;
        photo.uploadStatus = 'uploaded';
        
        // Create optimized thumbnail URL using Cloudinary dynamic transformations (w_200,c_limit)
        photo.previewUrl = uploadResult.secure_url.replace('/upload/', '/upload/w_200,c_limit/');

        showSuccess('Photo uploaded successfully');
    } catch (error) {
        console.error('Retry upload failed for photo', photoId, error);
        photo.uploadStatus = 'error';
        showError('Failed to upload photo. Please try again.');
    }

    // Update UI
    renderPhotoGrid();
    updateContinueToMusicButtonState();
    saveToLocalStorage();
}

// Show success modal
function showSuccessModal() {
    if (successModal) {
        successModal.classList.add('active');
    }
}

// Save current step data
function saveCurrentStep() {
    console.log(`🔍 saveCurrentStep called: currentStep=${currentStep}, validationAttempted=${validationAttempted}`);
    // Set validation attempted flag to true when trying to proceed from any step
    validationAttempted = true;
    console.log(`✅ validationAttempted set to true`);
    
    switch (currentStep) {
        case 1: {
            console.log(`🔍 Validating step 1 (memory name)`);
            const memoryName = memoryNameInput ? memoryNameInput.value.trim() : '';
            formData.memoryName = memoryName;
            console.log(`🔍 memoryName='${memoryName}', memoryNameInput=${!!memoryNameInput}`);

            // Validate memory name
            if (!memoryName) {
                console.log(`❌ Memory name validation failed - showing error`);
                // Show error message and highlight the input
                if (memoryNameInput) {
                    const formGroup = memoryNameInput.closest('.form-group');
                    if (formGroup) {
                        formGroup.classList.add('error');
                        memoryNameInput.classList.add('error');
                        showFieldError('memory-name-error', 'Please enter a name for your memory');
                    }
                }
                return false;
            } else {
                console.log(`✅ Memory name validation passed`);
                // Remove error state if it exists
                if (memoryNameInput) {
                    const formGroup = memoryNameInput.closest('.form-group');
                    if (formGroup) {
                        formGroup.classList.remove('error');
                        memoryNameInput.classList.remove('error');
                        const errorElement = document.getElementById('memory-name-error');
                        if (errorElement) {
                            errorElement.textContent = '';
                            errorElement.style.display = 'none';
                        }
                    }
                }
            }
            break;
        }
        case 3: {
            console.log(`🔍 Validating step 3 (music selection)`);
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
            type: photo.file?.type || '',
            permanentUrl: photo.permanentUrl,
            publicId: photo.publicId,
            uploadStatus: photo.uploadStatus
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
                    pricePerPhoto: formData.pricing?.pricePerPhoto || 0,
                    totalPrice: formData.pricing?.totalPrice || 0,
                    currency: formData.currency || 'ILS',
                    currencySymbol: CURRENCIES.find(c => c.code === (formData.currency || 'ILS'))?.symbol || '₪'
                },
                timestamp: new Date().toISOString()
            };
            localStorage.setItem('memoryCreatorData', JSON.stringify(minimalData));
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
            if (parsedData.currency && CURRENCIES.find(c => c.code === parsedData.currency)) {
                currentCurrency = parsedData.currency;
            }

            // Restore pricing data or initialize with default
            if (parsedData.pricing) {
                formData.pricing = parsedData.pricing;
            } else {
                formData.pricing = {
                    currentTier: PRICING_TIERS[0],
                    pricePerPhoto: 0,
                    totalPrice: 0,
                    currency: formData.currency || 'ILS'
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
        pricePerPhoto: 0,
        totalPrice: 0,
        currency: formData.currency || 'ILS'
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
        // Clean up localStorage to ensure fresh start on next visit
        console.log('🧹 Cleaning up localStorage before save-and-continue redirection...');
        localStorage.removeItem('leadId');
        localStorage.removeItem('memoryCreatorData');
        localStorage.removeItem('livingPictureOrder');
        console.log('✅ localStorage cleared - ready for fresh start on next visit');
        
        window.location.href = 'index.html';
    }, 2000);
}

// Track if validation has been attempted
let validationAttempted = false;

// Validate customer details
function validateCustomerDetails() {
    console.log(`🔍 validateCustomerDetails called: validationAttempted=${validationAttempted}`);
    // Only show errors if validation has been attempted
    if (!validationAttempted) {
        console.log(`⚠️ Validation not attempted yet - skipping error display`);
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
    console.log(`🔍 showFieldError called: fieldId='${fieldId}', message='${message}'`);
    const errorElement = document.getElementById(fieldId);
    console.log(`🔍 Found error element:`, errorElement);
    if (errorElement) {
        errorElement.textContent = message;
        errorElement.style.display = 'block'; // Make sure the error is visible
        console.log(`✅ Error displayed: ${message}`);
        console.log(`🔍 Error element styles:`, window.getComputedStyle(errorElement));
        console.log(`🔍 Error element visibility:`, errorElement.offsetParent !== null);
    } else {
        console.warn(`❌ Error element with ID '${fieldId}' not found`);
    }
}

// Test function to verify error display - call from console: testErrorDisplay()
function testErrorDisplay() {
    console.log('🧪 Testing error display...');
    
    // Test memory name error
    showFieldError('memory-name-error', 'Test memory name error');
    
    // Test customer errors
    showFieldError('name-error', 'Test name error');
    showFieldError('email-error', 'Test email error');
    showFieldError('country-error', 'Test country error');
    
    // Test music errors
    showFieldError('song-name-error', 'Test song name error');
    showFieldError('artist-name-error', 'Test artist name error');
    
    console.log('🧪 Error display test complete - check if messages appear above form fields');
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
                    customerPhone: formData.customer?.phone,
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
                customerPhone: formData.customer?.phone,
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