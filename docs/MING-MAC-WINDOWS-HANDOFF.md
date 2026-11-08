# Ming voice-over: Mac implementation and Windows regression checks

## Task for the next agent

Finish Ming 3.0 0.5B support on the user's Mac. Keep the tested Windows CPU and NVIDIA GPU paths working. Implement and test on real hardware. Do not mark Mac support ready from a successful import, model load, or mocked test alone.

Read the root `AGENTS.md` before editing. Preserve unrelated changes. The user will review, commit, and push; do not publish a release or upload model weights as part of this task.

Use simple, clear English in progress updates. Keep large downloads, runtime packages, model files, and caches in the folder the user selects. On the Windows machine, use E:, not C:.

## State at handoff — 2026-11-07

- Kokoro is still the default voice provider. Ming must be selected explicitly. No local failure may call a paid provider.
- Woof was removed from source, setup commands, documentation, and package output.
- Ming currently accepts Windows/Linux x64 setup. **Mac and ARM setup are deliberately blocked. Linux has not been tested on hardware.**
- Windows was tested with Python 3.11, a Ryzen 5 3600, 64 GB system RAM, and an RTX 3060 with 12 GB GPU memory.
- CPU testing used a separate venv with `torch==2.6.0+cpu` and `torchaudio==2.6.0+cpu`. It reported `torch.version.cuda is None` and `torch.cuda.is_available() == False`. Non-Torch dependencies were reused from the existing installation. The pinned model files were reused through a directory junction; this was not a full clean download of every dependency.
- The real Agentcut adapter generated three CPU clips: a 200-character script spanning text chunks (12 seconds of audio in 168.9 seconds), freeform delivery (2 seconds in 42.9 seconds), and voice design (2.2 seconds in 38.2 seconds). Peak child-process memory was about 8.85 GiB. Times are approximate and depend on the machine and other work running on it.
- All three WAV files had nonzero audio and no clipped samples. Local Whisper transcription matched the scripts after normalization of punctuation, spaces, and capitalization. This does not replace listening for voice quality or delivery.
- A real NVIDIA GPU generation also passed after the CPU changes.
- Fast voice tests, browser tests, helper build, type checks, lint for changed UI files, and package inspection passed. A production Webpack build passed.
- The default Turbopack build failed in Google font resolution. Root `package.json` now uses `next build --webpack`. Keep this separate from Ming runtime work; do not change the compiler again without a successful build.
- No code release was published during this work.

Windows evidence is local to that machine:

- `E:/Agentcut-models/ming-cpu-release/results/`: WAV files, timings, memory measurement, and transcripts.
- `E:/Agentcut-models/ming/sample-upload-verification.json`: uploaded file URLs, sizes, and SHA-256 hashes.
- `E:/Agentcut-models/ming/`: existing NVIDIA installation.

These paths are evidence, not application defaults. They will not exist on the Mac.

## Where samples live

The 28 Kokoro and 3 named Ming samples are uploaded to the existing shared R2 sound storage:

- `https://files.screenslick.com/studio/voice-samples/kokoro/<voice-id>.wav`
- `https://files.screenslick.com/studio/voice-samples/ming/US_Emma.wav`
- `https://files.screenslick.com/studio/voice-samples/ming/UK_George.wav`
- `https://files.screenslick.com/studio/voice-samples/ming/UK_Charlotte.wav`

Each uploaded clip was downloaded from its public URL and checked against the local file hash. License/provenance files were uploaded too.

Fallback copies remain in `public/voice-samples/kokoro/` and `public/voice-samples/ming/`. Catalog entries have `previewUrl` and `fallbackPreviewUrl`. Sample playback needs no model, helper, Python, or GPU. Do not replace this with first-play model generation.

Custom previews for Ming description modes are different: the helper generates them locally and caches them in `<selected Ming folder>/previews/`. They do not become project assets. User-created voice-overs are saved in the project's `assets/voice/` folder.

Do not copy bucket credentials into this repo. New uploads are not needed for Mac support.

## Files to inspect

| File | Purpose |
| --- | --- |
| `packages/agentcut/src/studio/voice/ming.ts` | Setup, platform check, package pins, device selection, CPU source adaptation, synthesis, timeout, and readiness marker |
| `packages/agentcut/src/studio/voice/ming-catalog.ts` | Named voices, description modes, and sample URLs |
| `packages/agentcut/src/studio/voice/previews.ts` | Local custom-preview cache and request deduplication |
| `packages/agentcut/src/studio/voice.ts` | Provider settings, routing, and project audio creation |
| `packages/agentcut/src/studio/host.ts` | Confirmed setup request, directory/device validation, installation state, and preview endpoint |
| `packages/agentcut/src/studio/cli.ts` | `--setup-ming`, `--ming-dir`, and `--ming-device` |
| `components/studio/LocalVoices.tsx` | Local voice cards, installation prompt, CPU/RAM warning, and script form |
| `components/studio/VoiceSamples.tsx` | Shared sample player and CDN-to-local fallback |
| `components/studio/VoicesDialog.tsx` | Provider settings and generation form |
| `tests/ming-voice.test.mjs` | Validation, CPU adaptation, routing, and no-fallback checks |
| `tests/ming-runtime.test.mjs` | Opt-in real generation across three modes |
| `tests/voice-previews.test.mjs` | Cache isolation, local-only previews, and included WAV files |
| `tests/studio-rail-voice-browser.test.mjs` | UI, disconnected playback, installation confirmation, CDN fallback, and selected-voice generation |

## How the Windows implementation works

The model is `inclusionAI/Ming-3.0-tts-0.5b`, revision `7247f4c94a5b2e987404ed28a5cfec41b1a4ca61`. The source revision is `a39b80660bdc5a4394d5e1d41af6dbfd9c443a54`. Keep the model/source pins unless a tested compatibility fix requires a change.

The original source uses BF16 and CUDA autocast. Merely passing `device='cpu'` failed with a Float/BFloat16 mismatch. `prepareMingCpu()` creates two adapted files under `source-cpu/`, uses float32, and removes CUDA autocast contexts. The GPU source stays unchanged. The CPU path adds both source directories to Python's import path, with `source-cpu/` first.

`ready.json` records the model/source revisions and `device`. A small `~/.agentcut/ming-location.json` pointer records the selected folder. `AGENTCUT_MING_DIR` overrides the folder and `AGENTCUT_MING_DEVICE` overrides CPU/CUDA selection. Do not write a readiness marker until model loading succeeds.

The installer selects CPU or CUDA package indexes on Windows/Linux. **The `+cpu` version suffix and CPU index must not be assumed valid for macOS.** The Python executable is `venv/Scripts/python.exe` on Windows and `venv/bin/python` elsewhere.

Current generation modes are English named voices (`US_Emma`, `UK_George`, `UK_Charlotte`), `freeform`, and `voice_design`. Named voices cannot combine with style instructions. Description modes require style. Inline expression tags, reference cloning, and automatic number normalization are not supported. Spell out numbers. Keep these limits unless you implement and test a separate expansion.

## Mac implementation plan

1. Record macOS version, hardware model, physical RAM, Node architecture, and Python version/architecture. Check for Rosetta. Use a native Python environment where possible; do not mix arm64 and x64 packages.
2. Verify the current official PyTorch package support and compatible wheel versions for that Mac. Check the actual pinned requirements before changing them. Use a platform-specific install plan; preserve the tested Windows CPU/CUDA pins. Do not simply remove the platform guard and reuse the Windows install command.
3. Make **CPU work first**. Reuse the tested float32 adaptation if it works on Mac. Install in a fresh user-selected folder. Test a path containing spaces and an external volume if available. Keep pip, Hugging Face, Torch, temporary files, and model caches in that folder.
4. Run `pip check`, load the model, verify all model parameters are on CPU, and generate all three real test clips. Record load time, generation time, output duration, peak memory, and package versions.
5. Verify a clean installation, not only copied packages or a warm cache. Verify a second setup reuses files. Interrupt a setup and verify retry/recovery. Confirm a failed install is not marked ready.
6. Consider Apple GPU (`mps`) only after CPU passes. Treat MPS as a separate capability: check backend availability, supported number formats, attention, audio decoder, speaker encoder, and all generation modes. Do not send `mps` to code that currently assumes only `cpu`/`cuda`. Update device types, validation, readiness data, CLI, setup, synthesis assertions, and UI together if you add it.
7. Do not silently enable MPS CPU fallback and call the result GPU support. If a mixed path is needed, report it, measure it, and label it correctly. A tested Mac CPU path is acceptable even if MPS remains unsupported.
8. Make the UI offer only supported choices. Show the download size, recommended free disk space, memory needs, and slow CPU warning before confirmation. Do not start a model download when the user only plays a preset sample. Keep the explicit **Download and install** action.
9. Test timeout/error cleanup on macOS. Ensure a timed-out generation leaves no active Python worker and no temporary voice directory. Confirm the next request can succeed. Do not kill unrelated user processes.
10. Update the supported-platform text in the UI, CLI help, README, skill reference, and this handoff only after real tests pass. Run `npm run sync:skill` after editing `skills/agentcut/`.

## Test commands

Run fast checks from the repo root:

```sh
npm run helper:build
npm run typecheck
node --import tsx --test tests/kokoro-voice.test.mjs tests/ming-voice.test.mjs tests/voice-previews.test.mjs tests/studio-rail-voice-browser.test.mjs
npm run build
npm pack --dry-run --workspace agentcut
git diff --check
```

Browser tests need Chrome. A skipped browser test is not a browser pass. Inspect the Assets panel at a narrow width and the installation dialog on the Mac.

After implementing Mac setup, use a fresh selected folder. This example is for a Mac shell; replace the folder with the user's chosen location:

```sh
export AGENTCUT_MING_DIR="/Volumes/Models/Agentcut/ming-cpu"
export AGENTCUT_MING_DEVICE=cpu
mkdir -p "$AGENTCUT_MING_DIR/temp" "$AGENTCUT_MING_DIR/pip-cache"
export TMPDIR="$AGENTCUT_MING_DIR/temp"
export PIP_CACHE_DIR="$AGENTCUT_MING_DIR/pip-cache"
npm run studio --workspace agentcut -- --setup-ming --ming-dir "$AGENTCUT_MING_DIR" --ming-device cpu
"$AGENTCUT_MING_DIR/venv/bin/python" -m pip check
"$AGENTCUT_MING_DIR/venv/bin/python" -c 'import platform, torch; print(platform.platform(), platform.machine(), torch.__version__, torch.version.cuda, torch.cuda.is_available())'
AGENTCUT_MING_RUNTIME_TEST=1 node --import tsx --test tests/ming-runtime.test.mjs
```

The opt-in runtime test writes WAV files and timings under `<selected folder>/release-test-results/`. Without `AGENTCUT_MING_RUNTIME_TEST`, it skips. Its WAV/duration assertions alone do not prove correct speech: also check for silence/clipping, listen to every clip, and compare a local transcription with the input. Report any missed/repeated words. Check voice consistency at the longer script's chunk boundary.

For Windows regression, use separate CPU and CUDA installations. Keep test downloads and temporary files on E:. Do not switch or overwrite the user's working installation just to run a test. Test CPU with a genuinely CPU-only runtime, not only `CUDA_VISIBLE_DEVICES=-1` on a CUDA build.

## Acceptance checklist

- [ ] Fresh Mac CPU setup passes with compatible native wheels and no CUDA dependency.
- [ ] Actual named, freeform, voice-design, and multi-chunk speech pass audio and word checks.
- [ ] Memory and timings are recorded; installation and slow-generation warnings are accurate.
- [ ] Preset samples play from shared storage with no model/helper; local fallback works.
- [ ] Custom previews remain local and are reused; changing the description creates a different cache entry.
- [ ] Selecting a voice preserves its provider, voice ID, and description when creating project audio.
- [ ] Cancel/error/retry, paths with spaces, external storage, and missing dependencies are checked.
- [ ] Windows CPU and NVIDIA GPU paths remain working. If no Windows machine is available, explicitly record the regression tests still needed; do not claim a Windows retest.
- [ ] CPU, CUDA, and any MPS claims match real hardware evidence. Intel Mac, Apple Silicon, and Linux claims are recorded separately.
- [ ] No paid-provider fallback; Kokoro remains the default; Woof stays removed.
- [ ] Builds, type checks, browser tests, skill sync, and package contents pass.
- [ ] User-facing changes are recorded under Unreleased. No secrets, model weights, venvs, or local test caches enter the commit.

At completion, give the user a short report of changes, tested hardware, results, remaining limits, and the exact sample locations. Leave commit and push to the user unless they request otherwise.

## Release order agreed with the user

Finish and test Mac support before the version bump and helper publication. Both packages are currently `0.2.25`; do not publish this work under that existing version.

1. Finish the Mac implementation and the applicable Windows regression checks. Record any unavailable hardware tests explicitly.
2. Choose the next unused release version. Update root `package.json`, `packages/agentcut/package.json`, and `package-lock.json` together. Follow README → Releasing. Check `MIN_HELPER_VERSION` in `lib/version.ts`; the new install/preview endpoints require a helper that includes this work.
3. Move the final Unreleased notes into the new version section and run builds, tests, skill sync, and `npm pack --dry-run --workspace agentcut` again for that release.
4. Let the user review, commit, and push. Follow their instructions for tagging and publication.
5. Publish the helper to npm before deploying the updated website. Verify the published package version and installation. Then deploy the website and check its connection to the published helper.

The preset audio uploads are already complete. They do not publish the application or the helper.
