import assert from "node:assert/strict";
import { spawn } from "node:child_process";
import { EventEmitter } from "node:events";
import fs from "node:fs";
import http from "node:http";
import os from "node:os";
import path from "node:path";
import test from "node:test";
import { fileURLToPath } from "node:url";

import {
  ACP_START_ARGS,
  ACP_TRUSTED_HOST_ARGS,
  acpPortFromHealthUrl,
  buildAcpEnvironment,
  buildTrustedHostLaunch,
  createFileLogger,
  encodeNativeMessage,
  ensureAcpUiRunning,
  grantTrustedHostWhenReady,
  handleNativeMessage,
  isValidExtensionOrigin,
  readNativeMessages,
} from "../skills/axhub-commentary/scripts/acp-native-host.mjs";
import { collectDoctorReport } from "../skills/axhub-commentary/scripts/doctor.mjs";
import {
  BUNDLED_HOST_PATH,
  HOST_NAME,
  PRIVATE_DIRECTORY_MODE,
  PRIVATE_EXECUTABLE_MODE,
  PRIVATE_FILE_MODE,
  parseRegisterArgs,
  registerNativeHost,
} from "../skills/axhub-commentary/scripts/register.mjs";
import * as startAcpUi from "../skills/axhub-commentary/scripts/start-acp-ui.mjs";

const testDir = path.dirname(fileURLToPath(import.meta.url));

function temporaryDirectory(t) {
  const directory = fs.mkdtempSync(path.join(os.tmpdir(), "axhub-acp-native-"));
  t.after(() => fs.rmSync(directory, { recursive: true, force: true }));
  return directory;
}

function fakeSpawn({ error } = {}) {
  const child = new EventEmitter();
  child.pid = 42;
  child.unref = () => {};
  const calls = [];
  const spawnProcess = (command, args, options) => {
    calls.push({ command, args, options });
    queueMicrotask(() => {
      if (error) child.emit("error", error);
      else child.emit("spawn");
    });
    return child;
  };
  return { calls, spawnProcess };
}

function healthResponse(healthy) {
  return {
    ok: healthy,
    json: async () =>
      healthy ? { status: "ok", service: "acp-ui" } : { status: "starting" },
  };
}

function healthSequence(...states) {
  let index = 0;
  return async () => {
    const state = states[Math.min(index, states.length - 1)] ?? false;
    index += 1;
    return healthResponse(state);
  };
}

function doctorExec(command, args) {
  if (command === process.execPath && args[0] === "-v") return "v22.0.0\n";
  if (command === "which" && args[0] === "npx") return "/usr/local/bin/npx\n";
  throw new Error(`Unexpected command: ${command}`);
}

function snapshotTree(root) {
  if (!fs.existsSync(root)) return [];
  return fs
    .readdirSync(root, { recursive: true, withFileTypes: true })
    .filter((entry) => entry.isFile())
    .map((entry) => {
      const filePath = path.join(entry.parentPath, entry.name);
      const stat = fs.statSync(filePath);
      return {
        path: path.relative(root, filePath),
        content: fs.readFileSync(filePath, "base64"),
        mode: stat.mode & 0o777,
        mtimeMs: stat.mtimeMs,
      };
    })
    .sort((left, right) => left.path.localeCompare(right.path));
}

function runNodeScript(scriptPath, environment) {
  return new Promise((resolve, reject) => {
    const child = spawn(process.execPath, [scriptPath], {
      env: { ...process.env, ...environment },
      stdio: ["ignore", "pipe", "pipe"],
    });
    const stdout = [];
    const stderr = [];
    child.stdout.on("data", (chunk) => stdout.push(Buffer.from(chunk)));
    child.stderr.on("data", (chunk) => stderr.push(Buffer.from(chunk)));
    child.on("error", reject);
    child.on("close", (code) =>
      resolve({
        code,
        stdout: Buffer.concat(stdout).toString("utf8"),
        stderr: Buffer.concat(stderr).toString("utf8"),
      }),
    );
  });
}

function runNativeWrapper(wrapperPath, message) {
  return new Promise((resolve, reject) => {
    const child = spawn(wrapperPath, [], { stdio: ["pipe", "pipe", "pipe"] });
    const stdout = [];
    const stderr = [];
    child.stdout.on("data", (chunk) => stdout.push(Buffer.from(chunk)));
    child.stderr.on("data", (chunk) => stderr.push(Buffer.from(chunk)));
    child.on("error", reject);
    child.on("close", (code) =>
      resolve({
        code,
        stdout: Buffer.concat(stdout),
        stderr: Buffer.concat(stderr).toString("utf8"),
      }),
    );
    child.stdin.end(encodeNativeMessage(message));
  });
}

test("encodes and incrementally decodes Native Messaging frames", () => {
  const frame = encodeNativeMessage({ type: "start_acp_ui", requestId: "r1" });
  const incomplete = readNativeMessages(frame.subarray(0, frame.length - 1));
  assert.deepEqual(incomplete.messages, []);
  assert.equal(incomplete.rest.length, frame.length - 1);

  const parsed = readNativeMessages(frame);
  assert.equal(parsed.error, undefined);
  assert.deepEqual(parsed.messages, [
    { type: "start_acp_ui", requestId: "r1" },
  ]);
  assert.equal(parsed.rest.length, 0);
});

test("classifies malformed Native messages without echoing input", () => {
  const body = Buffer.from('{"private-payload":', "utf8");
  const header = Buffer.alloc(4);
  header.writeUInt32LE(body.length, 0);

  const parsed = readNativeMessages(Buffer.concat([header, body]));

  assert.equal(parsed.error, "Invalid native message JSON");
  assert.doesNotMatch(parsed.error, /private-payload/u);
});

test("accepts only exact Chromium extension origins", () => {
  assert.equal(
    isValidExtensionOrigin(`chrome-extension://${"a".repeat(32)}`),
    true,
  );
  assert.equal(isValidExtensionOrigin("chrome-extension://*"), false);
  assert.equal(
    isValidExtensionOrigin(`chrome-extension://${"z".repeat(32)}`),
    false,
  );
});

test("rejects unknown messages and invalid origins without spawning", async () => {
  const spawnProcess = () => {
    throw new Error("spawn must not be called");
  };
  const unknown = await handleNativeMessage(
    { type: "stop_acp_ui", requestId: "r1" },
    { spawnProcess },
  );
  assert.equal(unknown.error.code, "UNKNOWN_MESSAGE");
  assert.equal(unknown.payload.accepted, false);
  assert.equal(unknown.responseToRequestId, "r1");

  const invalid = await handleNativeMessage(
    {
      type: "start_acp_ui",
      payload: { extensionOrigin: "chrome-extension://*" },
    },
    { spawnProcess },
  );
  assert.equal(invalid.error.code, "INVALID_ORIGIN");
  assert.equal(invalid.payload.accepted, false);
});

test("binds ACP launch to Chromium's caller origin and rejects payload spoofing", async (t) => {
  const callerOrigin = `chrome-extension://${"a".repeat(32)}/`;
  const differentOrigin = `chrome-extension://${"b".repeat(32)}`;
  const spawnProcess = () => {
    throw new Error("spawn must not be called");
  };

  const mismatch = await handleNativeMessage(
    {
      type: "start_acp_ui",
      payload: { extensionOrigin: differentOrigin },
    },
    { callerOrigin, spawnProcess },
  );
  assert.equal(mismatch.error.code, "ORIGIN_MISMATCH");
  assert.equal(mismatch.payload.accepted, false);

  const launcher = fakeSpawn();
  const accepted = await handleNativeMessage(
    { type: "start_acp_ui" },
    {
      callerOrigin,
      spawnProcess: launcher.spawnProcess,
      fetchImpl: healthSequence(false, false, true),
      retryDelayMs: 1,
      leasePath: path.join(temporaryDirectory(t), "launch.lock"),
    },
  );
  assert.equal(accepted.payload.accepted, true);
  assert.equal(
    Object.hasOwn(launcher.calls[0].options.env, "ACP_UI_TRUSTED_HOST_ORIGINS"),
    false,
  );
});

test("launches ACP without replacing its CORS or trusted-host defaults", async (t) => {
  const origin = `chrome-extension://${"a".repeat(32)}`;
  const launcher = fakeSpawn();
  const response = await handleNativeMessage(
    {
      type: "start_acp_ui",
      requestId: "r2",
      payload: { extensionOrigin: origin },
    },
    {
      spawnProcess: launcher.spawnProcess,
      platform: "darwin",
      homeDir: "/tmp/home",
      environment: { PATH: "/usr/bin" },
      fetchImpl: healthSequence(false, false, true),
      retryDelayMs: 1,
      leasePath: path.join(temporaryDirectory(t), "launch.lock"),
    },
  );

  assert.equal(response.payload.accepted, true);
  assert.equal(response.payload.pid, 42);
  assert.equal(response.responseToRequestId, "r2");
  assert.equal(launcher.calls[0].command, "npx");
  assert.deepEqual(launcher.calls[0].args, ACP_START_ARGS);
  assert.equal(launcher.calls[0].options.shell, false);
  assert.equal(launcher.calls[0].options.detached, true);
  assert.equal(Object.hasOwn(launcher.calls[0].options.env, "ACP_UI_CORS_ORIGINS"), false);
  assert.equal(
    Object.hasOwn(launcher.calls[0].options.env, "ACP_UI_TRUSTED_HOST_ORIGINS"),
    false,
  );
  assert.equal(response.payload.state, "started");
});

test("does not spawn ACP when Native host health is already ready", async () => {
  const response = await handleNativeMessage(
    { type: "start_acp_ui", requestId: "already-ready" },
    {
      fetchImpl: healthSequence(true),
      spawnProcess: () => {
        throw new Error("spawn must not be called for a healthy service");
      },
    },
  );

  assert.equal(response.payload.accepted, true);
  assert.equal(response.payload.state, "already_healthy");
  assert.equal(response.payload.pid, undefined);
});

test("deduplicates concurrent ACP starts across independent host requests", async (t) => {
  const leasePath = path.join(temporaryDirectory(t), "launch.lock");
  let initialProbes = 0;
  let releaseInitialProbes;
  const initialProbeBarrier = new Promise((resolve) => {
    releaseInitialProbes = resolve;
  });
  let healthy = false;
  const fetchImpl = async () => {
    initialProbes += 1;
    if (initialProbes <= 2) {
      if (initialProbes === 2) releaseInitialProbes();
      await initialProbeBarrier;
      return healthResponse(false);
    }
    return healthResponse(healthy);
  };
  let spawnCount = 0;
  const spawnProcess = () => {
    spawnCount += 1;
    const child = new EventEmitter();
    child.pid = 100 + spawnCount;
    child.unref = () => {};
    queueMicrotask(() => {
      healthy = true;
      child.emit("spawn");
    });
    return child;
  };

  const options = {
    fetchImpl,
    spawnProcess,
    retryDelayMs: 1,
    startupTimeoutMs: 100,
    leasePath,
  };
  const [first, second] = await Promise.all([
    ensureAcpUiRunning(undefined, options),
    ensureAcpUiRunning(undefined, options),
  ]);

  assert.equal(spawnCount, 1);
  assert.deepEqual(
    new Set([first.state, second.state]),
    new Set(["started", "startup_in_progress"]),
  );
});

test("preserves explicit caller environment without injecting extension origins", () => {
  const existing = {
    ACP_UI_CORS_ORIGINS: "http://localhost:53817,https://existing.example",
    ACP_UI_TRUSTED_HOST_ORIGINS: "https://existing.example",
  };
  assert.deepEqual(
    buildAcpEnvironment(`chrome-extension://${"a".repeat(32)}`, existing),
    existing,
  );
});

test("appends a trusted host through ACP's official runtime command", async () => {
  const origin = `chrome-extension://${"a".repeat(32)}`;
  const calls = [];
  const events = [];
  const spawnProcess = (command, args, options) => {
    calls.push({ command, args, options });
    const child = new EventEmitter();
    queueMicrotask(() => child.emit("close", 0));
    return child;
  };

  const granted = await grantTrustedHostWhenReady(origin, {
    fetchImpl: async () => ({
      ok: true,
      json: async () => ({ status: "ok", service: "acp-ui" }),
    }),
    spawnProcess,
    platform: "darwin",
    environment: {
      PATH: "/usr/bin",
      AXHUB_ACP_HEALTH_URL: "http://127.0.0.1:43210/api/health",
    },
    retryDelayMs: 0,
    logger: { write: (event) => events.push(event) },
  });

  assert.equal(granted, true);
  assert.equal(calls[0].command, "npx");
  assert.deepEqual(calls[0].args, [
    ...ACP_TRUSTED_HOST_ARGS,
    origin,
    "--port",
    "43210",
  ]);
  assert.equal(Object.hasOwn(calls[0].options.env, "ACP_UI_CORS_ORIGINS"), false);
  assert.deepEqual(events, [
    "trusted_host_append_requested",
    "trusted_host_append_succeeded",
  ]);
});

test("writes structured launch logs and keeps child output off protocol stdout", async (t) => {
  const logDir = temporaryDirectory(t);
  const logger = createFileLogger({
    logDir,
    now: () => new Date("2026-07-23T00:00:00.000Z"),
  });
  const launcher = fakeSpawn();
  const response = await handleNativeMessage(
    {
      type: "start_acp_ui",
      requestId: "logged-request",
      payload: { extensionOrigin: `chrome-extension://${"a".repeat(32)}` },
    },
    {
      spawnProcess: launcher.spawnProcess,
      logger,
      fetchImpl: healthSequence(false, false, true),
      retryDelayMs: 1,
      leasePath: path.join(logDir, "launch.lock"),
    },
  );

  assert.equal(response.payload.accepted, true);
  const records = fs
    .readFileSync(logger.hostLogPath, "utf8")
    .trim()
    .split("\n")
    .map((line) => JSON.parse(line));
  assert.deepEqual(
    records.map((record) => record.event),
    ["acp_launch_requested", "acp_spawned", "acp_startup_ready"],
  );
  assert.equal(records[1].childPid, 42);
  assert.equal(launcher.calls[0].options.stdio[0], "ignore");
  assert.equal(
    launcher.calls[0].options.stdio[1],
    launcher.calls[0].options.stdio[2],
  );
  if (process.platform !== "win32") {
    assert.equal(fs.statSync(logDir).mode & 0o777, PRIVATE_DIRECTORY_MODE);
    assert.equal(
      fs.statSync(logger.hostLogPath).mode & 0o777,
      PRIVATE_FILE_MODE,
    );
  }
});

test("launches ACP through cmd.exe on Windows without enabling a shell", async (t) => {
  const launcher = fakeSpawn();
  const comSpec = "C:\\Windows\\System32\\cmd.exe";
  const response = await handleNativeMessage(
    { type: "start_acp_ui" },
    {
      spawnProcess: launcher.spawnProcess,
      platform: "win32",
      environment: { ComSpec: comSpec },
      fetchImpl: healthSequence(false, false, true),
      retryDelayMs: 1,
      leasePath: path.join(temporaryDirectory(t), "launch.lock"),
    },
  );

  assert.equal(response.payload.accepted, true);
  assert.equal(launcher.calls[0].command, comSpec);
  assert.deepEqual(launcher.calls[0].args, [
    "/d",
    "/s",
    "/c",
    "npx.cmd",
    ...ACP_START_ARGS,
  ]);
  assert.equal(launcher.calls[0].options.shell, false);
});

test("direct fallback builds the same safe Windows ACP launch command", () => {
  const comSpec = "C:\\Windows\\System32\\cmd.exe";
  assert.equal(typeof startAcpUi.buildNpxLaunch, "function");
  assert.equal(acpPortFromHealthUrl("http://127.0.0.1:43210/api/health"), 43210);
  assert.deepEqual(startAcpUi.buildNpxLaunch("win32", { ComSpec: comSpec }), {
    command: comSpec,
    args: ["/d", "/s", "/c", "npx.cmd", "-y", "@axhub/acp@latest"],
  });
  assert.deepEqual(
    startAcpUi.buildTrustedHostLaunch(
      "win32",
      { ComSpec: comSpec },
      "origin",
      43210,
    ),
    {
      command: comSpec,
      args: [
        "/d",
        "/s",
        "/c",
        "npx.cmd",
        "-y",
        "@axhub/acp@latest",
        "trusted-host",
        "add",
        "origin",
        "--port",
        "43210",
      ],
    },
  );
  assert.deepEqual(buildTrustedHostLaunch("darwin", {}, "origin"), {
    command: "npx",
    args: [...ACP_TRUSTED_HOST_ARGS, "origin", "--port", "32124"],
  });
});

test("returns NPX_NOT_FOUND when spawn cannot resolve npx", async (t) => {
  const error = Object.assign(new Error("npx missing"), { code: "ENOENT" });
  const launcher = fakeSpawn({ error });
  const response = await handleNativeMessage(
    { type: "start_acp_ui" },
    {
      spawnProcess: launcher.spawnProcess,
      fetchImpl: healthSequence(false, false),
      leasePath: path.join(temporaryDirectory(t), "launch.lock"),
    },
  );
  assert.equal(response.error.code, "NPX_NOT_FOUND");
  assert.equal(response.payload.accepted, false);
});

test("direct fallback does not start NPX when ACP health is already ready", async (t) => {
  const server = http.createServer((_request, response) => {
    response.writeHead(200, { "content-type": "application/json" });
    response.end(JSON.stringify({ status: "ok", service: "acp-ui" }));
  });
  await new Promise((resolve) => server.listen(0, "127.0.0.1", resolve));
  t.after(() => server.close());
  const address = server.address();
  assert.ok(address && typeof address === "object");

  const result = await runNodeScript(
    path.resolve(
      testDir,
      "../skills/axhub-commentary/scripts/start-acp-ui.mjs",
    ),
    { AXHUB_ACP_HEALTH_URL: `http://127.0.0.1:${address.port}/api/health` },
  );
  assert.equal(result.code, 0, result.stderr);
  assert.match(result.stdout, /already healthy; no start was requested/u);
  assert.doesNotMatch(result.stdout, /Requested ACP UI start/u);
});

test("registration requires explicit user confirmation before any write", (t) => {
  const homeDir = temporaryDirectory(t);
  assert.throws(
    () =>
      registerNativeHost({
        browser: "chrome",
        extensionId: "a".repeat(32),
        platform: "darwin",
        homeDir,
      }),
    /--confirm-native-host-install/u,
  );
  assert.deepEqual(snapshotTree(homeDir), []);
  assert.equal(
    parseRegisterArgs([
      "--confirm-native-host-install",
      "--browser",
      "edge",
      "--extension-id",
      "b".repeat(32),
    ]).confirmed,
    true,
  );
});

test("registers the bundled host in a stable user directory and merges exact origins", (t) => {
  const homeDir = temporaryDirectory(t);
  const firstId = "a".repeat(32);
  const secondId = "b".repeat(32);
  const first = registerNativeHost({
    confirmed: true,
    browser: "chrome",
    extensionId: firstId,
    platform: "darwin",
    homeDir,
  });

  const firstManifest = JSON.parse(fs.readFileSync(first.manifestPath, "utf8"));
  assert.equal(firstManifest.name, HOST_NAME);
  assert.equal(firstManifest.path, first.wrapperPath);
  assert.deepEqual(firstManifest.allowed_origins, [
    `chrome-extension://${firstId}/`,
  ]);
  assert.equal(
    fs.readFileSync(first.hostPath, "utf8"),
    fs.readFileSync(BUNDLED_HOST_PATH, "utf8"),
  );
  assert.equal(fs.readFileSync(first.nodePathFile, "utf8"), process.execPath);
  assert.equal(
    fs.statSync(first.installDir).mode & 0o777,
    PRIVATE_DIRECTORY_MODE,
  );
  assert.equal(
    fs.statSync(first.logDir).mode & 0o777,
    PRIVATE_DIRECTORY_MODE,
  );
  assert.equal(fs.statSync(first.hostPath).mode & 0o777, PRIVATE_FILE_MODE);
  assert.equal(
    fs.statSync(first.nodePathFile).mode & 0o777,
    PRIVATE_FILE_MODE,
  );
  assert.equal(
    fs.statSync(first.wrapperPath).mode & 0o777,
    PRIVATE_EXECUTABLE_MODE,
  );
  assert.equal(
    fs.statSync(first.manifestPath).mode & 0o777,
    PRIVATE_FILE_MODE,
  );
  assert.match(fs.readFileSync(first.wrapperPath, "utf8"), /host\.mjs" "\$@"/u);
  assert.ok(first.hostPath.startsWith(path.join(homeDir, ".axhub")));
  assert.ok(
    !firstManifest.path.includes(path.join("skills", "axhub-commentary")),
  );

  const withWildcard = {
    ...firstManifest,
    allowed_origins: [...firstManifest.allowed_origins, "chrome-extension://*"],
  };
  fs.writeFileSync(
    first.manifestPath,
    `${JSON.stringify(withWildcard, null, 2)}\n`,
  );
  const second = registerNativeHost({
    confirmed: true,
    browser: "chrome",
    extensionId: secondId,
    platform: "darwin",
    homeDir,
  });
  const mergedManifest = JSON.parse(
    fs.readFileSync(second.manifestPath, "utf8"),
  );
  assert.deepEqual(mergedManifest.allowed_origins, [
    `chrome-extension://${firstId}/`,
    `chrome-extension://${secondId}/`,
  ]);

  const edge = registerNativeHost({
    confirmed: true,
    browser: "edge",
    extensionId: firstId,
    platform: "darwin",
    homeDir,
  });
  assert.match(edge.manifestPath, /Microsoft Edge/u);
});

test(
  "generated Unix wrapper launches the copied Native host through node_path.txt",
  { skip: process.platform === "win32" },
  async (t) => {
    const homeDir = temporaryDirectory(t);
    const registration = registerNativeHost({
      confirmed: true,
      browser: "chrome",
      extensionId: "f".repeat(32),
      platform: process.platform,
      homeDir,
    });
    const result = await runNativeWrapper(registration.wrapperPath, {
      type: "unknown",
      requestId: "wrapper-test",
    });
    assert.equal(result.code, 0, result.stderr);
    const parsed = readNativeMessages(result.stdout);
    assert.equal(parsed.error, undefined);
    assert.equal(parsed.messages[0].type, "start_acp_ui_result");
    assert.equal(parsed.messages[0].responseToRequestId, "wrapper-test");
    assert.equal(parsed.messages[0].error.code, "UNKNOWN_MESSAGE");
    assert.match(
      fs.readFileSync(registration.wrapperLogPath, "utf8"),
      /wrapper_started/u,
    );
    const hostLog = fs.readFileSync(registration.hostLogPath, "utf8");
    assert.match(hostLog, /"event":"host_started"/u);
    assert.match(hostLog, /"event":"message_received"/u);
    assert.match(hostLog, /"event":"response_sent"/u);
    assert.doesNotMatch(hostLog, /wrapper-test/u);
    assert.doesNotMatch(hostLog, /unknown/u);
  },
);

test("generates a Windows BAT wrapper and user-level registry command", (t) => {
  const homeDir = temporaryDirectory(t);
  const environment = {
    LOCALAPPDATA: path.join(homeDir, "LocalAppData"),
    APPDATA: path.join(homeDir, "RoamingAppData"),
  };
  const registryCalls = [];
  const result = registerNativeHost({
    confirmed: true,
    browser: "edge",
    extensionId: "c".repeat(32),
    platform: "win32",
    homeDir,
    environment,
    execFile: (...args) => registryCalls.push(args),
  });

  assert.equal(path.basename(result.wrapperPath), "run_host.bat");
  const wrapper = fs.readFileSync(result.wrapperPath, "utf8");
  assert.match(wrapper, /where node\.exe/u);
  assert.match(wrapper, /host\.mjs" %\*/u);
  assert.ok(result.hostPath.startsWith(environment.LOCALAPPDATA));
  assert.ok(result.manifestPath.startsWith(environment.APPDATA));
  assert.equal(registryCalls[0][0], "reg");
  assert.equal(registryCalls[0][1][0], "add");
  assert.match(registryCalls[0][1][1], /^HKCU\\Software\\Microsoft\\Edge/u);
  assert.ok(registryCalls[0][1].includes(result.manifestPath));
});

test("doctor does not report ready when the Windows registry key is missing", async (t) => {
  const homeDir = temporaryDirectory(t);
  const environment = {
    LOCALAPPDATA: path.join(homeDir, "LocalAppData"),
    APPDATA: path.join(homeDir, "RoamingAppData"),
  };
  registerNativeHost({
    confirmed: true,
    browser: "chrome",
    extensionId: "c".repeat(32),
    platform: "win32",
    homeDir,
    environment,
    execFile: () => "",
  });

  const report = await collectDoctorReport({
    browser: "chrome",
    extensionId: "c".repeat(32),
    platform: "win32",
    homeDir,
    environment,
    execFile(command, args) {
      if (command === process.execPath && args[0] === "-v") return "v22.0.0\n";
      if (command === "where.exe") return "C:\\Program Files\\nodejs\\npx.cmd\n";
      if (command === "reg") return "";
      throw new Error(`Unexpected command: ${command}`);
    },
  });

  assert.equal(
    report.checks.find((check) => check.id === "registry").status,
    "error",
  );
  assert.equal(
    report.checks.find((check) => check.id === "host.private-permissions")
      .status,
    "warn",
  );
  assert.equal(report.ok, false);
});

test("doctor is read-only by default and reports a stale installed host", async (t) => {
  const homeDir = temporaryDirectory(t);
  const extensionId = "d".repeat(32);
  const registration = registerNativeHost({
    confirmed: true,
    browser: "chrome",
    extensionId,
    platform: "darwin",
    homeDir,
  });
  const before = snapshotTree(homeDir);
  const report = await collectDoctorReport({
    browser: "chrome",
    extensionId,
    platform: "darwin",
    homeDir,
    execFile: doctorExec,
  });
  const after = snapshotTree(homeDir);

  assert.equal(
    report.checks.find((check) => check.id === "host.version").status,
    "ok",
  );
  assert.equal(
    report.checks.find((check) => check.id === "manifest.chrome").status,
    "ok",
  );
  assert.deepEqual(after, before);

  fs.appendFileSync(registration.hostPath, "\n// stale\n");
  const stale = await collectDoctorReport({
    browser: "chrome",
    extensionId,
    platform: "darwin",
    homeDir,
    execFile: doctorExec,
  });
  assert.equal(
    stale.checks.find((check) => check.id === "host.version").status,
    "error",
  );
  assert.equal(stale.ok, false);
});

test("doctor rejects a node_path.txt value that is not an executable file", async (t) => {
  const homeDir = temporaryDirectory(t);
  const extensionId = "e".repeat(32);
  const registration = registerNativeHost({
    confirmed: true,
    browser: "chrome",
    extensionId,
    platform: "darwin",
    homeDir,
  });
  fs.writeFileSync(registration.nodePathFile, registration.installDir, "utf8");

  const report = await collectDoctorReport({
    browser: "chrome",
    extensionId,
    platform: "darwin",
    homeDir,
    execFile: doctorExec,
  });

  assert.equal(
    report.checks.find((check) => check.id === "node.path.file").status,
    "error",
  );
  assert.equal(report.ok, false);
});

test("doctor --check-acp fails readiness when the health request errors", async (t) => {
  const homeDir = temporaryDirectory(t);
  const extensionId = "f".repeat(32);
  registerNativeHost({
    confirmed: true,
    browser: "chrome",
    extensionId,
    platform: "darwin",
    homeDir,
  });

  const report = await collectDoctorReport({
    browser: "chrome",
    extensionId,
    checkAcp: true,
    platform: "darwin",
    homeDir,
    execFile: doctorExec,
    fetchImpl: async () => {
      throw new Error("ACP health is unreachable");
    },
  });

  assert.equal(
    report.checks.find((check) => check.id === "acp.health").status,
    "error",
  );
  assert.equal(report.ok, false);
});

test("doctor --fix restores owner-only permissions and node_path.txt", async (t) => {
  const homeDir = temporaryDirectory(t);
  const extensionId = "e".repeat(32);
  const registration = registerNativeHost({
    confirmed: true,
    browser: "chrome",
    extensionId,
    platform: "darwin",
    homeDir,
  });
  const manifestBefore = fs.readFileSync(registration.manifestPath, "utf8");
  const hostBefore = fs.readFileSync(registration.hostPath, "utf8");
  fs.chmodSync(registration.installDir, 0o755);
  fs.chmodSync(registration.logDir, 0o755);
  fs.chmodSync(registration.hostPath, 0o644);
  fs.chmodSync(registration.wrapperPath, 0o644);
  fs.writeFileSync(registration.nodePathFile, "/missing/node", "utf8");
  fs.chmodSync(registration.nodePathFile, 0o644);
  fs.chmodSync(registration.manifestPath, 0o644);

  const report = await collectDoctorReport({
    browser: "chrome",
    extensionId,
    fix: true,
    platform: "darwin",
    homeDir,
    execFile: doctorExec,
  });

  assert.equal(report.fixes[0].success, true);
  assert.equal(report.ok, true);
  assert.equal(
    report.checks.find((check) => check.id === "host.private-permissions")
      .status,
    "ok",
  );
  assert.equal(
    fs.statSync(registration.installDir).mode & 0o777,
    PRIVATE_DIRECTORY_MODE,
  );
  assert.equal(
    fs.statSync(registration.logDir).mode & 0o777,
    PRIVATE_DIRECTORY_MODE,
  );
  assert.equal(
    fs.statSync(registration.hostPath).mode & 0o777,
    PRIVATE_FILE_MODE,
  );
  assert.equal(
    fs.statSync(registration.wrapperPath).mode & 0o777,
    PRIVATE_EXECUTABLE_MODE,
  );
  assert.equal(
    fs.statSync(registration.nodePathFile).mode & 0o777,
    PRIVATE_FILE_MODE,
  );
  assert.equal(
    fs.statSync(registration.manifestPath).mode & 0o777,
    PRIVATE_FILE_MODE,
  );
  assert.equal(
    fs.readFileSync(registration.nodePathFile, "utf8"),
    process.execPath,
  );
  assert.equal(
    fs.readFileSync(registration.manifestPath, "utf8"),
    manifestBefore,
  );
  assert.equal(fs.readFileSync(registration.hostPath, "utf8"), hostBefore);
});

test(
  "doctor --fix refuses to write through managed symlinks",
  { skip: process.platform === "win32" },
  async (t) => {
    const homeDir = temporaryDirectory(t);
    const registration = registerNativeHost({
      confirmed: true,
      browser: "chrome",
      extensionId: "e".repeat(32),
      platform: "darwin",
      homeDir,
    });
    const outsidePath = path.join(homeDir, "outside.txt");
    fs.writeFileSync(outsidePath, "keep", "utf8");
    fs.rmSync(registration.nodePathFile);
    fs.symlinkSync(outsidePath, registration.nodePathFile);

    const report = await collectDoctorReport({
      browser: "chrome",
      extensionId: "e".repeat(32),
      fix: true,
      platform: "darwin",
      homeDir,
      execFile: doctorExec,
    });

    assert.equal(report.fixes[0].success, false);
    assert.match(report.fixes[0].message, /symbolic link/u);
    assert.equal(fs.readFileSync(outsidePath, "utf8"), "keep");
  },
);

test("local comment processing requires unambiguous identities", () => {
  const source = fs.readFileSync(
    path.resolve(
      testDir,
      "../skills/axhub-commentary/references/comment-processing.md",
    ),
    "utf8",
  );

  assert.match(source, /批注.*id.*唯一/u);
  assert.match(source, /资源.*assetId.*唯一/u);
  assert.match(source, /commentId.*现有批注/u);
  assert.match(source, /生成并固定.*requestId.*sessionId/u);
});

test("bundled host test resolves from the Skill rather than the current working directory", () => {
  assert.equal(
    BUNDLED_HOST_PATH,
    path.resolve(
      testDir,
      "../skills/axhub-commentary/scripts/acp-native-host.mjs",
    ),
  );
});
