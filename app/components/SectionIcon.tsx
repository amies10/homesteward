const ICON_PATHS: Record<string, string[]> = {
  exterior: ["M3 9.5 12 3l9 6.5V21H3z", "M9 21v-8h6v8"],
  roofing: ["M2 12 12 4l10 8", "M4 11v9h16v-9"],
  structure: ["M3 21h18", "M5 21V7l7-4 7 4v14", "M9 21v-6h6v6"],
  attic: ["M3 10 12 3l9 7", "M5 9v11h14V9"],
  interior: ["M4 12h16"],
  hvac: [
    "M12 2v4M12 18v4M4.9 4.9l2.8 2.8M16.3 16.3l2.8 2.8M2 12h4M18 12h4M4.9 19.1l2.8-2.8M16.3 7.7l2.8-2.8",
  ],
  electrical: ["M13 2 4 14h7l-1 8 9-12h-7l1-8z"],
  plumbing: ["M7 3v6a4 4 0 0 0 4 4h2a4 4 0 0 0 4-4V3", "M12 13v8"],
  bathrooms: ["M4 12h16v3a5 5 0 0 1-5 5H9a5 5 0 0 1-5-5z", "M7 12V6a2 2 0 0 1 3.5-1.3"],
  appliances: ["M8 6h.01M11 6h.01"],
  custom: ["M12 5v14M5 12h14"],
};

const ICON_EXTRA: Record<string, { tag: "rect" | "circle"; attrs: Record<string, number> }[]> = {
  interior: [{ tag: "rect", attrs: { x: 4, y: 3, width: 16, height: 18, rx: 1 } }],
  hvac: [{ tag: "circle", attrs: { cx: 12, cy: 12, r: 4 } }],
  appliances: [
    { tag: "rect", attrs: { x: 5, y: 2, width: 14, height: 20, rx: 1.5 } },
    { tag: "circle", attrs: { cx: 12, cy: 15, r: 3.2 } },
  ],
};

// Maps this app's section slugs (lib/sections.ts) to the reference's icon keys.
const SLUG_TO_ICON: Record<string, string> = {
  exterior: "exterior",
  roofing: "roofing",
  structure: "structure",
  "attic-insulation": "attic",
  interior: "interior",
  hvac: "hvac",
  electrical: "electrical",
  plumbing: "plumbing",
  bathrooms: "bathrooms",
  appliances: "appliances",
};

interface Props {
  slug: string;
  size?: number;
  color?: string;
  strokeWidth?: number;
}

export default function SectionIcon({ slug, size = 20, color = "#7D234A", strokeWidth = 1.6 }: Props) {
  const key = SLUG_TO_ICON[slug] ?? "custom";
  const paths = ICON_PATHS[key] ?? ICON_PATHS.custom;
  const extra = ICON_EXTRA[key] ?? [];

  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke={color} strokeWidth={strokeWidth}>
      {extra.map((el, i) =>
        el.tag === "rect" ? (
          <rect key={`e${i}`} {...el.attrs} />
        ) : (
          <circle key={`e${i}`} {...el.attrs} />
        )
      )}
      {paths.map((d, i) => (
        <path key={`p${i}`} d={d} />
      ))}
    </svg>
  );
}
