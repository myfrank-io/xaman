import { clsx, type ClassValue } from "clsx";
import { extendTailwindMerge } from "tailwind-merge";

// The Xaman type scale renames the font sizes (`text-body`, `text-h1`, `text-num-lg`…).
// tailwind-merge only knows Tailwind's default names, so it would classify these as
// TEXT COLOURS and silently drop the real colour next to them
// (`cn("text-primary-foreground", "text-body")` → the colour disappears).
// Declaring them as font sizes restores both conflict resolutions.
const FONT_SIZES = [
  "overline",
  "caption",
  "label",
  "body",
  "body-lg",
  "h3",
  "h2",
  "h1",
  "display",
  "num-sm",
  "num-md",
  "num-lg",
];

const twMerge = extendTailwindMerge({
  extend: {
    classGroups: {
      "font-size": [{ text: FONT_SIZES }],
    },
  },
});

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}
