# PWA Icon Generation Guide

This document describes how to generate the missing PWA icons for the Tabeza Customer app.

## Required Icon Sizes

The PWA manifest requires the following icon sizes:
- 16x16 (favicon.ico) ✅ Already exists
- 192x192 ✅ Already exists  
- 512x512 ✅ Already exists

## Additional Recommended Sizes

For better PWA support across devices, consider generating:
- 72x72 (Android home screen)
- 96x96 (Android home screen)
- 128x128 (Chrome Web Store)
- 144x144 (Windows tiles)
- 152x152 (iOS home screen)
- 180x180 (iOS home screen)
- 384x384 (Android splash screen)

## Maskable Icons

The current icons are set up to work as both regular and maskable icons. For better Android support, consider creating dedicated maskable versions with:
- Safe zone: 40% of the icon size from each edge
- Centered logo within the safe zone
- Solid background color matching the theme

## Generation Tools

You can use online tools or command-line utilities:

### Online Tools
- [PWA Asset Generator](https://www.pwabuilder.com/imageGenerator)
- [Favicon Generator](https://favicon.io/)
- [App Icon Generator](https://appicon.co/)

### Command Line (ImageMagick)
```bash
# Generate from source logo
convert logo.png -resize 72x72 logo-72.png
convert logo.png -resize 96x96 logo-96.png
convert logo.png -resize 128x128 logo-128.png
convert logo.png -resize 144x144 logo-144.png
convert logo.png -resize 152x152 logo-152.png
convert logo.png -resize 180x180 logo-180.png
convert logo.png -resize 384x384 logo-384.png
```

## Fallback Implementation

The current manifest.json is configured to use existing icons as fallbacks. The browser will automatically scale icons if exact sizes aren't available.

## Icon Validation

After generating icons, validate them using:
- [PWA Builder](https://www.pwabuilder.com/)
- Chrome DevTools > Application > Manifest
- [Lighthouse PWA audit](https://developers.google.com/web/tools/lighthouse)