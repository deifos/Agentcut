# agentcut

The local helper for [Agentcut](https://github.com/deifos/Agentcut): it runs your coding agent
(Claude Code or Codex), your video workspace and live preview bundles for the Agentcut studio page.

```bash
npx -y agentcut
```

Then open https://agentcut.synteq.app/studio in Chrome. Run `npx -y agentcut --help` for options.
Needs Node.js 20.10 or newer.

For Style Spy, the helper downloads reference videos itself: it fetches
[yt-dlp](https://github.com/yt-dlp/yt-dlp) and [ffmpeg](https://ffmpeg.org) on first use into
`~/.agentcut/tools` (checksums verified, nothing installed system-wide; set `AGENTCUT_TOOLS` to use
another folder).

See the [changelog](https://github.com/deifos/Agentcut/blob/main/CHANGELOG.md) for what's new. If the
studio says **Update helper**, stop it and run `npx -y agentcut@latest`.

MIT
