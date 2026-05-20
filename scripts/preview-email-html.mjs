// Usage: node scripts/preview-email-html.mjs
// Writes HTML previews to tmp/email-preview-*.html
import { spawnSync } from "node:child_process";

const result = spawnSync(
  "npx",
  ["vitest", "run", "src/lib/email-preview.test.ts"],
  { stdio: "inherit", cwd: new URL("..", import.meta.url).pathname },
);

process.exit(result.status ?? 1);
