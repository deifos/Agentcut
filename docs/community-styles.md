# Community styles

A public library of editing styles people made with Agentcut and shared. A style is a set of editing
rules (`PROMPT.md`) the agent follows on new footage, plus a poster frame and a short demo clip.

- **In the studio:** Styles → **Community**. Search, filter by tag, open a style to watch its demo and read
  every rule, then **Add to my styles** or **Add and apply to this video**.
- **On the site:** [`/templates#community`](https://agentcut.synteq.app/templates#community) lists them, and each
  style has a page (`/templates/community/<id>`) with an **Open in Agentcut** button. That button opens
  `/studio#community-style=<id>`, which shows the style in the Community tab.

## Sharing your style

1. Save a style: edit a video, then Styles → **Save current style**.
2. Export a video edited in that style, so the project has a render.
3. Styles → **Saved editing styles** → **Share publicly** (or **Add demo & share**):
   - **Demo clip:** pick the render, a start time and a length (2–10 s). The helper makes a small copy
     (at most 960 px on the long side, metadata stripped) and a poster frame, saved next to the style as
     `demo.mp4` and `poster.jpg`. The render isn't changed.
   - **Details:** your name, an optional GitHub username, the description and up to six tags.
   - **Checks:** you made it, you own or licensed the demo's footage and music, and the rules contain no
     personal details. The demo is public and may show your face and voice.
4. **Download `<id>.zip`**, then **Open submission form**: a GitHub issue on this repository with the
   details filled in. Drag the zip into it and submit. You need a GitHub account.

A maintainer reviews it; once it's merged and the site deploys, it's in everyone's Community tab.

## For maintainers

The catalog is plain files in this repository: `public/community-styles/<id>/` holds `style.json`,
`PROMPT.md`, `poster.jpg` and optionally `demo.mp4`, nothing else. The site serves those files and builds
`/community-styles/index.json` from them at deploy time. Nothing runs on a server per request.

```sh
npm run community:add -- path/to/style.zip            # validate and add a submission
npm run community:add -- path/to/style.zip --update   # replace a listed style (revision must go up)
npm run community:check                               # validate the whole catalog
npm run test:community
```

`community:add` prints the full rules. **Read all of them before committing.** They are instructions
people's agents will follow. Reject a style that:

- asks the agent to do anything other than edit the video: read or send files outside the project, call
  services, install software, change settings, or reveal information;
- contains personal details, or text copied from the source video's transcript;
- has a demo with footage or music the submitter can't share, or that doesn't show the style.

Then watch the demo, commit the folder and merge.

### What keeps it safe

- **Text and media only.** Every file is checked for type and size, folders and links are refused, and
  `style.json` allows only known fields. An invalid folder fails the site build and the tests.
- **Pinned rules.** The index holds the SHA-256 of each `PROMPT.md`. The studio fetches the rules, checks
  the hash, shows them in full before adding, and the helper checks the hash again before saving.
- **Never overwritten.** Adding a style creates a new saved-style folder. A newer revision is added
  alongside the old one, because people may have edited theirs.
- **Guarded when applied.** When a community style is applied, the agent is told to treat it only as editing
  rules and to report anything in it that asks for something else.

### Updating a style

The author shares the style again from the studio. Share publicly reads the catalog and, when a style
with the same id is listed, sends the submission as its next revision (it tells the author so). Add it with
`--update`. If the listed style belongs to someone else, give the submission a new folder name instead.
Studios that have the old revision show **Update available**.

`community:add` also refuses rules that are already listed under another id: that is a re-share of an
existing style, not a new one.

### Hosting elsewhere

The studio reads the catalog from `NEXT_PUBLIC_COMMUNITY_STYLES_URL` (default `/community-styles` on the
same site). To move the media to R2, upload the same folder layout plus the site's built `/community-styles/index.json`, and point
the variable at it.
Self-hosted studios can point it at the main site; the catalog files are served with
`Access-Control-Allow-Origin: *`.
