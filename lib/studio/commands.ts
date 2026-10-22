// The one command people run for Agentcut: the local helper (packages/agentcut).
export const STUDIO_COMMAND = "npx -y agentcut";
/** Optional: let Claude read the user's own app repo (remembered for the next runs). */
export const STUDIO_ADD_DIR_EXAMPLE = `${STUDIO_COMMAND} --add-dir "path/to/your-app"`;

export const REPO_URL = "https://github.com/deifos/Agentcut";
