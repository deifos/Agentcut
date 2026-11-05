# Group reads and review changed shots

Use fewer repeated model turns without removing evidence, craft or final checks. These methods do
not promise measured token or time savings. They do not change provider settings or compact history.

## Independent reads in one request

Once the task and product are known, gather small independent reads together. For MCP,
`agentcut_read_files` accepts the active `project` and up to 12 `files`, each with `scope`, `path`,
optional configured source ID, and optional one-based inclusive `startLine`/`endLine`. Examples of
independent inputs are project.json, layers.json and notes.md, or already-located source UI sections.
Use `agentcut_guide` with `paths` to read up to six known supporting guides together. Single-guide
`path` remains supported. Do not load every reference just because a batch is possible.

The file batch uses the existing file-read permission checks and returns every result in request
order. Check each `ok`, scope, range, completeness and hash. It returns an explicit error for a file
that exceeds the remaining 96,000-character content budget; that file was not reviewed. A range's
hash covers the full original file, not only the excerpt. Keep hashes for normal conflict-safe writes.
Do not write from an excerpt when missing context could affect correctness. Narrow the range
or request the needed full file, without silently omitting evidence.

With local shell/file access, read those independent files or sections in one tool execution. Reuse
current material; avoid repeated whole-repository scans or rediscovering known brand/source paths.
Keep dependencies sequential: first list to find a path, then read it; first read before a write.
Do not parallelize edits, capture, contact sheets, audio analysis/review, preview checks or exports.
If an older helper does not advertise a new batching tool, use existing file tools grouped in
one local execution when permitted. Do not repeatedly call an unknown method or restart services.

## Intermediate picture checks

After an edit, call status for build/validation. For a change confined to known shots, use
`agentcut_review_plan` with `scope: "shot"` and their current clip IDs. It reads the project and
timeline together and returns concrete calls to existing capture and preview tools. It does not
render, edit, export or certify quality. Inspect and execute relevant calls in sequence.

The plan samples the changed shot's entrance, hold, exit and neighboring boundaries in all project
variants, including variant timing overrides. Add exact narration, action/result, focus, lift or
caption cue frames that the proposed samples miss. Samples are full frames, so overlays and nearby
content remain visible. Crop only for a detail diagnosis, never as the sole layout proof.

Use `agentcut_capture_frames` with explicit `frames` for small changed-shot probes. The existing
`agentcut_contact_sheet` also supports explicit `frames`, or inclusive `from`/`to` plus `every` for
a bounded sequence. The existing `agentcut_preview_check` supports `from`/`to`; check changed heavy
shots rather than replaying the whole video after every small revision. The planner splits its
preview suggestions into ranges of at most 60 seconds. These are suggestions, not passed checks.

Scope must broaden in these cases:

- A shared scene, component, asset, font, palette, style, layout helper or camera function changes:
  use `scope: "shared"` unless every consumer is known and included. Check all affected variants.
- A clip moves, a trim/duration changes, a shot is removed, or music/voice/SFX timing changes:
  use `scope: "timing"`. Check old and new boundaries, overlaps and sync; a current ID alone cannot
  describe a removed shot. Re-read the timeline and regenerate the plan after further edits.
- The affected scope is uncertain, or a probe reveals a new problem outside the shot: widen the
  review. A passed earlier check is stale for any range or variant affected by the new change.

Shared and timing plans broaden to full-project samples. Add focused transition/cue probes
where uniform sampling misses a critical moment. Unknown clip IDs in shot scope are errors, not
permission to skip them. Do not call a plan complete until its actual checks pass.

## Final review remains complete

Before hand-off, review full wide/mobile contact sheets and the complete story/procedure, confirm
readable actions and the actual success state, review captions, measure the mix and cue sync with
`agentcut_listen_critique`, and finish playback checks for heavy scenes. The planner always returns
`finalReviewRequired: true` and full-project picture/audio calls in each variant. Use current project
variants, including any user-added size. Follow the main skill's review and export rules.

Run page-heavy tasks sequentially. On timeout inspect `agentcut_status.page.activeWork` before retrying,
as `references/website-howto.md` requires. A smaller probe helps recover or diagnose; it cannot
replace final picture/sound checks or lower render quality.
