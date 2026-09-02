// Fake data for the visual gallery and the dashboard mock-up: no seed, no database.
export const SAMPLE_CATEGORIES = [
  { id: "engines", name: "Moteurs", color: "#D97706", icon: "cog" },
  { id: "daggerboards", name: "Dérives & Safrans", color: "#0284C7", icon: "ship-wheel" },
  { id: "sails", name: "Voiles & Gréement", color: "#A21CAF", icon: "wind" },
  { id: "hull", name: "Coque & Pont", color: "#52606F", icon: "ship" },
  { id: "electronics", name: "Électronique / Nav", color: "#1D4ED8", icon: "radar" },
  { id: "energy", name: "Énergie", color: "#A16207", icon: "zap" },
  { id: "plumbing", name: "Hydraulique & Circuits", color: "#0F766E", icon: "droplets" },
  { id: "safety", name: "Sécurité", color: "#C81E2B", icon: "life-buoy" },
] as const;

export const NEUTRALS = [
  ["--n-0", "#FFFFFF", "cartes"],
  ["--n-25", "#F7F9FB", "fond d'app"],
  ["--n-50", "#EFF3F7", "surface 2"],
  ["--n-100", "#E3E9F0", "séparateur"],
  ["--n-200", "#D2DAE4", "bordure"],
  ["--n-300", "#B3BECC", "champ"],
  ["--n-400", "#8A99AC", "icône"],
  ["--n-500", "#63748A", "placeholder"],
  ["--n-600", "#4A5B72", "texte 2"],
  ["--n-700", "#36465C", "texte fort"],
  ["--n-800", "#1E3A5F", "navy clair"],
  ["--n-900", "#142944", "barre d'état"],
  ["--n-950", "#0C1B33", "encre"],
] as const;
