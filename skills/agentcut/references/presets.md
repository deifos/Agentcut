# Video style presets

A video style is a recipe for a whole video that isn't a talking head: a music or lyric video, an explainer, a
promo look. It lives in the workspace library, one folder per preset:

```
library/presets/<id>/
  PROMPT.md       the recipe: what to copy, the look, the workflow. Blanks in [brackets].
  preset.json     name, description, kind, preview/poster file names, and the blanks as form fields
  preview.mp4     ~10 s of a video made with it (16:9, 960×540, no audio needed)
  poster.jpg      one strong frame from it
  scenes/         the scene files the recipe copies into a project
  assets/         textures, fonts and other files the scenes need
  *.example.*     optional: a script or layers.json that seeds the first timeline
```

The style gallery (Styles tab → Video styles) lists every folder with a PROMPT.md, plays its preview, and shows a
form built from `preset.json` fields. When the user fills it in, you get a message like:

> Make a video with the "Punk Cut-Paper" video style: read library/presets/punk-cut-paper/PROMPT.md and follow it,
> with these values for its blanks: - Song: assets/song.mp3 - Photos: … - Lyrics: transcribe them. Make it as a new
> project.

## Using a preset

1. Read the preset's PROMPT.md and fill its blanks with the values given (ask only for what's missing and needed).
2. "As a new project": create it with `agentcut_create_project`, then copy the preset's `scenes/` and
   `assets/` into it (and any song/photos the user picked from another project or the library). "In this project":
   copy them into the open project and replace its timeline.
3. Follow the recipe's look and workflow exactly; it was written from a finished video, so don't improvise a new look.

## Saving a video style

When the user asks to save the open video's style ("save this as a preset", the gallery's Save style button):

1. Copy the project's scene files and the assets the look needs (textures, fonts, overlays: not the user's song or
   personal photos) into `library/presets/<id>/`. Make the scenes generic: no names, personal facts or lyrics baked in
   (put example content in an `*.example.*` file).
2. Write PROMPT.md: what to copy, fonts for project.json, every rule of the look (layout, motion, timing to beats or
   words, colors, overlays), and the workflow. Put what changes per video in [brackets] (song, photos, title, about,
   lyrics, …).
3. Write preset.json:
   ```json
   { "name": "Punk Cut-Paper", "description": "One sentence on the look.", "kind": "Music video",
     "preview": "preview.mp4", "poster": "poster.jpg",
     "fields": [
       { "id": "song", "label": "Song", "type": "audio", "required": true },
       { "id": "photos", "label": "Photos", "type": "images" },
       { "id": "title", "label": "Title", "type": "text", "placeholder": "HAPPY BIRTHDAY SAM" },
       { "id": "lyrics", "label": "Lyrics", "type": "longtext", "placeholder": "Paste the lyrics, or leave empty" }
     ] }
   ```
   Field types: `text`, `longtext`, `audio` (the user picks an audio file), `images` (the user picks photos).
4. preview.mp4 and poster.jpg: cut ~10 s from the latest render in `renders/` (960×540, H.264, no audio) and grab one
   frame, choosing a stretch without personal photos when you can. With no render yet, export one first or ask.
5. Tell the user it's in the Styles tab under Video styles.
