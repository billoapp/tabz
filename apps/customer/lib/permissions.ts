// Enhanced permission system for Android/iOS system dialogs
export const requestSystemPermissions = async () => {
  const permissions = {
    vibration: false,
    notification: false,
    sound: false
  };

  try {
    // Request notification permission (triggers system dialog)
    if ('Notification' in window && Notification.permission === 'default') {
      const notificationPermission = await Notification.requestPermission();
      permissions.notification = notificationPermission === 'granted';
      console.log('🔔 Notification permission:', notificationPermission);
    } else if ('Notification' in window) {
      permissions.notification = Notification.permission === 'granted';
    }

    // Request vibration permission (triggers system dialog on Android)
    if ('vibrate' in navigator) {
      try {
        // Test vibration to trigger permission dialog on some Android versions
        await navigator.vibrate(10);
        permissions.vibration = true;
        console.log('📳 Vibration permission granted');
      } catch (error) {
        console.log('📳 Vibration permission denied:', error);
        permissions.vibration = false;
      }
    }

    // Check if we can play audio (may trigger permission dialog)
    try {
      const audioContext = new (window.AudioContext || (window as any).webkitAudioContext)();
      if (audioContext.state === 'suspended') {
        await audioContext.resume();
        console.log('🔊 Audio context resumed');
      }
      permissions.sound = audioContext.state === 'running';
    } catch (error) {
      console.log('🔊 Audio permission error:', error);
      permissions.sound = false;
    }

  } catch (error) {
    console.error('❌ Error requesting system permissions:', error);
  }

  return permissions;
};

// Check if all permissions are granted
export const checkPermissions = () => {
  const permissions = {
    notification: false,
    vibration: false,
    sound: false
  };

  // Check notification permission
  if ('Notification' in window) {
    permissions.notification = Notification.permission === 'granted';
  }

  // Check vibration support
  if ('vibrate' in navigator) {
    permissions.vibration = true; // Vibration API doesn't have permission state
  }

  // Check audio context
  try {
    const audioContext = new (window.AudioContext || (window as any).webkitAudioContext)();
    permissions.sound = audioContext.state === 'running';
  } catch (error) {
    permissions.sound = false;
  }

  return permissions;
};

// Show user-friendly permission status
export const showPermissionStatus = () => {
  const perms = checkPermissions();
  
  console.log('📋 Permission Status:');
  console.log('🔔 Notifications:', perms.notification ? '✅ Granted' : '❌ Denied');
  console.log('📳 Vibration:', perms.vibration ? '✅ Supported' : '❌ Not Supported');
  console.log('🔊 Audio:', perms.sound ? '✅ Allowed' : '❌ Blocked');
  
  return perms;
};
