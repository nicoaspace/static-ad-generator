export type PipelineErrorKind = "failure" | "disconnect";

/** Turn raw pipeline console output into a short user-facing message. */
export function formatPipelineError(logs: string): string | null {
  const failLines = logs
    .split("\n")
    .map((line) => line.trim())
    .filter((line) => line.startsWith("FAIL"));
  if (failLines.length === 0) return null;

  const raw = failLines[failLines.length - 1].replace(/^FAIL\s+/, "").trim();
  if (!raw) return null;

  if (raw.includes("aspect_ratio")) {
    return "The image model rejected this template's aspect ratio. Try a template that uses 1:1, 3:4, or 9:16.";
  }

  const jsonStart = raw.indexOf("{");
  if (raw.includes("OpenRouter image API error") && jsonStart !== -1) {
    try {
      const parsed = JSON.parse(raw.slice(jsonStart)) as {
        error?: { message?: string };
      };
      const message = parsed.error?.message?.trim();
      if (message) {
        if (message.includes("aspect_ratio")) {
          return "The image model rejected this template's aspect ratio. Try a template that uses 1:1, 3:4, or 9:16.";
        }
        return message.length > 220 ? `${message.slice(0, 217)}…` : message;
      }
    } catch {
      /* use raw fallback */
    }
  }

  return raw.length > 220 ? `${raw.slice(0, 217)}…` : raw;
}
