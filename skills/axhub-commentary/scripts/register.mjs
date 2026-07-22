#!/usr/bin/env node

import { execFileSync } from "node:child_process";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import process from "node:process";
import { fileURLToPath } from "node:url";

export const HOST_NAME = "com.axhub.acp.nativehost";
export const HOST_DESCRIPTION = "Axhub ACP UI Native Messaging host";

const scriptDir = path.dirname(fileURLToPath(import.meta.url));
export const BUNDLED_HOST_PATH = path.join(scriptDir, "acp-native-host.mjs");

export function isValidExtensionId(value) {
  return /^[a-p]{32}$/u.test(String(value ?? "").trim());
}

export function extensionOrigin(extensionId) {
  const normalized = String(extensionId ?? "").trim();
  if (!isValidExtensionId(normalized)) {
    throw new Error(
      "extension-id must be a 32-character Chromium extension ID",
    );
  }
  return `chrome-extension://${normalized}/`;
}

export function parseBrowser(value) {
  const browser = String(value || "chrome")
    .trim()
    .toLowerCase();
  if (browser === "chrome" || browser === "edge") return browser;
  throw new Error("browser must be chrome or edge");
}

export function installLayout({
  platform = process.platform,
  homeDir = os.homedir(),
  environment = process.env,
} = {}) {
  const root =
    platform === "win32"
      ? path.join(
          environment.LOCALAPPDATA || path.join(homeDir, "AppData", "Local"),
          "Axhub",
        )
      : path.join(homeDir, ".axhub");
  const installDir = path.join(root, "acp-native-host");
  return {
    installDir,
    hostPath: path.join(installDir, "host.mjs"),
    nodePathFile: path.join(installDir, "node_path.txt"),
    logDir: path.join(installDir, "logs"),
    hostLogPath: path.join(installDir, "logs", "native-host.log"),
    acpUiLogPath: path.join(installDir, "logs", "acp-ui.log"),
    wrapperLogPath: path.join(installDir, "logs", "wrapper.log"),
    wrapperPath: path.join(
      installDir,
      platform === "win32" ? "run_host.bat" : "run_host.sh",
    ),
  };
}

export function userManifestPath(
  browserValue,
  {
    platform = process.platform,
    homeDir = os.homedir(),
    environment = process.env,
  } = {},
) {
  const browser = parseBrowser(browserValue);
  const fileName = `${HOST_NAME}.json`;
  if (platform === "win32") {
    const appData =
      environment.APPDATA || path.join(homeDir, "AppData", "Roaming");
    return path.join(
      appData,
      ...(browser === "edge" ? ["Microsoft", "Edge"] : ["Google", "Chrome"]),
      "NativeMessagingHosts",
      fileName,
    );
  }
  if (platform === "darwin") {
    return path.join(
      homeDir,
      "Library",
      "Application Support",
      browser === "edge" ? "Microsoft Edge" : "Google/Chrome",
      "NativeMessagingHosts",
      fileName,
    );
  }
  return path.join(
    environment.XDG_CONFIG_HOME || path.join(homeDir, ".config"),
    browser === "edge" ? "microsoft-edge" : "google-chrome",
    "NativeMessagingHosts",
    fileName,
  );
}

export function registryKey(browserValue) {
  const browser = parseBrowser(browserValue);
  const product = browser === "edge" ? "Microsoft\\Edge" : "Google\\Chrome";
  return `HKCU\\Software\\${product}\\NativeMessagingHosts\\${HOST_NAME}`;
}

function unixWrapper() {
  return `#!/usr/bin/env sh
set -eu

SCRIPT_DIR="$(CDPATH= cd -- "$(dirname -- "$0")" && pwd)"
NODE_EXEC=""
LOG_DIR="${"${SCRIPT_DIR}"}/logs"
mkdir -p "${"${LOG_DIR}"}" 2>/dev/null || true
printf '%s wrapper_started pid=%s\\n' "$(date -u '+%Y-%m-%dT%H:%M:%SZ')" "$$" >> "${"${LOG_DIR}"}/wrapper.log" 2>/dev/null || true

if [ -f "${"${SCRIPT_DIR}"}/node_path.txt" ]; then
  CANDIDATE="$(tr -d '\\r\\n' < "${"${SCRIPT_DIR}"}/node_path.txt")"
  if [ -x "${"${CANDIDATE}"}" ]; then
    NODE_EXEC="${"${CANDIDATE}"}"
  fi
fi

if [ -z "${"${NODE_EXEC}"}" ]; then
  NODE_EXEC="$(command -v node || true)"
fi

if [ -z "${"${NODE_EXEC}"}" ] || [ ! -x "${"${NODE_EXEC}"}" ]; then
  echo "Node.js executable not found. Run the axhub-commentary doctor script." >&2
  exit 1
fi

NODE_BIN_DIR="$(dirname -- "${"${NODE_EXEC}"}")"
PATH="${"${NODE_BIN_DIR}"}${"${PATH:+:${PATH}}"}"
export PATH
exec "${"${NODE_EXEC}"}" "${"${SCRIPT_DIR}"}/host.mjs" "$@"
`;
}

function windowsWrapper() {
  return `@echo off
setlocal
set "SCRIPT_DIR=%~dp0"
set "NODE_EXEC="
set "LOG_DIR=%SCRIPT_DIR%logs"
if not exist "%LOG_DIR%" mkdir "%LOG_DIR%" >nul 2>&1
echo %DATE%T%TIME% wrapper_started>>"%LOG_DIR%/wrapper.log"

if exist "%SCRIPT_DIR%node_path.txt" set /p NODE_EXEC=<"%SCRIPT_DIR%node_path.txt"
if defined NODE_EXEC if exist "%NODE_EXEC%" goto run
set "NODE_EXEC="
for /f "delims=" %%I in ('where node.exe 2^>nul') do if not defined NODE_EXEC set "NODE_EXEC=%%I"

:run
if not defined NODE_EXEC (
  echo Node.js executable not found. Run the axhub-commentary doctor script. 1>&2
  exit /b 1
)
for %%I in ("%NODE_EXEC%") do set "NODE_BIN_DIR=%%~dpI"
set "PATH=%NODE_BIN_DIR%;%PATH%"
"%NODE_EXEC%" "%SCRIPT_DIR%host.mjs" %*
exit /b %ERRORLEVEL%
`;
}

function readAllowedOrigins(manifestPath) {
  try {
    const manifest = JSON.parse(fs.readFileSync(manifestPath, "utf8"));
    return Array.isArray(manifest.allowed_origins)
      ? manifest.allowed_origins.filter(
          (origin) =>
            typeof origin === "string" &&
            /^chrome-extension:\/\/[a-p]{32}\/$/u.test(origin),
        )
      : [];
  } catch {
    return [];
  }
}

export function registerNativeHost({
  confirmed = false,
  browser: browserValue = "chrome",
  extensionId,
  platform = process.platform,
  homeDir = os.homedir(),
  environment = process.env,
  nodeExecPath = process.execPath,
  sourceHostPath = BUNDLED_HOST_PATH,
  execFile = execFileSync,
} = {}) {
  if (!confirmed) {
    throw new Error(
      "Native Host registration requires explicit user confirmation; rerun with --confirm-native-host-install",
    );
  }
  const browser = parseBrowser(browserValue);
  const origin = extensionOrigin(extensionId);
  if (!fs.existsSync(sourceHostPath)) {
    throw new Error(`Bundled Native host not found: ${sourceHostPath}`);
  }

  const layout = installLayout({ platform, homeDir, environment });
  fs.mkdirSync(layout.installDir, { recursive: true });
  fs.mkdirSync(layout.logDir, { recursive: true });
  fs.copyFileSync(sourceHostPath, layout.hostPath);
  fs.writeFileSync(layout.nodePathFile, nodeExecPath, "utf8");
  fs.writeFileSync(
    layout.wrapperPath,
    platform === "win32" ? windowsWrapper() : unixWrapper(),
    "utf8",
  );
  if (platform !== "win32") fs.chmodSync(layout.wrapperPath, 0o755);

  const manifestPath = userManifestPath(browser, {
    platform,
    homeDir,
    environment,
  });
  const allowedOrigins = [
    ...new Set([...readAllowedOrigins(manifestPath), origin]),
  ].sort();
  const manifest = {
    name: HOST_NAME,
    description: HOST_DESCRIPTION,
    path: layout.wrapperPath,
    type: "stdio",
    allowed_origins: allowedOrigins,
  };
  fs.mkdirSync(path.dirname(manifestPath), { recursive: true });
  fs.writeFileSync(
    manifestPath,
    `${JSON.stringify(manifest, null, 2)}\n`,
    "utf8",
  );

  if (platform === "win32") {
    execFile(
      "reg",
      [
        "add",
        registryKey(browser),
        "/ve",
        "/t",
        "REG_SZ",
        "/d",
        manifestPath,
        "/f",
      ],
      { stdio: "pipe", windowsHide: true },
    );
  }

  return { browser, manifestPath, allowedOrigins, ...layout };
}

export function parseRegisterArgs(args, environment = process.env) {
  const option = (longName, shortName) => {
    const index = args.findIndex(
      (value) => value === longName || value === shortName,
    );
    return index >= 0 ? args[index + 1] : undefined;
  };
  if (args.includes("--system")) {
    throw new Error(
      "System-level registration is not supported; use user-level registration",
    );
  }
  return {
    confirmed: args.includes("--confirm-native-host-install"),
    browser: option("--browser", "-b") || "chrome",
    extensionId: option("--extension-id") || environment.AXHUB_EXTENSION_ID,
  };
}

export function main(args = process.argv.slice(2)) {
  const result = registerNativeHost(parseRegisterArgs(args));
  process.stdout.write(`Registered ${result.manifestPath}\n`);
  return 0;
}

function realFilePath(value) {
  try {
    return fs.realpathSync(value);
  } catch {
    return path.resolve(value);
  }
}

const isDirectRun =
  process.argv[1] &&
  realFilePath(process.argv[1]) ===
    realFilePath(fileURLToPath(import.meta.url));
if (isDirectRun) {
  try {
    process.exitCode = main();
  } catch (error) {
    process.stderr.write(
      `${error instanceof Error ? error.message : String(error)}\n`,
    );
    process.exitCode = 1;
  }
}
