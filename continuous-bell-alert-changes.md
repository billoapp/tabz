# Continuous Bell Alert Implementation

## Overview
Modified the staff app bell alert system to play continuously until the screen is clicked, ensuring staff don't miss important customer orders or messages.

## Changes Made

### 1. Enhanced `playAlertSound` Function
- Added `continuous` parameter to enable continuous sound playback
- Split into multiple functions for better organization:
  - `playAlertSound()` - Main function with continuous option
  - `playDefaultBellSound()` - Single bell sound
  - `startContinuousBellSound()` - Continuous bell loop
  - `stopContinuousAlertSound()` - Stop all continuous sounds

### 2. Continuous Sound Implementation
**For Custom Audio:**
- Uses `audio.loop = true` for seamless looping
- Stores reference in `window.continuousAlertAudio` for cleanup

**For Default Bell Sound:**
- Creates a repeating loop with 1.5-second intervals
- Uses `window.continuousBellActive` flag to control the loop
- Uses `window.continuousBellTimeout` for cleanup

### 3. Updated Alert Dismissal
**HighVisibilityAlert Component:**
- Modified `onClick` handler to call `stopContinuousAlertSound()`
- Updated UI text to indicate continuous sound
- Removed countdown timer, replaced with "🔔 Sound playing continuously"

**ESC Key Handler:**
- Added `stopContinuousAlertSound()` call when ESC is pressed

### 4. Alert Triggers Updated
**Customer Order Alerts:**
- Now use `continuous: true` parameter
- Removed auto-hide timeout (sound continues until dismissed)

**Customer Message Alerts:**
- Now use `continuous: true` parameter  
- Removed auto-hide timeout

**Test Button:**
- Updated to use continuous sound for testing

### 5. Cleanup Implementation
- Added cleanup in component unmount effect
- Stops continuous sounds when component is destroyed
- Prevents memory leaks and orphaned sounds

## How It Works

### When Alert Triggers:
1. Customer places order or sends message
2. `playAlertSound()` called with `continuous: true`
3. Sound starts playing in a loop (every 1.5 seconds for default bell)
4. Visual alert overlay appears
5. Sound continues indefinitely

### When Alert is Dismissed:
1. User clicks anywhere on screen or presses ESC
2. `stopContinuousAlertSound()` is called
3. All continuous sounds are stopped
4. Visual alert disappears
5. Normal operation resumes

## Technical Details

### Global Variables Used:
- `window.continuousAlertAudio` - Reference to looping custom audio
- `window.continuousBellActive` - Flag to control bell loop
- `window.continuousBellTimeout` - Timeout reference for cleanup

### Sound Timing:
- Default bell: 1-second duration, 1.5-second intervals
- Custom audio: Seamless looping
- Vibration: 3 short buzzes on initial trigger only

## Benefits
1. **No Missed Alerts** - Sound continues until acknowledged
2. **Immediate Attention** - Staff must actively dismiss the alert
3. **Flexible** - Works with both custom audio and default bell sounds
4. **Clean Cleanup** - Prevents orphaned sounds and memory leaks
5. **User Control** - Easy dismissal with click or ESC key

## Testing
Use the bell icon test button in the staff header to trigger a continuous alert and verify:
- Sound plays continuously
- Visual alert shows "Sound playing continuously"
- Clicking anywhere stops sound and dismisses alert
- ESC key stops sound and dismisses alert