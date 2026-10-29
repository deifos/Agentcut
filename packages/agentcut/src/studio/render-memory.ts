import { execFile } from "node:child_process";
import { freemem } from "node:os";
import { join } from "node:path";
import { promisify } from "node:util";

const execute = promisify(execFile);

/** Windows can run out of commit capacity while still reporting free physical RAM. */
export function memoryBudget(physicalBytes: number, freeVirtualKiB: unknown) {
  return typeof freeVirtualKiB === "number" && Number.isFinite(freeVirtualKiB) && freeVirtualKiB >= 0
    ? Math.min(physicalBytes, freeVirtualKiB * 1024)
    : physicalBytes;
}

export async function availableRenderMemory() {
  const physicalBytes = freemem();
  if (process.platform !== "win32") return { physicalBytes, availableBytes: physicalBytes, source: "physical" };
  try {
    const shell = join(process.env.SystemRoot ?? "C:\\Windows", "System32", "WindowsPowerShell", "v1.0", "powershell.exe");
    const { stdout } = await execute(shell, ["-NoProfile", "-NonInteractive", "-Command",
      "(Get-CimInstance Win32_OperatingSystem).FreeVirtualMemory | ConvertTo-Json -Compress",
    ], { windowsHide: true, timeout: 5_000, maxBuffer: 4096 });
    const freeVirtualKiB: unknown = JSON.parse(stdout.trim());
    if (typeof freeVirtualKiB !== "number" || !Number.isFinite(freeVirtualKiB) || freeVirtualKiB < 0) throw new Error("Invalid memory reading");
    return { physicalBytes, availableBytes: memoryBudget(physicalBytes, freeVirtualKiB), source: "physical-and-virtual" };
  } catch {
    // Restricted systems may not allow CIM or PowerShell. Rendering still works with the RAM budget.
    return { physicalBytes, availableBytes: physicalBytes, source: "physical-fallback" };
  }
}
