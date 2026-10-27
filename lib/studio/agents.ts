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

/** The thinking levels the agent offers with this model. */
export function effortsFor(agent: AgentInfo | null, model: string | null) {
  const id = model ?? agent?.defaultModel;
  return agent?.models?.find((m) => m.id === id)?.efforts ?? agent?.efforts ?? [];
}

/** The thinking level picked for this agent, if its model takes it (else null: the CLI's default). */
export function pickEffort(agent: AgentInfo | null, model: string | null, choices: Record<string, string>) {
  const effort = agent ? choices[agent.id] : undefined;
  return effort && effortsFor(agent, model).includes(effort) ? effort : null;
}

/** A choice per agent ({ claude: "opus" }), kept in localStorage; read with useSyncExternalStore. */
function perAgentStore(key: string) {
  const listeners = new Set<() => void>();
  const empty: Record<string, string> = {};
  let snapshot: { raw: string | null; value: Record<string, string> } = { raw: null, value: empty };
  const store = {
    subscribe(listener: () => void) {
      listeners.add(listener);
      const onStorage = (event: StorageEvent) => {
        if (event.key === key) listener();
      };
      window.addEventListener("storage", onStorage);
      return () => {
        listeners.delete(listener);
        window.removeEventListener("storage", onStorage);
      };
    },
    get(): Record<string, string> {
      let raw: string | null = null;
      try {
        raw = window.localStorage.getItem(key);
      } catch {}
      // Same object while the stored text is unchanged (useSyncExternalStore compares snapshots).
      if (raw !== snapshot.raw) {
        let value = empty;
        try {
          const parsed: unknown = raw ? JSON.parse(raw) : {};
          if (parsed && typeof parsed === "object") value = parsed as Record<string, string>;
        } catch {}
        snapshot = { raw, value };
      }
      return snapshot.value;
    },
    getServer(): Record<string, string> {
      return empty;
    },
    /** null goes back to the CLI's default. */
    set(agentId: string, value: string | null) {
      const next = { ...store.get() };
      if (value) next[agentId] = value;
      else delete next[agentId];
      try {
        window.localStorage.setItem(key, JSON.stringify(next));
      } catch {}
      for (const listener of listeners) listener();
    },
  };
  return store;
}

export const modelChoiceStore = perAgentStore("agentcut.models");
export const effortChoiceStore = perAgentStore("agentcut.efforts");

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
