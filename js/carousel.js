/**
 * CW Custom Works - Photo Carousel Component
 * Professional, touch-enabled carousel for photo series
 */

class PhotoCarousel {
    constructor(element, options = {}) {
        this.carousel = element;
        this.options = {
            autoPlay: options.autoPlay !== false,
            interval: options.interval || 5000,
            pauseOnHover: options.pauseOnHover !== false,
            showDots: options.showDots !== false,
            showArrows: options.showArrows !== false,
            loop: options.loop !== false,
            ...options
        };

        this.track = this.carousel.querySelector('.carousel-track');
        this.slides = Array.from(this.track.children);
        this.currentIndex = 0;
        this.autoPlayTimer = null;
        this.touchStartX = 0;
        this.touchEndX = 0;

        this.init();
    }

    init() {
        if (this.slides.length <= 1) return;

        // Create navigation
        if (this.options.showArrows) {
            this.createArrows();
        }

        if (this.options.showDots) {
            this.createDots();
        }

        // Setup touch/swipe
        this.setupTouch();

        // Setup keyboard navigation
        this.setupKeyboard();

        // Start autoplay
        if (this.options.autoPlay) {
            this.startAutoPlay();
        }

        // Pause on hover
        if (this.options.pauseOnHover) {
            this.carousel.addEventListener('mouseenter', () => this.stopAutoPlay());
            this.carousel.addEventListener('mouseleave', () => {
                if (this.options.autoPlay) this.startAutoPlay();
            });
        }

        // Lazy load images
        this.lazyLoadImages();
    }

    createArrows() {
        const prevButton = document.createElement('button');
        prevButton.className = 'carousel-nav prev';
        prevButton.setAttribute('aria-label', 'Previous slide');
        prevButton.innerHTML = '<svg fill="none" viewBox="0 0 24 24"><path d="M15 19l-7-7 7-7" /></svg>';
        prevButton.addEventListener('click', () => this.prev());

        const nextButton = document.createElement('button');
        nextButton.className = 'carousel-nav next';
        nextButton.setAttribute('aria-label', 'Next slide');
        nextButton.innerHTML = '<svg fill="none" viewBox="0 0 24 24"><path d="M9 5l7 7-7 7" /></svg>';
        nextButton.addEventListener('click', () => this.next());

        this.carousel.appendChild(prevButton);
        this.carousel.appendChild(nextButton);
    }

    createDots() {
        const dotsContainer = document.createElement('div');
        dotsContainer.className = 'carousel-dots';

        this.slides.forEach((_, index) => {
            const dot = document.createElement('button');
            dot.className = 'carousel-dot';
            dot.setAttribute('aria-label', `Go to slide ${index + 1}`);
            if (index === 0) dot.classList.add('active');

            dot.addEventListener('click', () => this.goToSlide(index));
            dotsContainer.appendChild(dot);
        });

        this.carousel.appendChild(dotsContainer);
        this.dots = Array.from(dotsContainer.children);
    }

    setupTouch() {
        this.track.addEventListener('touchstart', (e) => {
            this.touchStartX = e.changedTouches[0].screenX;
        }, { passive: true });

        this.track.addEventListener('touchend', (e) => {
            this.touchEndX = e.changedTouches[0].screenX;
            this.handleSwipe();
        }, { passive: true });
    }

    handleSwipe() {
        const swipeThreshold = 50;
        const diff = this.touchStartX - this.touchEndX;

        if (Math.abs(diff) > swipeThreshold) {
            if (diff > 0) {
                this.next();
            } else {
                this.prev();
            }
        }
    }

    setupKeyboard() {
        this.carousel.addEventListener('keydown', (e) => {
            if (e.key === 'ArrowLeft') {
                this.prev();
            } else if (e.key === 'ArrowRight') {
                this.next();
            }
        });

        // Make carousel focusable
        this.carousel.setAttribute('tabindex', '0');
    }

    goToSlide(index) {
        this.currentIndex = index;
        this.updateCarousel();
    }

    next() {
        if (this.currentIndex < this.slides.length - 1) {
            this.currentIndex++;
        } else if (this.options.loop) {
            this.currentIndex = 0;
        }
        this.updateCarousel();
    }

    prev() {
        if (this.currentIndex > 0) {
            this.currentIndex--;
        } else if (this.options.loop) {
            this.currentIndex = this.slides.length - 1;
        }
        this.updateCarousel();
    }

    updateCarousel() {
        const offset = -this.currentIndex * 100;
        this.track.style.transform = `translateX(${offset}%)`;

        // Update dots
        if (this.dots) {
            this.dots.forEach((dot, index) => {
                dot.classList.toggle('active', index === this.currentIndex);
            });
        }

        // Reset autoplay timer
        if (this.options.autoPlay) {
            this.stopAutoPlay();
            this.startAutoPlay();
        }

        // Lazy load adjacent images
        this.lazyLoadImages();
    }

    startAutoPlay() {
        this.autoPlayTimer = setInterval(() => {
            this.next();
        }, this.options.interval);
    }

    stopAutoPlay() {
        if (this.autoPlayTimer) {
            clearInterval(this.autoPlayTimer);
            this.autoPlayTimer = null;
        }
    }

    lazyLoadImages() {
        // Load current, previous, and next images
        const indicesToLoad = [
            this.currentIndex - 1,
            this.currentIndex,
            this.currentIndex + 1
        ];

        indicesToLoad.forEach(index => {
            if (index >= 0 && index < this.slides.length) {
                const img = this.slides[index].querySelector('img[data-src]');
                if (img) {
                    img.src = img.dataset.src;
                    img.removeAttribute('data-src');
                }
            }
        });
    }

    destroy() {
        this.stopAutoPlay();
        // Remove event listeners and elements would go here
    }
}

// Initialize all carousels on page load
document.addEventListener('DOMContentLoaded', function() {
    const carousels = document.querySelectorAll('.project-carousel');
    carousels.forEach(carousel => {
        new PhotoCarousel(carousel);
    });
});

// Export for use in other scripts
if (typeof module !== 'undefined' && module.exports) {
    module.exports = PhotoCarousel;
}
