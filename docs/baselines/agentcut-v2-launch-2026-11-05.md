# Agentcut v2 launch: measured local baseline

Recorded November 5, 2026. This report reads the completed **agentcut-preset-test** run; it does not
run a second generation. The user's roughly ten-minute observation is supported. The saved records
for this run show **6,579,541**, not 7.5 million, cumulative tokens. No available record establishes
where the reported 7.5 million figure came from.

## Evidence and method

- Studio: `<workspace>/projects/agentcut-preset-test/.studio/chat.json`.
- Project: the same folder's `project.json`, `layers.json`, `notes.md` and `renders/` listing.
- Provider: `~/.claude/projects/<workspace-key>/da63e55a-8c63-46cf-958a-939c8ef1659a.jsonl`.
- Code semantics: `packages/agentcut/src/studio/agents/usage.ts`, the Claude adapter, and
  `chat.ts`'s result handler and project-token accumulation.
- [Sanitized aggregate snapshot](agentcut-v2-launch-2026-11-05.json). It contains no raw prompts,
  source code, tool inputs, tool-result text, images or private project inventory.

Reproduce the aggregate without agent or media calls:

```text
node scripts/analyze-studio-run.mjs <chat.json> <session.jsonl>
```

The provider log has 49 API request records and 106 assistant content-block records, but only **49
unique assistant message IDs**. Each content block can repeat the same usage. The analyzer deduplicates
by message ID before summing; adding all 106 records would inflate the result. The resulting totals
match the saved assistant usage exactly. The saved project's total equals that one visible completed
assistant turn; the difference is zero. That does not recover deleted history from other sessions.

## Token accounting

Provider model: `claude-opus-5-5`, recorded effort `medium`.

| Measure | Tokens | Meaning |
| --- | ---: | --- |
| Plain uncached input | 99 | Provider `input_tokens`; excludes its separately reported cache reads/writes. |
| Cache creation/write | 195,908 | New cached input written during this run; all reported in the one-hour cache bucket. |
| Cache read | 6,339,761 | Cached context consumed again across model requests. |
| Newly supplied input | 196,007 | Plain input plus cache creation, not just the 99 plain tokens. |
| Studio normalized input | 6,535,768 | All three input categories, added once. |
| Output | 43,773 | Generated output; includes the recorded 12,786 thinking tokens, which must not be added again. |
| Studio turn total | 6,579,541 | Normalized input plus output. |
| Studio project total | 6,579,541 | Cumulative saved project use; currently equal to this turn. |
| First request input context | 43,133 | The first request's input, including cached prefixes and tools/instructions. |
| Last request input context | 214,550 | Context for the final recorded request, not a measurement of a later live session. |

Cache reads are **97.001% of normalized input**. The cached prefix grows and is read on later
requests; 6.34 million cache-read tokens are not 6.34 million distinct newly written prompt tokens.
The input context grows by 171,417 tokens from the first to last request. Repeated context consumption
is visible, but these fields do not allocate exact tokens among instructions, source reads, images,
thinking, generated scenes and tool schemas. Image-result byte size is not an image token count.

The provider's `cost-state` records **USD 3.7110722** and `hasUnknownModelCost: false`. This is the
CLI's recorded cost estimate, not a verified invoice or a claim about subscription billing. No rates
were assumed and no dollar savings were projected.

## Timing and work

Studio saved `durationMs`: **585,492 ms** (9 min 45.492 s). The result handler takes the provider's
`duration_ms` when available. Do not calculate an end timestamp by adding this value to the earlier
Studio assistant-creation timestamp.

The provider cost record gives **591,427 ms** overall, **455,617 ms** API time, **455,538 ms** API time
without retries and **131,428 ms** tool time. The raw user event to final assistant text spans
585.437 s. Studio user creation is at 20:19:59.766 UTC; the provider user event is at 20:20:05.893 UTC,
about 6.1 s later. Provider work ends near 20:29:51.3 UTC (15:29:51 Toronto). These different boundaries
explain why the displayed duration and overall cost-state duration differ. They do not establish an
extra six-second render or model wait. API and tool totals have different accounting/overlap and must
not be added as a strict partition of the wall time.

There are **61 tool calls**, **61 recorded results**, **zero tool-result error flags**, **seven image
results**, four status calls, six contact sheets, one frame capture, two mix critiques and one preview
check. No release-job orchestration, exported MP4 or failed-render retry loop appears in this run.
The API time difference with/without retries is only 79 ms; retries are not supported as the main delay.

The following are approximate editorial windows from recorded tool landmarks. Response counts and
tokens are assigned by the last block timestamp for each response, so an API request can start in the
prior window. These are descriptive windows containing model and tool work, not causal stopwatch
measurements for isolated operations.

| Window, UTC (Toronto is UTC−5) | Seconds | Model responses | Normalized input | Output |
| --- | ---: | ---: | ---: | ---: |
| 20:20:05.893–20:21:34.202: setup, brand and source review | 88.309 | 11 | 789,133 | 4,372 |
| 20:21:34.202–20:22:52.038: music selection, analysis and plan | 77.836 | 6 | 654,632 | 2,758 |
| 20:22:52.038–20:26:32.581: build and early visual checks | 220.543 | 16 | 2,129,947 | 24,316 |
| 20:26:32.581–20:28:26.811: whole-edit visual revisions | 114.230 | 7 | 1,181,858 | 6,943 |
| 20:28:26.811–20:29:51.330: sound, preview and hand-off | 84.519 | 9 | 1,780,198 | 5,384 |

Observed repeated work and long calls:

- Setup repeatedly reads product/source slices and earlier brand UI, then the format, sound and loops
  references. By the music stage the request input is 98,134 tokens, before most scene generation.
  This shows early context growth; it does not prove every read was redundant.
- Two music catalog calls, one import and one four-candidate ranking precede beat analysis. The ranking
  takes 23.611 s between tool-call and result timestamps.
- Source-based UI and six scene beats are written, with small layout/camera corrections. One scene
  writing response emits 5,477 output tokens. Building is the longest descriptive window.
- A whole-edit contact sheet takes 28.583 s; subsequent sheets expose popover scale, headline,
  background and mobile-contrast problems. Further checks follow corresponding edits. This is real
  quality work, not six identical checks with no change between them. Two final variant sheets were
  requested close together; future runs should follow the existing sequential page-work rule.
- Six contact sheets together take 54.358 s as paired call/result intervals. Image results increase
  retained context, but their exact token contribution cannot be inferred from base64 sizes.
- The preview check takes 21.301 s. The second mix critique takes 10.363 s. No tool interval exceeds
  29 s. The run is many model/tool cycles, rather than one observed ten-minute tool stall.
- Large text results include the music catalog (19,045 characters), final status (16,051), first mix
  critique (14,411), sound/loops read (13,129) and source/brand reads. These are text character counts,
  not token measurements. Tool/source verbosity is one candidate for further profiling.

## Prioritized options that preserve quality

| Priority | Option | Evidence and safeguard | Status |
| --- | --- | --- | --- |
| 1 | Keep the empty intake local for both video types. | A missing brief needs no search or model call. Test zero dispatch and one follow-up send. | Implemented and tested; no savings claim is made for this completed substantive run. |
| 2 | Group independent file reads and reuse known source/brand locations; inspect exact relevant slices. | Setup used 11 responses and reached nearly 100k input before music. Keep the evidence, license and brand checks. | Implemented `agentcut_read_files` and batched guide reads, with bounded responses and per-file results. No new benchmark run. |
| 3 | Fix changed shots with targeted captures, then run complete wide/mobile review in sequence. | Sheets caught useful problems. Shared/timing changes must broaden the review. Keep final picture, audio and preview quality. | Implemented read-only `agentcut_review_plan`, using existing capture/preview APIs and retaining final full-picture/audio calls. |
| 4 | Offer compact tool-result summaries with detail on demand. | Catalog/status/critique text is large and retained. Keep the full raw result and all evidence; measure exact input deltas before changing defaults. | Proposal only. No tool-output truncation implemented. |
| 5 | Reuse a verified brand UI kit and reusable editable components. | This run already reused prior UI but still wrote detailed scenes. Maintain current-label/source checks and avoid copying an old story or private names. | Guide-level direction; no renderer or scene system rewrite. |
| 6 | Show cache-read, cache-write, plain input, output and latest context separately. | Current total combines repeated reads with output. Clear labels would explain cost without implying 6.58M fresh tokens. | Proposal only; no telemetry UI change. |
| 7 | Investigate selective history reduction only after measuring quality and cache effects. | Final request context is 214,550. Removing context might break factual grounding or the cache prefix. | Deferred. No sweeping compaction, provider setting or model change. |

Nothing here establishes that fewer checks, a cheaper model, shorter instructions or fewer tokens would
retain the approved quality. Validate an option against the approved editable draft before adopting
it. Future measurements should capture per-request phase labels, tool timing, request context size,
cache categories and hand-off quality without recording secrets. No costly second run was used to
claim savings.
