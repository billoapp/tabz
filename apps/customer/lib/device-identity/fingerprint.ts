/**
 * Robust, privacy-conscious fingerprinting
 */

export class DeviceFingerprint {
  static generate(): string {
    const components = this.getFingerprintComponents();
    return this.hashComponents(components);
  }
  
  private static getFingerprintComponents(): Record<string, any> {
    return {
      // Browser capabilities (stable)
      capabilities: {
        timezone: Intl.DateTimeFormat().resolvedOptions().timeZone,
        language: navigator.language,
        languages: navigator.languages,
        platform: navigator.platform,
        
        // Screen (very stable)
        screen: {
          width: screen.width,
          height: screen.height,
          colorDepth: screen.colorDepth,
          pixelRatio: window.devicePixelRatio || 1,
          orientation: screen.orientation?.type || 'unknown'
        },
        
        // Hardware hints (fairly stable)
        hardware: {
          concurrency: navigator.hardwareConcurrency || 0,
          memory: (navigator as any).deviceMemory || 0,
          maxTouchPoints: navigator.maxTouchPoints || 0
        },
        
        // Browser features
        features: {
          cookies: navigator.cookieEnabled,
          online: navigator.onLine,
          touch: 'ontouchstart' in window,
          serviceWorker: 'serviceWorker' in navigator,
          webgl: this.detectWebGL(),
          webrtc: this.detectWebRTC(),
          notifications: 'Notification' in window,
          geolocation: 'geolocation' in navigator
        },
        
        // Media capabilities
        media: {
          audio: this.detectAudioContext(),
          video: this.detectVideoCodecs()
        }
      },
      
      // Timing-based entropy (unique per instance)
      entropy: {
        time: Date.now(),
        perf: performance.now(),
        math: Math.random(),
        crypto: this.getCryptoRandom()
      }
    };
  }
  
  private static detectWebGL(): string {
    try {
      const canvas = document.createElement('canvas');
      const gl = canvas.getContext('webgl') || canvas.getContext('experimental-webgl');
      if (!gl) return 'no-webgl';
      
      const debugInfo = (gl as WebGLRenderingContext).getExtension('WEBGL_debug_renderer_info');
      if (debugInfo) {
        const renderer = (gl as WebGLRenderingContext).getParameter(debugInfo.UNMASKED_RENDERER_WEBGL);
        const vendor = (gl as WebGLRenderingContext).getParameter(debugInfo.UNMASKED_VENDOR_WEBGL);
        return `${vendor}-${renderer}`.slice(0, 100).replace(/\s+/g, '_');
      }
      return 'webgl-no-info';
    } catch {
      return 'webgl-error';
    }
  }
  
  private static detectWebRTC(): boolean {
    return !!(window.RTCPeerConnection || (window as any).mozRTCPeerConnection);
  }
  
  private static detectAudioContext(): string {
    try {
      const AudioContext = window.AudioContext || (window as any).webkitAudioContext;
      if (AudioContext) {
        const context = new AudioContext();
        const dest = context.destination;
        return 'audio-available';
      }
      return 'no-audio';
    } catch {
      return 'audio-error';
    }
  }
  
  private static detectVideoCodecs(): string[] {
    const codecs = [];
    const video = document.createElement('video');
    
    if (video.canPlayType) {
      if (video.canPlayType('video/mp4; codecs="avc1.42E01E"')) codecs.push('h264');
      if (video.canPlayType('video/webm; codecs="vp8, vorbis"')) codecs.push('vp8');
      if (video.canPlayType('video/webm; codecs="vp9"')) codecs.push('vp9');
      if (video.canPlayType('video/ogg; codecs="theora"')) codecs.push('theora');
    }
    
    return codecs;
  }
  
  private static getCryptoRandom(): string {
    try {
      const array = new Uint8Array(4);
      crypto.getRandomValues(array);
      return Array.from(array).map(b => b.toString(16).padStart(2, '0')).join('');
    } catch {
      return '';
    }
  }
  
  private static hashComponents(components: Record<string, any>): string {
    // Simple, fast hash for fingerprint
    const str = JSON.stringify(components);
    let hash = 5381;
    
    for (let i = 0; i < str.length; i++) {
      hash = (hash * 33) ^ str.charCodeAt(i);
    }
    
    // Convert to base36 for compact representation
    return 'fp_' + (hash >>> 0).toString(36);
  }
  
  static async getStableIdentifier(): Promise<string> {
    return new Promise((resolve) => {
      // Generate initial fingerprint
      const fingerprint = this.generate();
      
      // Try to get persistent storage ID if available
      this.getPersistentStorageId()
        .then(persistentId => {
          if (persistentId) {
            // Combine with fingerprint for extra uniqueness
            resolve(`stable_${persistentId}_${fingerprint.slice(0, 8)}`);
          } else {
            resolve(fingerprint);
          }
        })
        .catch(() => {
          resolve(fingerprint);
        });
    });
  }
  
  private static async getPersistentStorageId(): Promise<string | null> {
    try {
      // Try to use StorageManager API if available
      if (navigator.storage && navigator.storage.persist) {
        const isPersisted = await navigator.storage.persist();
        if (isPersisted) {
          // Generate a unique ID based on storage persistence
          const storageId = 'ps_' + Date.now().toString(36) + 
                           Math.random().toString(36).substring(2, 10);
          return storageId;
        }
      }
      return null;
    } catch {
      return null;
    }
  }
  
  static testFingerprintStability(previousFingerprint?: string): {
    stable: boolean;
    reason?: string;
    newFingerprint: string;
  } {
    const currentFingerprint = this.generate();
    
    if (!previousFingerprint) {
      return {
        stable: true,
        newFingerprint: currentFingerprint
      };
    }
    
    // Compare fingerprints (allowing for minor changes)
    const stabilityScore = this.compareFingerprints(previousFingerprint, currentFingerprint);
    
    return {
      stable: stabilityScore > 0.7, // 70% similarity threshold
      reason: stabilityScore <= 0.7 ? 'Fingerprint changed significantly' : undefined,
      newFingerprint: currentFingerprint
    };
  }
  
  private static compareFingerprints(fp1: string, fp2: string): number {
    // Simple string similarity (Levenshtein distance ratio)
    const longer = fp1.length > fp2.length ? fp1 : fp2;
    const shorter = fp1.length > fp2.length ? fp2 : fp1;
    
    if (longer.length === 0) return 1.0;
    
    const distance = this.levenshteinDistance(longer, shorter);
    return (longer.length - distance) / longer.length;
  }
  
  private static levenshteinDistance(a: string, b: string): number {
    const matrix = Array(a.length + 1).fill(null).map(() => Array(b.length + 1).fill(null));
    
    for (let i = 0; i <= a.length; i++) matrix[i][0] = i;
    for (let j = 0; j <= b.length; j++) matrix[0][j] = j;
    
    for (let i = 1; i <= a.length; i++) {
      for (let j = 1; j <= b.length; j++) {
        const cost = a[i - 1] === b[j - 1] ? 0 : 1;
        matrix[i][j] = Math.min(
          matrix[i - 1][j] + 1,
          matrix[i][j - 1] + 1,
          matrix[i - 1][j - 1] + cost
        );
      }
    }
    
    return matrix[a.length][b.length];
  }
}