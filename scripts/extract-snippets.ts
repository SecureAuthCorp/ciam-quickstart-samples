import { readFileSync, writeFileSync } from "fs";
import { glob } from "glob";
import yaml from "js-yaml";
import path from "path";
import { fileURLToPath } from "url";

interface PlaceholderMapping {
  pattern: string;
  placeholder: string;
}

interface PlaceholderMap {
  [lang: string]: PlaceholderMapping[];
}

interface Step {
  step: number;
  description: string;
  code: string;
  file: string;
  lang: string;
  lines: string;
}

interface FrameworkSnippet {
  steps: Step[];
  framework: string;
  lib: string;
  lib_version: string;
  install: string;
  repo_path: string;
  run_command?: string;
}

interface ScenarioMeta {
  run_command?: string;
  [key: string]: unknown;
}

interface FrameworkManifest {
  framework: string;
  label: string;
  lang: string;
  lib: string;
  docs_url: string;
  scenarios: Record<string, ScenarioMeta>;
}

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const SAMPLES = path.join(ROOT, "samples");
const TAG_START = /\/\/\s*@snippet:step(\d+):start/;
const TAG_END = /\/\/\s*@snippet:step(\d+):end/;
const DESCRIPTION = /\/\/\s*@description\s+(.+)/;

function getPlaceholderMap(): PlaceholderMap {
  const content = readFileSync(path.join(ROOT, "placeholder-map.yaml"), "utf-8");
  return yaml.load(content) as PlaceholderMap;
}

function applyPlaceholders(code: string, lang: string, placeholderMap: PlaceholderMap): string {
  // Try language-specific mappings first, then fall back to js
  const mappings = placeholderMap[lang] || placeholderMap["js"] || [];
  let result = code;
  for (const { pattern, placeholder } of mappings) {
    result = result.replaceAll(pattern, `"${placeholder}"`);
  }
  return result;
}

function getLibVersion(scenarioDir: string, manifestDir: string): string {
  try {
    const pkg = JSON.parse(readFileSync(path.join(scenarioDir, "package.json"), "utf-8"));
    const manifest = yaml.load(
      readFileSync(path.join(manifestDir, "manifest.yaml"), "utf-8")
    ) as FrameworkManifest;
    return pkg.dependencies?.[manifest.lib] || pkg.devDependencies?.[manifest.lib] || "unknown";
  } catch {
    return "unknown";
  }
}

function getInstallCommand(scenarioDir: string): string {
  try {
    const pkg = JSON.parse(readFileSync(path.join(scenarioDir, "package.json"), "utf-8"));
    const deps = Object.keys(pkg.dependencies || {}).filter(
      (d) => !["react", "react-dom", "vue", "@angular/animations", "@angular/common", "@angular/compiler", "@angular/core", "@angular/forms", "@angular/platform-browser", "@angular/platform-browser-dynamic", "@angular/router", "rxjs", "tslib", "zone.js"].includes(d)
    );
    return deps.join(" ");
  } catch {
    return "";
  }
}

function extractStepsFromFile(
  filePath: string,
  lang: string,
  scenarioDir: string,
  placeholderMap: PlaceholderMap
): Step[] {
  const content = readFileSync(filePath, "utf-8");
  const lines = content.split("\n");
  const steps: Step[] = [];

  let currentStep: number | null = null;
  let currentDescription = "";
  let currentLines: string[] = [];
  let startLine = 0;

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];

    const startMatch = line.match(TAG_START);
    if (startMatch) {
      currentStep = parseInt(startMatch[1], 10);
      startLine = i + 1;
      currentLines = [];
      currentDescription = "";
      continue;
    }

    const endMatch = line.match(TAG_END);
    if (endMatch && currentStep !== null) {
      const endStep = parseInt(endMatch[1], 10);
      if (endStep !== currentStep) {
        throw new Error(
          `Mismatched snippet end tag in ${filePath}:${i + 1}. Expected @snippet:step${currentStep}:end but found @snippet:step${endStep}:end.`
        );
      }
      const code = applyPlaceholders(currentLines.join("\n"), lang, placeholderMap);
      steps.push({
        step: currentStep,
        description: currentDescription,
        code,
        file: path.relative(scenarioDir, filePath),
        lang,
        lines: `${startLine}-${i}`,
      });
      currentStep = null;
      continue;
    }

    if (currentStep !== null) {
      const descMatch = line.match(DESCRIPTION);
      if (descMatch) {
        currentDescription = descMatch[1].trim();
        continue;
      }
      currentLines.push(line);
    }
  }

  return steps;
}

async function main() {
  const placeholderMap = getPlaceholderMap();
  const manifestFiles = await glob("*/manifest.yaml", { cwd: SAMPLES });
  const snippets: Record<string, Record<string, FrameworkSnippet>> = {};

  for (const manifestFile of manifestFiles.sort()) {
    const frameworkDir = path.join(SAMPLES, path.dirname(manifestFile));
    const content = readFileSync(path.join(SAMPLES, manifestFile), "utf-8");
    const manifest = yaml.load(content) as FrameworkManifest;
    const fw = manifest.framework;
    const lang = manifest.lang;

    for (const scenarioId of Object.keys(manifest.scenarios)) {
      const dirName = scenarioId.replace(/^[^_]+_/, "").replaceAll("_", "-");
      const scenarioDir = path.join(frameworkDir, dirName);

      let hasPkg = false;
      try {
        readFileSync(path.join(scenarioDir, "package.json"), "utf-8");
        hasPkg = true;
      } catch {
        try {
          const srcFiles = await glob("src/**/*", { cwd: scenarioDir });
          hasPkg = srcFiles.length > 0;
        } catch {
          // directory doesn't exist
        }
      }

      if (!hasPkg) {
        console.warn(`Warning: no project found for scenario ${scenarioId} in samples/${fw}/${dirName}/`);
        continue;
      }

      const sourceFiles = await glob("src/**/*.{ts,tsx,js,jsx,vue}", { cwd: scenarioDir });
      const allSteps: Step[] = [];

      for (const sourceFile of sourceFiles.sort()) {
        const fullPath = path.join(scenarioDir, sourceFile);
        const steps = extractStepsFromFile(fullPath, lang, scenarioDir, placeholderMap);
        allSteps.push(...steps);
      }

      if (allSteps.length === 0) {
        console.warn(`Warning: no @snippet tags found in samples/${fw}/${dirName}/`);
        continue;
      }

      allSteps.sort((a, b) => a.step - b.step);

      if (!snippets[scenarioId]) {
        snippets[scenarioId] = {};
      }

      const runCommand = manifest.scenarios[scenarioId]?.run_command;
      snippets[scenarioId][fw] = {
        steps: allSteps,
        framework: fw,
        lib: manifest.lib,
        lib_version: getLibVersion(scenarioDir, frameworkDir),
        install: getInstallCommand(scenarioDir),
        repo_path: `samples/${path.relative(SAMPLES, scenarioDir)}`,
        ...(runCommand ? { run_command: runCommand } : {}),
      };
    }
  }

  const outputPath = path.join(ROOT, "snippets.json");
  writeFileSync(outputPath, JSON.stringify(snippets, null, 2) + "\n");

  const totalSnippets = Object.values(snippets).reduce(
    (sum, fw) => sum + Object.keys(fw).length,
    0
  );
  console.log(
    `Wrote ${outputPath} (${Object.keys(snippets).length} scenarios, ${totalSnippets} framework snippets)`
  );
}

main();
