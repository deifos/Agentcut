"use client";

import { useEffect, useRef, useState } from "react";
import { FolderOpen, Play, X } from "lucide-react";
import { Select, SelectContent, SelectGroup, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";

const VIDEO = /\.(mp4|m4v|mov|webm|mkv|avi)$/i;

function LocalPlayer({ file }: { file: File }) {
  const player = useRef<HTMLVideoElement>(null);
  const [failed, setFailed] = useState(false);
  useEffect(() => {
    const video = player.current;
    if (!video) return;
    const next = URL.createObjectURL(file);
    video.src = next;
    return () => {
      video.removeAttribute("src");
      video.load();
      URL.revokeObjectURL(next);
    };
  }, [file]);
  return <>
    <video ref={player} controls playsInline preload="metadata" className="max-h-80 w-full rounded-md bg-black" onLoadedMetadata={() => setFailed(false)} onError={() => setFailed(true)} />
    {failed ? <p role="alert" className="text-xs text-destructive">This browser cannot play this video format. Open it in your computer’s video player.</p> : null}
  </>;
}

/** User-selected files stay on this computer. No helper, upload or full-file buffer. */
export function LocalVideoViewer() {
  const videoInput = useRef<HTMLInputElement>(null);
  const folderInput = useRef<HTMLInputElement>(null);
  const [files, setFiles] = useState<File[]>([]);
  const [selected, setSelected] = useState(0);
  const [error, setError] = useState("");
  const choose = (input: HTMLInputElement) => {
    if (!input.files?.length) return;
    const videos = Array.from(input.files).filter((file) => file.type.startsWith("video/") || VIDEO.test(file.name));
    if (videos.length) {
      setFiles(videos);
      setSelected(0);
      setError("");
    } else setError("No video files were found in that selection.");
    input.value = "";
  };
  const file = files[selected];
  return <section aria-label="Watch local videos" className="space-y-3 rounded-lg border border-border p-3">
    <div>
      <p className="text-sm font-semibold">Watch local videos</p>
      <p className="mt-1 text-xs text-muted-foreground">Choose a video or folder from your computer. No helper is needed. Files stay on your computer.</p>
    </div>
    <input ref={videoInput} type="file" accept="video/*,.mkv,.avi,.mov,.m4v" className="hidden" aria-label="Choose local video" onChange={(event) => choose(event.currentTarget)} />
    <input ref={folderInput} type="file" {...{ webkitdirectory: "" }} multiple className="hidden" aria-label="Choose local video folder" onChange={(event) => choose(event.currentTarget)} />
    <div className="flex flex-wrap gap-2">
      <Button type="button" size="sm" variant="outline" onClick={() => videoInput.current?.click()}><Play className="size-3.5" />Choose video</Button>
      <Button type="button" size="sm" variant="outline" onClick={() => folderInput.current?.click()}><FolderOpen className="size-3.5" />Choose folder</Button>
      {file ? <Button type="button" size="sm" variant="ghost" onClick={() => { setFiles([]); setError(""); }}><X className="size-3.5" />Close video</Button> : null}
    </div>
    {files.length > 1 ? <div className="flex flex-col gap-2"><Label htmlFor="local-preview-video">Video</Label>
      <Select value={String(selected)} onValueChange={value => setSelected(Number(value))}>
        <SelectTrigger id="local-preview-video" aria-label="Local video" className="w-full"><SelectValue /></SelectTrigger>
        <SelectContent><SelectGroup>{files.map((item,index) => <SelectItem key={index} value={String(index)}>{item.webkitRelativePath || item.name}</SelectItem>)}</SelectGroup></SelectContent>
      </Select>
    </div> : file ? <p className="break-all text-xs text-muted-foreground">{file.name}</p> : null}
    {file ? <LocalPlayer key={`${selected}:${file.webkitRelativePath}:${file.name}:${file.size}:${file.lastModified}`} file={file} /> : null}
    {error ? <p role="alert" className="text-xs text-destructive">{error}</p> : null}
  </section>;
}
