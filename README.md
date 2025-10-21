# My Benefits Help - Website

Professional benefits administration service website for My Benefits Help.

## Project Structure

```
mbh/
├── *.html              # Main website pages
├── styles.css          # Global stylesheet
├── api/                # Serverless functions (Vercel/Netlify)
│   └── send-email.js   # Contact form handler
├── Images/             # Logo and client images
├── og-image.svg        # Social media preview image (SVG)
└── .github/            # GitHub Actions workflows
    └── workflows/
        └── deploy.yml  # Automated deployment
```

## Setup Instructions

### 1. Environment Variables

Create a `.env` file based on `.env.example`:

```bash
cp .env.example .env
```

Required variables:
- `RESEND_API_KEY` - Your Resend API key for email functionality
- `RESEND_FROM_EMAIL` - Verified sender email address

### 2. Email Configuration

1. Sign up for [Resend](https://resend.com)
2. Verify your domain (`mybenefitshelp.net`)
3. Add your API key to environment variables
4. Update `RESEND_FROM_EMAIL` in `.env`

### 3. OG Image

The `og-image.svg` file needs to be converted to PNG for optimal social media sharing:

```bash
# Using rsvg-convert (recommended)
rsvg-convert -w 1200 -h 630 og-image.svg -o og-image.png

# Or using ImageMagick
convert -background none -size 1200x630 og-image.svg og-image.png

# Or use an online tool like:
# - https://cloudconvert.com/svg-to-png
# - https://svgtopng.com/
```

Alternatively, create a custom PNG in design tools like:
- Figma (1200x630px)
- Canva (Facebook Post template)
- Photoshop

### 4. Deployment

#### GitHub Pages

1. Enable GitHub Pages in repository settings
2. Set source to "GitHub Actions"
3. Push to `main` branch - automatic deployment via `.github/workflows/deploy.yml`

#### Vercel (Recommended for serverless functions)

```bash
npm install -g vercel
vercel
```

## Development

This is a static website with:
- Vanilla HTML/CSS/JavaScript (no build process)
- External CSS in `styles.css`
- Serverless functions in `api/` directory

### Local Development

Simply open any `.html` file in a browser, or use a local server:

```bash
# Python 3
python -m http.server 8000

# Node.js
npx serve

# PHP
php -S localhost:8000
```

Visit `http://localhost:8000`

## Features

- ✅ Responsive design (mobile-first)
- ✅ SEO optimized (meta tags, Open Graph, JSON-LD)
- ✅ Accessibility (ARIA labels, skip links, keyboard navigation)
- ✅ Privacy-friendly analytics (Plausible)
- ✅ Contact form with email integration (Resend)
- ✅ Automated deployment (GitHub Actions)

## Browser Support

- Chrome/Edge (latest)
- Firefox (latest)
- Safari (latest)
- Mobile browsers (iOS Safari, Chrome Mobile)

## License

All rights reserved - My Benefits Help
