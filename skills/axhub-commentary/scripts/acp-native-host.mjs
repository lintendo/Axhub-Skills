#!/usr/bin/env node

import { spawn } from "node:child_process";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import process from "node:process";
import { fileURLToPath } from "node:url";

export const MAX_NATIVE_MESSAGE_BYTES = 1024 * 1024;
export const ACP_START_ARGS = ["-y", "@axhub/acp@latest"];
export const HOST_LOG_FILE_NAME = "native-host.log";
export const ACP_UI_LOG_FILE_NAME = "acp-ui.log";
const DEFAULT_MAX_LOG_BYTES = 2 * 1024 * 1024;

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
  extensionOrigin,
  baseEnvironment = process.env,
) {
  const environment = { ...baseEnvironment };
  delete environment.ACP_UI_TRUSTED_HOST_ORIGINS;
  delete environment.ACP_UI_CORS_ORIGINS;
  if (extensionOrigin) {
    environment.ACP_UI_TRUSTED_HOST_ORIGINS = extensionOrigin;
    environment.ACP_UI_CORS_ORIGINS = extensionOrigin;
  }
  return environment;
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
    const result = await launchAcpUi(extensionOrigin, options);
    const requestId = requestIdOf(message);
    return {
      type: "start_acp_ui_result",
      ...(requestId ? { responseToRequestId: requestId } : {}),
      payload: { accepted: true, ...(result.pid ? { pid: result.pid } : {}) },
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
if (isDirectRun) runNativeHost();
