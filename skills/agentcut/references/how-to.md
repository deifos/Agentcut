# How-to

Help a viewer complete one real task and recognize success. Use this guide for the How-to action,
tutorial requests and software walkthrough videos. The user's brief, uploaded material, existing edit,
selected style and music take priority. This is not a fixed scene sequence or a promotional film.

## Establish the task before searching

The studio asks locally when the request is empty. If a bare request reaches the agent without a
task, brief, recording or relevant project material, ask immediately: "What should viewers learn to
do? Add a URL, recording, or a short description of the task." Stop before tool calls, source or
library searches, planning or rendering. A project name, generic earlier request, music choice or
unrelated shared stock does not establish a task. A known product alone may still lack a procedure.

This also applies when How-to is clicked while viewing a finished launch or another populated video.
The old edit, its incidental assets and prior launch conversation do not identify the new tutorial's
task. Ask locally before creating a destination or sending to the agent. An explicit current task,
genuinely established tutorial task, or material deliberately attached for the tutorial can proceed.
Keep project uploads available for inspection after the user answers; do not discard them.

With material, inspect the current project and attachments first. Read `references/format.md`,
`references/footage.md` for recordings, and `references/website-howto.md` for website execution and
tool recovery. Use media information, source frames and transcripts to find complete actions and
their results. Do not ask the user to repeat facts already in the brief or a visible recording.
If one crucial task detail remains missing, ask that one question and continue work that is clear.
When a user reply is required, state the exact missing input plainly, for example
"Question for you: Which voice should this use?" or "Still blocked: I need a recording of the task."
Do not bury the needed action beneath a long completion update or imply that generation continues.

## Obtain the real UI from a task-only brief

A request such as "how to add a style to Agentcut" supplies a task. Do not make the user also ask
for screenshots, captions or an edited video. Proactively obtain authentic evidence:

1. Check relevant captures or recordings already in the target project's assets and its supplied
   source material. Reuse them only if they show the current labels, complete actions and success state.
2. Use the supplied or already-known product URL or an already-running local preview. Read the
   relevant routes and control labels from configured source folders if that helps locate the task.
   A source-code read locates controls; it is not a visual or proof that an action works. Do not
   search the home folder for identity or start/restart the user's services as part of discovery.
3. Use an available permitted browser capture tool. Prefer a connected browser automation tool
   when it supports actual screenshots/recording. Otherwise the helper includes `agent-browser`:
   read `agent-browser skills get core` and its video-recording reference for the installed version,
   use a named session, open the known URL, inspect the live controls, and take real screenshots or
   a recording into the new video's `assets/`. Inspect before each action and re-inspect afterward.
   The installed CLI supports `screenshot <path>` and `record start <path.webm> --cursor`, followed
   by planned actions and `record stop`. Use only supported commands from its local documentation.
4. Demonstrate the requested task in prepared safe demo state, retaining the real pointer/action,
   response and final success state. Do not modify the user's original video to make tutorial footage.
   For Agentcut, use a disposable safe demo video rather than changing the completed launch. Reuse
   existing captures if obtaining that safe state is not possible under the current permissions.
5. If sign-in, access, an unknown URL, blocked network permissions or capture capability prevents
   this, ask for the smallest missing link or recording. The user signs in directly; never request
   credentials, cookies or tokens. Do not fabricate screens, bypass a block, or claim code proves UI.

`agentcut_capture_frames` captures the edited composition, not an arbitrary website. The release-job
API still supports announcement only; do not submit a how-to job to it or pretend it captured a task.
After authentic material exists, add accurate captions or step labels without waiting for a separate
request, then build and review the editable tutorial. Preserve all earlier edits and source files.

## Plan for someone doing the task

Record in `notes.md`: the intended viewer, their starting state and prerequisites, the task they
will complete, and the visible evidence that confirms success. Show the direction in a few lines.
For example, "Create a project from a preset" needs the real starting screen, the preset selection,
the creation action and the newly opened project. A title that says "Easy presets" is not instruction.

Use a task title with a clear action. Start with the useful result or a brief orientation, then give
the minimum context needed to begin. Teach the actual procedure in its dependency order. Put any
necessary account, permission or prepared-file condition before the first action that needs it.
Do not turn the tutorial into a tour of every feature. Split distinct goals when the user requests
several tutorials; do not silently omit a required step to hit an arbitrary duration.

Build a flexible cue sheet. For each step note the source range or real captured view, exact control
label, action, visible reaction, focus region, text or narration cue and readable hold. Mark the
final state that proves success. Choose length from the requested duration and the time needed to
understand the steps. No duration slider or camera vocabulary is required from the user.

## Real actions and useful cues

- Use real screenshots and recordings from the current app or user material as the procedural
  evidence. A screenshot can orient the viewer or show a result; it must not imply that an unseen
  click was verified. Capture a missing transition or state clearly what remains unverified.
- Follow the main skill's website safety rules. Inspect before capture. Use safe sample content;
  do not submit live messages, change settings or expose credentials to make a tutorial. If a write
  action needs user preparation or authorization, explain the missing step. Do not invent it.
- Preserve actual labels, cursor targets, menu state, entry values and system feedback. Do not
  replace procedural evidence with an imagined UI or pretend a decorative animation is a capture.
  Any explanatory reconstruction must be clearly identified and must not be the only proof.
- Show where to act, the action, then its result. Give the viewer a stable pause at meaningful step
  boundaries instead of relying on them to discover where to pause. Trim idle waits but retain
  feedback that explains progress and completion. Speed up typing only when the entered value and
  result remain clear. Keep important errors and their recovery when relevant to the task.
- Use a brief highlight, pointer or close-up on the relevant control as the instruction reaches it.
  Do not cue several competing objects. Start wide enough for orientation, move to the detail,
  then hold sharp and readable through the action and reaction. Follow cursor metadata when present
  (`references/cursor.md`). Keep the current step and progress clear without excessive labels.
- Narration should explain the action as it appears. Use plain action words and exact UI labels.
  Do not narrate a click several seconds before or after the visible action. For a silent tutorial,
  place concise step instructions next to the demonstrated action and hold them long enough to read.

## Brand, library, motion and sound

Match the app's actual logos, fonts, colors and spacing. Discover useful existing project images,
B-roll, recordings, music and effects even when they are not chat attachments: list project `assets/`
with `agentcut_list_files`, then relevant shared library folders with `scope: "library"`. Follow
pagination and inspect relevant subfolders. Use `assets/...` and `library:...` media paths. Do not scan
other projects or every source directory to guess the task. Reuse known allowed source locations for
brand checks; if one is missing, ask instead of searching the home folder. Tell the user they can
drop a specific missing asset into the Library panel; a second chat attachment is not required.

Use B-roll only when it explains the task without hiding an essential step. Reuse existing components
and relevant assets; do not generate replacements by default. With website source available, inspect
the exact relevant components rather than reading the whole repository repeatedly.

Read `references/cinematic.md` when using camera depth or devices. Use existing `Device3D` hardware
for visible phones and computers. Smooth motion, backgrounds and restrained brand effects can frame
the tutorial, but essential UI must stay sharp, upright enough to read and clear of captions. Blur,
perspective and zoom should lead into a readable hold. Do not carry launch-film energy through every
instructional step. Keep optional backgrounds quiet during the action.

Read `references/sound.md`. Preserve a selected song; balance it below speech and keep busy music or
effects away from difficult steps. Use a small sound on a meaningful action, not every pointer move.
Caption narration accurately using the transcription workflow. Correct names, numbers and UI labels;
include meaningful non-speech audio when needed to understand the task. Captions must follow the
audio and avoid controls, results and the cursor target. Do not require voice for a silent brief.

## Success and review

Read `references/efficient-review.md`. Group independent file/guide reads and target changed shots
during revisions. Broaden after shared or timing changes; retain the complete final review below.

End at the real successful state. Tell the viewer what to check, for example the saved item appearing
in its list or an exported file opening correctly. An optional short "Try it with your own project"
prompt can encourage practice. Do not claim that an extra replay or recap guarantees learning.

Use the normal build and review loop: editable scene, text, footage and audio clips, status after
changes, source-frame checks, wide and mobile contact sheets, audio measurements and heavy-scene
playback checks. Check that a novice could follow every action without guessing a hidden step.
Check the order, cue timing, pointer visibility, label accuracy, reading time, final state and caption
placement. Retain both-format and sound review. Export only when requested.

Reuse current material and passed checks. Check changed regions first, then review the complete edit
in both formats. Run page-heavy checks in sequence as `website-howto.md` requires. If a tool stalls,
inspect active work before retrying. Record what passed and what remains blocked; do not claim a
build alone proves instructional accuracy.
