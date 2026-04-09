import { existsSync, readFileSync } from "fs";
import { glob } from "glob";
import yaml from "js-yaml";
import path from "path";

interface FrameworkManifest {
  framework: string;
  scenarios: Record<string, unknown>;
}

const ROOT = path.resolve(import.meta.dirname, "..");
const SAMPLES = path.join(ROOT, "samples");
const TAG_PATTERN = /@snippet:step\d+:start/;

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

      if (!existsSync(path.join(scenarioDir, ".env.example"))) {
        error(`Missing .env.example in samples/${manifest.framework}/${dirName}/`);
      }

      if (!existsSync(path.join(scenarioDir, "README.md"))) {
        error(`Missing README.md in samples/${manifest.framework}/${dirName}/`);
      }

      const sourceFiles = await glob("src/**/*.{ts,tsx,js,jsx}", {
        cwd: scenarioDir,
      });

      let hasSnippetTag = false;
      for (const file of sourceFiles) {
        const fileContent = readFileSync(path.join(scenarioDir, file), "utf-8");
        if (TAG_PATTERN.test(fileContent)) {
          hasSnippetTag = true;
          break;
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
