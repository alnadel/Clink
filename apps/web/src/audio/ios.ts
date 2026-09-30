/** True on iPhone, iPad and iPod, including iPadOS reporting itself as a Mac. */
export function isIOS(): boolean {
  if (typeof navigator === 'undefined') return false;
  return (
    /iPad|iPhone|iPod/.test(navigator.userAgent) ||
    (navigator.platform === 'MacIntel' && navigator.maxTouchPoints > 1)
  );
}

let silentElement: HTMLAudioElement | null = null;

/**
 * iOS plays Web Audio silently when the ringer switch is on silent (NFR-05). Safari 16.4+ lets us
 * declare a playback session; older iOS needs a looping silent <audio> element. Call this inside
 * the user gesture, before ctx.resume().
 */
export function applyIosAudioSession(): void {
  if (typeof navigator === 'undefined') return;
  const session = (navigator as Navigator & { audioSession?: { type: string } }).audioSession;
  if (session) {
    session.type = 'playback';
    return;
  }
  if (!isIOS()) return;
  if (!silentElement) {
    silentElement = document.createElement('audio');
    silentElement.src = '/audio/silence.wav';
    silentElement.loop = true;
    silentElement.setAttribute('playsinline', '');
  }
  void silentElement.play().catch(() => {});
}
