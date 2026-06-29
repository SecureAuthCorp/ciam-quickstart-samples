import { readFileSync, writeFileSync } from "fs";
import { glob } from "glob";
import { load, dump } from "js-yaml";
import path from "path";
import { fileURLToPath } from "url";

interface ConfigRow {
  label: string;
  value: string;
  display_only?: boolean;
}

interface ScenarioManifest {
  app_type: string;
  display_name: string;
  grant: string;
  description: string;
  callout?: string;
  extends?: string;
  run_command?: string;
  lib?: string;
  docs_url?: string;
  required_scopes?: string[];
  config_rows: ConfigRow[];
}

interface FrameworkManifest {
  framework: string;
  label: string;
  lang: string;
  lib: string;
  docs_url: string;
  env_file?: string;
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
    {
      label: string;
      lang: string;
      lib: string;
      docs_url: string;
      env_file?: string;
    }
  > = {};

  for (const file of manifestFiles.sort()) {
    const fullPath = path.join(SAMPLES, file);
    const content = readFileSync(fullPath, "utf-8");
    const manifest = load(content) as FrameworkManifest;

    frameworks[manifest.framework] = {
      label: manifest.label,
      lang: manifest.lang,
      lib: manifest.lib,
      docs_url: manifest.docs_url,
      ...(manifest.env_file ? { env_file: manifest.env_file } : {}),
    };

    for (const [scenarioId, scenario] of Object.entries(manifest.scenarios)) {
      if (!scenarios[scenarioId]) {
        // Strip per-framework concerns from the scenario-level entry — these all differ per
        // framework, and the aggregated scenario merges multiple frameworks. Their values live
        // in `snippets.json` keyed by framework instead.
        const {
          run_command: _rc,
          lib: _lib,
          docs_url: _docs,
          callout: _callout,
          ...scenarioForAllFrameworks
        } = scenario;
        scenarios[scenarioId] = {
          ...scenarioForAllFrameworks,
          frameworks: [manifest.framework],
        };
      } else {
        scenarios[scenarioId].frameworks.push(manifest.framework);
      }
    }
  }

  const frameworkOrder = ["react", "angular"];
  const rank = (id: string): number => {
    const i = frameworkOrder.indexOf(id);
    return i === -1 ? 999 : i;
  };
  for (const scenario of Object.values(scenarios)) {
    scenario.frameworks.sort((a, b) => rank(a) - rank(b));
  }

  const orderedFrameworks = Object.fromEntries(
    Object.entries(frameworks).sort(([a], [b]) => rank(a) - rank(b)),
  );

  const output = { frameworks: orderedFrameworks, scenarios };
  const yamlStr = dump(output, {
    lineWidth: 120,
    noRefs: true,
    quoteStyle: "double",
  });
  const outputPath = path.join(ROOT, "snippet-manifest.yaml");
  writeFileSync(
    outputPath,
    `# GENERATED — do not edit. Aggregated from per-framework manifest.yaml files.\n${yamlStr}`,
  );
  console.log(
    `Wrote ${outputPath} (${Object.keys(scenarios).length} scenarios, ${Object.keys(frameworks).length} frameworks)`,
  );
}

main();
