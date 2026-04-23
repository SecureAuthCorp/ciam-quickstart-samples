import { existsSync, readFileSync } from "fs";
import { glob } from "glob";
import yaml from "js-yaml";
import path from "path";
import { fileURLToPath } from "url";

interface FrameworkManifest {
  framework: string;
  env_file?: string;
  scenarios: Record<string, unknown>;
}

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const SAMPLES = path.join(ROOT, "samples");
const TAG_START = /@snippet:step(\d+):start/g;
const TAG_END = /@snippet:step(\d+):end/g;

let errors = 0;

function error(msg: string) {
  console.error(`ERROR: ${msg}`);
  errors++;
}

async function main() {
  const manifestFiles = await glob("*/manifest.yaml", { cwd: SAMPLES });

  for (const manifestFile of manifestFiles) {
    const frameworkDir = path.join(SAMPLES, path.dirname(manifestFile));
    const content = readFileSync(path.join(SAMPLES, manifestFile), "utf-8");
    const manifest = yaml.load(content) as FrameworkManifest;

    for (const scenarioId of Object.keys(manifest.scenarios)) {
      const dirName = scenarioId.replace(/^[^_]+_/, "").replaceAll("_", "-");
      const scenarioDir = path.join(frameworkDir, dirName);

      if (!existsSync(scenarioDir)) {
        error(`Directory not found: samples/${manifest.framework}/${dirName}/ (scenario: ${scenarioId})`);
        continue;
      }

      const envFile = manifest.env_file || ".env";
      const exampleFile = envFile.endsWith(".ts")
        ? envFile.replace(/\.ts$/, ".example.ts")
        : ".env.example";
      if (!existsSync(path.join(scenarioDir, exampleFile))) {
        error(`Missing ${exampleFile} in samples/${manifest.framework}/${dirName}/`);
      }

      if (!existsSync(path.join(scenarioDir, "README.md"))) {
        error(`Missing README.md in samples/${manifest.framework}/${dirName}/`);
      }

      const sourceFiles = await glob("src/**/*.{ts,tsx,js,jsx,vue,cs}", {
        cwd: scenarioDir,
      });

      let hasSnippetTag = false;
      for (const file of sourceFiles) {
        const fileContent = readFileSync(path.join(scenarioDir, file), "utf-8");
        const starts = [...fileContent.matchAll(TAG_START)].map((m) => parseInt(m[1], 10));
        const ends = [...fileContent.matchAll(TAG_END)].map((m) => parseInt(m[1], 10));

        if (starts.length > 0) hasSnippetTag = true;

        for (const step of starts) {
          if (!ends.includes(step)) {
            error(`Missing @snippet:step${step}:end in samples/${manifest.framework}/${dirName}/${file}`);
          }
        }
        for (const step of ends) {
          if (!starts.includes(step)) {
            error(`Missing @snippet:step${step}:start in samples/${manifest.framework}/${dirName}/${file}`);
          }
        }
      }

      if (!hasSnippetTag) {
        error(`No @snippet tags found in samples/${manifest.framework}/${dirName}/`);
      }
    }
  }

  if (errors > 0) {
    console.error(`\n${errors} error(s) found`);
    process.exit(1);
  }

  console.log("All structure checks passed");
}

main();
