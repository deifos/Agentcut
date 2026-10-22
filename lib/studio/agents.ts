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
