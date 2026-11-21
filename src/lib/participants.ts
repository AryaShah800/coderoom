/**
 * Participant colours. Each has at least 4.5:1 contrast against the dark editor background (#0f1115)
 * and is used with near-black text on the name label.
 */
export const PARTICIPANT_COLORS = [
  { value: "#f5a524", name: "Amber" },
  { value: "#4ade80", name: "Green" },
  { value: "#38bdf8", name: "Sky" },
  { value: "#f472b6", name: "Pink" },
  { value: "#a78bfa", name: "Violet" },
  { value: "#fb7185", name: "Rose" },
  { value: "#2dd4bf", name: "Teal" },
  { value: "#facc15", name: "Yellow" },
] as const;

export const NAME_MAX_LENGTH = 24;
const COLOR_PATTERN = /^#[0-9a-f]{6}$/i;

export interface ParticipantIdentity {
  name: string;
  color: string;
}

export interface Participant extends ParticipantIdentity {
  clientId: number;
  isSelf: boolean;
}

/** Trims, collapses whitespace, strips control characters and caps the length of a display name. */
export function sanitizeName(raw: unknown): string {
  if (typeof raw !== "string") return "";
  return raw
    .replace(/[\u0000-\u001f\u007f]/g, "")
    .replace(/\s+/g, " ")
    .trim()
    .slice(0, NAME_MAX_LENGTH);
}

export function sanitizeColor(raw: unknown): string {
  return typeof raw === "string" && COLOR_PATTERN.test(raw) ? raw.toLowerCase() : PARTICIPANT_COLORS[0].value;
}

export function randomColor(): string {
  return PARTICIPANT_COLORS[Math.floor(Math.random() * PARTICIPANT_COLORS.length)]!.value;
}

export function initials(name: string): string {
  const parts = name.trim().split(/\s+/).filter(Boolean);
  if (parts.length === 0) return "?";
  const first = parts[0]!.charAt(0);
  const last = parts.length > 1 ? parts[parts.length - 1]!.charAt(0) : "";
  return (first + last).toUpperCase();
}

/**
 * Turns raw Yjs awareness states (untrusted: any peer can send anything) into a clean,
 * sorted participant list. The local client comes first.
 */
export function participantsFromAwareness(
  states: Map<number, Record<string, unknown>>,
  selfId: number,
): Participant[] {
  const list: Participant[] = [];
  for (const [clientId, state] of states) {
    const user = state?.user as Partial<ParticipantIdentity> | undefined;
    if (!user || !Number.isInteger(clientId)) continue;
    const name = sanitizeName(user.name);
    if (!name) continue;
    list.push({ clientId, name, color: sanitizeColor(user.color), isSelf: clientId === selfId });
  }
  // Two people can pick the same name: the one who joined first (lowest client id) keeps it,
  // the others get " (2)", " (3)" so labels and avatars stay distinguishable.
  const counts = new Map<string, number>();
  for (const p of [...list].sort((a, b) => a.clientId - b.clientId)) {
    const n = (counts.get(p.name) ?? 0) + 1;
    counts.set(p.name, n);
    if (n > 1) p.name = `${p.name} (${n})`;
  }
  return list.sort((a, b) => Number(b.isSelf) - Number(a.isSelf) || a.name.localeCompare(b.name));
}

/** Escapes a value for use inside a double-quoted CSS string (also neutralises `</style>`). */
export function cssString(value: string): string {
  return `"${value.replace(/\\/g, "\\\\").replace(/"/g, '\\"').replace(/</g, "\\3c ").replace(/\n/g, "\\a ")}"`;
}

/**
 * CSS for y-monaco's remote selection decorations: a tinted selection, a coloured caret
 * and a name label above the caret for every remote participant.
 */
export function remoteCursorCss(
  participants: Participant[],
  /** Clients whose label is shown now; omit to show every label. Others fade out (caret stays). */
  visibleIds?: ReadonlySet<number>,
  /** The followed collaborator keeps a visible label. */
  followId: number | null = null,
): string {
  const rules = participants
    .filter((p) => !p.isSelf)
    .map((p) => {
      const id = Math.trunc(p.clientId);
      const color = sanitizeColor(p.color);
      const shown = !visibleIds || visibleIds.has(id) || followId === id;
      return [
        `.yRemoteSelection-${id}{background-color:${color}40;}`,
        `.yRemoteSelectionHead-${id}{position:absolute;box-sizing:border-box;height:100%;border-left:2px solid ${color};}`,
        `.yRemoteSelectionHead-${id}::after{content:${cssString(sanitizeName(p.name))};position:absolute;left:-2px;top:-1.35em;padding:0 4px;border-radius:3px 3px 3px 0;background:${color};color:#0b0d10;font:600 11px/1.35em ui-sans-serif,system-ui,sans-serif;white-space:nowrap;pointer-events:none;z-index:10;opacity:${shown ? 1 : 0};transition:opacity .3s ease;}`,
      ].join("");
    })
    .join("\n");
  const reduced = "@media (prefers-reduced-motion:reduce){[class*='yRemoteSelectionHead-']::after{transition:none !important;}}";
  return rules ? `${rules}\n${reduced}` : rules;
}
