/**
 * Sound Guy Productions - Scroll Animation Controller
 * Triggers fade-in and stagger animations on scroll
 */

document.addEventListener('DOMContentLoaded', function() {
    // Configuration for Intersection Observer
    const observerOptions = {
        threshold: 0.1,
        rootMargin: '0px 0px -50px 0px'
    };

    // Create observer for scroll animations
    const scrollObserver = new IntersectionObserver((entries) => {
        entries.forEach(entry => {
            if (entry.isIntersecting) {
                entry.target.classList.add('visible');

                // Optional: Stop observing after animation triggers (performance)
                // scrollObserver.unobserve(entry.target);
            }
        });
    }, observerOptions);

    // Observe all fade-in elements
    const fadeElements = document.querySelectorAll(
        '.fade-in-up, .fade-in-left, .fade-in-right, .scale-in, .stagger-animation'
    );

    fadeElements.forEach(el => {
        scrollObserver.observe(el);
    });

    // Log animation initialization in development
    if (window.location.hostname === 'localhost' || window.location.hostname === '127.0.0.1') {
        console.log(`SGP Animations: Observing ${fadeElements.length} elements`);
    }
});

/**
 * Optional: Add smooth scroll behavior to anchor links
 */
document.querySelectorAll('a[href^="#"]').forEach(anchor => {
    anchor.addEventListener('click', function (e) {
        const href = this.getAttribute('href');

        // Don't prevent default for # only links
        if (href === '#') return;

        const target = document.querySelector(href);
        if (target) {
            e.preventDefault();
            target.scrollIntoView({
                behavior: 'smooth',
                block: 'start'
            });
        }
    });
});
