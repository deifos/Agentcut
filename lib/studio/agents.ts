import type { AgentInfo, StudioInfo } from "@/lib/studio/types";

/** Helpers before agents were pluggable only report Claude Code. */
const LEGACY_CLAUDE: Omit<AgentInfo, "found" | "path" | "version" | "error"> = {
  id: "claude",
  name: "Claude",
  product: "Claude Code",
  installUrl: "https://claude.com/claude-code",
  loginCommand: "claude",
};

/** The agents the connected helper can drive. */
export function studioAgents(info: StudioInfo | null): AgentInfo[] {
  if (!info) return [];
  if (info.agents?.length) return info.agents;
  return info.claude ? [{ ...LEGACY_CLAUDE, ...info.claude }] : [];
}

/** Whether the helper lets the page pick the agent (older helpers always use Claude). */
export function canPickAgent(info: StudioInfo | null) {
  return Boolean(info?.agents?.length);
}

/**
 * The agent the chat uses: the user's pick if it's installed, else the helper's default,
 * else the first one installed (else the first one, to show its install hint).
 */
export function pickAgent(
  agents: AgentInfo[],
  choice: string | null,
  defaultAgent: string | null | undefined,
): AgentInfo | null {
  const installed = agents.filter((agent) => agent.found);
  return (
    installed.find((agent) => agent.id === choice) ??
    installed.find((agent) => agent.id === defaultAgent) ??
    installed[0] ??
    agents[0] ??
    null
  );
}

/** The model picked for this agent, if it still offers it (else null: the CLI's default). */
export function pickModel(agent: AgentInfo | null, choices: Record<string, string>) {
  const id = agent ? choices[agent.id] : undefined;
  return agent?.models?.some((model) => model.id === id) ? (id as string) : null;
}

const MODEL_KEY = "agentcut.models";
const modelListeners = new Set<() => void>();
let modelSnapshot: { raw: string | null; value: Record<string, string> } = { raw: null, value: {} };

/** The model picked per agent ({ claude: "opus" }), kept in localStorage. */
export const modelChoiceStore = {
  subscribe(listener: () => void) {
    modelListeners.add(listener);
    const onStorage = (event: StorageEvent) => {
      if (event.key === MODEL_KEY) listener();
    };
    window.addEventListener("storage", onStorage);
    return () => {
      modelListeners.delete(listener);
      window.removeEventListener("storage", onStorage);
    };
  },
  get(): Record<string, string> {
    let raw: string | null = null;
    try {
      raw = window.localStorage.getItem(MODEL_KEY);
    } catch {}
    // Same object while the stored text is unchanged (useSyncExternalStore compares snapshots).
    if (raw !== modelSnapshot.raw) {
      let value: Record<string, string> = {};
      try {
        const parsed: unknown = raw ? JSON.parse(raw) : {};
        if (parsed && typeof parsed === "object") value = parsed as Record<string, string>;
      } catch {}
      modelSnapshot = { raw, value };
    }
    return modelSnapshot.value;
  },
  getServer(): Record<string, string> {
    return EMPTY_MODELS;
  },
  /** null goes back to the CLI's default. */
  set(agentId: string, model: string | null) {
    const next = { ...modelChoiceStore.get() };
    if (model) next[agentId] = model;
    else delete next[agentId];
    try {
      window.localStorage.setItem(MODEL_KEY, JSON.stringify(next));
    } catch {}
    for (const listener of modelListeners) listener();
  },
};
const EMPTY_MODELS: Record<string, string> = {};

const CHOICE_KEY = "agentcut.agent";
const listeners = new Set<() => void>();

/** The agent the user picked last (kept in localStorage; read with useSyncExternalStore). */
export const agentChoiceStore = {
  subscribe(listener: () => void) {
    listeners.add(listener);
    const onStorage = (event: StorageEvent) => {
      if (event.key === CHOICE_KEY) listener();
    };
    window.addEventListener("storage", onStorage);
    return () => {
      listeners.delete(listener);
      window.removeEventListener("storage", onStorage);
    };
  },
  get(): string | null {
    try {
      return window.localStorage.getItem(CHOICE_KEY);
    } catch {
      return null;
    }
  },
  getServer(): string | null {
    return null;
  },
  set(id: string) {
    try {
      window.localStorage.setItem(CHOICE_KEY, id);
    } catch {}
    for (const listener of listeners) listener();
  },
};
