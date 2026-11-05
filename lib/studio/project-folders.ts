import type { ProjectSummary } from "./types";

export function localDateKey(date = new Date()): string {
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}-${String(date.getDate()).padStart(2, "0")}`;
}

export function projectDate(project: ProjectSummary): string {
  return (
    project.folderDate ??
    localDateKey(new Date(project.createdAt ?? project.updatedAt))
  );
}

export function dateLabel(date: string): string {
  return new Date(`${date}T12:00:00`).toLocaleDateString("en-US", {
    month: "long",
    day: "numeric",
    year: "numeric",
  });
}

export function groupProjects(
  projects: ProjectSummary[],
  query: string,
  today: string,
) {
  const normalized = query.toLowerCase().trim();
  const namedDate =
    /\b(jan(?:uary)?|feb(?:ruary)?|mar(?:ch)?|apr(?:il)?|may|jun(?:e)?|jul(?:y)?|aug(?:ust)?|sep(?:tember)?|oct(?:ober)?|nov(?:ember)?|dec(?:ember)?)\s+(\d{1,2})(?:,?\s+(\d{4}))?\b/.exec(
      normalized,
    );
  const months = [
    "jan",
    "feb",
    "mar",
    "apr",
    "may",
    "jun",
    "jul",
    "aug",
    "sep",
    "oct",
    "nov",
    "dec",
  ];
  const terms = normalized
    .replace(namedDate?.[0] ?? "", "")
    .split(/\s+/)
    .filter(Boolean);
  const groups = new Map<string, ProjectSummary[]>();
  if (!normalized) groups.set(today, []);
  for (const project of projects) {
    const date = projectDate(project);
    const parsed = new Date(`${date}T12:00:00`);
    if (
      namedDate &&
      (parsed.getMonth() !== months.indexOf(namedDate[1].slice(0, 3)) ||
        parsed.getDate() !== Number(namedDate[2]) ||
        (namedDate[3] && parsed.getFullYear() !== Number(namedDate[3])))
    )
      continue;
    const short = parsed.toLocaleDateString("en-US", {
      month: "short",
      day: "numeric",
      year: "numeric",
    });
    const haystack =
      `${project.name} ${date} ${dateLabel(date)} ${short} ${date === today ? "today" : ""}`
        .toLowerCase()
        .replaceAll(",", "");
    if (!terms.every((term) => haystack.includes(term.replaceAll(",", ""))))
      continue;
    const group = groups.get(date) ?? [];
    group.push(project);
    groups.set(date, group);
  }
  return [...groups]
    .sort(([a], [b]) => b.localeCompare(a))
    .map(([date, items]) => ({
      date,
      projects: items.sort(
        (a, b) => b.updatedAt - a.updatedAt || a.name.localeCompare(b.name),
      ),
    }));
}
