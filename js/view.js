// Video View Page JavaScript
class VideoViewManager {
    constructor() {
        this.orderId = null;
        this.token = null;
        this.videoData = null;
        
        this.init();
    }

    init() {
        // Parse URL parameters
        this.parseUrlParams();
        
        // Validate required parameters
        if (!this.orderId || !this.token) {
            this.showError('Missing required parameters');
            return;
        }

        // Start loading
        this.showState('loading');
        
        // Fetch video data
        this.fetchVideoData();
        
        // Setup event listeners
        this.setupEventListeners();
    }

    parseUrlParams() {
        const params = new URLSearchParams(window.location.search);
        this.orderId = params.get('orderId');
        this.token = params.get('t');
    }

    async fetchVideoData() {
        try {
            console.log(`🎬 Fetching video data for order: ${this.orderId}`);
            
            // Use relative URL since frontend and functions are on the same Netlify site
            const response = await fetch(`/.netlify/functions/get-order-view?orderId=${encodeURIComponent(this.orderId)}&t=${encodeURIComponent(this.token)}`);
            
            if (!response.ok) {
                throw new Error(`HTTP ${response.status}: ${response.statusText}`);
            }

            const data = await response.json();
            console.log('📋 Received video data:', data);
            
            this.handleVideoDataResponse(data);
            
        } catch (error) {
            console.error('💥 Error fetching video data:', error);
            
            // Show more specific error message
            if (error.message.includes('404')) {
                this.showError('Video service not available. Please try again later.');
            } else if (error.message.includes('403')) {
                this.showError('Access denied. Link may be expired.');
            } else {
                this.showError('Failed to load video. Please try again later.');
            }
        }
    }

    handleVideoDataResponse(data) {
        this.videoData = data;

        switch (data.status) {
            case 'ready':
                this.showReadyState(data);
                break;
            case 'not_ready':
                this.showNotReadyState(data);
                break;
            default:
                this.showError('Video not available');
        }
    }

    showReadyState(data) {
        console.log('✅ Video ready, setting up player...');
        
        // Update title
        const titleElement = document.getElementById('video-title');
        if (titleElement) {
            titleElement.textContent = data.customerName ? `${data.customerName}'s LivingPicture` : 'Your LivingPicture';
        }

        // Setup video player
        this.setupVideoPlayer(data.streamUrl);
        
        // Setup download button
        this.setupDownloadButton(data.downloadUrl);
        
        // Setup share button
        this.setupShareButton();
        
        // Show ready state
        this.showState('ready');
    }

    setupVideoPlayer(streamUrl) {
        const videoPlayer = document.getElementById('video-player');
        if (!videoPlayer) return;

        // Set video source
        videoPlayer.src = streamUrl;
        
        // Add event listeners
        videoPlayer.addEventListener('loadstart', () => {
            console.log('🎥 Video loading started');
        });

        videoPlayer.addEventListener('loadedmetadata', () => {
            console.log('🎥 Video metadata loaded');
        });

        videoPlayer.addEventListener('canplay', () => {
            console.log('🎥 Video can play');
        });

        videoPlayer.addEventListener('error', (e) => {
            console.error('🎥 Video error:', e);
            
            // Try fallback to test video
            if (!videoPlayer.src.includes('test-video')) {
                console.log('🔄 Trying fallback test video...');
                videoPlayer.src = 'https://commondatastorage.googleapis.com/gtv-videos-bucket/sample/BigBuckBunny.mp4';
                videoPlayer.load();
                this.showToast('Original video unavailable, showing sample video.');
            } else {
                this.showToast('Error loading video. Please try again.');
            }
        });

        // Load video
        videoPlayer.load();
    }

    setupDownloadButton(downloadUrl) {
        const downloadBtn = document.getElementById('download-btn');
        if (!downloadBtn) return;

        downloadBtn.addEventListener('click', async () => {
            try {
                console.log('⬇️ Starting video download...');
                
                // Create a temporary link element to force download
                const link = document.createElement('a');
                link.href = downloadUrl;
                link.download = `LivingPicture-${this.orderId}.mp4`;
                link.style.display = 'none';
                
                document.body.appendChild(link);
                link.click();
                document.body.removeChild(link);
                
                this.showToast('Download started!');
                
            } catch (error) {
                console.error('💥 Download error:', error);
                this.showToast('Download failed. Please try again.');
            }
        });
    }

    setupShareButton() {
        const shareBtn = document.getElementById('share-btn');
        if (!shareBtn) return;

        shareBtn.addEventListener('click', async () => {
            try {
                const shareData = {
                    title: 'My LivingPicture',
                    text: 'Check out my LivingPicture video!',
                    url: window.location.href
                };

                // Try Web Share API first (mobile)
                if (navigator.share && navigator.canShare && navigator.canShare(shareData)) {
                    await navigator.share(shareData);
                    console.log('📱 Content shared successfully');
                } else {
                    // Fallback: copy link to clipboard
                    await this.copyLinkToClipboard();
                }
                
            } catch (error) {
                console.log('📱 Share cancelled or failed:', error);
                // Don't show error for user cancellation
                if (error.name !== 'AbortError') {
                    await this.copyLinkToClipboard();
                }
            }
        });
    }

    async copyLinkToClipboard() {
        try {
            await navigator.clipboard.writeText(window.location.href);
            this.showToast('Link copied to clipboard!');
            console.log('📋 Link copied to clipboard');
        } catch (error) {
            console.error('💥 Failed to copy link:', error);
            // Fallback for older browsers
            this.fallbackCopyLink();
        }
    }

    fallbackCopyLink() {
        try {
            const textArea = document.createElement('textarea');
            textArea.value = window.location.href;
            textArea.style.position = 'fixed';
            textArea.style.opacity = '0';
            
            document.body.appendChild(textArea);
            textArea.select();
            
            const successful = document.execCommand('copy');
            document.body.removeChild(textArea);
            
            if (successful) {
                this.showToast('Link copied to clipboard!');
            } else {
                this.showToast('Failed to copy link');
            }
        } catch (error) {
            console.error('💥 Fallback copy failed:', error);
            this.showToast('Failed to copy link');
        }
    }

    showNotReadyState(data) {
        console.log(`⏳ Video not ready: ${data.message}`);
        
        // Update message if provided
        const messageElement = document.querySelector('#not-ready-state .message');
        if (messageElement && data.message) {
            messageElement.textContent = data.message;
        }
        
        this.showState('not-ready');
    }

    showError(message) {
        console.error(`❌ Error: ${message}`);
        
        // Update error message
        const messageElement = document.querySelector('#invalid-state .message');
        if (messageElement) {
            messageElement.textContent = message;
        }
        
        this.showState('invalid');
    }

    showState(stateName) {
        // Hide all states
        const states = document.querySelectorAll('.state-container');
        states.forEach(state => state.classList.remove('active'));
        
        // Show target state
        const targetState = document.getElementById(`${stateName}-state`);
        if (targetState) {
            targetState.classList.add('active');
        }
    }

    showToast(message, duration = 3000) {
        const toast = document.getElementById('toast');
        const toastMessage = document.getElementById('toast-message');
        
        if (!toast || !toastMessage) return;
        
        toastMessage.textContent = message;
        toast.classList.add('show');
        
        setTimeout(() => {
            toast.classList.remove('show');
        }, duration);
    }

    setupEventListeners() {
        // Handle page visibility changes
        document.addEventListener('visibilitychange', () => {
            if (!document.hidden && this.videoData?.status === 'not_ready') {
                // Refresh data when page becomes visible again
                setTimeout(() => {
                    this.fetchVideoData();
                }, 1000);
            }
        });

        // Handle keyboard shortcuts
        document.addEventListener('keydown', (e) => {
            if (e.key === 'Escape' && document.fullscreenElement) {
                document.exitFullscreen();
            }
        });

        // Add fullscreen support for video
        const videoPlayer = document.getElementById('video-player');
        if (videoPlayer) {
            videoPlayer.addEventListener('dblclick', () => {
                if (document.fullscreenElement) {
                    document.exitFullscreen();
                } else {
                    videoPlayer.requestFullscreen().catch(err => {
                        console.log('Fullscreen not available:', err);
                    });
                }
            });
        }
    }
}

// Initialize when DOM is loaded
document.addEventListener('DOMContentLoaded', () => {
    window.videoViewManager = new VideoViewManager();
});

// Handle browser back/forward navigation
window.addEventListener('popstate', () => {
    // Refresh data if user navigates back
    if (window.videoViewManager) {
        window.videoViewManager.fetchVideoData();
    }
});
