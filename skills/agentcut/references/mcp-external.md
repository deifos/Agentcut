# Working through MCP from outside the workspace

Use the same creative and review workflow whether you work inside Agentcut or through MCP.
Start with `agentcut_capabilities`, `SKILL.md` through `agentcut_guide`, then `agentcut_status`.
Supporting `references/*.md` files are available through `agentcut_guide` and MCP guide resources.
If you cannot read the helper's local disk, use `agentcut_list_files`, `agentcut_read_file`,
`agentcut_write_file` and `agentcut_copy_file`. These operate on the connected helper's workspace,
not your own current folder. Read before writing and pass the returned hash to preserve hand edits.
Use `baseHash: null` only for a new file. Call status after scene or timeline edits to check the build.

File scopes are `project`, `library` and read-only `toolkit`. Workspace `library/presets/...` is
scope `library`, path `presets/...`; `.agentcut/components/...` is scope `toolkit`, path
`components/...`; `.agentcut/runtime/...` is scope `toolkit`, path `runtime/...`. List preset files,
read their recipes and copy their scenes/assets into the project. Music, SFX and b-roll catalogs
use their existing search/add tools. Capture and contact-sheet calls return MCP images as well
as local paths, so visual review does not require a shared disk. Keep all creative and review steps.
For local app code, call `agentcut_sources`. Scope `source` reads only folders already allowed
with the helper's `--add-dir` option; pass the returned ID as `source` for list/read, or
`sourceRoot` for copy. Source folders stay read-only. MCP cannot grant itself new folder access.
