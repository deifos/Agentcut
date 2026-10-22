/** 125 frames @30 → "0:04.17" */
export function formatFrameTime(frame: number, fps: number, decimals = 2) {
  const totalSeconds = Math.max(0, frame) / Math.max(1, fps);
  const minutes = Math.floor(totalSeconds / 60);
  const seconds = totalSeconds - minutes * 60;
  const fixed = seconds.toFixed(decimals);
  const padded = seconds < 10 ? `0${fixed}` : fixed;
  return `${minutes}:${padded}`;
}

export function formatBytes(bytes: number) {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(0)} KB`;
  if (bytes < 1024 * 1024 * 1024) return `${(bytes / 1024 / 1024).toFixed(1)} MB`;
  return `${(bytes / 1024 / 1024 / 1024).toFixed(2)} GB`;
}

export function fileName(path: string) {
  const clean = path.replace(/^library:/, "");
  return clean.slice(clean.lastIndexOf("/") + 1);
}
