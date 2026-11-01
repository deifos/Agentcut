/** A page overlay keeps cursor motion in the captured Chrome pixels. No desktop
 * capture, native cursor compositor, or separate image encoder is required. */
export function cursorOverlayScript(id: string) {
  return `(() => {
    if (window !== window.top) return;
    const install = () => {
    if (document.getElementById(${JSON.stringify(id)})) return;
    const root = document.createElement('div'); root.id = ${JSON.stringify(id)};
    root.setAttribute('aria-hidden','true'); root.style.cssText = 'position:fixed;inset:0;pointer-events:none;z-index:2147483647;contain:strict';
    const pointer = document.createElement('div');
    pointer.style.cssText = 'position:absolute;left:0;top:0;width:30px;height:36px;transform:translate(1100px,760px);filter:drop-shadow(0 2px 2px #0d142455)';
    pointer.innerHTML = '<svg width="30" height="36" viewBox="0 0 30 36"><path d="M3 2L4 28l7-7 6 12 5-3-6-11 10-1Z" fill="#0d1424" stroke="white" stroke-width="2.3" stroke-linejoin="round"/></svg>';
    root.append(pointer); document.documentElement.append(root);
    const move = e => { pointer.style.transform = 'translate(' + e.clientX + 'px,' + e.clientY + 'px)'; };
    const down = e => {
      move(e); const ripple = document.createElement('div');
      ripple.style.cssText = 'position:absolute;width:44px;height:44px;border:3px solid #2f74f0;background:#2f74f026;border-radius:50%;left:'+(e.clientX-22)+'px;top:'+(e.clientY-22)+'px';
      root.prepend(ripple); ripple.animate([{transform:'scale(.3)',opacity:1},{transform:'scale(1.5)',opacity:0}],{duration:450,easing:'cubic-bezier(.16,1,.3,1)'}).onfinish=()=>ripple.remove();
    };
    addEventListener('mousemove',move,true); addEventListener('mousedown',down,true);
    root.__cleanup = () => { removeEventListener('mousemove',move,true); removeEventListener('mousedown',down,true); root.remove(); };
    };
    window[${JSON.stringify(id)}] = () => { removeEventListener('DOMContentLoaded',install); document.getElementById(${JSON.stringify(id)})?.__cleanup?.(); delete window[${JSON.stringify(id)}]; };
    if (document.documentElement) install(); else addEventListener('DOMContentLoaded',install,{once:true});
  })()`;
}
