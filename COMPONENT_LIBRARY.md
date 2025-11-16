# My Benefits Help - Component Library

XLB-inspired professional design enhancements building on existing MBH foundation.

## Color Palette

### Primary Blue (from logo: #1B4571)
- `--brand-blue-500`: #1B4571 (Dark blue from logo)
- `--brand-blue-600`: #16375a (Darker blue)
- Shades available: 50-900

### Light Blue (from logo: #6CB4E3)
- `--brand-lightblue-500`: #6CB4E3 (Light blue from logo)
- `--brand-lightblue-600`: #5690b6 (Darker light blue)
- Shades available: 50-900

### Existing MBH Colors (preserved)
- `--mbh-primary`: #00529b (Strong blue)
- `--mbh-accent`: #0891b2 (Cyan)
- `--mbh-action`: #E87A5D (Terracotta CTA)

## Typography

MBH already uses clamp() for fluid typography. Extended utilities:

```html
<h1 class="text-fluid-4xl">Large Heading</h1>
<h2 class="text-fluid-3xl">Section Title</h2>
<p class="text-fluid-lg">Body text</p>
```

## Enhanced Cards

Professional cards with hover lift effects.

```html
<!-- Enhanced card with hover -->
<div class="card-enhanced">
    <h3>Card Title</h3>
    <p>Card content with automatic hover lift.</p>
</div>

<!-- Blue accent card -->
<div class="card-enhanced card-blue-accent">
    <h3>Benefits Overview</h3>
    <p>Left border in dark blue for emphasis.</p>
</div>

<!-- Light blue accent card -->
<div class="card-enhanced card-lightblue-accent">
    <h3>Service Highlight</h3>
    <p>Left border in light blue.</p>
</div>

<!-- Crisp shadow card -->
<div class="card-enhanced card-crisp">
    <h3>Bold Design</h3>
    <p>Offset shadow for distinctive look.</p>
</div>
```

**Features:**
- Automatic lift on hover (`translateY(-4px)`)
- Smooth shadow transitions
- Accent border options

## Enhanced Buttons

Building on existing `.btn` classes:

```html
<!-- Enhanced primary button -->
<a href="#" class="btn btn-primary btn-enhanced">
    Get Started
</a>

<!-- Blue glow effect -->
<a href="#" class="btn btn-primary btn-enhanced btn-blue-glow">
    Contact Us
</a>

<!-- Light blue glow effect -->
<a href="#" class="btn btn-secondary btn-enhanced btn-lightblue-glow">
    Learn More
</a>
```

## Gradient Text

```html
<h1 class="text-gradient-blue">Dark Blue Gradient</h1>
<h2 class="text-gradient-lightblue">Light Blue Gradient</h2>
<h1 class="text-gradient-brand">Blue to Light Blue</h1>
```

## Image Overlays

Hover effect with gradient overlay and sliding content.

```html
<div class="image-overlay">
    <img src="team-photo.jpg" alt="Our team">
    <div class="image-overlay-content">
        <h3>Meet Our Team</h3>
        <p>Dedicated benefits professionals ready to help</p>
    </div>
</div>
```

## Backdrop Blur

Modern glass effect for overlays and modals.

```html
<div class="backdrop-blur bg-white/90 p-6 rounded-lg">
    <h3>Important Notice</h3>
    <p>Content with blur effect behind</p>
</div>
```

**Variants:**
- `backdrop-blur-sm` - Subtle blur
- `backdrop-blur` - Standard blur
- `backdrop-blur-lg` - Heavy blur

## Section Backgrounds

Themed section styles using brand colors.

```html
<!-- Light blue background -->
<section class="section-blue">
    <div class="container">
        <h2>Section Title</h2>
    </div>
</section>

<!-- Blue gradient background -->
<section class="section-blue-gradient">
    <div class="container">
        <h2>Gradient Section</h2>
    </div>
</section>

<!-- Light blue background -->
<section class="section-lightblue">
    <div class="container">
        <h2>Light Blue Section</h2>
    </div>
</section>

<!-- Multi-color brand gradient -->
<section class="section-gradient-brand">
    <div class="container">
        <h2>Brand Colors Gradient</h2>
    </div>
</section>
```

## Animations

### Scroll Animations

```html
<div class="fade-in-up">Fades in from bottom on scroll</div>
<div class="fade-in-left">Slides in from left</div>
<div class="fade-in-right">Slides in from right</div>
<div class="scale-in">Scales up on scroll</div>
```

**Note:** Add `.visible` class via JavaScript when element enters viewport.

**JavaScript Example:**
```javascript
// Simple scroll animation trigger
const observerOptions = {
    threshold: 0.1,
    rootMargin: '0px 0px -50px 0px'
};

const observer = new IntersectionObserver((entries) => {
    entries.forEach(entry => {
        if (entry.isIntersecting) {
            entry.target.classList.add('visible');
        }
    });
}, observerOptions);

document.querySelectorAll('.fade-in-up, .fade-in-left, .fade-in-right, .scale-in').forEach(el => {
    observer.observe(el);
});
```

### Staggered List Animation

```html
<ul class="stagger-animation">
    <li class="card p-4">Item 1 (animates first)</li>
    <li class="card p-4">Item 2 (animates second)</li>
    <li class="card p-4">Item 3 (animates third)</li>
</ul>
```

### Hover Scale

```html
<img src="photo.jpg" class="hover-scale rounded">
<div class="hover-scale-sm card">Subtle scale on hover</div>
<button class="hover-scale-lg btn btn-primary">Big scale effect</button>
```

## Shadow System

```html
<!-- Professional shadow utilities -->
<div class="shadow-soft">Subtle professional shadow</div>
<div class="shadow-bold">Bold prominent shadow</div>
<div class="shadow-crisp">Offset light blue shadow</div>
<div class="shadow-deep">Deep dimensional shadow</div>
<div class="shadow-glow-blue">Dark blue glow effect</div>
<div class="shadow-glow-lightblue">Light blue glow effect</div>
```

## Brand Color Utilities

```html
<!-- Background colors -->
<div class="bg-brand-blue text-white p-4">Dark blue background</div>
<div class="bg-brand-lightblue text-white p-4">Light blue background</div>

<!-- Text colors -->
<p class="text-brand-blue">Dark blue text</p>
<p class="text-brand-lightblue">Light blue text</p>

<!-- Border colors -->
<div class="border-2 border-brand-blue">Dark blue border</div>
<div class="border-2 border-brand-lightblue">Light blue border</div>
```

## Usage Examples

### Enhanced CTA Section
```html
<section class="section-gradient-brand text-center py-16">
    <div class="container">
        <h2 class="text-gradient-brand text-fluid-4xl mb-4">
            Ready to Simplify Your Benefits?
        </h2>
        <div class="cta-trio">
            <a href="#" class="btn btn-primary btn-enhanced btn-blue-glow">
                Get Started
            </a>
            <a href="#" class="btn btn-action btn-enhanced">
                Schedule Demo
            </a>
            <a href="#" class="btn btn-secondary btn-enhanced">
                Learn More
            </a>
        </div>
    </div>
</section>
```

### Feature Cards Grid
```html
<section class="section-lightblue">
    <div class="container">
        <h2 class="text-center text-fluid-3xl mb-8">Our Services</h2>
        <div class="features-grid">
            <div class="card-enhanced card-blue-accent fade-in-up">
                <h3 class="text-gradient-blue">COBRA Administration</h3>
                <p>Comprehensive compliance and support for all your COBRA needs.</p>
            </div>
            <div class="card-enhanced card-lightblue-accent fade-in-up">
                <h3 class="text-gradient-lightblue">Benefits Support</h3>
                <p>Expert guidance for employers and employees throughout the year.</p>
            </div>
            <div class="card-enhanced card-crisp fade-in-up">
                <h3>Broker Services</h3>
                <p>Dedicated support for insurance brokers and their clients.</p>
            </div>
        </div>
    </div>
</section>
```

### Team Section with Image Overlays
```html
<section>
    <div class="container">
        <h2 class="text-center text-fluid-3xl mb-8">Our Team</h2>
        <div class="team-grid">
            <div class="image-overlay hover-scale-sm">
                <img src="team-member-1.jpg" alt="Team member">
                <div class="image-overlay-content">
                    <h3>Jennifer Smith</h3>
                    <p>Benefits Specialist</p>
                </div>
            </div>
            <!-- More team members... -->
        </div>
    </div>
</section>
```

### Gradient Hero Heading
```html
<section class="section-hero">
    <div class="container text-center">
        <h1 class="text-gradient-brand text-fluid-5xl font-bold">
            Benefits Service for Brokers & Employers
        </h1>
        <p class="subheadline text-fluid-lg max-w-3xl mx-auto">
            Nationwide, people-first benefits support without extra overhead
        </p>
    </div>
</section>
```

## CSS Variables Reference

All CSS variables are available for custom styling:

```css
/* Use brand colors */
.custom-element {
    background: var(--brand-blue-500);
    color: white;
    box-shadow: var(--shadow-glow-lightblue);
    border-radius: var(--radius-xl);
    transition: var(--transition-base);
}

/* Fluid typography */
.custom-text {
    font-size: var(--text-fluid-3xl);
}

/* Combine with existing MBH variables */
.custom-card {
    background: var(--mbh-card);
    border: 2px solid var(--brand-lightblue-500);
    color: var(--mbh-fg);
}
```

## Compatibility Notes

- **Preserves Existing Styles**: All original MBH styles remain intact
- **Additive Enhancements**: New classes work alongside existing `.card`, `.btn`, etc.
- **Accessibility**: Focus states, reduced motion support, semantic HTML
- **Mobile-First**: Responsive with fluid typography
- **Performance**: GPU-accelerated transforms, optimized animations

## Migration Tips

**Enhance existing cards:**
```html
<!-- Before -->
<div class="card">
    <h3>Title</h3>
    <p>Content</p>
</div>

<!-- After (enhanced) -->
<div class="card card-enhanced card-blue-accent fade-in-up">
    <h3>Title</h3>
    <p>Content</p>
</div>
```

**Enhance existing buttons:**
```html
<!-- Before -->
<a href="#" class="btn btn-primary">Click Me</a>

<!-- After (enhanced) -->
<a href="#" class="btn btn-primary btn-enhanced btn-blue-glow">Click Me</a>
```

Copy and adapt these components to your specific pages while maintaining consistency across the My Benefits Help site.
