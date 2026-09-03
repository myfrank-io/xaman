/**
 * Captures `beforeinstallprompt` before React exists.
 *
 * Chrome fires it once, a moment after load, and never again for that page load. The hook that
 * used to listen for it lives in the account menu — a client component that only exists inside
 * a boat, and that mounts after hydration. So on the landing page nothing listened at all, and
 * everywhere else the event usually arrived before the listener did: it was dropped, and the
 * install dialog fell back to « dans le menu du navigateur », which is why tapping « Installer »
 * appeared to do nothing.
 *
 * This runs inline in the document head, so it is listening while the HTML is still parsing.
 * It parks the event on `window` and announces it, and the hook reads both.
 */
export const INSTALL_PROMPT_KEY = "__xamanInstallPrompt";
export const INSTALL_PROMPT_EVENT = "xaman:installprompt";

export const installPromptCapture = `(function(){var w=window;w.${INSTALL_PROMPT_KEY}=w.${INSTALL_PROMPT_KEY}||null;w.addEventListener("beforeinstallprompt",function(e){e.preventDefault();w.${INSTALL_PROMPT_KEY}=e;w.dispatchEvent(new Event("${INSTALL_PROMPT_EVENT}"))});w.addEventListener("appinstalled",function(){w.${INSTALL_PROMPT_KEY}=null;w.dispatchEvent(new Event("${INSTALL_PROMPT_EVENT}"))})})();`;
