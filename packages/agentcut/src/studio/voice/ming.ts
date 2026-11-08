import { MING_VOICES } from "./ming-catalog.js";
export { MING_VOICES } from "./ming-catalog.js";
import { spawn } from "node:child_process";
import { appendFileSync, existsSync, readFileSync, readdirSync } from "node:fs";
import { mkdir, mkdtemp, readFile, rm, writeFile } from "node:fs/promises";
import { homedir } from "node:os";
import { join, resolve } from "node:path";
import { randomInt } from "node:crypto";
import type { GenerateVoiceInput, VoiceAdapter } from "./types.js";

export const MING_MODEL = "inclusionAI/Ming-3.0-tts-0.5b";
export const MING_REVISION = "7247f4c94a5b2e987404ed28a5cfec41b1a4ca61";
const SOURCE_REVISION = "a39b80660bdc5a4394d5e1d41af6dbfd9c443a54";
const setupHelp =
  "Run agentcut --setup-ming --ming-dir <folder> with Python 3.10-3.12. Use --ming-device cpu for CPU-only setup.";
// Only this small pointer lives in the home directory. All model/runtime/cache files live in the selected folder.
function pointerPath() {
  return join(homedir(), ".agentcut", "ming-location.json");
}
export function mingDir() {
  if (process.env.AGENTCUT_MING_DIR)
    return resolve(process.env.AGENTCUT_MING_DIR);
  try {
    const saved = JSON.parse(readFileSync(pointerPath(), "utf8"));
    if (typeof saved.directory === "string") return resolve(saved.directory);
  } catch {}
  return join(
    process.env.AGENTCUT_MODEL_CACHE || join(homedir(), ".agentcut", "models"),
    "ming",
  );
}
function pythonPath(dir: string) {
  return join(
    dir,
    "venv",
    process.platform === "win32" ? "Scripts/python.exe" : "bin/python",
  );
}
export function mingReady(dir = mingDir()) {
  try {
    const ready = JSON.parse(readFileSync(join(dir, "ready.json"), "utf8"));
    return (
      ready.model === MING_REVISION &&
      ready.source === SOURCE_REVISION &&
      [
        pythonPath(dir),
        join(dir, "model", "model.safetensors"),
        join(dir, "source", "ming_tts.py"),
        ...(ready.device === "cpu"
          ? [
              join(dir, "source-cpu", "ming_tts.py"),
              join(dir, "source-cpu", "modeling_bailingmm.py"),
            ]
          : []),
      ].every(existsSync)
    );
  } catch {
    return false;
  }
}
export type MingDevice = "cpu" | "cuda";
export function mingDevice(dir = mingDir()): MingDevice {
  const override = process.env.AGENTCUT_MING_DEVICE;
  if (override && override !== "cpu" && override !== "cuda")
    throw new Error("AGENTCUT_MING_DEVICE must be cpu or cuda.");
  if (override === "cpu" || override === "cuda") return override;
  return installedMingDevice(dir);
}
function installedMingDevice(dir: string): MingDevice {
  try {
    return JSON.parse(readFileSync(join(dir, "ready.json"), "utf8")).device ===
      "cpu"
      ? "cpu"
      : "cuda";
  } catch {
    return "cuda";
  }
}
export async function prepareMingCpu(dir: string) {
  await mkdir(join(dir, "source-cpu"), { recursive: true });
  for (const name of ["ming_tts.py", "modeling_bailingmm.py"]) {
    const original = await readFile(join(dir, "source", name), "utf8");
    if (!original.includes("torch.bfloat16"))
      throw new Error("Unexpected Ming source; CPU patch was not applied.");
    const patched = original
      .replaceAll("torch.bfloat16", "torch.float32")
      .replaceAll(
        "torch.autocast(device_type='cuda', dtype=torch.float32)",
        "__import__('contextlib').nullcontext()",
      );
    await writeFile(join(dir, "source-cpu", name), patched);
  }
}

async function run(
  dir: string,
  command: string,
  args: string[],
  input = "",
  timeout = 600_000,
) {
  return new Promise<void>((resolveRun, reject) => {
    const child = spawn(command, args, {
      cwd: dir,
      windowsHide: true,
      shell: false,
      env: {
        ...process.env,
        PYTHONUTF8: "1",
        PYTHONNOUSERSITE: "1",
        HF_HUB_OFFLINE: "1",
        TEMP: join(dir, "temp"),
        TMP: join(dir, "temp"),
        TMPDIR: join(dir, "temp"),
        PIP_CACHE_DIR: join(dir, "pip-cache"),
        HF_HOME: join(dir, "hf-cache"),
        TORCH_HOME: join(dir, "torch-cache"),
        XDG_CACHE_HOME: join(dir, "cache"),
        CUDA_CACHE_PATH: join(dir, "cuda-cache"),
        TORCH_EXTENSIONS_DIR: join(dir, "torch-extensions"),
        TORCHINDUCTOR_CACHE_DIR: join(dir, "torch-compile-cache"),
        TRITON_CACHE_DIR: join(dir, "triton-cache"),
        HF_XET_CACHE: join(dir, "hf-cache", "xet"),
        HF_HUB_DISABLE_SYMLINKS_WARNING: "1",
      },
      stdio: ["pipe", "pipe", "pipe"],
    });
    let error = "";
    let timedOut = false;
    const timer = setTimeout(() => {
      timedOut = true;
      if (process.platform === "win32" && child.pid) {
        const killer = spawn(
          "taskkill",
          ["/PID", String(child.pid), "/T", "/F"],
          { windowsHide: true, stdio: "ignore" },
        );
        killer.on("error", () => child.kill());
      } else child.kill();
    }, timeout);
    child.stderr.on("data", (data) => {
      error = (error + data.toString()).slice(-6000);
    });
    child.stdout.on("data", (data) => {
      if (timeout > 600_000) appendFileSync(join(dir, "setup.log"), data);
    });
    child.stdin.on("error", () => {});
    child.on("error", (e) => {
      clearTimeout(timer);
      reject(e);
    });
    child.on("close", (code) => {
      clearTimeout(timer);
      if (timedOut) {
        reject(
          new Error(
            "Ming timed out. Try a shorter script. No other provider was called.",
          ),
        );
        return;
      }
      code === 0
        ? resolveRun()
        : reject(new Error(`Ming failed (${code}). ${error}`));
    });
    child.stdin.end(input);
  });
}

const DOWNLOAD = `
import json, pathlib, urllib.request, os
root = pathlib.Path.cwd()
base = 'https://raw.githubusercontent.com/inclusionAI/Ming-3.0-tts/${SOURCE_REVISION}/'
files = ['LICENSE','LEGAL.md','requirements.txt','ming_tts.py','modeling_bailingmm.py','configuration_bailingmm.py','prompt_contract.py','tts_tasks.py','spkemb_extractor.py',
 'audio_tokenizer/audio_encoder.py','audio_tokenizer/configuration_audio_vae.py','audio_tokenizer/istft.py','audio_tokenizer/modeling_audio_vae.py','audio_tokenizer/rope.py','audio_tokenizer/vae_modules.py',
 'fm/CFM.py','fm/dit.py','fm/flowloss.py','fm/modules.py',
 'frontend/__init__.py','frontend/audio_processing.py','frontend/number_en.py','frontend/text_processing.py','frontend/text_segment_cut.py','frontend/toolkit.py']
for name in files:
 target = root / 'source' / name
 target.parent.mkdir(parents=True, exist_ok=True)
 with urllib.request.urlopen(base + name, timeout=90) as response:
  target.write_bytes(response.read())
os.environ.pop('HF_HUB_OFFLINE', None)
from huggingface_hub import snapshot_download
snapshot_download('${MING_MODEL}', revision='${MING_REVISION}', local_dir=str(root / 'model'), allow_patterns=['*.json','*.txt','*.onnx','*.safetensors','README.md'], max_workers=2)
`;

export async function setupMing(
  directory?: string,
  log: (message: string) => void = console.log,
  requestedDevice: "auto" | MingDevice = "auto",
) {
  if (!["win32", "linux"].includes(process.platform) || process.arch !== "x64")
    throw new Error(
      "Ming setup currently supports Windows and Linux on x64. Included samples work without installation.",
    );
  const dir = resolve(directory || mingDir());
  if (!["auto", "cpu", "cuda"].includes(requestedDevice))
    throw new Error("Choose CPU or NVIDIA GPU for Ming.");
  if (
    mingReady(dir) &&
    (requestedDevice === "auto" || installedMingDevice(dir) === requestedDevice)
  ) {
    await prepareMingCpu(dir);
    await mkdir(join(homedir(), ".agentcut"), { recursive: true });
    await writeFile(pointerPath(), JSON.stringify({ directory: dir }));
    log(`Ming is already installed in ${dir}.`);
    return;
  }
  await mkdir(dir, { recursive: true });
  for (const name of [
    "temp",
    "pip-cache",
    "hf-cache",
    "torch-cache",
    "cache",
    "cuda-cache",
    "wheels",
  ])
    await mkdir(join(dir, name), { recursive: true });
  log(
    `Ming 0.5B setup: ${dir}. Model download is about 3 GB; runtime packages need several more GB.`,
  );
  const python =
    process.env.AGENTCUT_PYTHON ||
    (process.platform === "win32" ? "python" : "python3");
  await run(dir, python, [
    "-c",
    "import sys; assert (3,10) <= sys.version_info[:2] <= (3,12), 'Use Python 3.10-3.12 for the pinned Ming runtime.'",
  ]);
  let device: MingDevice = requestedDevice === "cpu" ? "cpu" : "cuda";
  if (requestedDevice !== "cpu") {
    try {
      await run(dir, "nvidia-smi", [
        "--query-gpu=name",
        "--format=csv,noheader",
      ]);
    } catch {
      if (requestedDevice === "cuda")
        throw new Error("NVIDIA GPU not found. Choose CPU mode instead.");
      device = "cpu";
    }
  }
  log(
    device === "cpu"
      ? "CPU mode: slow generation. At least 16 GB system RAM recommended; allow about 9 GB free for Ming."
      : "NVIDIA GPU mode.",
  );
  await rm(join(dir, "ready.json"), { force: true });
  if (!existsSync(pythonPath(dir)))
    await run(dir, python, ["-m", "venv", join(dir, "venv")]);
  if (
    device === "cuda" &&
    readdirSync(join(dir, "wheels")).some(
      (name) => name.startsWith("torch-2.6.0+cu124-") && name.endsWith(".whl"),
    )
  ) {
    log("Installing the cached CUDA wheel...");
    await run(
      dir,
      pythonPath(dir),
      [
        "-m",
        "pip",
        "install",
        "--no-index",
        "--find-links",
        join(dir, "wheels"),
        "--no-deps",
        "torch==2.6.0+cu124",
      ],
      "",
      1800_000,
    );
  }
  log(
    `Installing ${device === "cpu" ? "CPU" : "CUDA"} PyTorch in the selected folder...`,
  );
  const runtimePackage = (name: string, version: string) => {
    const wheel = join(dir, "wheels", `${name}-${version}-py3-none-any.whl`);
    return existsSync(wheel) ? wheel : `${name}==${version}`;
  };
  await run(
    dir,
    pythonPath(dir),
    [
      "-m",
      "pip",
      "install",
      "--disable-pip-version-check",
      `torch==2.6.0+${device === "cpu" ? "cpu" : "cu124"}`,
      `torchaudio==2.6.0+${device === "cpu" ? "cpu" : "cu124"}`,
      "--find-links",
      join(dir, "wheels"),
      "--index-url",
      `https://download.pytorch.org/whl/${device === "cpu" ? "cpu" : "cu124"}`,
    ],
    "",
    3600_000,
  );
  if (device === "cuda")
    await run(dir, pythonPath(dir), [
      "-c",
      "import torch; assert torch.cuda.is_available(), 'Ming needs an NVIDIA GPU and a compatible driver.'; assert torch.cuda.is_bf16_supported(), 'Ming needs BF16 GPU support.'",
    ]);
  log("Installing speech runtime packages...");
  await run(
    dir,
    pythonPath(dir),
    [
      "-m",
      "pip",
      "install",
      "--disable-pip-version-check",
      runtimePackage("transformers", "4.46.3"),
      "--find-links",
      join(dir, "wheels"),
      runtimePackage("accelerate", "1.3.0"),
      "huggingface_hub==0.36.0",
      "numpy==2.2.6",
      "soundfile==0.12.1",
      "tqdm",
      "loguru",
      runtimePackage("x_transformers", "2.9.2"),
      runtimePackage("diffusers", "0.33.0"),
      "onnxruntime",
      "inflect",
      "einops",
      "packaging",
    ],
    "",
    1800_000,
  );
  log("Downloading pinned Ming source and model files...");
  await run(dir, pythonPath(dir), ["-c", DOWNLOAD], "", 3600_000);
  await prepareMingCpu(dir);
  await run(dir, pythonPath(dir), [
    "-c",
    `import sys; sys.path.insert(0, 'source'); ${device === "cpu" ? "sys.path.insert(0, 'source-cpu');" : ""} from ming_tts import MingTTS; MingTTS('model', device='${device === "cpu" ? "cpu" : "cuda:0"}', text_normalization=False)`,
  ]);
  await writeFile(
    join(dir, "ready.json"),
    JSON.stringify({ model: MING_REVISION, source: SOURCE_REVISION, device }),
  );
  await mkdir(join(homedir(), ".agentcut"), { recursive: true });
  await writeFile(pointerPath(), JSON.stringify({ directory: dir }));
  log(
    "Ming is installed. Reopen Voice-over and select Ming 0.5B. All downloads and caches are in the selected folder.",
  );
}

export function validateMing(
  input: GenerateVoiceInput,
  voice: string,
  model: string,
) {
  if (model !== MING_MODEL) throw new Error("Select Ming 3.0 0.5B.");
  const selected = MING_VOICES.find((v) => v.id === voice);
  if (!selected)
    throw new Error("Select a listed Ming voice or description mode.");
  if (
    input.language &&
    !/^(en(?:[-_](us|gb))?|english|american english|british english)$/i.test(
      input.language.trim(),
    )
  )
    throw new Error("This Ming integration currently supports English only.");
  if (
    /[^\p{Script=Latin}\p{Script=Common}\p{Script=Inherited}\s]/u.test(
      input.text,
    )
  )
    throw new Error("Use an English script with this Ming integration.");
  if (input.speed !== undefined && input.speed !== 1)
    throw new Error(
      "Ming named voices use their original speed. Use description mode for pace instructions.",
    );
  if (
    (input.gender && input.gender !== selected.gender) ||
    (input.accent && input.accent !== selected.accent)
  )
    throw new Error(
      "The selected Ming voice does not match the requested gender or accent. In description mode, put these requests in style.",
    );
  const language = input.language?.trim().toLowerCase().replace("_", "-");
  if (
    selected.accent &&
    ((["en-gb", "british english"].includes(language ?? "") &&
      selected.accent !== "British") ||
      (["en-us", "american english"].includes(language ?? "") &&
        selected.accent !== "American"))
  )
    throw new Error(
      "The selected Ming voice does not match the requested English accent.",
    );
  const described = voice === "freeform" || voice === "voice_design";
  if (described && !input.style?.trim())
    throw new Error("Add style instructions for Ming description mode.");
  if (!described && input.style?.trim())
    throw new Error(
      "Ming cannot combine a named voice with style instructions. Select description mode, or remove style.",
    );
  if (/\[[^\]]+\]/.test(input.text))
    throw new Error(
      "Inline expression tags need Ming's reference-voice mode, which is not included here. Use description mode and describe the expression in style.",
    );
}

const SYNTHESIZE = `
import json, sys, pathlib, torch, soundfile as sf
p = json.load(sys.stdin)
sys.path.insert(0, str(pathlib.Path.cwd() / 'source'))
if p['device'] == 'cpu':
 sys.path.insert(0, str(pathlib.Path.cwd() / 'source-cpu'))
from ming_tts import MingTTS
torch.manual_seed(p['seed'])
torch.set_num_threads(4)
if p['device'] == 'cuda':
 assert torch.cuda.is_available(), 'The selected GPU is unavailable. Choose CPU setup to use Ming without a GPU. No other provider was called.'
model = MingTTS(str(pathlib.Path.cwd() / 'model'), device='cpu' if p['device'] == 'cpu' else 'cuda:0', text_normalization=False)
assert all(t.device.type == p['device'] for t in model.model.parameters())
kwargs = dict(text=p['text'], use_zero_spk_emb=True, max_length=120)
if p['voice'] == 'freeform':
 kwargs.update(task='FREEFORM', instruction=p['style'])
elif p['voice'] == 'voice_design':
 kwargs.update(task='VOICE_DESIGN', controls={'style':p['style']})
else:
 kwargs.update(task='IP', controls={'ip':p['voice']})
audio = model.synthesize(**kwargs)
sf.write(p['output'], audio.detach().float().cpu().numpy().reshape(-1), model.sample_rate, subtype='PCM_16')
`;
let queue: Promise<unknown> = Promise.resolve();
export const adapter: VoiceAdapter = {
  spec: {
    id: "ming",
    name: "Ming 0.5B (local)",
    local: true,
    keyUrl: "https://github.com/inclusionAI/Ming-3.0-tts/blob/main/LICENSE",
    keyHint: setupHelp,
    envVar: "",
    defaultModel: MING_MODEL,
    models: [
      { id: MING_MODEL, label: "Ming 3.0 0.5B (CPU or NVIDIA GPU, MIT)" },
    ],
    defaultVoice: "US_Emma",
    styleNote:
      "MIT license. English integration. Choose a named voice, or select description mode and supply style instructions. These modes cannot be combined. Write numbers as spoken words. CPU or compatible NVIDIA GPU. CPU is slow and needs about 9 GB free RAM. About 3 GB of model files, plus runtime packages.",
  },
  voices: MING_VOICES,
  async listVoices() {
    return this.voices!;
  },
  async verify() {
    throw new Error("Ming does not use an API key.");
  },
  async synthesize(_key, input, model, voice) {
    validateMing(input, voice, model);
    if (!mingReady())
      throw new Error(
        `Ming is not installed. ${setupHelp} No other provider was called.`,
      );
    const task = queue
      .catch(() => {})
      .then(async () => {
        const dir = mingDir();
        await mkdir(join(dir, "temp"), { recursive: true });
        const temp = await mkdtemp(join(dir, "temp", "voice-"));
        try {
          const output = join(temp, "voice.wav");
          await run(
            dir,
            pythonPath(dir),
            ["-c", SYNTHESIZE],
            JSON.stringify({
              text: input.text,
              style: input.style,
              voice,
              output,
              seed: randomInt(0, 2147483647),
              device: mingDevice(dir),
            }),
            mingDevice(dir) === "cpu" ? 1800_000 : 600_000,
          );
          const data = await readFile(output);
          if (
            data.length <= 44 ||
            data.toString("ascii", 0, 4) !== "RIFF" ||
            data.toString("ascii", 8, 12) !== "WAVE"
          )
            throw new Error("Ming returned no valid WAV audio.");
          return { data, ext: "wav" as const };
        } finally {
          await rm(temp, { recursive: true, force: true });
        }
      });
    queue = task.catch(() => {});
    return task;
  },
};
