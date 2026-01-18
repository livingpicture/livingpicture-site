document.addEventListener('DOMContentLoaded', function() {
    // Initialize variables
    const memoryForm = document.querySelector('form');
    const memoryNameInput = document.getElementById('memoryName');
    const fileInput = document.getElementById('photoUpload');
    const browseButton = document.getElementById('browse-files');
    const previewContainer = document.getElementById('photoPreview');
    let uploadedPhotos = [];
    
    // Initialize lead tracker if not already initialized
    if (!window.leadTracker) {
        console.warn('Lead tracker not found. Initializing...');
        window.leadTracker = new LeadTracker();
    }
    
    // Track memory name changes with debounce
    if (memoryNameInput) {
        let nameTimeout;
        const updateMemoryName = (value) => {
            if (window.leadTracker) {
                console.log('Updating memory title:', value);
                window.leadTracker.updateLead({
                    memoryTitle: value,
                    step: 'MEMORY_NAME_ENTERED'
                });
            }
        };
        
        memoryNameInput.addEventListener('input', function() {
            clearTimeout(nameTimeout);
            nameTimeout = setTimeout(() => updateMemoryName(this.value), 500);
        });
        
        // Also track on blur for immediate update when user leaves the field
        memoryNameInput.addEventListener('blur', function() {
            clearTimeout(nameTimeout);
            if (this.value) {
                updateMemoryName(this.value);
            }
        });
    }
    
    // Handle browse button click
    if (browseButton && fileInput) {
        browseButton.addEventListener('click', function(e) {
            e.preventDefault();
            fileInput.click();
        });
    }
    
    // Handle photo uploads
    if (fileInput) {
        fileInput.addEventListener('change', async function(e) {
            const files = Array.from(e.target.files);
            if (files.length === 0) return;
            
            // Show upload progress
            const uploadProgress = document.getElementById('upload-progress');
            const progressBar = document.getElementById('upload-progress-bar');
            const progressText = document.getElementById('upload-progress-text');
            const cancelUploadBtn = document.getElementById('cancel-upload');
            
            if (uploadProgress && progressBar && progressText) {
                // Reset and show the progress bar
                progressBar.style.width = '0%';
                progressBar.setAttribute('aria-valuenow', '0');
                progressText.textContent = 'Preparing upload...';
                uploadProgress.classList.add('visible');
                uploadProgress.style.display = 'block';
                uploadProgress.style.visibility = 'visible';
                uploadProgress.style.opacity = '1';
                
                // Show cancel button
                if (cancelUploadBtn) {
                    cancelUploadBtn.style.display = 'inline-block';
                    cancelUploadBtn.onclick = () => cancelAllUploads();
                }
            }
            
            // Disable the continue button while uploading
            const continueButton = document.getElementById('next-to-music');
            if (continueButton) {
                continueButton.disabled = true;
                continueButton.textContent = 'Uploading...';
            }
            
            // Create file previews and prepare uploads
            const uploadPromises = [];
            const uploadControllers = [];
            
            files.forEach((file, index) => {
                const fileId = `file-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
                const controller = new AbortController();
                uploadControllers.push({ id: fileId, controller });
                
                // Create preview with loading state
                const preview = document.createElement('div');
                preview.className = 'photo-preview';
                preview.setAttribute('data-file-id', fileId);
                preview.innerHTML = `
                    <div class="preview-container">
                        <img src="${URL.createObjectURL(file)}" alt="Preview">
                        <div class="progress-overlay">
                            <div class="progress-bar" style="width: 0%"></div>
                        </div>
                    </div>
                    <div class="upload-status">
                        <div class="status-indicator loading"></div>
                        <span class="status-text">Waiting...</span>
                        <div class="file-info">${formatFileSize(file.size)} • 0%</div>
                        <button type="button" class="cancel-upload" data-file-id="${fileId}" title="Cancel upload">
                            <span class="cancel-icon">×</span>
                        </button>
                    </div>
                    <button type="button" class="remove-photo" data-file-id="${fileId}" title="Remove photo" style="display: none;">×</button>
                `;
                previewContainer.appendChild(preview);
                
                // Add to uploaded photos array with initial state
                const photoIndex = uploadedPhotos.length;
                const photoData = {
                    id: fileId,
                    name: file.name,
                    url: null,
                    size: file.size,
                    type: file.type,
                    status: 'pending',
                    progress: 0,
                    element: preview,
                    error: null,
                    controller
                };
                uploadedPhotos.push(photoData);
                
                // Create upload promise with concurrency control
                const uploadPromise = (async () => {
                    try {
                        // Update status to uploading
                        photoData.status = 'uploading';
                        updatePhotoStatus(photoData);
                        
                        // Start the upload
                        await uploadToCloudinary(file, photoData, (progress) => {
                            photoData.progress = progress;
                            updatePhotoStatus(photoData);
                        }, controller.signal);
                        
                        // Mark as completed
                        photoData.status = 'uploaded';
                        updatePhotoStatus(photoData);
                        return photoData;
                    } catch (error) {
                        if (error.name !== 'AbortError') {
                            photoData.status = 'error';
                            photoData.error = error.message || 'Upload failed';
                            updatePhotoStatus(photoData);
                        }
                        throw error;
                    }
                })();
                
                uploadPromises.push(uploadPromise);
            });
            
            // Process uploads in parallel (max 3 at a time)
            const MAX_CONCURRENT_UPLOADS = 3;
            const processUploads = async () => {
                const results = [];
                const totalFiles = uploadPromises.length;
                let completed = 0;
                
                // Process in chunks
                for (let i = 0; i < uploadPromises.length; i += MAX_CONCURRENT_UPLOADS) {
                    const chunk = uploadPromises.slice(i, i + MAX_CONCURRENT_UPLOADS);
                    const chunkResults = await Promise.allSettled(chunk);
                    
                    // Update progress
                    completed += chunk.length;
                    const progress = Math.round((completed / totalFiles) * 100);
                    if (progressBar && progressText) {
                        progressBar.style.width = `${progress}%`;
                        progressBar.setAttribute('aria-valuenow', progress);
                        progressText.textContent = `Uploading ${completed} of ${totalFiles} photos...`;
                    }
                    
                    results.push(...chunkResults);
                }
                
                return results;
            };
            
            try {
                // Start processing uploads
                await processUploads();
                
                // Update lead with new photo count and URLs
                updateLeadWithPhotos();
                
                // Update UI when all uploads are done
                if (progressText) {
                    const successCount = uploadedPhotos.filter(p => p.status === 'uploaded').length;
                    const errorCount = uploadedPhotos.filter(p => p.status === 'error').length;
                    
                    if (errorCount > 0) {
                        progressText.innerHTML = `Upload complete with ${errorCount} error(s). <a href="#" id="view-errors">View errors</a>`;
                        
                        // Add click handler for viewing errors
                        const viewErrorsLink = document.getElementById('view-errors');
                        if (viewErrorsLink) {
                            viewErrorsLink.onclick = (e) => {
                                e.preventDefault();
                                // Scroll to first error
                                const firstError = document.querySelector('.photo-preview.error');
                                if (firstError) {
                                    firstError.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
                                    firstError.classList.add('highlight-error');
                                    setTimeout(() => firstError.classList.remove('highlight-error'), 2000);
                                }
                            };
                        }
                    } else {
                        progressText.textContent = 'Upload complete!';
                    }
                }
                
            } catch (error) {
                console.error('Error during uploads:', error);
                if (progressText) {
                    progressText.textContent = 'Upload completed with some errors.';
                }
            } finally {
                // Clean up
                if (cancelUploadBtn) {
                    cancelUploadBtn.style.display = 'none';
                }
                
                // Hide progress bar after delay if all uploads are done
                const hasActiveUploads = uploadedPhotos.some(p => p.status === 'uploading' || p.status === 'pending');
                if (!hasActiveUploads) {
                    setTimeout(() => {
                        if (uploadProgress) {
                            uploadProgress.classList.remove('visible');
                            setTimeout(() => {
                                uploadProgress.style.display = 'none';
                            }, 300);
                        }
                    }, 2000);
                }
            }
        });
        
        // Handle photo removal
        previewContainer.addEventListener('click', function(e) {
            const removeBtn = e.target.closest('.remove-photo');
            if (removeBtn) {
                const fileId = removeBtn.getAttribute('data-file-id');
                
                // Remove from DOM with animation
                const preview = removeBtn.closest('.photo-preview');
                if (preview) {
                    preview.style.animation = 'fadeOut 0.3s';
                    setTimeout(() => {
                        preview.remove();
                        
                        // Remove from array
                        uploadedPhotos = uploadedPhotos.filter(photo => photo.id !== fileId);
                        
                        // Update lead with new photo count and URLs
                        updateLeadWithPhotos();
                    }, 300);
                }
            }
        });
    }
    
    // Update lead with current photo information and update UI state
    function updateLeadWithPhotos() {
        if (!window.leadTracker) {
            console.warn('Lead tracker not available');
            return;
        }
        
        // Filter only successfully uploaded photos
        const uploadedPhotosData = uploadedPhotos.filter(photo => photo.status === 'uploaded');
        const photoCount = uploadedPhotosData.length;
        const photoUrls = uploadedPhotosData.map(photo => photo.url);
        const step = photoCount > 0 ? 'PHOTOS_UPLOADED' : 'MEMORY_NAME_ENTERED';
        
        console.log(`Updating lead with ${photoCount} photos, step: ${step}`);
        
        // Update the lead data
        window.leadTracker.updateLead({
            photoCount: photoCount,
            imageUrls: photoUrls,
            step: step
        });
        
        // Update the Continue button state
        const continueButton = document.getElementById('next-to-music');
        if (continueButton) {
            const hasUploading = uploadedPhotos.some(photo => photo.status === 'uploading');
            const hasErrors = uploadedPhotos.some(photo => photo.status === 'error');
            const hasUploads = uploadedPhotos.length > 0;
            const allUploaded = uploadedPhotos.every(photo => 
                photo.status === 'uploaded' || photo.status === 'error');
            
            // Only enable if there are no uploads in progress and at least one successful upload
            continueButton.disabled = hasUploading || !hasUploads || !allUploaded;
            
            // Update button text based on state
            if (hasUploading) {
                continueButton.textContent = 'Uploading...';
            } else if (hasErrors) {
                continueButton.textContent = 'Resolve upload errors to continue';
            } else if (hasUploads) {
                continueButton.textContent = 'Continue to Next Step';
            } else {
                continueButton.textContent = 'Upload Photos to Continue';
            }
        }
    }
    
        // Upload file to Cloudinary with progress tracking
    async function uploadToCloudinary(file, photoData, onProgress, signal) {
        return new Promise((resolve, reject) => {
            const formData = new FormData();
            formData.append('file', file);
            formData.append('upload_preset', 'livingpicture_uploads');
            
            const xhr = new XMLHttpRequest();
            
            // Set up progress tracking
            xhr.upload.addEventListener('progress', (e) => {
                if (e.lengthComputable) {
                    const percentComplete = Math.round((e.loaded / e.total) * 100);
                    if (onProgress) onProgress(percentComplete);
                }
            });
            
            // Handle completion
            xhr.addEventListener('load', () => {
                if (xhr.status >= 200 && xhr.status < 300) {
                    try {
                        const data = JSON.parse(xhr.responseText);
                        photoData.url = data.secure_url;
                        photoData.publicId = data.public_id;
                        resolve(data.secure_url);
                    } catch (e) {
                        reject(new Error('Invalid server response'));
                    }
                } else {
                    let errorMessage = 'Upload failed';
                    try {
                        const errorData = JSON.parse(xhr.responseText);
                        errorMessage = errorData.message || errorMessage;
                    } catch (e) { /* Ignore JSON parse error */ }
                    reject(new Error(errorMessage));
                }
            });
            
            // Handle errors
            xhr.addEventListener('error', () => {
                reject(new Error('Network error occurred'));
            });
            
            // Handle abort
            xhr.addEventListener('abort', () => {
                reject(new DOMException('Upload cancelled', 'AbortError'));
            });
            
            // Set up abort signal
            if (signal) {
                if (signal.aborted) {
                    xhr.abort();
                    return;
                }
                
                signal.addEventListener('abort', () => {
                    xhr.abort();
                });
            }
            
            // Start the upload
            xhr.open('POST', 'https://api.cloudinary.com/v1_1/dojuekij4/image/upload', true);
            xhr.send(formData);
        });
    }
    
    // Update photo status in the UI
    function updatePhotoStatus(photoData) {
        const { element, status, progress, error, size } = photoData;
        if (!element) return;
        
        const statusElement = element.querySelector('.upload-status');
        const progressBar = element.querySelector('.progress-bar');
        const statusText = element.querySelector('.status-text');
        const fileInfo = element.querySelector('.file-info');
        const removeBtn = element.querySelector('.remove-photo');
        const cancelBtn = element.querySelector('.cancel-upload');
        
        if (!statusElement) return;
        
        // Update status class
        element.className = `photo-preview ${status}`;
        
        switch (status) {
            case 'uploading':
                if (progressBar) progressBar.style.width = `${progress}%`;
                if (statusText) statusText.textContent = 'Uploading...';
                if (fileInfo) fileInfo.textContent = `${formatFileSize(size)} • ${progress}%`;
                if (cancelBtn) cancelBtn.style.display = 'block';
                if (removeBtn) removeBtn.style.display = 'none';
                break;
                
            case 'uploaded':
                if (progressBar) progressBar.style.width = '100%';
                if (statusText) statusText.textContent = 'Uploaded';
                if (fileInfo) fileInfo.textContent = formatFileSize(size);
                if (cancelBtn) cancelBtn.style.display = 'none';
                if (removeBtn) removeBtn.style.display = 'block';
                statusElement.innerHTML = `
                    <div class="status-indicator success">✓</div>
                    <span class="status-text">Uploaded</span>
                    <div class="file-info">${formatFileSize(size)}</div>
                `;
                break;
                
            case 'error':
                if (statusText) statusText.textContent = 'Upload failed';
                if (fileInfo) fileInfo.textContent = error || 'Unknown error';
                if (cancelBtn) cancelBtn.style.display = 'none';
                if (removeBtn) removeBtn.style.display = 'block';
                statusElement.innerHTML = `
                    <div class="status-indicator error">!</div>
                    <span class="status-text">Upload failed</span>
                    <div class="file-info">${error || 'Unknown error'}</div>
                    <button class="retry-upload" data-file-id="${photoData.id}">Retry</button>
                `;
                
                // Add retry handler
                const retryBtn = statusElement.querySelector('.retry-upload');
                if (retryBtn) {
                    retryBtn.addEventListener('click', (e) => {
                        e.stopPropagation();
                        retryUpload(photoData);
                    });
                }
                break;
                
            case 'cancelled':
                if (statusText) statusText.textContent = 'Cancelled';
                if (fileInfo) fileInfo.textContent = 'Upload cancelled';
                if (cancelBtn) cancelBtn.style.display = 'none';
                statusElement.innerHTML = `
                    <div class="status-indicator">✕</div>
                    <span class="status-text">Cancelled</span>
                    <button class="retry-upload" data-file-id="${photoData.id}">Retry</button>
                `;
                
                // Add retry handler
                const retryBtn2 = statusElement.querySelector('.retry-upload');
                if (retryBtn2) {
                    retryBtn2.addEventListener('click', (e) => {
                        e.stopPropagation();
                        retryUpload(photoData);
                    });
                }
                break;
        }
    }
    
    // Format file size
    function formatFileSize(bytes) {
        if (bytes === 0) return '0 Bytes';
        const k = 1024;
        const sizes = ['Bytes', 'KB', 'MB', 'GB'];
        const i = Math.floor(Math.log(bytes) / Math.log(k));
        return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
    }
    
    // Retry upload for a failed or cancelled upload
    async function retryUpload(photoData) {
        if (!photoData || !photoData.element) return;
        
        const fileInput = document.createElement('input');
        fileInput.type = 'file';
        fileInput.accept = 'image/*';
        
        fileInput.onchange = async (e) => {
            if (e.target.files && e.target.files[0]) {
                const file = e.target.files[0];
                const controller = new AbortController();
                
                // Update photo data
                photoData.status = 'pending';
                photoData.progress = 0;
                photoData.error = null;
                photoData.controller = controller;
                updatePhotoStatus(photoData);
                
                try {
                    await uploadToCloudinary(file, photoData, (progress) => {
                        photoData.progress = progress;
                        updatePhotoStatus(photoData);
                    }, controller.signal);
                    
                    photoData.status = 'uploaded';
                    updatePhotoStatus(photoData);
                    updateLeadWithPhotos();
                } catch (error) {
                    if (error.name !== 'AbortError') {
                        photoData.status = 'error';
                        photoData.error = error.message || 'Upload failed';
                        updatePhotoStatus(photoData);
                        updateLeadWithPhotos();
                    }
                }
            }
        };
        
        fileInput.click();
    }
    
    // Cancel all active uploads
    function cancelAllUploads() {
        uploadedPhotos.forEach(photo => {
            if ((photo.status === 'uploading' || photo.status === 'pending') && photo.controller) {
                photo.controller.abort();
                photo.status = 'cancelled';
                updatePhotoStatus(photo);
            }
        });
        
        // Update UI
        updateLeadWithPhotos();
        
        // Hide cancel button
        const cancelUploadBtn = document.getElementById('cancel-upload');
        if (cancelUploadBtn) {
            cancelUploadBtn.style.display = 'none';
        }
    }
    }
    
    // Handle retry and cancel button clicks
    document.addEventListener('click', function(e) {
        // Stop propagation for retry buttons
        if (e.target.classList.contains('retry-upload')) {
            e.stopPropagation();
        }
        
        // Handle cancel upload button clicks
        const cancelBtn = e.target.closest('.cancel-upload');
        if (cancelBtn) {
            e.preventDefault();
            e.stopPropagation();
            
            const fileId = cancelBtn.getAttribute('data-file-id');
            if (!fileId) return;
            
            // Find and cancel the upload
            const photo = uploadedPhotos.find(p => p.id === fileId);
            if (photo && photo.controller) {
                photo.controller.abort();
                photo.status = 'cancelled';
                updatePhotoStatus(photo);
                updateLeadWithPhotos();
            }
        }
    });

    // Handle form steps navigation
    const nextButtons = document.querySelectorAll('[id^="next-to-"]');
    nextButtons.forEach(button => {
        button.addEventListener('click', async function(e) {
            e.preventDefault();
            
            // Get current and next step
            const currentStep = this.closest('.store-step');
            const nextStepId = this.id.replace('next-to-', 'step-');
            const nextStep = document.getElementById(nextStepId);
            
            if (!nextStep) return;
            
            // Update progress bar
            updateProgressBar(nextStepId);
            
            // Hide current step and show next step
            currentStep.classList.remove('active');
            nextStep.classList.add('active');
            
            // Scroll to top of the next step
            nextStep.scrollIntoView({ behavior: 'smooth', block: 'start' });
            
            // Update step in lead data
            if (window.leadTracker) {
                await window.leadTracker.updateLead({
                    step: nextStepId.toUpperCase()
                }, true);
            }
        });
    });
    
    // Update progress bar based on current step
    function updateProgressBar(stepId) {
        const stepNumber = parseInt(stepId.split('-')[1]);
        const progressPercentage = ((stepNumber - 1) / 4) * 100;
        
        // Update desktop progress bar
        const progressBar = document.querySelector('.progress');
        if (progressBar) {
            progressBar.style.width = `${progressPercentage}%`;
        }
        
        // Update mobile progress indicator
        const mobileProgressBar = document.getElementById('mobile-progress-bar');
        const currentStepElement = document.getElementById('current-step');
        
        if (mobileProgressBar) {
            mobileProgressBar.style.width = `${progressPercentage}%`;
        }
        
        if (currentStepElement) {
            currentStepElement.textContent = stepNumber;
        }
    }
    
    // Initialize progress bar
    updateProgressBar('step-1');
    
    // Handle back buttons
    const backButtons = document.querySelectorAll('[id^="back-to-"]');
    backButtons.forEach(button => {
        button.addEventListener('click', function(e) {
            e.preventDefault();
            
            // Get current and previous step
            const currentStep = this.closest('.store-step');
            const prevStepId = this.id.replace('back-to-', 'step-');
            const prevStep = document.getElementById(prevStepId);
            
            if (!prevStep) return;
            
            // Update progress bar
            updateProgressBar(prevStepId);
            
            // Hide current step and show previous step
            currentStep.classList.remove('active');
            prevStep.classList.add('active');
            
            // Scroll to top of the previous step
            prevStep.scrollIntoView({ behavior: 'smooth', block: 'start' });
        });
    });
});
