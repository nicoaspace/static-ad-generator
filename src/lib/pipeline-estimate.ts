import { LIMITS } from "./limits";

export function estimateGenerateSeconds(
  templateCount: number,
  variations: number,
  resolution: string,
  isPublicVersion = false
): number {
  const perImage = isPublicVersion
    ? LIMITS.PUBLIC_SECONDS_PER_IMAGE
    : LIMITS.ESTIMATED_SECONDS_PER_IMAGE[resolution] ??
      LIMITS.ESTIMATED_SECONDS_PER_IMAGE["512"];
  const imageCount = Math.max(1, templateCount) * Math.max(1, variations);
  return LIMITS.ESTIMATED_PHASE2_SECONDS + imageCount * perImage;
}

export function estimateResearchSeconds(): number {
  return 90;
}

export function formatDuration(seconds: number): string {
  if (seconds < 60) return `~${Math.max(1, Math.round(seconds))}s`;
  const mins = Math.floor(seconds / 60);
  const secs = Math.round(seconds % 60);
  return secs > 0 ? `~${mins}m ${secs}s` : `~${mins}m`;
}

export function formatElapsed(seconds: number): string {
  if (seconds < 60) return `${seconds}s`;
  const mins = Math.floor(seconds / 60);
  const secs = seconds % 60;
  return secs > 0 ? `${mins}m ${secs}s` : `${mins}m`;
}
