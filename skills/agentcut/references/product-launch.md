# Product Launch

Make a product film that gives a specific audience one clear reason to care and a clear next step.
Use this guide for the Product Launch action and equivalent written requests. It works with an empty
project, uploaded footage, screenshots, an existing edit, or product context already in the chat.
The user's request takes priority. Keep their context, attachments, style, music and hand edits.

## Check product context first

If the request only asks for a launch video and has no product brief, URL, attached material,
project footage or relevant project assets, ask immediately: "What are you launching? Add a product
URL or a short description." Stop there. Do not call tools, scan the shared library or source folders,
search other projects, plan scenes or render to guess the product. A project name, a generic earlier
launch request, an assistant's unanswered intake question, music choice or shared library stock does
not establish product identity. The studio handles this empty intake locally without an agent call;
use this early exit when a bare request reaches you by another path.

Use genuinely established user context when present. With project footage or relevant project assets,
inspect that material first. Once the product is known, discover supporting library assets below.
If project material still cannot identify the product, ask the same short question instead of widening
the search to unrelated projects or sources. Keep the original launch request and the user's answer.

## Start with evidence

- Read the studio context, project files, notes and attached material. Inspect the current timeline
  before changing it. Read `references/format.md` and `references/footage.md` when footage is present.
- Discover material beyond the chat attachments. Call `agentcut_list_files` with `scope: "project"`,
  the active project slug and `path: "assets"`, then with `scope: "library"` and `path: ""`.
  Follow `nextOffset` and open relevant subfolders; listings are not recursive. This includes items
  dropped into the project Library panel without a chat attachment or timeline clip. Inspect relevant
  images, B-roll, recordings, music and effects before fetching or generating replacements. Do not
  assume every file is useful: match it to the benefit, brand and proof, then use the relevant items.
  Project files use `assets/...`; shared files use `library:...` in media tools. Use
  `agentcut_copy_file` with `scope: "library"` to copy a needed shared asset into project `assets/`
  when required. With local disk access, inspect these same folders. Do not limit discovery to files
  named in the message. If a specific required asset is missing, tell the user they can drop it into
  the Library panel; re-list the files after they do. Do not require a second chat attachment.
- With recordings, use `agentcut_media_info`, sample frames and inspect transcripts when useful.
  Find the actual action and visible result. Note useful source ranges, weak material and gaps.
  Do this before proposing a story or asking the user to explain material you can inspect.
- From scratch, first establish the product from the user's brief or previous user context. Then use
  the brief, existing project and library assets, product URL and allowed source
  folders. Use `agentcut_sources` for configured folders. Do not require source code. Inspect what
  is available before requesting more. A URL alone does not prove every product claim.
- Ask only for the minimum missing input that blocks an honest film. If the product is unknown,
  ask for its name and a link or short description. If the intended viewer or next step cannot be
  inferred, ask for the missing item in one short question. Do not send a blank questionnaire or
  ask again for facts already supplied. State reasonable low-risk assumptions and continue.
- Never invent customer quotes, numbers, integrations, capabilities or UI evidence. If a required
  claim lacks proof, narrow the claim to what is visible or ask for the missing material. Label
  any user-approved illustration as an illustration. Follow the real-app capture safety rules in
  the main skill when recording a website. Do not rebuild an app and present it as a real capture.

## Write a flexible brief

Record a short brief in `notes.md` and show the direction in two or three lines in chat:

- **Audience:** who needs this product, and the task or problem they recognize.
- **One benefit:** the single outcome this film will make clear, in the product's own language.
- **Proof:** for each claim, the exact source range, screenshot region or verified interaction that
  demonstrates it. Pair the words with a visible action and result. Remove unsupported claims.
- **Next step:** one specific action, with the real destination or product name. Do not invent a URL.
- **Delivery:** use the requested format, duration and tone; infer sensible defaults from the use
  case when they are absent. Let the amount of proof and reading time determine the cut length.
  Honor a length stated in plain language. Do not require a duration slider or a length choice to start.

Read `references/launch-direction.md` before building. Use it to choose the story, record concrete
visual settings and shot handoffs, check the opening and proof early, and review transition frames.

Consider at least two distinct stories before choosing one. Examples include a useful result first,
a recognizable problem with an immediate demonstration, a surprising verified detail, or a product
reveal with a short promise. Compare them against the available material and audience. Record the
choice and its reason in notes. Do not force a device orbit or logo reveal onto every film.

Build the story around the strongest proof. A shot can introduce the problem, show an action, reveal
the result or explain the next step; combine or omit these functions when the material supports it.
There is no required shot count, fixed order, duration per shot or mandatory sequence. Choose frame
ranges only after the story works. Each planned shot needs a purpose, source, claim, focus target,
readable hold and sound cue. Do not use decorative motion to conceal a missing demonstration.

## Brand and visual direction

- Inspect the repository or allowed product source, website and supplied assets for actual logos,
  colors, typography, product names and UI. Reuse the brand assets and match their proportions,
  clear space, spelling and color. Do not replace a real logo with typed text or an invented symbol.
- Show an integration only when the material or official product information verifies it. Use that
  integration's official mark from supplied/repository assets or its official brand source. Do not
  draw an approximate logo, imply an unverified partnership or add unrelated brand marks. If the
  official asset is unavailable, use an accurate plain-text label or omit the mark.
- Read `references/cinematic.md` for its toolkit, camera guidance and quality gate. Use its existing
  `Device3D` models whenever a phone, laptop or desktop device is visible. Check available library
  models and their license rules. Do not draw flat hardware frames. Browser windows and frameless
  detail views can use `Screen`; respect export rules and keep proof sharp.
- Use a purposeful pan to connect an action to its result, a zoom to reveal a relevant detail,
  perspective to show useful depth, and lens or motion blur to guide attention during a move.
  Choose the moves that serve this brief. Do not apply every effect to every shot. Settle the camera
  and focus for readable holds; keep essential UI, claims and the next step legible in each format.
- For a website, choose the camera treatment automatically from the plain-language request and the
  inspected page. Show enough of the full view to establish the product, move from wide to the detail
  that proves the benefit, then pause in focus while the viewer reads the action and result. Adjust
  the crop, perspective, move speed and hold to the actual content. The user does not need to name a
  camera technique or open Cinematic Mode. Avoid a continuous fly-over that never lets the UI settle.
- Use `references/loops.md`, `references/craft.md` and the component catalog for brand-matched
  backgrounds and editable graphics. Keep decoration below the product's visual priority.

The cinematic guide supplies tools and quality checks. Its suggested shot arc and example timings
do not replace this brief. Fit the edit to the product, evidence and user request.

## Sound and build

Read `references/sound.md`. Keep the user's selected music. Otherwise choose music that supports the
benefit, pace and brand. Analyze beats and meaningful onsets. Synchronize cuts, product actions,
reveals and result moments with the music where it helps the story. Put a sound effect on a meaningful
action or transition, not every camera movement. Keep voice and product sounds clear. Use the listen
tools and record measured mix results; do not claim to have heard the mix.

Follow the main skill's build and review loop. Build one beat at a time, keep footage trims, text,
music and SFX editable on separate timeline clips, and preserve user edits. Use real material for
proof; graphics can explain it but must not change what the product can do.

## Review before hand-off

Read `references/efficient-review.md`. Group independent file/guide reads, use changed-shot probes
for local revisions, and broaden for shared/timing changes. Keep all final picture and sound checks.

Check the whole film, not only attractive stills. Does the opening earn attention from this audience?
Can a new viewer name the benefit? Does each claim have visible real proof? Can they read the action
and result without pausing? Is the next step correct and clear? Remove shots that add no meaning.

Capture entrances, settled holds and exits in wide and mobile. Inspect full contact sheets, check
heavy scene playback, and review the mix and cue timing with the existing tools. Fix cropped logos,
blurred proof, tiny UI, weak contrast, abrupt moves and masking sound. Keep the cinematic quality gate
and normal preview/export checks. State any remaining evidence gaps. Hand off the editable draft;
export only when requested.
