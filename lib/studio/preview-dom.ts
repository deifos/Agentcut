// Reading the preview's own page: which clip drew the thing under the pointer, and where a scene's
// content sits. Scenes are code, so the only place their text and pictures have a position is the DOM.

import { clipClass } from "@/lib/studio/preview-perf";
import type { Box } from "@/lib/studio/types";

function isShown(element: Element) {
  const check = (element as Element & { checkVisibility?(options: object): boolean }).checkVisibility;
  if (typeof check !== "function") return true;
  return check.call(element, { opacityProperty: true, visibilityProperty: true, checkOpacity: true, checkVisibilityCSS: true });
}

function hasOwnText(element: Element) {
  for (const node of element.childNodes) {
    if (node.nodeType === Node.TEXT_NODE && node.nodeValue?.trim()) return true;
  }
  return false;
}

const round = (n: number) => Math.round(n * 10000) / 10000;

/**
 * The rectangle around what a clip draws right now: its text and its pictures (not ones that fill
 * the frame, which are backgrounds). Frame fractions; null when nothing is on screen.
 */
export function contentRect(stage: HTMLElement, clipId: string): Box | null {
  const frame = stage.getBoundingClientRect();
  if (!frame.width || !frame.height) return null;
  let left = Infinity;
  let top = Infinity;
  let right = -Infinity;
  let bottom = -Infinity;
  const add = (rect: DOMRect) => {
    if (!rect.width || !rect.height) return;
    left = Math.min(left, rect.left);
    top = Math.min(top, rect.top);
    right = Math.max(right, rect.right);
    bottom = Math.max(bottom, rect.bottom);
  };
  const range = document.createRange();
  for (const root of stage.getElementsByClassName(clipClass(clipId))) {
    if (!isShown(root)) continue;
    const walker = document.createTreeWalker(root, NodeFilter.SHOW_TEXT);
    for (let node = walker.nextNode(); node; node = walker.nextNode()) {
      const parent = node.parentElement;
      if (!node.nodeValue?.trim() || !parent || !isShown(parent)) continue;
      // The letters themselves: their element is often a frame-sized box that only centres them.
      range.selectNodeContents(node);
      add(range.getBoundingClientRect());
    }
    for (const media of root.querySelectorAll("img, video, canvas, svg")) {
      if (!isShown(media)) continue;
      const rect = media.getBoundingClientRect();
      if (rect.width >= frame.width * 0.9 && rect.height >= frame.height * 0.9) continue;
      add(rect);
    }
  }
  if (left === Infinity) return null;
  return {
    x: round((left - frame.left) / frame.width),
    y: round((top - frame.top) / frame.height),
    width: round((right - left) / frame.width),
    height: round((bottom - top) / frame.height),
  };
}

/** The clip an element belongs to. `classes` maps each clip's wrapper class to its id. */
function clipOf(element: Element, stage: HTMLElement, classes: Map<string, string>) {
  for (let node: Element | null = element; node && node !== stage; node = node.parentElement) {
    for (const name of node.classList) {
      const id = classes.get(name);
      if (id) return { id, root: node };
    }
  }
  return null;
}

export function clipClasses(ids: string[]) {
  return new Map(ids.map((id) => [clipClass(id), id]));
}

/** The text directly under a point on the screen, topmost first, with the clip that drew it. */
export function textAt(
  stage: HTMLElement,
  clientX: number,
  clientY: number,
  classes: Map<string, string>,
): { id: string; element: Element; root: Element }[] {
  const hits: { id: string; element: Element; root: Element }[] = [];
  for (const element of document.elementsFromPoint(clientX, clientY)) {
    if (!stage.contains(element) || !hasOwnText(element)) continue;
    const clip = clipOf(element, stage, classes);
    if (clip) hits.push({ id: clip.id, element, root: clip.root });
  }
  return hits;
}

/** An element's text, then the text of each element around it up to the clip's wrapper. */
export function textsAround(element: Element, root: Element) {
  const chain: { element: Element; text: string }[] = [];
  for (let node: Element | null = element; node && node !== root; node = node.parentElement) {
    chain.push({ element: node, text: node.textContent ?? "" });
  }
  return chain;
}
