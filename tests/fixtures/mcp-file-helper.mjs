// Real host/file/HTTP handlers, without agent discovery, watching or preview installs.
// Rendering is checked separately against a live editor; these tests cover file transport.
import { scaffoldWorkspace } from "../../packages/agentcut/dist/studio/workspace.js";
import {
  StudioHost,
  DEFAULT_ALLOWED_ORIGINS,
} from "../../packages/agentcut/dist/studio/host.js";
import {
  setBridgeExtension,
  startOwnedBridge,
} from "../../packages/agentcut/dist/bridge.js";

const { paths } = scaffoldWorkspace(process.argv[2]);
const host = new StudioHost({
  paths,
  port: Number(process.env.AGENTCUT_PORT),
  allowBash: false,
  addDirs: process.argv[3] ? [process.argv[3]] : [],
  allowedOrigins: DEFAULT_ALLOWED_ORIGINS,
});
host.watchProject = () => {};
setBridgeExtension(host);
await startOwnedBridge();
