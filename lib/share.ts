// I1/I2/I3: shared "share this" primitive. Prefers the native share sheet
// (mobile browsers) and falls back to clipboard copy everywhere else.
// Callers should treat a thrown AbortError as a silent no-op (the user
// dismissed the native share sheet) — not an error state worth surfacing.
export async function shareText(title: string, text: string): Promise<"shared" | "copied"> {
  if (typeof navigator !== "undefined" && navigator.share) {
    try {
      await navigator.share({ title, text });
      return "shared";
    } catch (err) {
      // AbortError means the user cancelled the native share sheet — not a
      // failure. Let it propagate so callers can distinguish "cancelled"
      // (silent no-op) from "copied" (show feedback) without us guessing.
      if (err instanceof Error && err.name === "AbortError") throw err;
    }
  }
  await navigator.clipboard.writeText(text);
  return "copied";
}
