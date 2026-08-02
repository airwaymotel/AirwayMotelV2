import { cpSync, existsSync, mkdirSync } from "node:fs";

const staticSource = ".next/static";
const staticTarget = ".next/standalone/.next/static";
const publicSource = "public";
const publicTarget = ".next/standalone/public";

mkdirSync(staticTarget, { recursive: true });
mkdirSync(publicTarget, { recursive: true });
cpSync(staticSource, staticTarget, { recursive: true });
cpSync(publicSource, publicTarget, { recursive: true });

for (const file of [".env", ".z-ai-config"]) {
  if (existsSync(file)) {
    cpSync(file, `.next/standalone/${file}`);
  }
}

console.log("Copied .next/static, public, and config files into standalone build.");
