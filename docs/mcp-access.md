# External MCP access

The approved Instagram how-to is the quality reference. This change exposes the existing
creative workflow to external MCP clients. It does not replace that workflow with the release
announcement prototype or remove creative and review steps.

| Resource or task | MCP access | Check |
| --- | --- | --- |
| Main skill and supporting guides | `agentcut_guide`, `agentcut://guide/...` resources | Shipped text matches the source skill |
| Tool discovery | `agentcut_capabilities`, standard `tools/list`, server instructions | Index covers all registered tools |
| Animated components | `agentcut_components` | Live `chat-thread` props and usage returned |
| Music | `agentcut_music_catalog`, `agentcut_add_catalog_music` | Live search and MP3 import passed |
| Sound effects | `agentcut_sfx_catalog`, `agentcut_add_sfx` | Live search and effect import passed |
| B-roll | Existing search/add tools | Registration checked; download not repeated |
| Voice, generated music, transcription | Existing options/generation/transcription tools | Live options checked; no new paid generation for this access test |
| Audio review, preview and export | Existing listening/analysis/playback/export tools | Registration checked; full export and mix review not repeated |
| Project authoring | `agentcut_list_files`, `agentcut_read_file`, `agentcut_write_file` | External client created a scene and edited notes; stale writes and invalid manifests refused |
| Presets and toolkit | File scope `library` or `toolkit`; `agentcut_copy_file` | Preset discovery, recipe reading/copying, and styles guide reading passed |
| Local app source | `agentcut_sources`, file scope `source` | Only configured source IDs accepted; source remains read-only |
| Visual review | Capture and contact-sheet tools return native MCP image blocks plus saved paths | Live 1920×1080 and 1080×1920 frames, and a three-frame contact sheet returned |

The live check used an isolated copy of the approved project. The original video files were
not edited. Frame captures used scale 1. After preview setup, the two single-frame checks took
about 2.8 and 1.7 seconds, and the contact sheet took about 3.1 seconds. These are tool timings,
not a measurement of total video creation time or a promise of future speed.

`npm run helper:build` and `npm run test:mcp-access` check the compiled stdio server, real host
file handlers and HTTP transport, guide resources, native image responses, file conflicts,
manifest validation, path bounds, linked-folder escapes and asset overwrite protection.
The transport image fixture is separate from the live editor check.

The helper and MCP process must be restarted after updating local code. Keep the studio page
connected for catalogs, imports, capture, audio review, playback and export. Source folders must
already be configured with `--add-dir`; MCP cannot grant itself access. Provider options report
configuration without returning keys.

A fresh video made from the same prompt by an external model has not yet been compared with
the approved result. The access tests establish available tools and assets, not equal creative
judgment across models or an end-to-end speed improvement.
