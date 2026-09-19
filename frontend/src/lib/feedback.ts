// A beep and a buzz on a good scan, so the seller doesn't have to look at the screen.

let audio: AudioContext | null = null

/**
 * Phones only let a page play sound after the user has tapped it, so this runs on the first tap
 * anywhere in the app. Without it the first scan would be silent on iPhone.
 */
export function unlockSound() {
  try {
    audio ??= new AudioContext()
    if (audio.state === 'suspended') void audio.resume()
  } catch {
    /* no Web Audio on this browser: vibration only */
  }
}

export function scanFeedback() {
  // Chrome ignores (and warns about) vibrate() before the first tap.
  if (navigator.userActivation?.hasBeenActive) navigator.vibrate?.(80)
  try {
    unlockSound()
    if (!audio) return
    const now = audio.currentTime
    const tone = audio.createOscillator()
    const volume = audio.createGain()
    tone.frequency.value = 1800 // the high "beep" of a shop scanner
    // Fade in and out quickly so the speaker doesn't click.
    volume.gain.setValueAtTime(0.0001, now)
    volume.gain.exponentialRampToValueAtTime(0.3, now + 0.01)
    volume.gain.exponentialRampToValueAtTime(0.0001, now + 0.12)
    tone.connect(volume).connect(audio.destination)
    tone.start(now)
    tone.stop(now + 0.13)
  } catch {
    /* sound is a nice-to-have; the scan itself already worked */
  }
}
