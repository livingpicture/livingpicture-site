
let currentCurrency = 'ILS';

function updatePricing(currency) {
    currentCurrency = currency;
    const currencyObj = CURRENCIES.find(c => c.code === currency) || CURRENCIES[0];
    const currencySymbol = currencyObj.symbol;

    document.querySelectorAll('.tier-price .amount').forEach(priceElement => {
        const tier = priceElement.closest('.price-tier').getAttribute('data-tier');
        const price = PRICING[tier]?.[currency] || 0;
        priceElement.textContent = `${currencySymbol}${price.toFixed(2)}`;
    });

    document.querySelectorAll('.currency-dropdown').forEach(dropdown => {
        dropdown.value = currency;
    });
}

document.addEventListener('DOMContentLoaded', function() {
    document.dispatchEvent(new CustomEvent('pageLoaded', { detail: { page: 'index' } }));

    document.addEventListener('currencyLoaded', (e) => {
        updatePricing(e.detail.currency);
    });

    document.addEventListener('currencyChanged', (e) => {
        updatePricing(e.detail.currency);
    });
    
    // DOM Elements
    const body = document.body;
    const header = document.querySelector('.site-header');
    const menuToggle = document.querySelector('.menu-toggle');
    const mobileNav = document.getElementById('mobileNav');
    const navLinks = document.querySelectorAll('.nav-link');
    const navClose = document.querySelector('.nav-close');
    
    // Toggle mobile menu
    function toggleMenu() {
        body.classList.toggle('menu-open');
        mobileNav.classList.toggle('active');
        
        // Toggle aria-expanded for accessibility
        const isExpanded = menuToggle.getAttribute('aria-expanded') === 'true' || false;
        menuToggle.setAttribute('aria-expanded', !isExpanded);
        
        // Toggle menu icon animation
        menuToggle.classList.toggle('is-active');
    }
    
    // Close mobile menu when clicking on a nav link
    function closeMenu() {
        body.classList.remove('menu-open');
        mobileNav.classList.remove('active');
        menuToggle.setAttribute('aria-expanded', 'false');
        menuToggle.classList.remove('is-active');
    }
    
    // Event Listeners
    menuToggle.addEventListener('click', toggleMenu);
    navClose.addEventListener('click', closeMenu);
    
    // Close menu when clicking on a nav link
    navLinks.forEach(link => {
        link.addEventListener('click', (e) => {
            // Only close if it's a hash link (same page)
            if (link.getAttribute('href').startsWith('#')) {
                e.preventDefault();
                const targetId = link.getAttribute('href');
                const targetElement = document.querySelector(targetId);
                
                closeMenu();
                
                // Smooth scroll to section
                if (targetElement) {
                    window.scrollTo({
                        top: targetElement.offsetTop - header.offsetHeight,
                        behavior: 'smooth'
                    });
                }
            }
        });
    });
    
    // Handle header scroll effect
    let lastScroll = 0;
    
    function handleScroll() {
        const currentScroll = window.pageYOffset;
        
        // Add/remove scrolled class based on scroll position
        if (currentScroll > 10) {
            header.classList.add('scrolled');
        } else {
            header.classList.remove('scrolled');
        }
        
        // Hide/show header on scroll
        if (currentScroll <= 0) {
            header.classList.remove('scroll-up');
            return;
        }
        
        if (currentScroll > lastScroll && !header.classList.contains('scroll-down')) {
            // Scroll Down
            header.classList.remove('scroll-up');
            header.classList.add('scroll-down');
        } else if (currentScroll < lastScroll && header.classList.contains('scroll-down')) {
            // Scroll Up
            header.classList.remove('scroll-down');
            header.classList.add('scroll-up');
        }
        
        lastScroll = currentScroll;
    }
    
    // Initialize scroll handler
    window.addEventListener('scroll', handleScroll);
    handleScroll(); // Run once on load
    
    // Animate steps on scroll
    const animateOnScroll = () => {
        const steps = document.querySelectorAll('.step');
        steps.forEach((step, index) => {
            const stepPosition = step.getBoundingClientRect().top;
            const screenPosition = window.innerHeight / 1.3;
            
            if (stepPosition < screenPosition) {
                // Add delay to each step
                setTimeout(() => {
                    step.classList.add('visible');
                }, 150 * index);
            }
        });
    };

    // Initial check on load
    animateOnScroll();
    
    // Check on scroll
    window.addEventListener('scroll', animateOnScroll);
    
    // Handle file upload preview (basic implementation)
    const handleFileUpload = (event) => {
        const file = event.target.files[0];
        if (file) {
            const objectUrl = URL.createObjectURL(file);
            const preview = document.querySelector('.image-placeholder');
            preview.innerHTML = `<img src="${objectUrl}" alt="Preview" style="width: 100%; height: 100%; object-fit: cover; border-radius: 8px;">`;
            
            // Remove the loading class after a short delay for the animation
            setTimeout(() => {
                preview.classList.remove('loading');
            }, 1000);
            
            // Revoke the object URL when the image is loaded to free up memory
            const img = preview.querySelector('img');
            img.onload = function() {
                URL.revokeObjectURL(objectUrl);
            };
        }
    };

    // Initialize file input
    const fileInput = document.createElement('input');
    fileInput.type = 'file';
    fileInput.accept = 'image/*';
    fileInput.style.display = 'none';
    fileInput.addEventListener('change', handleFileUpload);
    
    // CTA button click handler removed as per request
    
    // Add touch effect to buttons
    const buttons = document.querySelectorAll('button, a');
    buttons.forEach(button => {
        button.addEventListener('touchstart', function() {
            this.classList.add('touch-active');
        });
        
        button.addEventListener('touchend', function() {
            this.classList.remove('touch-active');
        });
    });
});
