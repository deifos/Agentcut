# Graphics behind a person

Use agentcut_cutout_person when the user wants text or a graphic behind someone, or the person in front of something. Do not install segmentation packages, write background-removal scripts, export frames or use image APIs.

The stack, top to bottom: the person cutout, the graphic, the original footage. The footage stays in place, so a slightly loose edge only shows where the graphic touches the person.

1. Add the graphic on a track above the footage first, and note its clip ID and frames.
2. Call agentcut_cutout_person with the footage clipId, fromFrame and durationInFrames covering only the frames where the graphic is on screen, and behind with the graphic's clip ID. Cutting out only those frames is much faster than the whole clip. The first run also downloads a model of about 26 MB.
3. Check captures at the start, middle and end of the range, and where the graphic overlaps the person. Look at hair, hands and fast movement.

The tool adds a muted video clip to a track named Person cutout. Keep captions on a track above the cutout so the person doesn't cover them.

- It copies the footage clip's trim, speed, box, crop, fit and grade once. After changing those, or moving the footage, run the tool again with the same range; it replaces the earlier cutout on that range.
- A range can't start or end inside an enter or exit animation of the footage, and a project style camera needs the whole clip: the tool returns needs_full_clip, so omit the range.
- Works on the person in front; it can't choose between people, and it doesn't handle objects. Fast movement can leave soft or smeared edges. no_person means most of the range has nobody clearly visible.
- Without WebGPU the tool is several times slower and accepts up to 1,800 frames at a time; with WebGPU, 5,400.
- Frames stay on this computer. Scene-embedded video and remote URLs aren't supported.
- Files go to assets/cutouts/. Use Undo, or delete the clip, to remove a cutout.
