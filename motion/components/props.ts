// Prop defaults and checks for library components (metadata only: no React, no Remotion).
import { COMPONENT_METAS } from "./catalog";
import { getMotionStyle, styleValueFor } from "./styles";
import type { PropSpec, PropValues } from "./types";

function coerce(spec: PropSpec, value: unknown): PropValues[string] {
  switch (spec.type) {
    case "number": {
      const n = typeof value === "number" ? value : Number(value);
      return Number.isFinite(n) ? Math.min(spec.max, Math.max(spec.min, n)) : spec.default;
    }
    case "boolean":
      return typeof value === "boolean" ? value : spec.default;
    case "lines":
      if (Array.isArray(value)) return value.map(String).slice(0, spec.max ?? 12);
      return typeof value === "string" ? value.split("\n") : spec.default;
    case "select":
      return spec.options.some((o) => o.value === value) ? String(value) : spec.default;
    default:
      return typeof value === "string" ? value : value === undefined || value === null ? spec.default : String(value);
  }
}

/**
 * The clip's props with defaults filled in and wrong types replaced (the preview never crashes on a
 * typo). Props the clip leaves out follow the project's style (`styleId`) where they're tagged to.
 */
export function resolveComponentProps(
  id: string,
  props: Record<string, unknown> | undefined,
  styleId?: string | null,
): PropValues {
  const meta = COMPONENT_METAS[id];
  if (!meta) return {};
  const style = getMotionStyle(styleId);
  const out: PropValues = {};
  for (const [key, spec] of Object.entries(meta.props)) {
    const own = props?.[key];
    out[key] = coerce(spec, own === undefined ? styleValueFor(spec, style) : own);
  }
  return out;
}

/** Props of a component that follow the project style (the keys "Use style" clears from a clip). */
export function styledPropKeys(id: string): string[] {
  const meta = COMPONENT_METAS[id];
  if (!meta) return [];
  return Object.entries(meta.props)
    .filter(([, spec]) => spec.style)
    .map(([key]) => key);
}

/** Problems with a clip's props, for the problems list: unknown keys and values out of range. */
export function checkComponentProps(id: string, props: Record<string, unknown> | undefined): string[] {
  const meta = COMPONENT_METAS[id];
  if (!meta) return [`Unknown component "${id}". Available: ${Object.keys(COMPONENT_METAS).join(", ")}.`];
  const issues: string[] = [];
  for (const [key, value] of Object.entries(props ?? {})) {
    const spec = meta.props[key];
    if (!spec) {
      issues.push(`"${key}" isn't a prop of ${id} (props: ${Object.keys(meta.props).join(", ")}).`);
      continue;
    }
    if (spec.type === "number" && (typeof value !== "number" || value < spec.min || value > spec.max))
      issues.push(`${key} should be a number from ${spec.min} to ${spec.max}.`);
    if (spec.type === "select" && !spec.options.some((o) => o.value === value))
      issues.push(`${key} should be one of ${spec.options.map((o) => o.value).join(", ")}.`);
    if (spec.type === "boolean" && typeof value !== "boolean") issues.push(`${key} should be true or false.`);
    if (spec.type === "lines" && !Array.isArray(value)) issues.push(`${key} should be a list of lines.`);
  }
  return issues;
}

