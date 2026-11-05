"use client";

import { useId, useRef, useState } from "react";
import {
  CalendarDays,
  Check,
  ChevronRight,
  ChevronsUpDown,
  FilePlus2,
  FolderOpen,
  Loader2,
  Search,
  Trash2,
  X,
} from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import {
  InputGroup,
  InputGroupAddon,
  InputGroupButton,
  InputGroupInput,
} from "@/components/ui/input-group";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { ScrollArea } from "@/components/ui/scroll-area";
import {
  Empty,
  EmptyHeader,
  EmptyTitle,
  EmptyDescription,
} from "@/components/ui/empty";
import { cn } from "@/lib/utils";
import type { ProjectSummary } from "@/lib/studio/types";
import {
  dateLabel,
  groupProjects,
  localDateKey,
  projectDate,
} from "@/lib/studio/project-folders";

const DRAG_TYPE = "application/x-agentcut-project";

export function ProjectPicker({
  projects,
  currentSlug,
  name,
  opening,
  connected,
  canMove,
  onOpen,
  onCreate,
  onDelete,
  onMove,
}: {
  projects: ProjectSummary[];
  currentSlug?: string;
  name?: string;
  opening: boolean;
  connected: boolean;
  canMove: boolean;
  onOpen(slug: string): void;
  onCreate(date: string): void;
  onDelete(project: ProjectSummary): void;
  onMove(slug: string, date: string): Promise<void>;
}) {
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState("");
  const [expanded, setExpanded] = useState<Record<string, boolean>>({});
  const [moving, setMoving] = useState<ProjectSummary | null>(null);
  const [targetDate, setTargetDate] = useState("");
  const [busy, setBusy] = useState(false);
  const [dragging, setDragging] = useState<string | null>(null);
  const [overDate, setOverDate] = useState<string | null>(null);
  const searchRef = useRef<HTMLInputElement>(null);
  const currentRow = useRef<HTMLDivElement>(null);
  const currentProject = projects.find(project => project.slug === currentSlug);
  const currentDate = currentProject && projectDate(currentProject);
  const id = useId();
  const today = localDateKey();
  const groups = groupProjects(projects, query, today);
  const searching = Boolean(query.trim());
  const matches = groups.reduce((sum, group) => sum + group.projects.length, 0);

  async function move(slug: string, date: string) {
    if (busy || !connected || !canMove) return;
    setBusy(true);
    try {
      await onMove(slug, date);
      setExpanded((previous) => ({ ...previous, [date]: true }));
      setMoving(null);
      setQuery("");
      toast.success(`Project moved to ${dateLabel(date)}.`);
    } catch (error) {
      toast.error(
        error instanceof Error ? error.message : "Could not move the project.",
      );
    } finally {
      setBusy(false);
    }
  }

  function create(date: string) {
    setOpen(false);
    onCreate(date);
  }

  return (
    <Popover
      open={open}
      onOpenChange={(value) => {
        if (value && currentDate) setExpanded(previous => ({ ...previous, [currentDate]: true }));
        setOpen(value);
        setQuery("");
        setMoving(null);
        setDragging(null);
        setOverDate(null);
      }}
    >
      <PopoverTrigger asChild>
        <Button
          variant="outline"
          size="sm"
          className="max-w-80 gap-2"
          aria-label={`Projects: ${name ?? "Choose a project"}`}
        >
          <FolderOpen data-icon="inline-start" />
          <span className="truncate">
            {name ?? (opening ? "Opening…" : "Choose a project")}
          </span>
          {opening ? (
            <Loader2 className="animate-spin" />
          ) : (
            <ChevronsUpDown data-icon="inline-end" />
          )}
        </Button>
      </PopoverTrigger>
      <PopoverContent
        align="start"
        aria-label="Projects"
        className="flex max-h-[min(36rem,var(--radix-popover-content-available-height))] w-[min(25rem,calc(100vw-1rem))] flex-col gap-0 p-0"
        onKeyDown={(event) => {
          if (event.key !== "Escape") event.stopPropagation();
        }}
        onOpenAutoFocus={(event) => {
          event.preventDefault();
          searchRef.current?.focus({ preventScroll: true });
          currentRow.current?.scrollIntoView({ block: "nearest" });
        }}
      >
        <div className="flex shrink-0 flex-col gap-2 p-3">
          <InputGroup>
            <InputGroupAddon>
              <Search aria-hidden="true" />
            </InputGroupAddon>
            <InputGroupInput
              ref={searchRef}
              aria-label="Search projects by name or date"
              placeholder="Search projects by name or date…"
              value={query}
              onChange={(event) => setQuery(event.target.value)}
            />
            {query ? (
              <InputGroupAddon align="inline-end">
                <InputGroupButton
                  aria-label="Clear project search"
                  onClick={() => {
                    setQuery("");
                    searchRef.current?.focus();
                  }}
                >
                  <X />
                </InputGroupButton>
              </InputGroupAddon>
            ) : null}
          </InputGroup>
          <div className="flex items-center justify-between gap-2">
            <span className="text-xs text-muted-foreground" role="status">
              {searching
                ? `${matches} result${matches === 1 ? "" : "s"}`
                : `${projects.length} project${projects.length === 1 ? "" : "s"}`}
            </span>
            <Button
              size="sm"
              variant="ghost"
              disabled={!connected}
              onClick={() => create(today)}
            >
              <FilePlus2 data-icon="inline-start" />
              New project
            </Button>
          </div>
        </div>
        <div role="separator" className="shrink-0 border-t border-border" />
        {moving ? (
          <form
            className="flex shrink-0 flex-col gap-2 p-3"
            onSubmit={(event) => {
              event.preventDefault();
              void move(moving.slug, targetDate);
            }}
          >
            <div className="flex flex-col gap-2">
              <Label htmlFor={`${id}-date`}>Move “{moving.name}” to date</Label>
              <Input
                id={`${id}-date`}
                type="date"
                required
                value={targetDate}
                disabled={busy}
                onChange={(event) => setTargetDate(event.target.value)}
              />
            </div>
            <div className="flex justify-end gap-2">
              <Button
                type="button"
                variant="ghost"
                size="sm"
                disabled={busy}
                onClick={() => setMoving(null)}
              >
                Cancel
              </Button>
              <Button type="submit" size="sm" disabled={busy || !targetDate}>
                {busy ? <Loader2 className="animate-spin" /> : null}Move
              </Button>
            </div>
          </form>
        ) : null}
        <ScrollArea
          className="flex min-h-0 flex-col [&_[data-slot=scroll-area-scrollbar]]:hidden"
          viewportClassName="min-h-0 overscroll-contain p-1 [&>div]:!block"
          aria-label="Projects by date"
        >
          {!groups.length ? (
            <Empty>
              <EmptyHeader>
                <EmptyTitle>No projects found</EmptyTitle>
                <EmptyDescription>
                  Try a project name or a date, such as Nov 3 or 2026-11-03.
                </EmptyDescription>
              </EmptyHeader>
            </Empty>
          ) : null}
          {groups.map((group) => {
            const isExpanded =
              searching || (expanded[group.date] ?? group.date === (currentDate ?? today));
            const label =
              group.date === today
                ? `Today · ${dateLabel(group.date)}`
                : dateLabel(group.date);
            return (
              <section
                key={group.date}
                className={cn(
                  "rounded-md",
                  overDate === group.date && "bg-accent ring-2 ring-ring",
                )}
                onDragOver={(event) => {
                  if (
                    dragging &&
                    canMove &&
                    !busy &&
                    event.dataTransfer.types.includes(DRAG_TYPE)
                  ) {
                    event.preventDefault();
                    event.dataTransfer.dropEffect = "move";
                    setOverDate(group.date);
                  }
                }}
                onDragLeave={(event) => {
                  if (
                    !event.currentTarget.contains(
                      event.relatedTarget as Node | null,
                    )
                  )
                    setOverDate(null);
                }}
                onDrop={(event) => {
                  event.preventDefault();
                  const slug = event.dataTransfer.getData(DRAG_TYPE);
                  setOverDate(null);
                  setDragging(null);
                  if (slug && projects.some((project) => project.slug === slug))
                    void move(slug, group.date);
                }}
              >
                <div className={cn("flex items-center gap-1 rounded-md pr-1", group.date === currentDate && "bg-brand/10 text-foreground")}>
                  <button
                    type="button"
                    className="flex min-h-10 min-w-0 flex-1 items-center gap-2 rounded-md px-2 text-left text-xs font-semibold hover:bg-accent focus-visible:outline-2 focus-visible:outline-ring"
                    aria-expanded={isExpanded}
                    aria-controls={`${id}-${group.date}`}
                    onClick={() =>
                      setExpanded((previous) => ({
                        ...previous,
                        [group.date]: !isExpanded,
                      }))
                    }
                  >
                    <ChevronRight
                      aria-hidden="true"
                      className={cn(
                        "size-3.5 shrink-0",
                        isExpanded && "rotate-90",
                      )}
                    />
                    <span className="flex-1 truncate">{label}</span>
                    <span className="text-muted-foreground tabular-nums">
                      {group.projects.length}
                    </span>
                  </button>
                  <Button
                    variant="ghost"
                    size="icon-sm"
                    aria-label={`New project in ${dateLabel(group.date)}`}
                    title={`New project in ${dateLabel(group.date)}`}
                    disabled={!connected || (!canMove && group.date !== today)}
                    onClick={() => create(group.date)}
                  >
                    <FilePlus2 />
                  </Button>
                </div>
                <div
                  id={`${id}-${group.date}`}
                  hidden={!isExpanded}
                  className="my-1 ml-4 border-l border-border pl-3"
                >
                  {!group.projects.length ? (
                    <p className="px-3 py-2 text-xs text-muted-foreground">
                      No projects yet. Create one here or drop a project onto
                      this date.
                    </p>
                  ) : null}
                  {group.projects.map((project) => (
                    <div
                      key={project.slug}
                      ref={project.slug === currentSlug ? currentRow : undefined}
                      className={cn(
                        "group flex items-center gap-1 rounded-md pr-1",
                        project.slug === currentSlug && "bg-brand/15 font-semibold ring-1 ring-inset ring-brand/45",
                        dragging === project.slug && "opacity-50",
                      )}
                      draggable={connected && canMove && !busy}
                      onDragStart={(event) => {
                        event.dataTransfer.setData(DRAG_TYPE, project.slug);
                        event.dataTransfer.effectAllowed = "move";
                        setDragging(project.slug);
                      }}
                      onDragEnd={() => {
                        setDragging(null);
                        setOverDate(null);
                      }}
                    >
                      <button
                        type="button"
                        className="flex min-h-10 min-w-0 flex-1 items-center gap-2 rounded-md py-2 pl-3 pr-1 text-left text-sm hover:bg-accent focus-visible:outline-2 focus-visible:outline-ring"
                        aria-current={
                          project.slug === currentSlug ? "true" : undefined
                        }
                        title={project.name}
                        onClick={() => {
                          setOpen(false);
                          onOpen(project.slug);
                        }}
                      >
                        <span className="min-w-0 flex-1 truncate">
                          {project.name}
                        </span>
                        {project.slug === currentSlug ? (
                          <Check
                            aria-hidden="true"
                            className="size-3.5 shrink-0"
                          />
                        ) : null}
                        {project.durationInFrames && project.fps ? (
                          <span className="text-[10px] text-muted-foreground tabular-nums">
                            {(project.durationInFrames / project.fps).toFixed(
                              1,
                            )}
                            s
                          </span>
                        ) : null}
                      </button>
                      <Button
                        variant="ghost"
                        size="icon-sm"
                        aria-label={`Move ${project.name} to date`}
                        title={
                          canMove
                            ? "Move to date…"
                            : "Restart the updated helper to move projects"
                        }
                        disabled={!connected || !canMove || busy}
                        onClick={() => {
                          setMoving(project);
                          setTargetDate(projectDate(project));
                        }}
                      >
                        <CalendarDays />
                      </Button>
                      <Button
                        variant="ghost"
                        size="icon-sm"
                        aria-label={`Delete ${project.name}`}
                        title="Delete project"
                        disabled={!connected || busy}
                        onClick={() => {
                          setOpen(false);
                          onDelete(project);
                        }}
                      >
                        <Trash2 />
                      </Button>
                    </div>
                  ))}
                </div>
              </section>
            );
          })}
        </ScrollArea>
      </PopoverContent>
    </Popover>
  );
}
