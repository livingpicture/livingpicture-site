// Currency configuration
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

// Current currency (default to ILS)
let currentCurrency = 'ILS';

// Function to update prices based on selected currency
function updatePricing() {
    const currencySymbol = CURRENCIES[currentCurrency]?.symbol || '₪';
    
    // Update all price elements
    document.querySelectorAll('.tier-price .amount').forEach(priceElement => {
        const tier = priceElement.closest('.price-tier').getAttribute('data-tier');
        const price = PRICING[tier]?.[currentCurrency] || 0;
        priceElement.textContent = `${currencySymbol}${price}`;
        priceElement.setAttribute('data-currency', currentCurrency);
    });
    
    // Update currency selector if it exists
    const currencySelect = document.getElementById('pricing-currency');
    if (currencySelect) {
        currencySelect.value = currentCurrency;
    }
}

// Function to create currency selector
document.addEventListener('DOMContentLoaded', function() {
    // Create currency selector if it doesn't exist
    const currencySelectorContainer = document.getElementById('pricing-currency-selector');
    if (currencySelectorContainer && !document.getElementById('pricing-currency')) {
        const select = document.createElement('select');
        select.id = 'pricing-currency';
        select.className = 'currency-select';
        
        // Add currency options
        Object.entries(CURRENCIES).forEach(([code, currency]) => {
            const option = document.createElement('option');
            option.value = code;
            option.textContent = `${code} (${currency.symbol})`;
            select.appendChild(option);
        });
        
        // Set default value
        select.value = currentCurrency;
        
        // Add event listener
        select.addEventListener('change', (e) => {
            currentCurrency = e.target.value;
            updatePricing();
            // Save to localStorage for consistency
            localStorage.setItem('preferredCurrency', currentCurrency);
        });
        
        currencySelectorContainer.appendChild(select);
    }
    
    // Load saved currency preference
    const savedCurrency = localStorage.getItem('preferredCurrency');
    if (savedCurrency && CURRENCIES[savedCurrency]) {
        currentCurrency = savedCurrency;
    }
    
    // Initial price update
    updatePricing();
    
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
