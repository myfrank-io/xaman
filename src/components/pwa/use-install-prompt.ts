"use client";

import { useCallback, useEffect, useState } from "react";

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

export type InstallState = {
  /** false until the browser has been inspected (server render, first paint). */
  ready: boolean;
  standalone: boolean;
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
      const ios =
        /iPad|iPhone|iPod/.test(navigator.userAgent) ||
        (navigator.platform === "MacIntel" && navigator.maxTouchPoints > 1);
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
      setState((current) => ({ ...current, ready: true, standalone, ios, sessions, dismissed }));
    }
    inspect();

    const onPrompt = (event: Event) => {
      event.preventDefault();
      setState((current) => ({ ...current, promptEvent: event as BeforeInstallPromptEvent }));
    };
    const onInstalled = () =>
      setState((current) => ({ ...current, standalone: true, promptEvent: null }));
    window.addEventListener("beforeinstallprompt", onPrompt);
    window.addEventListener("appinstalled", onInstalled);
    return () => {
      window.removeEventListener("beforeinstallprompt", onPrompt);
      window.removeEventListener("appinstalled", onInstalled);
    };
  }, []);

  const install = useCallback(async () => {
    const event = state.promptEvent;
    if (!event) return false;
    await event.prompt();
    const choice = await event.userChoice;
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

  const installable = state.ready && !state.standalone && (state.ios || state.promptEvent !== null);
  return {
    ...state,
    installable,
    bannerEligible: installable && !state.dismissed && state.sessions >= MIN_SESSIONS,
    install,
    dismiss,
  };
}
