export interface BatchFile {
  scope: "project" | "library" | "toolkit" | "source";
  source?: string;
  path: string;
  startLine?: number;
  endLine?: number;
}
export interface ReadResult {
  scope: string;
  project?: string;
  path: string;
  content: string;
  hash: string;
}

/** Existing read_file permissions remain the boundary; this only groups independent reads. */
export async function readBatch(files: BatchFile[], read: (file: BatchFile) => Promise<ReadResult>) {
  const settled = await Promise.allSettled(files.map(read));
  let remainingChars = 96_000;
  return { files: settled.map((result, index) => {
    const file = files[index];
    if (result.status === "rejected") return { path: file.path, scope: file.scope, ok: false, error: result.reason instanceof Error ? result.reason.message : String(result.reason) };
    const { content: fullContent, ...metadata } = result.value;
    const lines = fullContent.split(/\r?\n/);
    const startLine = file.startLine ?? 1;
    const endLine = Math.min(file.endLine ?? lines.length, lines.length);
    if (startLine > lines.length) return { ...metadata, ok: false, error: "startLine is after the end of the file.", totalLines: lines.length };
    const content = startLine === 1 && endLine === lines.length ? fullContent : lines.slice(startLine - 1, endLine).join("\n");
    if (content.length > remainingChars) return { ...metadata, ok: false, totalLines: lines.length,
      error: "Selected content exceeds the batch's remaining 96,000-character budget. Request narrower startLine/endLine ranges or use read_file for this file. No partial content was returned." };
    remainingChars -= content.length;
    return { ...metadata, ok: true, content, startLine, endLine, totalLines: lines.length,
      complete: startLine === 1 && endLine === lines.length,
      hashScope: "full-file" };
  }), note: "Ranges use one-based inclusive lines. Hashes cover full files, not returned excerpts. Read the complete relevant context before writing. Failed or omitted entries are not reviewed." };
}
