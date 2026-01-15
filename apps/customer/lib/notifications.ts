// Customer notification system with sound and vibration support
export const playCustomerNotification = (soundEnabled: boolean, vibrationEnabled: boolean) => {
  try {
    // Vibrate for mobile devices (works for all users including anon)
    if (vibrationEnabled && 'vibrate' in navigator) {
      // Vibration pattern: [duration, pause, duration, pause, ...]
      navigator.vibrate([300, 150, 300]); // 2 longer buzzes for customer notifications
    }
    
    if (soundEnabled) {
      // Play a simple notification sound using Web Audio API
      const audioContext = new (window.AudioContext || (window as any).webkitAudioContext)();
      const oscillator = audioContext.createOscillator();
      const gainNode = audioContext.createGain();

      oscillator.connect(gainNode);
      gainNode.connect(audioContext.destination);

      // Friendly notification sound (different from staff alert)
      oscillator.frequency.setValueAtTime(600, audioContext.currentTime);
      oscillator.frequency.exponentialRampToValueAtTime(800, audioContext.currentTime + 0.2);
      oscillator.frequency.exponentialRampToValueAtTime(600, audioContext.currentTime + 0.4);
      
      // Volume envelope
      gainNode.gain.setValueAtTime(0, audioContext.currentTime);
      gainNode.gain.linearRampToValueAtTime(0.2, audioContext.currentTime + 0.05);
      gainNode.gain.exponentialRampToValueAtTime(0.001, audioContext.currentTime + 0.5);
      
      oscillator.start();
      oscillator.stop(audioContext.currentTime + 0.5);
    }
  } catch (error) {
    console.log('Could not play customer notification:', error);
  }
};

// Check if device supports vibration
export const isVibrationSupported = () => {
  return 'vibrate' in navigator;
};

// Request vibration permissions (mainly for Android)
export const requestVibrationPermission = async () => {
  // Vibration API doesn't require explicit permission on most platforms
  // But on some Android versions, we may need to trigger it with a test vibration
  if (isVibrationSupported()) {
    try {
      // Test vibration to trigger permission prompt on some devices
      await navigator.vibrate(10);
      return true;
    } catch (error) {
      console.log('Vibration permission denied or not supported:', error);
      return false;
    }
  }
  return false;
};
