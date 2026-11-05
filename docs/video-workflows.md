# Video workflows

This is the working record for the chat video types. Update it when a user approves a result or a
measured test exposes a problem. Keep the creative guides on demand in `skills/agentcut/references/`;
the main skill should only route requests and state short safety or intake rules.

## The chat flow

Studio currently offers **Product Launch** and **How-to**. Both use the normal chat send path, so
typed context, frame attachments, uploaded files, selected style/music and queued requests keep their
existing behavior. A project Library upload is available even if it has no timeline clip or chat chip.
The launch and tutorial guides discover relevant supporting media after the brief is established.

A clear new-video request on an existing edit creates a separate video card in the same canvas.
Its timeline and scenes start empty; copies of the source's project assets and explicit frame
attachments remain available, along with the shared library. Original video files and chat stay
unchanged. A truly empty video can be reused. Requests carry a stable ID so duplicate submits,
retries and a lost response do not create a second target or dispatch twice. New video chat and
default agent writes bind to the returned target. Explicit edits keep their original destination.
An ambiguous request such as "turn this into a tutorial" asks whether to edit this video or create
a new video; Cancel keeps the prompt and attachments without dispatching or creating anything.

The helper must advertise `chat-video-creation`. An older running helper is blocked before capture
or dispatch, with an update message; the editor never falls back to sending a creation to the old
edit. Updating source files alone does not change a running helper's loaded capabilities. Do not
restart a service during a user's test without their instruction.

For an empty project and a bare request, the panel shows a local question. It does not dispatch a
chat request, scan tools, render, or use model tokens. Add the answer and press Send; the original
intent and answer go together once. The intake and unsent draft stay with the project when switching
projects. Send failure retains them for retry. Cancel removes the pending video type.

| Action | Local question | On-demand guide |
| --- | --- | --- |
| Product Launch | What are you launching? Add a product URL or a short description. | `references/product-launch.md` |
| How-to | What should viewers learn to do? Add a URL, recording, or a short description of the task. | `references/how-to.md` |

Common bare free-text requests use the same local intake. The text matching is deliberately limited,
not an intent classifier for every possible sentence. Substantive written requests use ordinary Send
and the main skill routes them. The guides also ask immediately if an empty request reaches an agent
by another path. A project name, unrelated shared stock, selected music or an unanswered generic
exchange does not establish a brief. Tutorial history must establish a task, not only a product.

An empty How-to action also asks locally on a populated canvas. The selected finished video, old
launch attachments and incidental project assets are not a new tutorial task. Keep these assets for
use after the user supplies the task. Deliberately attached tutorial inputs or an established tutorial
task can still proceed through the normal path.

The composer also shows **Waiting for your reply** with the actionable request when a completed
agent response needs user input. Explicit pending metadata or supported structured completion data
takes precedence. Ordinary final questions and explicit “Still blocked” sections with choices are
recognized as fallbacks. The observed How-to reply used prose, not an explicit provider state.
Scripted, quoted and rhetorical questions are excluded conservatively. No indicator appears during
generation. Accepted/queued replies clear it; a failed send retains the prompt and question. Each
video uses its own chat history. Prose detection is limited; it is not a general intent classifier.

No extra duration or camera control is required. Written duration requests take priority; otherwise
the agent chooses a length that fits the material and leaves time to read. The How-to workflow is
separate from the existing announcement capture job API, which still does not support how-to jobs.

## Approved Product Launch example: Agentcut v2

The user approved the result on November 5, 2026. The request introduced **Agentcut v2**, with the
Product Launch skill/action and projects organized by date, in about 20 seconds with smooth movement
and backgrounds. “v2” is the user's release name; the package version was **0.2.24**.

Local project: `projects/agentcut-preset-test/` in the user's Agentcut workspace. Its manifest has
600 frames at 30 fps, wide 1920×1080 and mobile 1080×1920. It uses Figtree, Bricolage Grotesque and
Geist Mono, with the product's coral, ink and light surfaces. The recorded plan chose a brand reveal
over an invented before-state, demonstrated the launch intake and date menu, and ended with the real
repository destination. Music and separate SFX follow meaningful actions. These are choices for this
film, not a required scene order, font set, duration or shot count for future work.

The local notes describe **UI reconstructed from source code**, including reusable brand UI from
an earlier project. This is an approved launch design example, not evidence that a real UI click
was recorded or that a tutorial procedure was tested. Future instructional videos must show real
screenshots/recordings for procedural evidence and identify explanatory reconstructions. Do not
reuse private project names or old scenes in a new customer's video just because they are available.

Quality baseline to preserve:

- The viewer sees one benefit: a fast start for a launch video and easier project retrieval by date.
- The UI labels, button, date groups, brand marks and final destination agree with the current product.
- Movement leads to a stable, readable hold; graphics and backgrounds stay below the product's priority.
- Scenes, text, source trims and sound remain editable. Both wide and mobile receive review.
- The saved notes report one preview frame dropped out of 598, a 33 ms median scrub, and a final mix
  critique. These are recorded tool results from that run, not a promise for another computer.
- The project `renders/` directory was empty at this review. The approved artifact is an editable
  draft. The notes' proposed export loudness is not evidence of an exported MP4.

The [measured run report](baselines/agentcut-v2-launch-2026-11-05.md) records timing, token usage and
specific improvement options. Do not treat its cumulative token number as a single prompt size.

## How-to design basis

The tutorial guide is original Agentcut wording. The following primary sources inform a few specific
decisions; they are not imported product frameworks, templates or fixed shot recipes.

| Primary source | Decision used here | Limit |
| --- | --- | --- |
| [Software-training study and design paper, 2013](https://ris.utwente.nl/ws/portalfiles/portal/6827789/s4.pdf) | A task-focused title, accurate interface, visible action and response, coordinated narration. | Tests concerned specific software-training tasks; this is not a universal video recipe. |
| [Pause and navigation guidance experiment, 2022](https://pmc.ncbi.nlm.nih.gov/articles/PMC9610327/) | Give stable pauses and tell a learner what to check rather than relying only on a player's pause button. | Applying an educational-video experiment to software holds is a design inference. |
| [Software-tutorial review experiment, 2018](https://research.utwente.nl/en/publications/supporting-motivation-task-performance-and-retention-in-video-tut/) | Finish with a visible success check; avoid redundant replays by default. | The study found no added condition benefit for review/second demonstration; it does not prove all recaps are useless. |
| [W3C caption guidance](https://www.w3.org/WAI/media/av/captions/) | Align captions with audio, correct automatic text and retain meaningful non-speech information. | Caption accuracy still requires review against the actual audio. |

The guide combines these with Agentcut's existing website recovery, capture, cursor, cinematic,
sound and export instructions. It does not require a voice-over for a silent brief. Brand and motion
remain flexible; no effect may obscure an essential step or success state.

A plain task, for example "how to add a style to Agentcut", is enough to begin discovery. The agent
checks existing captures, a known URL or running preview, and configured source routes/labels, then
uses an available permitted browser tool to capture real actions and success. Source code and edited
composition captures are not website footage. If access or capture is blocked, it asks for the
smallest missing URL or recording instead of fabricating a screen. These rules are in the packaged
How-to guide; this implementation task did not perform another website recording or video generation.

## Implemented efficiency support

`agentcut_read_files` groups up to 12 independent permission-checked reads, with optional line ranges
and a 96,000-character content budget. Every result is explicit; oversized/missing files are not
silently truncated or counted as reviewed. `agentcut_guide` accepts `paths` for up to six known guides.
`agentcut_review_plan` reads the current project/timeline and proposes concrete changed-shot captures
and preview ranges through existing APIs. Shared or timing scope broadens the plan. It never renders
or mutates files. Final full-project picture and mix checks remain mandatory in every variant.
See [the agent recipe](../skills/agentcut/references/efficient-review.md) for usage and fallback rules.
These capabilities are tested; savings have not been measured with another paid generation.

## Improve this record

After approval, record the brief, project reference, real evidence used, format/length, what the user
liked, remaining limits, and measured timing/usage if available. Keep source files and raw provider
logs outside the repository. Add only a sanitized aggregate baseline. Separate observed numbers,
user preference and inference. Do not invent quality scores, savings or causal timing attribution.

For a guide change, name the problem, make the smallest rule change, sync the packaged skill, and
verify button, bare text, meaningful brief, attachments/project assets, retry and guide resolution.
Reuse an approved project for read-only comparison; a new costly generation needs a reason. Keep
the actual visual, audio, mobile and success checks even when reducing duplicate reads or tool calls.
