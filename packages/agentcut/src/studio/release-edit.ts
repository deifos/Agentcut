import { writeFileSync } from "node:fs";
import { join } from "node:path";
import {
  readProjectState,
  writeLayers,
  writeProjectFile,
  atomicWrite,
} from "./projects.js";
import type { WorkspacePaths } from "./workspace.js";
import type { ReleaseJob } from "./release-video.js";

interface EditPlan {
  opening: string;
  closing: string;
  story: {
    message: string;
    disclosure?: string;
    audience: string;
    before: string;
    after: string;
  };
  scenes: {
    title: string;
    purpose: string;
    evidence: string;
    expectedChange: string;
    focus?: { x: number; y: number; width: number; height: number };
    beats?: { actionIndex: number; headline: string; explanation: string }[];
  }[];
}

/** Translate actual capture cue times into source trims and editable story beats.
 * No footage, conversation, timing or zoom is invented by the edit builder. */
export function buildReleaseEdit(
  paths: WorkspacePaths,
  job: ReleaseJob,
  plan: EditPlan,
) {
  const state = readProjectState(paths, job.slug);
  if (!state.project) throw new Error("The recorded project is invalid.");
  const fps = state.project.fps;
  const openingFrames = Math.max(
    90,
    Math.ceil((plan.opening.split(/\s+/).length / 3) * fps),
  );
  const closingFrames = Math.max(
    100,
    Math.ceil((plan.closing.split(/\s+/).length / 3) * fps),
  );
  let frame = openingFrames;
  const videos: unknown[] = [],
    headings: unknown[] = [],
    explanations: unknown[] = [],
    numbers: unknown[] = [],
    markers: unknown[] = [];
  const edit: unknown[] = [];
  const text = (
    id: string,
    from: number,
    duration: number,
    value: string,
    box: object,
    fontSize: number,
    color = "#101b30",
    weight = 650,
  ) => ({
    id,
    from,
    duration,
    text: value,
    box,
    style: {
      fontFamily: "Segoe UI",
      fontSize,
      fontWeight: weight,
      color,
      align: "left",
      lineHeight: 1.15,
    },
    enter: { preset: "fade", frames: 8 },
    exit: { preset: "fade", frames: 6 },
  });
  let index = 0;
  job.recordings.forEach((take, sceneIndex) => {
    const scene = plan.scenes[sceneIndex];
    const beats = scene.beats?.length
      ? scene.beats
      : [
          {
            actionIndex: 0,
            headline: scene.title,
            explanation: scene.expectedChange,
          },
        ];
    const boundaries = beats.map((beat, i) =>
      i === 0
        ? 0
        : Math.max(
            0,
            (take.cues?.find((c) => c.actionIndex === beat.actionIndex)
              ?.start ?? 0) - 0.25,
          ),
    );
    if (boundaries.some((time, i) => i > 0 && time <= boundaries[i - 1]))
      throw new Error("Story beats must use increasing recorded action cues.");
    beats.forEach((beat, beatIndex) => {
      const sourceStart = Math.round(boundaries[beatIndex] * fps);
      const sourceEnd =
        boundaries[beatIndex + 1] === undefined
          ? Math.floor((take.seconds - 0.2) * fps)
          : Math.round(boundaries[beatIndex + 1] * fps);
      const duration = sourceEnd - sourceStart;
      if (duration < fps)
        throw new Error(
          "A story beat is too short to show its action and result. Add a readable hold before the next action.",
        );
      const id = `beat-${++index}`;
      videos.push({
        id: `${id}-footage`,
        name: beat.headline,
        from: frame,
        duration,
        src: take.path,
        trimStart: sourceStart,
        muted: true,
        fit: "contain",
        camera: "none",
        ...(scene.focus ? { framing: { crop: scene.focus } } : {}),
        box: { x: 0.28, y: 0.15, width: 0.69, height: 0.76 },
        radius: 20,
      });
      headings.push(
        text(
          `${id}-heading`,
          frame,
          duration,
          beat.headline,
          { x: 0.045, y: 0.29, width: 0.205, height: 0.28 },
          48,
        ),
      );
      explanations.push(
        text(
          `${id}-explanation`,
          frame,
          duration,
          beat.explanation,
          { x: 0.045, y: 0.59, width: 0.205, height: 0.2 },
          25,
          "#536176",
          450,
        ),
      );
      numbers.push(
        text(
          `${id}-number`,
          frame,
          duration,
          String(index).padStart(2, "0"),
          { x: 0.045, y: 0.2, width: 0.16, height: 0.06 },
          25,
          "#2f74f0",
          700,
        ),
      );
      markers.push({ id, frame, label: beat.headline, kind: "section" });
      edit.push({
        id,
        from: frame,
        duration,
        source: take.path,
        trimStart: sourceStart,
        headline: beat.headline,
        explanation: beat.explanation,
        evidence: scene.evidence,
      });
      frame += duration;
    });
  });
  const total = frame + closingFrames;
  const brand = job.input.name.replace(/\s*[—–].*$/, "");
  const titles = [
    text(
      "opening-kicker",
      0,
      openingFrames,
      "PRODUCT UPDATE",
      { x: 0.07, y: 0.22, width: 0.8, height: 0.07 },
      27,
      "#2f74f0",
      750,
    ),
    text(
      "opening",
      0,
      openingFrames,
      plan.opening,
      { x: 0.07, y: 0.34, width: 0.84, height: 0.38 },
      96,
    ),
    text(
      "closing",
      frame,
      closingFrames,
      plan.closing,
      { x: 0.07, y: 0.29, width: 0.84, height: 0.4 },
      94,
    ),
    text(
      "closing-message",
      frame,
      closingFrames,
      plan.story.message,
      { x: 0.07, y: 0.73, width: 0.78, height: 0.12 },
      31,
      "#536176",
      450,
    ),
  ];
  const persistent = [
    text(
      "brand",
      0,
      total,
      brand,
      { x: 0.045, y: 0.045, width: 0.75, height: 0.06 },
      27,
      "#101b30",
      750,
    ),
    ...(plan.story.disclosure
      ? [
          text(
            "disclosure",
            0,
            total,
            plan.story.disclosure,
            { x: 0.045, y: 0.945, width: 0.91, height: 0.035 },
            20,
            "#536176",
            450,
          ),
        ]
      : []),
  ];
  writeFileSync(
    join(state.dir, "scenes", "ReleaseBackdrop.tsx"),
    `import React from 'react';\nimport {useCurrentFrame,useVideoConfig,interpolate} from 'remotion';\nexport default function ReleaseBackdrop({duration=900}){const f=useCurrentFrame();const {width,height}=useVideoConfig();return <div style={{position:'absolute',inset:0,background:'#f5f8fc'}}><div style={{position:'absolute',left:width*.045,right:width*.03,top:height*.12,height:1,background:'#dbe4f1'}}/><div style={{position:'absolute',left:width*.045,bottom:height*.014,width:width*.91,height:3,background:'#e2eaf5'}}/><div style={{position:'absolute',left:width*.045,bottom:height*.014,width:width*.91*interpolate(f,[0,duration],[0,1],{extrapolateRight:'clamp'}),height:3,background:'#2f74f0'}}/></div>;}\n`,
  );
  writeProjectFile(paths, job.slug, {
    ...state.project,
    background: "#f5f8fc",
    fonts: [],
    variants: { wide: { width: 1920, height: 1080 } },
    defaultVariant: "wide",
    durationInFrames: total,
  });
  writeLayers(
    paths,
    job.slug,
    {
      version: 1,
      tracks: [
        {
          id: "titles",
          name: "Opening and closing",
          kind: "text",
          clips: [titles[1], titles[2]],
        },
        {
          id: "kicker",
          name: "Opening label",
          kind: "text",
          clips: [titles[0]],
        },
        {
          id: "closing-message",
          name: "Closing explanation",
          kind: "text",
          clips: [titles[3]],
        },
        { id: "brand", name: "Brand", kind: "text", clips: [persistent[0]] },
        {
          id: "disclosure",
          name: "Demo disclosure",
          kind: "text",
          clips: persistent.slice(1),
        },
        {
          id: "headlines",
          name: "Story headlines",
          kind: "text",
          clips: headings,
        },
        {
          id: "explanations",
          name: "What changed and why",
          kind: "text",
          clips: explanations,
        },
        { id: "steps", name: "Story steps", kind: "text", clips: numbers },
        {
          id: "footage",
          name: "Recorded actions and results",
          kind: "video",
          clips: videos,
        },
        {
          id: "backdrop",
          name: "Presentation and progress",
          kind: "scene",
          clips: [
            {
              id: "backdrop",
              scene: "ReleaseBackdrop",
              from: 0,
              duration: total,
              props: { duration: total },
            },
          ],
        },
      ],
      markers,
    },
    state.layersHash,
  );
  atomicWrite(
    join(state.dir, ".studio", "edit-decision-list.json"),
    JSON.stringify(
      { story: plan.story, fps, durationInFrames: total, beats: edit },
      null,
      2,
    ) + "\n",
  );
  writeFileSync(
    join(state.dir, "notes.md"),
    `# ${job.input.name}\n\n${plan.story.message}\n\nAudience: ${plan.story.audience}\nBefore: ${plan.story.before}\nAfter: ${plan.story.after}\n\n${plan.story.disclosure ?? "Recorded from the supplied website."}\n\nTitles, explanations, source trims and footage are separate editable tracks. Cuts use actual recorded action times. No arbitrary zooms are added. Source recordings remain in assets/.\n\nReview the story and full playback before sharing.\n`,
  );
}
