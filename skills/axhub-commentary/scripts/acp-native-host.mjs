#!/usr/bin/env node

import { spawn } from "node:child_process";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import process from "node:process";
import { fileURLToPath } from "node:url";

export const MAX_NATIVE_MESSAGE_BYTES = 1024 * 1024;
export const ACP_START_ARGS = ["-y", "@axhub/acp@latest"];
export const ACP_TRUSTED_HOST_ARGS = [
  "-y",
  "@axhub/acp@latest",
  "trusted-host",
  "add",
];
export const HOST_LOG_FILE_NAME = "native-host.log";
export const ACP_UI_LOG_FILE_NAME = "acp-ui.log";
const DEFAULT_MAX_LOG_BYTES = 2 * 1024 * 1024;
export const ACP_HEALTH_URL = "http://127.0.0.1:32124/api/health";
export const ACP_LAUNCH_LEASE_DIR_NAME = "acp-ui-start.lock";
export const ACP_LAUNCH_LEASE_TTL_MS = 120_000;
export const ACP_STARTUP_TIMEOUT_MS = 30_000;
const TRUSTED_HOST_GRANT_MODE = "--grant-trusted-host";
const TRUSTED_HOST_GRANT_TIMEOUT_MS = 90_000;

export class AcpLaunchError extends Error {
  constructor(code, message) {
    super(message);
    this.name = "AcpLaunchError";
    this.code = code;
  }
}

function rotateLogFile(filePath, maxBytes) {
  try {
    if (fs.statSync(filePath).size < maxBytes) return;
    const rotatedPath = `${filePath}.1`;
    fs.rmSync(rotatedPath, { force: true });
    fs.renameSync(filePath, rotatedPath);
  } catch {
    // Missing or unreadable logs must never break Native Messaging.
  }
}

export function createFileLogger({
  logDir =
    process.env.AXHUB_ACP_NATIVE_LOG_DIR ||
    path.join(path.dirname(fileURLToPath(import.meta.url)), "logs"),
  now = () => new Date(),
  maxBytes = DEFAULT_MAX_LOG_BYTES,
} = {}) {
  const hostLogPath = path.join(logDir, HOST_LOG_FILE_NAME);
  const acpUiLogPath = path.join(logDir, ACP_UI_LOG_FILE_NAME);

  const ensureLogDir = () => {
    try {
      fs.mkdirSync(logDir, { recursive: true });
      return true;
    } catch {
      return false;
    }
  };

  return {
    logDir,
    hostLogPath,
    acpUiLogPath,
    write(event, details = {}) {
      if (!ensureLogDir()) return;
      try {
        rotateLogFile(hostLogPath, maxBytes);
        fs.appendFileSync(
          hostLogPath,
          `${JSON.stringify({
            timestamp: now().toISOString(),
            event,
            pid: process.pid,
            ...details,
          })}\n`,
          "utf8",
        );
      } catch {
        // Logging is best effort and cannot affect protocol responses.
      }
    },
    openAcpUiOutput() {
      if (!ensureLogDir()) return undefined;
      try {
        rotateLogFile(acpUiLogPath, maxBytes);
        return fs.openSync(acpUiLogPath, "a");
      } catch {
        return undefined;
      }
    },
  };
}

export function encodeNativeMessage(message) {
  const body = Buffer.from(JSON.stringify(message), "utf8");
  if (body.length > MAX_NATIVE_MESSAGE_BYTES) {
    throw new Error(`Native message exceeds ${MAX_NATIVE_MESSAGE_BYTES} bytes`);
  }
  const header = Buffer.alloc(4);
  header.writeUInt32LE(body.length, 0);
  return Buffer.concat([header, body]);
}

export function readNativeMessages(input) {
  const messages = [];
  let buffer = input;

  while (buffer.length >= 4) {
    const length = buffer.readUInt32LE(0);
    if (length <= 0 || length > MAX_NATIVE_MESSAGE_BYTES) {
      return {
        messages,
        rest: Buffer.alloc(0),
        error: `Invalid native message length: ${length}`,
      };
    }
    if (buffer.length < length + 4) break;

    const body = buffer.subarray(4, length + 4).toString("utf8");
    buffer = buffer.subarray(length + 4);
    try {
      const value = JSON.parse(body);
      if (!value || typeof value !== "object" || Array.isArray(value)) {
        return {
          messages,
          rest: buffer,
          error: "Native message must be an object",
        };
      }
      messages.push(value);
    } catch (error) {
      return {
        messages,
        rest: buffer,
        error: `Invalid native message JSON: ${error instanceof Error ? error.message : String(error)}`,
      };
    }
  }

  return { messages, rest: buffer };
}

export function isValidExtensionOrigin(value) {
  return /^chrome-extension:\/\/[a-p]{32}$/u.test(value);
}

function normalizeCallerOrigin(value) {
  const normalized = typeof value === "string" ? value.trim() : "";
  return /^chrome-extension:\/\/[a-p]{32}\/?$/u.test(normalized)
    ? normalized.replace(/\/$/u, "")
    : null;
}

function requestIdOf(message) {
  return typeof message?.requestId === "string" && message.requestId.trim()
    ? message.requestId.trim()
    : undefined;
}

function errorResponse(message, code, error) {
  const requestId = requestIdOf(message);
  return {
    type: "start_acp_ui_result",
    ...(requestId ? { responseToRequestId: requestId } : {}),
    payload: { accepted: false },
    error: {
      code,
      message: error instanceof Error ? error.message : String(error),
    },
  };
}

function extensionOriginOf(message) {
  const payload = message?.payload;
  if (payload === undefined) return undefined;
  if (!payload || typeof payload !== "object" || Array.isArray(payload))
    return null;
  const value = payload.extensionOrigin;
  if (value === undefined) return undefined;
  return typeof value === "string" ? value.trim() : null;
}

export function buildAcpEnvironment(
  _extensionOrigin,
  baseEnvironment = process.env,
) {
  return { ...baseEnvironment };
}

export function buildNpxLaunch(platform, environment) {
  if (platform === "win32") {
    return {
      command: environment.ComSpec || environment.COMSPEC || "cmd.exe",
      args: ["/d", "/s", "/c", "npx.cmd", ...ACP_START_ARGS],
    };
  }
  return { command: "npx", args: [...ACP_START_ARGS] };
}

export function buildTrustedHostLaunch(platform, environment, extensionOrigin) {
  const args = [...ACP_TRUSTED_HOST_ARGS, extensionOrigin];
  if (platform === "win32") {
    return {
      command: environment.ComSpec || environment.COMSPEC || "cmd.exe",
      args: ["/d", "/s", "/c", "npx.cmd", ...args],
    };
  }
  return { command: "npx", args };
}

function wait(delayMs) {
  return new Promise((resolve) => setTimeout(resolve, delayMs));
}

export async function isAcpHealthy(
  fetchImpl = fetch,
  healthUrl = process.env.AXHUB_ACP_HEALTH_URL || ACP_HEALTH_URL,
) {
  try {
    const response = await fetchImpl(healthUrl, {
      cache: "no-store",
      signal: AbortSignal.timeout(1500),
    });
    const body = await response.json().catch(() => ({}));
    return response.ok && body?.status === "ok" && body?.service === "acp-ui";
  } catch {
    return false;
  }
}

export function resolveAcpLaunchLeasePath({
  platform = process.platform,
  homeDir = os.homedir(),
  environment = process.env,
} = {}) {
  const hostDir =
    platform === "win32"
      ? path.join(
          environment.LOCALAPPDATA || path.join(homeDir, "AppData", "Local"),
          "Axhub",
          "acp-native-host",
        )
      : path.join(homeDir, ".axhub", "acp-native-host");
  return path.join(hostDir, ACP_LAUNCH_LEASE_DIR_NAME);
}

function readLeaseToken(leasePath) {
  try {
    const value = JSON.parse(
      fs.readFileSync(path.join(leasePath, "owner.json"), "utf8"),
    );
    return typeof value?.token === "string" ? value.token : "";
  } catch {
    return "";
  }
}

function removeStaleLease(leasePath, leaseTtlMs, now) {
  let modifiedAt;
  try {
    modifiedAt = fs.statSync(leasePath).mtimeMs;
  } catch {
    return true;
  }
  if (now() - modifiedAt <= leaseTtlMs) return false;

  const stalePath = `${leasePath}.stale-${process.pid}-${Math.random()
    .toString(16)
    .slice(2)}`;
  try {
    fs.renameSync(leasePath, stalePath);
  } catch {
    return false;
  }
  try {
    fs.rmSync(stalePath, { recursive: true, force: true });
  } catch {
    // The renamed stale lease no longer blocks a new owner.
  }
  return true;
}

export function acquireAcpLaunchLease({
  leasePath = resolveAcpLaunchLeasePath(),
  leaseTtlMs = ACP_LAUNCH_LEASE_TTL_MS,
  now = Date.now,
} = {}) {
  fs.mkdirSync(path.dirname(leasePath), { recursive: true });

  for (let attempt = 0; attempt < 2; attempt += 1) {
    const token = `${process.pid}-${now()}-${Math.random().toString(16).slice(2)}`;
    let created = false;
    try {
      fs.mkdirSync(leasePath);
      created = true;
      fs.writeFileSync(
        path.join(leasePath, "owner.json"),
        `${JSON.stringify({ token, pid: process.pid, createdAt: now() })}\n`,
        "utf8",
      );
      let released = false;
      return {
        leasePath,
        release() {
          if (released) return;
          released = true;
          if (readLeaseToken(leasePath) !== token) return;
          fs.rmSync(leasePath, { recursive: true, force: true });
        },
      };
    } catch (error) {
      if (error?.code !== "EEXIST") {
        try {
          if (created || readLeaseToken(leasePath) === token) {
            fs.rmSync(leasePath, { recursive: true, force: true });
          }
        } catch {
          // Preserve the original lease acquisition error.
        }
        throw error;
      }
      if (!removeStaleLease(leasePath, leaseTtlMs, now)) return null;
    }
  }
  return null;
}

export async function waitForAcpHealth({
  fetchImpl = fetch,
  healthUrl = process.env.AXHUB_ACP_HEALTH_URL || ACP_HEALTH_URL,
  timeoutMs = ACP_STARTUP_TIMEOUT_MS,
  retryDelayMs = 500,
} = {}) {
  const deadline = Date.now() + timeoutMs;
  while (Date.now() < deadline) {
    if (await isAcpHealthy(fetchImpl, healthUrl)) return true;
    await wait(Math.max(1, retryDelayMs));
  }
  return false;
}

export async function grantTrustedHostWhenReady(
  extensionOrigin,
  {
    fetchImpl = fetch,
    spawnProcess = spawn,
    platform = process.platform,
    homeDir = os.homedir(),
    environment = process.env,
    timeoutMs = TRUSTED_HOST_GRANT_TIMEOUT_MS,
    retryDelayMs = 500,
    logger = createFileLogger(),
  } = {},
) {
  if (!isValidExtensionOrigin(extensionOrigin)) return false;
  const deadline = Date.now() + timeoutMs;
  while (Date.now() < deadline) {
    if (await isAcpHealthy(fetchImpl)) {
      await wait(retryDelayMs);
      const launch = buildTrustedHostLaunch(
        platform,
        environment,
        extensionOrigin,
      );
      logger?.write?.("trusted_host_append_requested", {
        extensionOrigin,
        command: launch.command,
        args: launch.args,
      });
      return await new Promise((resolve) => {
        let child;
        try {
          child = spawnProcess(launch.command, launch.args, {
            cwd: homeDir,
            env: { ...environment },
            detached: false,
            shell: false,
            windowsHide: true,
            stdio: "ignore",
          });
        } catch (error) {
          logger?.write?.("trusted_host_append_failed", {
            extensionOrigin,
            message: error instanceof Error ? error.message : String(error),
          });
          resolve(false);
          return;
        }
        child.once("error", (error) => {
          logger?.write?.("trusted_host_append_failed", {
            extensionOrigin,
            message: error instanceof Error ? error.message : String(error),
          });
          resolve(false);
        });
        child.once("close", (code) => {
          logger?.write?.(
            code === 0
              ? "trusted_host_append_succeeded"
              : "trusted_host_append_failed",
            { extensionOrigin, exitCode: code },
          );
          resolve(code === 0);
        });
      });
    }
    await wait(retryDelayMs);
  }
  logger?.write?.("trusted_host_append_timeout", { extensionOrigin, timeoutMs });
  return false;
}

function spawnTrustedHostGrantWorker(
  extensionOrigin,
  {
    spawnProcess,
    homeDir,
    environment,
    logger,
  },
) {
  if (!spawnProcess || !isValidExtensionOrigin(extensionOrigin)) return;
  try {
    const worker = spawnProcess(
      process.execPath,
      [fileURLToPath(import.meta.url), TRUSTED_HOST_GRANT_MODE, extensionOrigin],
      {
        cwd: homeDir,
        env: {
          ...environment,
          ...(logger?.logDir
            ? { AXHUB_ACP_NATIVE_LOG_DIR: logger.logDir }
            : {}),
        },
        detached: true,
        shell: false,
        windowsHide: true,
        stdio: "ignore",
      },
    );
    worker.once("error", (error) => {
      logger?.write?.("trusted_host_worker_failed", {
        extensionOrigin,
        message: error instanceof Error ? error.message : String(error),
      });
    });
    worker.once("spawn", () => {
      logger?.write?.("trusted_host_worker_spawned", {
        extensionOrigin,
        workerPid: worker.pid ?? null,
      });
      worker.unref();
    });
  } catch (error) {
    logger?.write?.("trusted_host_worker_failed", {
      extensionOrigin,
      message: error instanceof Error ? error.message : String(error),
    });
  }
}

export function launchAcpUi(
  extensionOrigin,
  {
    spawnProcess = spawn,
    platform = process.platform,
    homeDir = os.homedir(),
    environment = process.env,
    logger,
  } = {},
) {
  return new Promise((resolve, reject) => {
    let child;
    let acpUiOutputFd;
    const closeAcpUiOutput = () => {
      if (acpUiOutputFd === undefined) return;
      try {
        fs.closeSync(acpUiOutputFd);
      } catch {
        // The child may already own the duplicated descriptor.
      }
      acpUiOutputFd = undefined;
    };
    try {
      const launch = buildNpxLaunch(platform, environment);
      acpUiOutputFd = logger?.openAcpUiOutput?.();
      logger?.write?.("acp_launch_requested", {
        command: launch.command,
        args: launch.args,
        extensionOrigin: extensionOrigin || null,
        childLogPath: logger?.acpUiLogPath || null,
      });
      child = spawnProcess(
        launch.command,
        launch.args,
        {
          cwd: homeDir,
          env: buildAcpEnvironment(extensionOrigin, environment),
          detached: true,
          shell: false,
          windowsHide: true,
          stdio:
            acpUiOutputFd === undefined
              ? "ignore"
              : ["ignore", acpUiOutputFd, acpUiOutputFd],
        },
      );
    } catch (error) {
      closeAcpUiOutput();
      logger?.write?.("acp_spawn_error", {
        code: error?.code || "SPAWN_FAILED",
        message: error instanceof Error ? error.message : String(error),
      });
      reject(
        new AcpLaunchError(
          "SPAWN_FAILED",
          error instanceof Error ? error.message : String(error),
        ),
      );
      return;
    }

    let settled = false;
    child.once("error", (error) => {
      closeAcpUiOutput();
      if (settled) return;
      settled = true;
      const code = error?.code === "ENOENT" ? "NPX_NOT_FOUND" : "SPAWN_FAILED";
      logger?.write?.("acp_spawn_error", {
        code,
        message: error instanceof Error ? error.message : String(error),
      });
      reject(
        new AcpLaunchError(
          code,
          error instanceof Error ? error.message : String(error),
        ),
      );
    });
    child.once("spawn", () => {
      closeAcpUiOutput();
      if (settled) return;
      settled = true;
      logger?.write?.("acp_spawned", { childPid: child.pid ?? null });
      child.unref();
      resolve({ pid: child.pid ?? undefined });
    });
  });
}

export async function ensureAcpUiRunning(
  extensionOrigin,
  {
    fetchImpl = fetch,
    spawnProcess = spawn,
    platform = process.platform,
    homeDir = os.homedir(),
    environment = process.env,
    logger,
    healthUrl = environment.AXHUB_ACP_HEALTH_URL || ACP_HEALTH_URL,
    startupTimeoutMs = ACP_STARTUP_TIMEOUT_MS,
    retryDelayMs = 500,
    leasePath = resolveAcpLaunchLeasePath({ platform, homeDir, environment }),
    leaseTtlMs = Math.max(
      ACP_LAUNCH_LEASE_TTL_MS,
      startupTimeoutMs + 30_000,
    ),
  } = {},
) {
  if (await isAcpHealthy(fetchImpl, healthUrl)) {
    logger?.write?.("acp_already_healthy");
    return { state: "already_healthy" };
  }

  const lease = acquireAcpLaunchLease({ leasePath, leaseTtlMs });
  if (!lease) {
    logger?.write?.("acp_launch_deduplicated", { leasePath });
    const healthy = await waitForAcpHealth({
      fetchImpl,
      healthUrl,
      timeoutMs: startupTimeoutMs,
      retryDelayMs,
    });
    if (healthy) return { state: "startup_in_progress" };
    throw new AcpLaunchError(
      "ACP_START_TIMEOUT",
      `ACP UI did not become healthy within ${startupTimeoutMs}ms`,
    );
  }

  let keepLeaseUntilStale = false;
  try {
    // Close the race between the first health probe and atomic lease acquisition.
    if (await isAcpHealthy(fetchImpl, healthUrl)) {
      logger?.write?.("acp_became_healthy_before_launch");
      return { state: "already_healthy" };
    }
    const launched = await launchAcpUi(extensionOrigin, {
      spawnProcess,
      platform,
      homeDir,
      environment,
      logger,
    });
    const healthy = await waitForAcpHealth({
      fetchImpl,
      healthUrl,
      timeoutMs: startupTimeoutMs,
      retryDelayMs,
    });
    if (!healthy) {
      // A successfully spawned process may still be booting. Keep the lease until
      // its TTL expires so an automatic retry cannot immediately launch another.
      keepLeaseUntilStale = true;
      logger?.write?.("acp_startup_timeout", {
        childPid: launched.pid ?? null,
        startupTimeoutMs,
        leasePath,
      });
      throw new AcpLaunchError(
        "ACP_START_TIMEOUT",
        `ACP UI did not become healthy within ${startupTimeoutMs}ms`,
      );
    }
    logger?.write?.("acp_startup_ready", { childPid: launched.pid ?? null });
    return { state: "started", ...launched };
  } finally {
    if (!keepLeaseUntilStale) lease.release();
  }
}

export async function handleNativeMessage(message, options = {}) {
  if (message?.type !== "start_acp_ui") {
    return errorResponse(
      message,
      "UNKNOWN_MESSAGE",
      `Unsupported native message: ${String(message?.type ?? "")}`,
    );
  }

  const payloadOrigin = extensionOriginOf(message);
  if (
    payloadOrigin === null ||
    (payloadOrigin && !isValidExtensionOrigin(payloadOrigin))
  ) {
    return errorResponse(
      message,
      "INVALID_ORIGIN",
      "extensionOrigin must be an exact chrome-extension://<id> origin",
    );
  }
  const callerOrigin = normalizeCallerOrigin(options.callerOrigin);
  if (options.callerOrigin !== undefined && !callerOrigin) {
    return errorResponse(
      message,
      "INVALID_CALLER_ORIGIN",
      "Chromium caller origin is invalid",
    );
  }
  if (callerOrigin && payloadOrigin && callerOrigin !== payloadOrigin) {
    return errorResponse(
      message,
      "ORIGIN_MISMATCH",
      "Message extensionOrigin does not match the Chromium caller origin",
    );
  }
  const extensionOrigin = callerOrigin || payloadOrigin;

  try {
    const result = await ensureAcpUiRunning(extensionOrigin, options);
    const launchSpawnProcess = options.spawnProcess || spawn;
    spawnTrustedHostGrantWorker(extensionOrigin, {
      spawnProcess:
        options.spawnGrantWorker === undefined
          ? launchSpawnProcess === spawn
            ? spawn
            : undefined
          : options.spawnGrantWorker,
      homeDir: options.homeDir || os.homedir(),
      environment: options.environment || process.env,
      logger: options.logger,
    });
    const requestId = requestIdOf(message);
    return {
      type: "start_acp_ui_result",
      ...(requestId ? { responseToRequestId: requestId } : {}),
      payload: {
        accepted: true,
        state: result.state,
        ...(result.pid ? { pid: result.pid } : {}),
      },
    };
  } catch (error) {
    return errorResponse(
      message,
      error instanceof AcpLaunchError ? error.code : "SPAWN_FAILED",
      error,
    );
  }
}

export function runNativeHost({
  input = process.stdin,
  output = process.stdout,
  exit = process.exit,
  logger = createFileLogger(),
  callerOrigin = process.argv[2],
} = {}) {
  let completed = false;
  let processing = false;
  let buffer = Buffer.alloc(0);

  logger?.write?.("host_started", {
    parentPid: process.ppid,
    node: process.execPath,
  });

  const writeResponse = (response) => {
    if (completed) return;
    completed = true;
    try {
      logger?.write?.("response_sent", {
        type: response?.type || null,
        responseToRequestId: response?.responseToRequestId || null,
        accepted: response?.payload?.accepted === true,
        errorCode: response?.error?.code || null,
      });
      output.write(encodeNativeMessage(response), () => exit(0));
    } catch (error) {
      logger?.write?.("response_write_error", {
        message: error instanceof Error ? error.message : String(error),
      });
      exit(1);
    }
  };

  input.on("data", (chunk) => {
    if (completed) return;
    buffer = Buffer.concat([buffer, Buffer.from(chunk)]);
    const parsed = readNativeMessages(buffer);
    buffer = parsed.rest;
    if (parsed.error) {
      logger?.write?.("message_parse_error", { message: parsed.error });
      writeResponse(errorResponse({}, "UNKNOWN_MESSAGE", parsed.error));
      return;
    }
    const message = parsed.messages[0];
    if (message) {
      processing = true;
      logger?.write?.("message_received", {
        type: typeof message.type === "string" ? message.type : null,
        requestId: requestIdOf(message) || null,
        extensionOrigin: extensionOriginOf(message) || null,
      });
      void handleNativeMessage(message, { logger, callerOrigin }).then(
        writeResponse,
      );
    }
  });
  input.on("end", () => {
    if (!completed && !processing) {
      logger?.write?.("input_ended_without_message");
      exit(1);
    }
  });
  input.on("error", (error) => {
    logger?.write?.("input_error", {
      message: error instanceof Error ? error.message : String(error),
    });
    exit(1);
  });
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
  if (process.argv[2] === TRUSTED_HOST_GRANT_MODE) {
    process.exitCode = (await grantTrustedHostWhenReady(process.argv[3])) ? 0 : 1;
  } else {
    runNativeHost();
  }
}
