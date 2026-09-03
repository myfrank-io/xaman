/**
 * Which browser is this, and how does one install an app in it?
 *
 * There used to be two branches — iOS and « everything else » — and « everything else » was
 * given Chrome's instructions. On a Mac in Safari that names a menu entry that does not exist,
 * which is how « ça ne download rien » happens: the text is not wrong about Chrome, it is
 * simply not about the browser in front of you.
 *
 * Safari never fires `beforeinstallprompt`, on either platform, so there will never be an
 * in-app button there — the honest answer is the system gesture, named exactly.
 *
 * A pure function of what the browser reports, so it can be tested against real user-agent
 * strings instead of being discovered on somebody's laptop.
 */
export type InstallPlatform =
  /** iPhone / iPad: Partager → Sur l'écran d'accueil. No prompt event, ever. */
  | "ios"
  /** macOS Safari 17+: Partager → Ajouter au Dock. No prompt event, ever. */
  | "macSafari"
  /** Chrome, Edge, and the rest of Chromium: `beforeinstallprompt`, or the address-bar icon. */
  | "chromium"
  /** Firefox installs no web app on desktop; saying so beats sending someone hunting. */
  | "firefox"
  /** Anything we cannot place: fall back to the generic wording. */
  | "other";

export function detectPlatform(
  userAgent: string,
  platform: string,
  maxTouchPoints: number,
): InstallPlatform {
  // An iPad on iPadOS 13+ reports itself as a Mac; the touch points give it away.
  const isIos =
    /iPad|iPhone|iPod/.test(userAgent) || (platform === "MacIntel" && maxTouchPoints > 1);
  if (isIos) return "ios";
  if (/Firefox\/|FxiOS/.test(userAgent)) return "firefox";
  // Every Chromium browser carries « Safari » in its user agent, so Safari is what is left
  // once they are all excluded — Chrome, Edge (Edg), Opera (OPR) and Samsung Internet.
  const isChromium = /Chrome\/|Chromium\/|Edg\/|OPR\/|SamsungBrowser\//.test(userAgent);
  if (isChromium) return "chromium";
  if (/Safari\//.test(userAgent) && /Mac/.test(platform)) return "macSafari";
  return "other";
}

/** Browsers that can hand us a `beforeinstallprompt` to replay behind our own button. */
export function canPrompt(platform: InstallPlatform): boolean {
  return platform === "chromium";
}
