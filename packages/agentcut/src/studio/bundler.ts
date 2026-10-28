import { join } from "node:path";
import type { Plugin } from "esbuild";
import { listSceneNames, projectDir } from "./projects.js";
import { ensurePreviewDependencies, type WorkspacePaths } from "./workspace.js";

/**
 * Packages the web app provides to bundles (one copy of React/Remotion on the page).
 * Must match lib/studio/modules.ts (repo root).
 */
export const SHARED_MODULES = [
  "react",
  "react/jsx-runtime",
  "react/jsx-dev-runtime",
  "react-dom",
  "remotion",
  "@remotion/media",
  "@remotion/transitions",
  "@remotion/shapes",
  "@remotion/paths",
  "@remotion/noise",
  "agentcut/components",
];

const SHARED_PATTERN =
  /^(react|react-dom|remotion|@remotion\/(media|transitions|shapes|paths|noise))(\/.*)?$|^agentcut\/components$/;

export interface BundleMessage {
  text: string;
  file?: string;
  line?: number;
  column?: number;
  lineText?: string;
}

export interface BundleState {
  slug: string;
  revision: number;
  code: string | null;
  ok: boolean;
  errors: BundleMessage[];
  warnings: BundleMessage[];
  scenes: string[];
  builtAt: number;
  durationMs: number;
}

const toPosix = (path: string) => path.replace(/\\/g, "/");

export function buildEntrySource(paths: WorkspacePaths, slug: string, scenes: string[]) {
  const dir = projectDir(paths, slug);
  const lines = [
    `import { createStudioModule } from ${JSON.stringify(toPosix(join(paths.runtime, "index.tsx")))};`,
  ];
  scenes.forEach((scene, index) => {
    lines.push(`import Scene${index} from ${JSON.stringify(toPosix(join(dir, "scenes", scene)))};`);
  });
  lines.push(
    `export default createStudioModule({ ${scenes
      .map((scene, index) => `${JSON.stringify(scene)}: Scene${index}`)
      .join(", ")} });`,
  );
  return `${lines.join("\n")}\n`;
}

function studioPlugin(paths: WorkspacePaths): Plugin {
  return {
    name: "agentcut",
    setup(build) {
      build.onResolve({ filter: /^agentcut$/ }, () => ({
        path: join(paths.runtime, "helpers.tsx"),
      }));
      build.onResolve({ filter: SHARED_PATTERN }, (args) => ({ path: args.path, external: true }));
      build.onResolve({ filter: /\.css$/ }, (args) => ({
        errors: [
          {
            text: `CSS imports are not supported in Studio scenes (${args.path}). Use inline styles.`,
          },
        ],
      }));
    },
  };
}

function toMessages(list: { text: string; location?: { file: string; line: number; column: number; lineText: string } | null }[]) {
  return list.slice(0, 30).map((message) => ({
    text: message.text,
    file: message.location?.file,
    line: message.location?.line,
    column: message.location?.column,
    lineText: message.location?.lineText,
  }));
}

/** Build one project's browser bundle (CommonJS, shared modules external). */
export async function buildProjectBundle(
  paths: WorkspacePaths,
  slug: string,
  previous: BundleState | undefined,
): Promise<BundleState> {
  const esbuild = await import("esbuild");
  const scenes = listSceneNames(projectDir(paths, slug));
  const started = Date.now();
  const revision = (previous?.revision ?? 0) + 1;
  try {
    await ensurePreviewDependencies(paths.root);
    const result = await esbuild.build({
      stdin: {
        contents: buildEntrySource(paths, slug, scenes),
        resolveDir: paths.render,
        sourcefile: `${slug}.entry.tsx`,
        loader: "tsx",
      },
      bundle: true,
      write: false,
      format: "cjs",
      platform: "browser",
      target: "es2022",
      jsx: "automatic",
      // Fixed compiler settings: esbuild then never searches parent folders for a
      // tsconfig.json (a stray or broken one, e.g. C:\tsconfig.json, breaks the build).
      tsconfigRaw: { compilerOptions: { jsx: "react-jsx", useDefineForClassFields: true, verbatimModuleSyntax: false } },
      sourcemap: "inline",
      logLevel: "silent",
      nodePaths: [join(paths.root, "node_modules")],
      define: { "process.env.NODE_ENV": '"development"' },
      loader: { ".json": "json", ".svg": "text", ".txt": "text" },
      plugins: [studioPlugin(paths)],
    });
    const code = result.outputFiles?.[0]?.text ?? "";
    return {
      slug,
      revision,
      code,
      ok: true,
      errors: [],
      warnings: toMessages(result.warnings),
      scenes,
      builtAt: Date.now(),
      durationMs: Date.now() - started,
    };
  } catch (error) {
    const failure = error as { errors?: Parameters<typeof toMessages>[0]; warnings?: Parameters<typeof toMessages>[0]; message?: string };
    return {
      slug,
      revision,
      // Keep serving the last good code so the preview keeps playing.
      code: previous?.code ?? null,
      ok: false,
      errors: failure.errors ? toMessages(failure.errors) : [{ text: failure.message ?? String(error) }],
      warnings: failure.warnings ? toMessages(failure.warnings) : [],
      scenes,
      builtAt: Date.now(),
      durationMs: Date.now() - started,
    };
  }
}

/** Entry for a local `remotion render` (registerRoot with one composition per variant). */
export function buildRenderEntrySource(paths: WorkspacePaths, slug: string, scenes: string[]) {
  const dir = projectDir(paths, slug);
  const lines = [
    `import { Composition, registerRoot } from "remotion";`,
    `import { createStudioModule } from ${JSON.stringify(toPosix(join(paths.runtime, "index.tsx")))};`,
    `import project from ${JSON.stringify(toPosix(join(dir, "project.json")))};`,
    `import layers from ${JSON.stringify(toPosix(join(dir, "layers.json")))};`,
  ];
  scenes.forEach((scene, index) => {
    lines.push(`import Scene${index} from ${JSON.stringify(toPosix(join(dir, "scenes", scene)))};`);
  });
  lines.push(
    `const mod = createStudioModule({ ${scenes.map((s, i) => `${JSON.stringify(s)}: Scene${i}`).join(", ")} });`,
    `const Root = () => (`,
    `  <>`,
    `    {Object.entries(project.variants).map(([variant, size]) => (`,
    `      <Composition`,
    `        key={variant}`,
    `        id={"studio-" + variant}`,
    `        component={mod.StudioComposition as never}`,
    `        width={(size as { width: number }).width}`,
    `        height={(size as { height: number }).height}`,
    `        fps={project.fps}`,
    `        durationInFrames={project.durationInFrames}`,
    `        defaultProps={{ project, layers, variant, assetBase: "", libraryBase: "" } as never}`,
    `      />`,
    `    ))}`,
    `  </>`,
    `);`,
    `registerRoot(Root);`,
  );
  return `${lines.join("\n")}\n`;
}
