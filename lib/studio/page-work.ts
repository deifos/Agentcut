/** Page tools outlive an MCP request timeout. Reject overlapping expensive work
 * instead of building a hidden backlog in the renderer or audio workers. */
export class PageWorkGate {
  private active: { method: string; startedAt: number } | null = null;

  status() {
    return this.active
      ? { ...this.active, elapsedMs: Date.now() - this.active.startedAt }
      : null;
  }

  async run<T>(method: string, task: () => Promise<T>): Promise<T> {
    const busy = this.status();
    if (busy) {
      throw new Error(
        `Agentcut is still running ${busy.method} (${Math.round(busy.elapsedMs / 1000)} s). This request was not queued. Check agentcut_status.page.activeWork. A timed-out call may still be running; do not start another capture, contact sheet, audio review or export until it finishes. If it is stuck, save the project and reload the editor before one small probe.`,
      );
    }
    const work = { method, startedAt: Date.now() };
    this.active = work;
    try {
      return await task();
    } finally {
      if (this.active === work) this.active = null;
    }
  }
}

export const HEAVY_PAGE_TOOLS = new Set([
  "studio_capture_frames",
  "studio_contact_sheet",
  "studio_preview_check",
  "studio_export",
  "studio_frame_person",
  "studio_cutout_person",
  "studio_color_check",
  "studio_match_shots",
  "studio_match_look",
  "studio_grade_subject",
  "studio_transcribe",
  "studio_analyze_audio",
  "studio_listen_measure",
  "studio_listen_rank",
  "studio_listen_tags",
  "studio_listen_realness",
  "studio_listen_critique",
]);
