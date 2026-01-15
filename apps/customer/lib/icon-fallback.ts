/**
 * Icon Fallback Utility
 * 
 * Provides fallback logic for missing PWA icons and validates icon availability.
 * Implements Requirements 4.5: Icon Fallback Handling
 */

export interface IconConfig {
  src: string;
  sizes: string;
  type: string;
  purpose?: string;
}

export class IconFallbackManager {
  private static instance: IconFallbackManager;
  private iconCache = new Map<string, boolean>();

  static getInstance(): IconFallbackManager {
    if (!IconFallbackManager.instance) {
      IconFallbackManager.instance = new IconFallbackManager();
    }
    return IconFallbackManager.instance;
  }

  /**
   * Check if an icon exists and is accessible
   */
  async checkIconExists(iconPath: string): Promise<boolean> {
    if (this.iconCache.has(iconPath)) {
      return this.iconCache.get(iconPath)!;
    }

    try {
      const response = await fetch(iconPath, { method: 'HEAD' });
      const exists = response.ok;
      this.iconCache.set(iconPath, exists);
      return exists;
    } catch {
      this.iconCache.set(iconPath, false);
      return false;
    }
  }

  /**
   * Get fallback icon for a given size
   */
  getFallbackIcon(requestedSize: string): IconConfig {
    const size = parseInt(requestedSize.split('x')[0]);
    
    // Use appropriate fallback based on requested size
    if (size <= 32) {
      return {
        src: '/favicon.ico',
        sizes: '16x16 32x32',
        type: 'image/x-icon'
      };
    } else if (size <= 192) {
      return {
        src: '/logo-192.png',
        sizes: '192x192',
        type: 'image/png'
      };
    } else {
      return {
        src: '/logo-512.png',
        sizes: '512x512',
        type: 'image/png'
      };
    }
  }

  /**
   * Validate all icons in manifest and provide fallbacks for missing ones
   */
  async validateAndFixManifestIcons(icons: IconConfig[]): Promise<IconConfig[]> {
    const validatedIcons: IconConfig[] = [];

    for (const icon of icons) {
      const exists = await this.checkIconExists(icon.src);
      
      if (exists) {
        validatedIcons.push(icon);
      } else {
        console.warn(`Icon not found: ${icon.src}, using fallback`);
        const fallback = this.getFallbackIcon(icon.sizes);
        
        // Only add fallback if it's not already in the list
        const fallbackExists = validatedIcons.some(
          existing => existing.src === fallback.src && existing.sizes === fallback.sizes
        );
        
        if (!fallbackExists) {
          validatedIcons.push({
            ...fallback,
            purpose: icon.purpose // Preserve original purpose
          });
        }
      }
    }

    return validatedIcons;
  }

  /**
   * Generate placeholder icon data URL for missing icons
   */
  generatePlaceholderIcon(size: number, text: string = 'T'): string {
    const canvas = document.createElement('canvas');
    canvas.width = size;
    canvas.height = size;
    
    const ctx = canvas.getContext('2d');
    if (!ctx) return '';

    // Draw background
    ctx.fillStyle = '#ea580c'; // Theme color
    ctx.fillRect(0, 0, size, size);

    // Draw text
    ctx.fillStyle = '#ffffff';
    ctx.font = `bold ${size * 0.6}px Arial`;
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText(text, size / 2, size / 2);

    return canvas.toDataURL('image/png');
  }

  /**
   * Clear icon cache (useful for testing or when icons are updated)
   */
  clearCache(): void {
    this.iconCache.clear();
  }
}