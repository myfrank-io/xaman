"use client";

import { useCallback, useEffect, useState } from "react";

import { INSTALL_PROMPT_EVENT, INSTALL_PROMPT_KEY } from "@/components/pwa/install-prompt-capture";
import { canPrompt, detectPlatform, type InstallPlatform } from "@/components/pwa/platform";

const SESSIONS_KEY = "xaman.pwa.sessions";
const COUNTED_KEY = "xaman.pwa.counted";
const DISMISSED_KEY = "xaman.pwa.installDismissedUntil";
const DISMISS_DAYS = 30;
// The banner waits for the second session: on the first visit nobody installs anything.
const MIN_SESSIONS = 2;

type BeforeInstallPromptEvent = Event & {
  prompt: () => Promise<void>;
  userChoice: Promise<{ outcome: "accepted" | "dismissed" }>;
};

/** What the inline capture in the document head parked for us (see install-prompt-capture). */
function parkedPrompt(): BeforeInstallPromptEvent | null {
  return (
    ((window as unknown as Record<string, unknown>)[INSTALL_PROMPT_KEY] as
      BeforeInstallPromptEvent | undefined) ?? null
  );
}

export type InstallState = {
  /** false until the browser has been inspected (server render, first paint). */
  ready: boolean;
  standalone: boolean;
  /** Which browser, and therefore which gesture installs an app in it. */
  platform: InstallPlatform;
  /** Kept for the callers that only ask « is this an iPhone ». */
  ios: boolean;
  sessions: number;
  dismissed: boolean;
  promptEvent: BeforeInstallPromptEvent | null;
};

/**
 * Install affordance (E7-2, flow j). iOS has no install prompt: the banner explains
 * « Partager → Sur l'écran d'accueil ». Chromium browsers fire `beforeinstallprompt`,
 * captured here and replayed on demand.
 */
export function useInstallPrompt() {
  const [state, setState] = useState<InstallState>({
    ready: false,
    standalone: false,
    platform: "other",
    ios: false,
    sessions: 0,
    dismissed: false,
    promptEvent: null,
  });

  useEffect(() => {
    function inspect() {
      const standalone =
        window.matchMedia("(display-mode: standalone)").matches ||
        (navigator as Navigator & { standalone?: boolean }).standalone === true;
      const platform = detectPlatform(
        navigator.userAgent,
        navigator.platform,
        navigator.maxTouchPoints,
      );
      let sessions = 0;
      let dismissed = false;
      try {
        sessions = Number(localStorage.getItem(SESSIONS_KEY) ?? "0");
        if (!sessionStorage.getItem(COUNTED_KEY)) {
          sessions += 1;
          localStorage.setItem(SESSIONS_KEY, String(sessions));
          sessionStorage.setItem(COUNTED_KEY, "1");
        }
        dismissed = Number(localStorage.getItem(DISMISSED_KEY) ?? "0") > Date.now();
      } catch {
        // storage blocked (private mode): behave as a first session
      }
      setState((current) => ({
        ...current,
        ready: true,
        standalone,
        platform,
        ios: platform === "ios",
        sessions,
        dismissed,
        // The event has almost always fired before this component mounts, so read it rather
        // than wait for it.
        promptEvent: current.promptEvent ?? parkedPrompt(),
      }));
    }
    inspect();

    const onPrompt = (event: Event) => {
      event.preventDefault();
      setState((current) => ({ ...current, promptEvent: event as BeforeInstallPromptEvent }));
    };
    // Re-read after the inline capture announces one: it can arrive after this mount too.
    const onParked = () => setState((current) => ({ ...current, promptEvent: parkedPrompt() }));
    const onInstalled = () =>
      setState((current) => ({ ...current, standalone: true, promptEvent: null }));
    window.addEventListener("beforeinstallprompt", onPrompt);
    window.addEventListener(INSTALL_PROMPT_EVENT, onParked);
    window.addEventListener("appinstalled", onInstalled);
    return () => {
      window.removeEventListener("beforeinstallprompt", onPrompt);
      window.removeEventListener(INSTALL_PROMPT_EVENT, onParked);
      window.removeEventListener("appinstalled", onInstalled);
    };
  }, []);

  const install = useCallback(async () => {
    const event = state.promptEvent;
    if (!event) return false;
    await event.prompt();
    const choice = await event.userChoice;
    // The event is single-use: drop the parked copy as well, or reopening the dialog would
    // offer a button that can no longer prompt.
    (window as unknown as Record<string, unknown>)[INSTALL_PROMPT_KEY] = null;
    setState((current) => ({ ...current, promptEvent: null }));
    return choice.outcome === "accepted";
  }, [state.promptEvent]);

  const dismiss = useCallback(() => {
    try {
      localStorage.setItem(DISMISSED_KEY, String(Date.now() + DISMISS_DAYS * 86_400_000));
    } catch {
      // ignore
    }
    setState((current) => ({ ...current, dismissed: true }));
  }, []);

  /**
   * Installable means « there is a way in from here », by our button or by the system menu.
   * Safari has no prompt event on either platform but installs perfectly well by hand; Firefox
   * installs no web app on desktop, so claiming otherwise would only waste a tap.
   */
  const byHand = state.platform === "ios" || state.platform === "macSafari";
  const installable =
    state.ready &&
    !state.standalone &&
    (byHand || (canPrompt(state.platform) && state.promptEvent !== null));
  return {
    ...state,
    installable,
    bannerEligible: installable && !state.dismissed && state.sessions >= MIN_SESSIONS,
    install,
    dismiss,
  };
}
