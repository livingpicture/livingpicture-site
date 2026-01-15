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
            
            if (uploadProgress && progressBar && progressText) {
                // Reset and show the progress bar
                progressBar.style.width = '0%';
                progressText.textContent = 'Uploading photos...';
                uploadProgress.classList.add('visible');
                
                // Ensure the progress bar is visible
                uploadProgress.style.display = 'block';
                uploadProgress.style.visibility = 'visible';
                uploadProgress.style.opacity = '1';
            }
            
            // Process each file
            for (let i = 0; i < files.length; i++) {
                const file = files[i];
                
                // Update progress
                if (progressBar) {
                    const progress = Math.round(((i + 1) / files.length) * 100);
                    progressBar.style.width = `${progress}%`;
                    progressText.textContent = `Uploading ${i + 1} of ${files.length} photos...`;
                }
                
                // In a real app, you would upload the file to a server here
                // For now, we'll just create a preview and store the file data
                await new Promise((resolve) => {
                    const reader = new FileReader();
                    
                    reader.onload = function(e) {
                        // Create preview
                        const preview = document.createElement('div');
                        preview.className = 'photo-preview';
                        preview.innerHTML = `
                            <img src="${e.target.result}" alt="Preview">
                            <button type="button" class="remove-photo" data-filename="${file.name}">×</button>
                        `;
                        previewContainer.appendChild(preview);
                        
                        // Add to uploaded photos array
                        uploadedPhotos.push({
                            name: file.name,
                            url: e.target.result,
                            size: file.size,
                            type: file.type
                        });
                        
                        // Update the UI immediately after adding each photo
                        updateLeadWithPhotos();
                        
                        resolve();
                    };
                    
                    reader.readAsDataURL(file);
                });
            }
            
            // Update lead with new photo count and URLs
            updateLeadWithPhotos();
            
            // Hide progress when done
            if (progressBar && progressText) {
                progressText.textContent = 'Upload complete!';
                setTimeout(() => {
                    document.getElementById('upload-progress').style.display = 'none';
                }, 1500);
            }
            
            // Reset file input to allow re-uploading the same file
            fileInput.value = '';
        });
        
        // Handle photo removal
        previewContainer.addEventListener('click', function(e) {
            const removeBtn = e.target.closest('.remove-photo');
            if (removeBtn) {
                const filename = removeBtn.getAttribute('data-filename');
                
                // Remove from DOM
                const preview = removeBtn.closest('.photo-preview');
                if (preview) {
                    preview.style.animation = 'fadeOut 0.3s';
                    setTimeout(() => {
                        preview.remove();
                        
                        // Remove from array
                        uploadedPhotos = uploadedPhotos.filter(photo => photo.name !== filename);
                        
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
        
        const photoCount = uploadedPhotos.length;
        const photoUrls = uploadedPhotos.map(photo => photo.url);
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
            continueButton.disabled = photoCount === 0;
        }
    }
    
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
