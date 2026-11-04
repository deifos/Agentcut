# Phone editing modes

Use this guide when the phone edit prompt selects Social video or Light cleanup.
The user's written request sets the scope and overrides the mode and visual style.
For “only trim the end”, trim the end and check that cut. Do not apply a full makeover.
Keep source media, cuts, captions and graphics editable in the existing project format.
Use the selected output size; the helper scales the render. Keep the source aspect ratio
unless the user asks for a different format. Do not create extra formats by default.

## Social video

Read the transcript and inspect the footage before choosing cuts. Reuse the built-in
transcription cache and follow references/transcription.md and references/footage.md.
Find one clear message. Choose a strong, complete opening already present in the footage.
Reorder only when the meaning and context remain accurate. Do not invent a claim or hook.
Remove verified false starts, repeated takes, recording directions and long empty gaps.
Confirm ambiguous words and suspected mistakes by listening before removing them.
Keep natural breaths, complete words and enough pauses to understand the speaker.
Do not impose a fixed cut interval, duration, zoom pattern or number of effects.

Use readable captions for speech, unless the user says otherwise. Fix transcription
errors from the audio. Anchor each cue to the exact word occurrence, not the first match
for a repeated word. Re-map source times after cuts; check that cues follow the kept take.
Add graphics only when they explain the current idea. Keep faces and important content
visible and place text inside safe areas. Use relevant real assets. Do not force b-roll,
music, intro cards, a call to action, or a split-screen layout into every video.
Use music only when it helps and an available licensed track fits. Keep speech clear.

## Light cleanup

Preserve the sequence and visual treatment. Remove clear mistakes, duplicate takes and
excessive empty gaps. Keep natural pauses. Do not add captions, graphics, music or a new
opening unless requested. The style choice affects only visuals the user requests.

## Visual style

- Automatic: choose a restrained treatment that suits the footage and existing project.
- Clean: simple type, few accents, quiet transitions, limited motion.
- Bold: strong type and contrast, selective emphasis on key words; avoid constant motion.

These are directions, not saved style IDs. If the user names an existing saved style,
read references/editing-styles.md and use that style within the requested scope.
Mode controls the editing decisions; style controls their appearance.

## Final review

Review the edited timeline with the available audio and visual tools, not only the source.
Listen across changed speech boundaries and check the start and end for clipped words.
Check caption timing after cuts, repeated words, readability and safe areas. Inspect
frames at graphics transitions and the opening and ending. Check audio levels and that
music does not mask speech. Inspect the final project at its selected aspect ratio.
Follow references/craft.md for the available capture and sound checks.

Write a short review in notes.md: what changed, checks actually performed, timeline
timestamps for evidence, and any unresolved issue. Mark checks that could not be performed
as unverified. Fix material defects and check again. If a required check cannot be performed
or a material defect remains, write a failed phone-edit-result.json with the reason.
Only write the complete receipt after the requested edit and required checks succeed.
Do not assign a viral score or promise engagement. This review records evidence, not a
guarantee of audience performance.
