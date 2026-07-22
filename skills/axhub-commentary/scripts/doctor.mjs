#!/usr/bin/env node

import { execFileSync } from "node:child_process";
import { createHash } from "node:crypto";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import process from "node:process";
import { fileURLToPath } from "node:url";
import {
  BUNDLED_HOST_PATH,
  HOST_NAME,
  extensionOrigin,
  installLayout,
  parseBrowser,
  registryKey,
  userManifestPath,
} from "./register.mjs";

function fileHash(filePath) {
  try {
    return createHash("sha256").update(fs.readFileSync(filePath)).digest("hex");
  } catch {
    return undefined;
  }
}

function commandResult(execFile, command, args) {
  try {
    return String(
      execFile(command, args, {
        encoding: "utf8",
        stdio: ["ignore", "pipe", "ignore"],
        windowsHide: true,
      }),
    ).trim();
  } catch {
    return "";
  }
}

function existingDirectory(value) {
  let candidate = path.resolve(value);
  while (!fs.existsSync(candidate)) {
    const parent = path.dirname(candidate);
    if (parent === candidate) return candidate;
    candidate = parent;
  }
  return candidate;
}

function isWritable(value) {
  try {
    fs.accessSync(existingDirectory(value), fs.constants.W_OK);
    return true;
  } catch {
    return false;
  }
}

function isExecutableFile(value, platform) {
  if (!value) return false;
  try {
    if (!fs.statSync(value).isFile()) return false;
    if (platform === "win32") {
      return [".com", ".exe"].includes(path.extname(value).toLowerCase());
    }
    fs.accessSync(value, fs.constants.X_OK);
    return true;
  } catch {
    return false;
  }
}

function readManifest(manifestPath) {
  try {
    const value = JSON.parse(fs.readFileSync(manifestPath, "utf8"));
    return value && typeof value === "object" && !Array.isArray(value)
      ? value
      : undefined;
  } catch {
    return undefined;
  }
}

async function checkAcpHealth(fetchImpl) {
  try {
    const response = await fetchImpl("http://localhost:32124/api/health", {
      cache: "no-store",
      signal: AbortSignal.timeout(1500),
    });
    const body = await response.json().catch(() => ({}));
    const healthy =
      response.ok && body?.status === "ok" && body?.service === "acp-ui";
    return {
      id: "acp.health",
      status: healthy ? "ok" : "error",
      message: healthy
        ? "ACP UI health is ready"
        : "ACP UI health is not ready",
      details: { status: response.status, body },
    };
  } catch (error) {
    return {
      id: "acp.health",
      status: "error",
      message: error instanceof Error ? error.message : String(error),
    };
  }
}

export async function collectDoctorReport({
  browser: browserValue = "chrome",
  extensionId,
  fix = false,
  checkAcp = false,
  platform = process.platform,
  homeDir = os.homedir(),
  environment = process.env,
  nodeExecPath = process.execPath,
  sourceHostPath = BUNDLED_HOST_PATH,
  execFile = execFileSync,
  fetchImpl = fetch,
} = {}) {
  const browser = parseBrowser(browserValue);
  const layout = installLayout({ platform, homeDir, environment });
  const manifestPath = userManifestPath(browser, {
    platform,
    homeDir,
    environment,
  });
  const checks = [];
  const fixes = [];

  if (fix) {
    if (!fs.existsSync(layout.hostPath) || !fs.existsSync(layout.wrapperPath)) {
      fixes.push({
        id: "local-files",
        success: false,
        message: "Native host is not installed; run register explicitly",
      });
    } else {
      try {
        if (platform !== "win32") fs.chmodSync(layout.wrapperPath, 0o755);
        fs.writeFileSync(layout.nodePathFile, nodeExecPath, "utf8");
        fixes.push({
          id: "local-files",
          success: true,
          message: "Fixed wrapper permissions and node_path.txt",
        });
      } catch (error) {
        fixes.push({
          id: "local-files",
          success: false,
          message: error instanceof Error ? error.message : String(error),
        });
      }
    }
  }

  const nodeVersion = commandResult(execFile, nodeExecPath, ["-v"]);
  checks.push({
    id: "node",
    status: nodeVersion ? "ok" : "error",
    message: nodeVersion
      ? `${nodeExecPath} ${nodeVersion}`
      : "Current Node.js executable failed",
    details: { path: nodeExecPath, version: nodeVersion || null },
  });

  const npxCommand = platform === "win32" ? "npx.cmd" : "npx";
  const npxPath = commandResult(
    execFile,
    platform === "win32" ? "where.exe" : "which",
    [npxCommand],
  )
    .split(/\r?\n/u)
    .find(Boolean);
  checks.push({
    id: "npx",
    status: npxPath ? "ok" : "error",
    message: npxPath || `${npxCommand} executable not found`,
    details: { path: npxPath || null },
  });

  const sourceHash = fileHash(sourceHostPath);
  const installedHash = fileHash(layout.hostPath);
  checks.push({
    id: "host.files",
    status:
      sourceHash && installedHash && fs.existsSync(layout.wrapperPath)
        ? "ok"
        : "error",
    message:
      sourceHash && installedHash && fs.existsSync(layout.wrapperPath)
        ? "Bundled and installed Native host files exist"
        : "Native host is not installed; run register explicitly",
    details: {
      sourceHostPath,
      installedHostPath: layout.hostPath,
      wrapperPath: layout.wrapperPath,
    },
  });
  checks.push({
    id: "host.version",
    status:
      sourceHash && installedHash && sourceHash === installedHash
        ? "ok"
        : sourceHash && installedHash
          ? "error"
          : "warn",
    message:
      sourceHash && installedHash && sourceHash === installedHash
        ? "Installed Native host matches the Skill"
        : "Installed Native host differs from the Skill; run register explicitly",
    details: {
      sourceHash: sourceHash || null,
      installedHash: installedHash || null,
    },
  });

  let wrapperExecutable = platform === "win32";
  if (platform !== "win32") {
    try {
      fs.accessSync(layout.wrapperPath, fs.constants.X_OK);
      wrapperExecutable = true;
    } catch {
      wrapperExecutable = false;
    }
  }
  checks.push({
    id: "host.permissions",
    status: wrapperExecutable ? "ok" : "error",
    message: wrapperExecutable
      ? "Native host wrapper is executable"
      : "Wrapper is not executable",
    details: { path: layout.wrapperPath },
  });

  const logDirectoryWritable = isWritable(layout.logDir);
  checks.push({
    id: "host.logs",
    status: logDirectoryWritable ? "ok" : "warn",
    message: logDirectoryWritable
      ? "Native host log directory is writable"
      : "Native host log directory is not writable",
    details: {
      directory: layout.logDir,
      wrapper: layout.wrapperLogPath,
      host: layout.hostLogPath,
      acpUi: layout.acpUiLogPath,
    },
  });

  let configuredNodePath = "";
  try {
    configuredNodePath = fs.readFileSync(layout.nodePathFile, "utf8").trim();
  } catch {
    configuredNodePath = "";
  }
  const configuredNodeExecutable = isExecutableFile(configuredNodePath, platform);
  checks.push({
    id: "node.path.file",
    status: configuredNodeExecutable ? "ok" : "error",
    message:
      configuredNodeExecutable
        ? "node_path.txt points to an existing executable"
        : "node_path.txt is missing, stale, or not executable",
    details: { path: layout.nodePathFile, value: configuredNodePath || null },
  });

  const manifest = readManifest(manifestPath);
  const expectedOrigin = extensionId ? extensionOrigin(extensionId) : undefined;
  const allowedOrigins = Array.isArray(manifest?.allowed_origins)
    ? manifest.allowed_origins
    : [];
  const exactOriginsOnly = allowedOrigins.every(
    (origin) =>
      typeof origin === "string" &&
      /^chrome-extension:\/\/[a-p]{32}\/$/u.test(origin),
  );
  const manifestValid =
    manifest?.name === HOST_NAME &&
    manifest?.type === "stdio" &&
    manifest?.path === layout.wrapperPath &&
    exactOriginsOnly &&
    allowedOrigins.length > 0 &&
    (!expectedOrigin || allowedOrigins.includes(expectedOrigin));
  checks.push({
    id: `manifest.${browser}`,
    status: manifestValid ? "ok" : "error",
    message: manifestValid
      ? "Native Messaging manifest is valid"
      : "Manifest is missing or invalid",
    details: {
      path: manifestPath,
      expectedOrigin: expectedOrigin || null,
      manifest: manifest || null,
    },
  });

  const writablePaths = [layout.installDir, path.dirname(manifestPath)];
  checks.push({
    id: "directories.user-writable",
    status: writablePaths.every(isWritable) ? "ok" : "warn",
    message: writablePaths.every(isWritable)
      ? "User-level host and manifest directories are writable"
      : "One or more user-level directories are not writable",
    details: {
      directories: writablePaths.map((value) => ({
        path: value,
        existingPath: existingDirectory(value),
        writable: isWritable(value),
      })),
    },
  });

  if (platform === "win32") {
    const key = registryKey(browser);
    const registry = commandResult(execFile, "reg", ["query", key, "/ve"]);
    checks.push({
      id: "registry",
      status: registry.includes(manifestPath) ? "ok" : "error",
      message: registry.includes(manifestPath)
        ? "Native Messaging registry key is valid"
        : "Native Messaging registry key is missing or stale",
      details: { key, manifestPath },
    });
  }

  if (checkAcp) checks.push(await checkAcpHealth(fetchImpl));

  return {
    schemaVersion: 1,
    timestamp: new Date().toISOString(),
    ok: checks.every((check) => check.status !== "error"),
    platform,
    arch: process.arch,
    checks,
    fixes,
  };
}

export function parseDoctorArgs(args, environment = process.env) {
  const option = (longName, shortName) => {
    const index = args.findIndex(
      (value) => value === longName || value === shortName,
    );
    return index >= 0 ? args[index + 1] : undefined;
  };
  return {
    browser: option("--browser", "-b") || "chrome",
    extensionId: option("--extension-id") || environment.AXHUB_EXTENSION_ID,
    json: args.includes("--json"),
    fix: args.includes("--fix"),
    checkAcp: args.includes("--check-acp"),
  };
}

export async function main(args = process.argv.slice(2)) {
  const options = parseDoctorArgs(args);
  const report = await collectDoctorReport(options);
  if (options.json) {
    process.stdout.write(`${JSON.stringify(report, null, 2)}\n`);
  } else {
    for (const check of report.checks) {
      process.stdout.write(
        `[${check.status.toUpperCase()}] ${check.id}: ${check.message}\n`,
      );
    }
    for (const fix of report.fixes) {
      process.stdout.write(
        `[${fix.success ? "OK" : "ERROR"}] fix.${fix.id}: ${fix.message}\n`,
      );
    }
  }
  return report.ok ? 0 : 1;
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
  main()
    .then((code) => {
      process.exitCode = code;
    })
    .catch((error) => {
      process.stderr.write(
        `${error instanceof Error ? error.message : String(error)}\n`,
      );
      process.exitCode = 1;
    });
}
