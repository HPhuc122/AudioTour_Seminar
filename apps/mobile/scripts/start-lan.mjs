import { execFile, spawn } from "node:child_process";
import { promisify } from "node:util";
import { fileURLToPath } from "node:url";
import { isIPv4, createServer } from "node:net";

const exec = promisify(execFile);
const root = fileURLToPath(new URL("../", import.meta.url));
const cli = fileURLToPath(new URL("../node_modules/expo/bin/cli", import.meta.url));
const args = process.argv.slice(2);
const checkOnly = args.includes("--check");
const expoArgs = args.filter((arg) => arg !== "--check");
if (expoArgs.some((arg) => /^(--(tunnel|localhost|host|port|lan)|-p)(=|$)/.test(arg))) {
  throw new Error("Use npm run start:manual for custom Expo connection settings.");
}

async function detectAddress() {
  if (process.env.AUDIOTOUR_LAN_IP) {
    if (!isIPv4(process.env.AUDIOTOUR_LAN_IP)) throw new Error("Invalid AUDIOTOUR_LAN_IP");
    return process.env.AUDIOTOUR_LAN_IP;
  }
  if (process.platform !== "win32") throw new Error("Set AUDIOTOUR_LAN_IP or use npm run start:manual on this OS.");
  const command = `
    $ErrorActionPreference = 'Stop'
    $physical = @(Get-NetAdapter -Physical | Where-Object Status -eq 'Up' | Select-Object -ExpandProperty ifIndex)
    $candidates = @(Get-NetIPConfiguration | Where-Object {
      $_.InterfaceIndex -in $physical -and $_.IPv4DefaultGateway -and $_.IPv4Address
    } | Sort-Object @{Expression={if ($_.NetAdapter.NdisPhysicalMedium -eq 9) {0} else {1}}}, @{Expression={$_.NetIPv4Interface.InterfaceMetric}})
    if ($candidates.Count -gt 0) { $candidates[0].IPv4Address.IPAddress | Select-Object -First 1 }
  `;
  const { stdout } = await exec("powershell.exe", ["-NoProfile", "-NonInteractive", "-Command", command], { windowsHide: true, timeout: 15000 });
  const ip = stdout.trim();
  if (!isIPv4(ip) || ip.startsWith("169.254.") || ip.startsWith("127.")) throw new Error("No connected LAN/Wi-Fi address. Connect Wi-Fi and try again.");
  return ip;
}

async function ensurePortFree() {
  await new Promise((resolve, reject) => {
    const server = createServer();
    server.once("error", () => reject(new Error("Port 8081 is in use. Stop the old Expo terminal (Ctrl+C), then run npm start.")));
    server.listen(8081, () => server.close(resolve));
  });
}

let child;
let currentAddress;
let closing = false;
let timer;
const expectedStops = new WeakSet();

async function stopMetro() {
  const old = child;
  if (!old || old.exitCode !== null) return;
  expectedStops.add(old);
  const ended = new Promise((resolve) => old.once("exit", resolve));
  if (process.platform === "win32") {
    await exec("taskkill.exe", ["/PID", String(old.pid), "/T", "/F"], { windowsHide: true }).catch(() => old.kill());
  } else old.kill("SIGTERM");
  await ended;
}

async function startMetro(ip) {
  await ensurePortFree();
  const api = `http://${ip}:8002`;
  console.log(`\nAudioTour LAN: exp://${ip}:8081\nAPI: ${api}\nScan the NEW Expo QR after switching Wi-Fi.\n`);
  try {
    const result = await fetch(`${api}/health`, { signal: AbortSignal.timeout(3000) });
    if (!result.ok) throw new Error(`HTTP ${result.status}`);
    console.log("API health: OK (from this computer).");
  } catch {
    console.warn("API is not reachable yet. Start Content API on 0.0.0.0:8002 to load content.");
  }
  child = spawn(process.execPath, [cli, "start", "--lan", "--port", "8081", "--clear", ...expoArgs.filter((arg) => arg !== "--clear")], {
    cwd: root,
    stdio: "inherit",
    env: { ...process.env, REACT_NATIVE_PACKAGER_HOSTNAME: ip, EXPO_PUBLIC_API_BASE_URL: api },
  });
  const running = child;
  running.once("error", (error) => { console.error(error.message); process.exitCode = 1; closing = true; clearTimeout(timer); });
  running.once("exit", (code) => {
    if (!expectedStops.has(running)) { closing = true; clearTimeout(timer); process.exitCode = code ?? 1; }
  });
  currentAddress = ip;
}

let networkUnavailable = false;
async function poll() {
  try {
    const ip = await detectAddress();
    networkUnavailable = false;
    if (!closing && ip !== currentAddress) {
      console.log(`\nWi-Fi/IP changed: ${currentAddress} -> ${ip}. Restarting Expo...`);
      await stopMetro();
      if (!closing) await startMetro(ip);
    }
  } catch (error) {
    if (!networkUnavailable) console.warn(error.message);
    networkUnavailable = true;
  }
  if (!closing) timer = setTimeout(poll, 5000);
}

for (const signal of ["SIGINT", "SIGTERM"]) {
  process.on(signal, async () => { closing = true; clearTimeout(timer); await stopMetro(); process.exit(0); });
}

try {
  const ip = await detectAddress();
  if (checkOnly) console.log(JSON.stringify({ expo: `exp://${ip}:8081`, api: `http://${ip}:8002` }, null, 2));
  else { await startMetro(ip); if (!closing) timer = setTimeout(poll, 5000); }
} catch (error) { console.error(error.message); process.exitCode = 1; }
