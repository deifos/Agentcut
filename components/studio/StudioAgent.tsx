"use client";

import { createContext, useContext } from "react";
import type { AgentInfo } from "@/lib/studio/types";

/** The agent the chat talks to (Claude, Codex, …), for copy anywhere in the studio. */
export const StudioAgentContext = createContext<AgentInfo | null>(null);

/** "Claude", "Codex"… ("Agent" until the helper has said which one). */
export function useAgentName() {
  return useContext(StudioAgentContext)?.name ?? "Agent";
}
