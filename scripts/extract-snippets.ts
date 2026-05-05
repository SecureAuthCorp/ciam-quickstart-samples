import { readdirSync, readFileSync, writeFileSync } from "fs";
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
  docs_url: string;
  install: string;
  repo_path: string;
  run_command?: string;
  callout?: string;
}

interface ScenarioMeta {
  run_command?: string;
  lib?: string;
  docs_url?: string;
  callout?: string;
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
const TAG_START = /(?:\/\/|#)\s*@snippet:step(\d+):start/;
const TAG_END = /(?:\/\/|#)\s*@snippet:step(\d+):end/;
const DESCRIPTION = /(?:\/\/|#)\s*@description\s+(.+)/;

function getPlaceholderMap(): PlaceholderMap {
  const content = readFileSync(
    path.join(ROOT, "placeholder-map.yaml"),
    "utf-8",
  );
  return yaml.load(content) as PlaceholderMap;
}

function applyPlaceholders(
  code: string,
  lang: string,
  placeholderMap: PlaceholderMap,
): string {
  // Try language-specific mappings first, then fall back to js
  const mappings = placeholderMap[lang] || placeholderMap["js"] || [];
  let result = code;
  for (const { pattern, placeholder } of mappings) {
    result = result.replaceAll(pattern, `"${placeholder}"`);
  }
  return result;
}

function getLibVersion(
  scenarioDir: string,
  manifestDir: string,
  libOverride?: string,
): string {
  const manifest = yaml.load(
    readFileSync(path.join(manifestDir, "manifest.yaml"), "utf-8"),
  ) as FrameworkManifest;
  const lib = libOverride ?? manifest.lib;

  // npm — package.json
  try {
    const pkg = JSON.parse(
      readFileSync(path.join(scenarioDir, "package.json"), "utf-8"),
    );
    const v = pkg.dependencies?.[lib] || pkg.devDependencies?.[lib];
    if (v) return String(v).replace(/^[\^~>=<\s]+/, "");
  } catch {
    // no package.json — try next
  }

  // .NET — *.csproj under src/
  try {
    const srcDir = path.join(scenarioDir, "src");
    const csprojFiles = readdirSync(srcDir).filter((f) =>
      f.endsWith(".csproj"),
    );
    if (csprojFiles.length > 0) {
      const csprojContent = readFileSync(
        path.join(srcDir, csprojFiles[0]),
        "utf-8",
      );
      const libEscaped = lib.replace(/[.]/g, "\\.");
      const regex = new RegExp(
        `<PackageReference\\s+Include="${libEscaped}"\\s+Version="([^"]+)"`,
      );
      const match = csprojContent.match(regex);
      if (match) return match[1];
    }
  } catch {
    // no src/ dir or no .csproj — fall through
  }

  // Java — pom.xml (Spring Boot starters inherit version from parent POM)
  try {
    const pomContent = readFileSync(path.join(scenarioDir, "pom.xml"), "utf-8");
    const parentMatch = pomContent.match(
      /<parent>[\s\S]*?<artifactId>spring-boot-starter-parent<\/artifactId>[\s\S]*?<version>([^<]+)<\/version>[\s\S]*?<\/parent>/,
    );
    if (parentMatch) return parentMatch[1];
  } catch {
    // no pom.xml — fall through
  }

  // Flutter — pubspec.yaml dependencies
  try {
    const pubspec = yaml.load(
      readFileSync(path.join(scenarioDir, "pubspec.yaml"), "utf-8"),
    ) as { dependencies?: Record<string, unknown> };
    const dep = pubspec?.dependencies?.[lib];
    if (typeof dep === "string") {
      return dep.replace(/^[\^~>=<\s]+/, "");
    }
    if (
      dep &&
      typeof dep === "object" &&
      typeof (dep as { version?: unknown }).version === "string"
    ) {
      return (dep as { version: string }).version.replace(/^[\^~>=<\s]+/, "");
    }
  } catch {
    // no pubspec.yaml — fall through
  }

  // iOS — Package.resolved (preferred) or Package.swift literal
  try {
    // Look for Package.resolved at the SPM root and inside any *.xcworkspace or
    // *.xcodeproj/project.xcworkspace under the scenario dir. globSync is
    // synchronous — fine here since this whole function is sync.
    const swiftpmGlobs = glob
      .sync(
        [
          "**/*.xcworkspace/**/swiftpm/Package.resolved",
          "**/*.xcodeproj/**/swiftpm/Package.resolved",
        ],
        { cwd: scenarioDir, absolute: true, nodir: true },
      )
      // glob may include both the .xcworkspace inside a .xcodeproj and the
      // .xcodeproj's own embedded workspace — dedupe.
      .filter((p, i, arr) => arr.indexOf(p) === i);
    const resolvedPaths = [
      path.join(scenarioDir, "Package.resolved"),
      ...swiftpmGlobs,
    ];
    for (const p of resolvedPaths) {
      try {
        // SwiftPM v1 puts pins at the top level; v2 (used by modern Xcode)
        // wraps them under `object.pins`. Handle both.
        const resolved = JSON.parse(readFileSync(p, "utf-8")) as {
          pins?: Array<{
            identity?: string;
            location?: string;
            state?: { version?: string };
          }>;
          object?: {
            pins?: Array<{
              identity?: string;
              location?: string;
              state?: { version?: string };
            }>;
          };
        };
        const pins = resolved.pins ?? resolved.object?.pins;
        const libLower = lib.toLowerCase();
        const pin = pins?.find((p) => {
          const id = (p.identity || "").toLowerCase();
          const loc = (p.location || "").toLowerCase();
          return id === libLower || loc.includes(`/${libLower}`);
        });
        if (pin?.state?.version) return pin.state.version;
      } catch {
        // try next path
      }
    }
    // Fall back to scanning Package.swift for `.upToNextMajor(from: "X.Y.Z")` literals.
    const swiftContent = readFileSync(
      path.join(scenarioDir, "Package.swift"),
      "utf-8",
    );
    const libEscapedSwift = lib.replace(/[.+*?^${}()|[\]\\]/g, "\\$&");
    const literalMatch = swiftContent.match(
      new RegExp(
        `${libEscapedSwift}[\\s\\S]{0,200}?\\.upToNextMajor\\(from:\\s*"([0-9][0-9A-Za-z.\\-]*)"\\)`,
      ),
    );
    if (literalMatch) return literalMatch[1];
  } catch {
    // no Package.swift / no Package.resolved — fall through
  }

  // Android — build.gradle.kts (Kotlin DSL) or build.gradle (Groovy DSL)
  try {
    const gradlePaths = [
      path.join(scenarioDir, "app", "build.gradle.kts"),
      path.join(scenarioDir, "app", "build.gradle"),
      path.join(scenarioDir, "build.gradle.kts"),
      path.join(scenarioDir, "build.gradle"),
    ];
    for (const p of gradlePaths) {
      try {
        const gradle = readFileSync(p, "utf-8");
        // Match e.g. `implementation("net.openid:appauth:0.11.1")`.
        // The `lib` value is expected to be `group:artifact` (e.g. `net.openid:appauth`).
        const libEscaped = lib.replace(/[.+*?^${}()|[\]\\]/g, "\\$&");
        const regex = new RegExp(
          `["']${libEscaped}:([0-9][0-9A-Za-z.\\-]*)["']`,
        );
        const match = gradle.match(regex);
        if (match) return match[1];
      } catch {
        // try next path
      }
    }
  } catch {
    // no Gradle file — fall through
  }

  return "unknown";
}

function getInstallCommand(scenarioDir: string): string {
  try {
    const pkg = JSON.parse(
      readFileSync(path.join(scenarioDir, "package.json"), "utf-8"),
    );
    const deps = Object.keys(pkg.dependencies || {}).filter(
      (d) =>
        ![
          "react",
          "react-dom",
          "react-native",
          "vue",
          "express",
          "express-session",
          "dotenv",
          "selfsigned",
          "@angular/animations",
          "@angular/common",
          "@angular/compiler",
          "@angular/core",
          "@angular/forms",
          "@angular/platform-browser",
          "@angular/platform-browser-dynamic",
          "@angular/router",
          "rxjs",
          "tslib",
          "zone.js",
        ].includes(d),
    );
    return deps.join(" ");
  } catch {
    // non-npm projects (e.g. .NET) declare packages elsewhere (.csproj) and install via run_command
    return "";
  }
}

function extractStepsFromFile(
  filePath: string,
  lang: string,
  scenarioDir: string,
  placeholderMap: PlaceholderMap,
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
          `Mismatched snippet end tag in ${filePath}:${i + 1}. Expected @snippet:step${currentStep}:end but found @snippet:step${endStep}:end.`,
        );
      }
      const code = applyPlaceholders(
        currentLines.join("\n"),
        lang,
        placeholderMap,
      );
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

const EXT_LANG_OVERRIDES: Record<string, string> = {
  ".java": "java",
  ".yml": "yaml",
  ".yaml": "yaml",
  ".swift": "swift",
  ".kt": "kotlin",
  ".kts": "kotlin",
  ".dart": "dart",
  ".gradle": "groovy",
  ".xcconfig": "xcconfig",
};

function langFor(file: string, manifestLang: string): string {
  const ext = path.extname(file).toLowerCase();
  return EXT_LANG_OVERRIDES[ext] ?? manifestLang;
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
      const projectMarkers = [
        "package.json", // Node / RN
        "pom.xml", // Java
        "pubspec.yaml", // Flutter
        "Package.swift", // iOS (SPM)
        "build.gradle.kts", // Android (Kotlin DSL)
        "build.gradle", // Android (Groovy DSL)
      ];
      for (const marker of projectMarkers) {
        try {
          readFileSync(path.join(scenarioDir, marker), "utf-8");
          hasPkg = true;
          break;
        } catch {
          // marker not found — try next
        }
      }
      if (!hasPkg) {
        // .NET projects keep their .csproj inside src/ — fall back to "any src/ content".
        try {
          const srcFiles = await glob("src/**/*", { cwd: scenarioDir });
          hasPkg = srcFiles.length > 0;
        } catch {
          // src/ doesn't exist
        }
      }

      if (!hasPkg) {
        // iOS Xcode projects (xcodegen-generated or hand-rolled) — any *.xcodeproj/ folder.
        try {
          const xcodeprojDirs = await glob("*.xcodeproj", { cwd: scenarioDir });
          hasPkg = xcodeprojDirs.length > 0;
        } catch {
          // no .xcodeproj
        }
      }

      if (!hasPkg) {
        console.warn(
          `Warning: no project found for scenario ${scenarioId} in samples/${fw}/${dirName}/`,
        );
        continue;
      }

      const sourceFiles = await glob(
        "**/*.{ts,tsx,js,jsx,vue,cs,java,yml,yaml,swift,kt,kts,dart,gradle,xcconfig}",
        {
          cwd: scenarioDir,
          ignore: [
            "**/node_modules/**",
            "**/.yarn/**",
            "**/dist/**",
            "**/build/**",
            "**/target/**",
            "**/bin/**",
            "**/obj/**",
            "**/.gradle/**",
            "**/.dart_tool/**",
            "**/.flutter-plugins-dependencies",
            "**/Pods/**",
            "**/DerivedData/**",
            "**/.build/**",
            "**/coverage/**",
          ],
        },
      );
      const allSteps: Step[] = [];

      for (const sourceFile of sourceFiles.sort()) {
        const fullPath = path.join(scenarioDir, sourceFile);
        const fileLang = langFor(sourceFile, lang);
        const steps = extractStepsFromFile(
          fullPath,
          fileLang,
          scenarioDir,
          placeholderMap,
        );
        allSteps.push(...steps);
      }

      if (allSteps.length === 0) {
        console.warn(
          `Warning: no @snippet tags found in samples/${fw}/${dirName}/`,
        );
        continue;
      }

      allSteps.sort((a, b) => a.step - b.step);

      if (!snippets[scenarioId]) {
        snippets[scenarioId] = {};
      }

      const runCommand = manifest.scenarios[scenarioId]?.run_command;
      const scenarioLib = manifest.scenarios[scenarioId]?.lib ?? manifest.lib;
      const scenarioDocsUrl =
        manifest.scenarios[scenarioId]?.docs_url ?? manifest.docs_url;
      const scenarioCallout = manifest.scenarios[scenarioId]?.callout;
      snippets[scenarioId][fw] = {
        steps: allSteps,
        framework: fw,
        lib: scenarioLib,
        lib_version: getLibVersion(scenarioDir, frameworkDir, scenarioLib),
        docs_url: scenarioDocsUrl,
        install: getInstallCommand(scenarioDir),
        repo_path: `samples/${path.relative(SAMPLES, scenarioDir)}`,
        ...(runCommand ? { run_command: runCommand } : {}),
        ...(scenarioCallout ? { callout: scenarioCallout } : {}),
      };
    }
  }

  const outputPath = path.join(ROOT, "snippets.json");
  writeFileSync(outputPath, JSON.stringify(snippets, null, 2) + "\n");

  const totalSnippets = Object.values(snippets).reduce(
    (sum, fw) => sum + Object.keys(fw).length,
    0,
  );
  console.log(
    `Wrote ${outputPath} (${Object.keys(snippets).length} scenarios, ${totalSnippets} framework snippets)`,
  );
}

main();
