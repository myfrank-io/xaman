import { describe, expect, it } from "vitest";

import { canPrompt, detectPlatform } from "@/components/pwa/platform";

/**
 * Real user-agent strings, because the whole point of this function is that guessing at them
 * is what produced « Dans Chrome ou Edge : l'icône d'installation… » on a Mac running Safari.
 */
const UA = {
  iphoneSafari:
    "Mozilla/5.0 (iPhone; CPU iPhone OS 18_1 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/18.1 Mobile/15E148 Safari/604.1",
  iphoneChrome:
    "Mozilla/5.0 (iPhone; CPU iPhone OS 18_1 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) CriOS/130.0 Mobile/15E148 Safari/604.1",
  ipadOS:
    "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.0 Safari/605.1.15",
  macSafari:
    "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/18.0 Safari/605.1.15",
  macChrome:
    "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/130.0.0.0 Safari/537.36",
  macEdge:
    "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/130.0.0.0 Safari/537.36 Edg/130.0.0.0",
  macFirefox:
    "Mozilla/5.0 (Macintosh; Intel Mac OS X 10.15; rv:132.0) Gecko/20100101 Firefox/132.0",
  androidChrome:
    "Mozilla/5.0 (Linux; Android 14; Pixel 8) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/130.0.0.0 Mobile Safari/537.36",
  androidSamsung:
    "Mozilla/5.0 (Linux; Android 14; SM-S918B) AppleWebKit/537.36 (KHTML, like Gecko) SamsungBrowser/26.0 Chrome/122.0.0.0 Mobile Safari/537.36",
  windowsChrome:
    "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/130.0.0.0 Safari/537.36",
};

describe("which browser, and how does one install in it", () => {
  it("places an iPhone, whichever browser is wrapped around WebKit", () => {
    expect(detectPlatform(UA.iphoneSafari, "iPhone", 5)).toBe("ios");
    // Chrome on iOS is Safari underneath: no prompt event there either.
    expect(detectPlatform(UA.iphoneChrome, "iPhone", 5)).toBe("ios");
  });

  it("places an iPad that claims to be a Mac", () => {
    // iPadOS 13+ reports MacIntel; only the touch points tell it apart from a laptop.
    expect(detectPlatform(UA.ipadOS, "MacIntel", 5)).toBe("ios");
  });

  it("tells macOS Safari from a Mac running Chromium — the case that was wrong", () => {
    expect(detectPlatform(UA.macSafari, "MacIntel", 0)).toBe("macSafari");
    expect(detectPlatform(UA.macChrome, "MacIntel", 0)).toBe("chromium");
    expect(detectPlatform(UA.macEdge, "MacIntel", 0)).toBe("chromium");
  });

  it("places every Chromium that hides behind « Safari » in its user agent", () => {
    expect(detectPlatform(UA.androidChrome, "Linux armv8l", 5)).toBe("chromium");
    expect(detectPlatform(UA.androidSamsung, "Linux armv8l", 5)).toBe("chromium");
    expect(detectPlatform(UA.windowsChrome, "Win32", 0)).toBe("chromium");
  });

  it("names Firefox rather than sending someone hunting for a menu it does not have", () => {
    expect(detectPlatform(UA.macFirefox, "MacIntel", 0)).toBe("firefox");
  });

  it("falls back rather than guessing", () => {
    expect(detectPlatform("something/1.0", "", 0)).toBe("other");
  });

  it("only Chromium can hand us a prompt to replay", () => {
    expect(canPrompt("chromium")).toBe(true);
    for (const platform of ["ios", "macSafari", "firefox", "other"] as const) {
      expect(canPrompt(platform), platform).toBe(false);
    }
  });
});
