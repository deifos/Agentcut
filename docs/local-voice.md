# Local Kokoro voice-over

Generic voice-over requests use Kokoro, even when paid provider keys exist. A user can select a paid provider in the Voice-over dialog, or ask the agent for one explicitly. There is no automatic paid fallback.

## Runtime and downloads

The helper uses `kokoro-js` 1.2.1 with `onnx-community/Kokoro-82M-v1.0-ONNX`, q8, on the CPU. The first generation downloads the 92,361,116-byte model and small tokenizer/configuration files. The runtime ships with the helper dependency; model setup is on demand. Models are cached in `~/.agentcut/models`, or `AGENTCUT_MODEL_CACHE`. The loaded engine is reused and synthesis is serial. Failed setup can be retried. First use needs internet access and write access to the cache. Later use can run offline once the files are cached.

This integration exposes the runtime's 28 English voices: American and British. It does not expose the upstream Python runtime's other languages. Supply the language explicitly for non-English requests so unsupported language is rejected before synthesis. Latin-script text cannot reliably identify a language by itself. Kokoro does not accept free-form style instructions. Speed is 0.5–2. Long scripts are split into bounded English chunks before synthesis and combined into a 24 kHz mono PCM WAV. Use media inspection and transcription for exact length, word timings and caption checks.

## Catalog and previews

`kokoro-catalog.ts` is shared by helper voice options and the human preview UI. IDs, names, language/accent and female/male labels are from the upstream catalog and ScreenSlick's catalog. These are supplied labels, not demographic judgments from audio. All 28 IDs are checked against the installed runtime. Included WAV samples were copied from ScreenSlick under its MIT license; its full license is in `public/voice-samples/kokoro/SCREENSLICK-LICENSE.txt`. ScreenSlick was read only.

The `suggestedUses` values are ScreenSlick director-playbook choices: Heart for tutorials, Emma for walkthroughs, Bella for demos, Puck for launches, Michael for sales. They are editorial defaults, not measured tone. Unknown tone/delivery is omitted. User voice, accent and gender constraints take priority. Do not promise a calm or energetic delivery from a catalog label. Audition a sample when tone matters. Preview samples use the same voice IDs; ScreenSlick generated them with q4, while Agentcut generation uses q8.

The model and kokoro-js use Apache-2.0. Model licensing does not grant rights to third-party brands, scripts or identities.

Primary sources checked 2026-11-05:

- [Runtime usage, CPU support and license](https://github.com/hexgrad/kokoro/tree/main/kokoro.js)
- [Model and quantization files](https://huggingface.co/onnx-community/Kokoro-82M-v1.0-ONNX/tree/main/onnx)
- [Upstream language and voice labels](https://huggingface.co/hexgrad/Kokoro-82M/blob/main/VOICES.md)

## Verification

On Windows with Node 24.22.1, the built helper generated short WAV files with Heart and Emma in a new process with network fetch disabled. Heart produced 3.48 seconds and Emma 3.40 seconds of valid WAV audio. The model was already cached; this verifies cached offline use and built helper imports, not a fresh installation on every operating system. The initial online model download and short synthesis also passed. Unit tests check generic local defaults with and without paid keys, explicit paid selections, no paid fallback after local errors, constraints, catalog/sample IDs and WAV metadata. Browser fixtures check preview start/stop and manual local/paid selection. No live project was changed.
