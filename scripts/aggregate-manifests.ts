import { readFileSync, writeFileSync } from "fs";
import { glob } from "glob";
import yaml from "js-yaml";
import path from "path";
import { fileURLToPath } from "url";

interface ConfigRow {
  label: string;
  value: string;
}

interface ScenarioManifest {
  app_type: string;
  display_name: string;
  grant: string;
  description: string;
  callout?: string;
  extends?: string;
  config_rows: ConfigRow[];
}

interface FrameworkManifest {
  framework: string;
  label: string;
  lang: string;
  lib: string;
  docs_url: string;
  scenarios: Record<string, ScenarioManifest>;
}

interface AggregatedScenario extends ScenarioManifest {
  frameworks: string[];
}

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const SAMPLES = path.join(ROOT, "samples");

async function main() {
  const manifestFiles = await glob("*/manifest.yaml", { cwd: SAMPLES });

  if (manifestFiles.length === 0) {
    console.error("No manifest.yaml files found in samples/");
    process.exit(1);
  }

  const scenarios: Record<string, AggregatedScenario> = {};
  const frameworks: Record<
    string,
    { label: string; lang: string; lib: string; docs_url: string }
  > = {};

  for (const file of manifestFiles.sort()) {
    const fullPath = path.join(SAMPLES, file);
    const content = readFileSync(fullPath, "utf-8");
    const manifest = yaml.load(content) as FrameworkManifest;

    frameworks[manifest.framework] = {
      label: manifest.label,
      lang: manifest.lang,
      lib: manifest.lib,
      docs_url: manifest.docs_url,
    };

    for (const [scenarioId, scenario] of Object.entries(manifest.scenarios)) {
      if (!scenarios[scenarioId]) {
        scenarios[scenarioId] = {
          ...scenario,
          frameworks: [manifest.framework],
        };
      } else {
        scenarios[scenarioId].frameworks.push(manifest.framework);
      }
    }
  }

  const output = { frameworks, scenarios };
  const yamlStr = yaml.dump(output, { lineWidth: 120, noRefs: true, quotingType: '"' });
  const outputPath = path.join(ROOT, "snippet-manifest.yaml");
  writeFileSync(
    outputPath,
    `# GENERATED — do not edit. Aggregated from per-framework manifest.yaml files.\n${yamlStr}`
  );
  console.log(
    `Wrote ${outputPath} (${Object.keys(scenarios).length} scenarios, ${Object.keys(frameworks).length} frameworks)`
  );
}

main();
