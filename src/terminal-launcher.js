#!/usr/bin/env node

const childProcess = require("node:child_process");
const fs = require("node:fs");
const path = require("node:path");
const readline = require("node:readline");

const rootDir = path.resolve(__dirname, "..");
const configDir = path.join(rootDir, "config");
const profilesPath = path.join(configDir, "profiles.json");
const windowsTerminalFallbackPath = "C:\\Users\\PC\\AppData\\Local\\Microsoft\\WindowsApps\\wt.exe";
const launchCwd = process.cwd();

let profiles = [];
let selectedIndex = 0;
let message = "";
let messageKind = "info";
let isPrompting = false;

function ensureConfig() {
  fs.mkdirSync(configDir, { recursive: true });

  if (!fs.existsSync(profilesPath)) {
    fs.writeFileSync(profilesPath, "[]\n", "utf8");
  }
}

function loadProfiles() {
  ensureConfig();
  const raw = fs.readFileSync(profilesPath, "utf8");
  const parsed = JSON.parse(raw);

  if (!Array.isArray(parsed)) {
    throw new Error("profiles.json must contain an array of profiles.");
  }

  profiles = parsed.map((profile, index) => normalizeProfile(profile, index));

  if (profiles.length === 0) {
    selectedIndex = 0;
  } else if (selectedIndex >= profiles.length) {
    selectedIndex = profiles.length - 1;
  }
}

function normalizeProfile(profile, index) {
  if (!profile || typeof profile !== "object") {
    throw new Error(`Profile at index ${index} must be an object.`);
  }

  const name = String(profile.name || "").trim();
  const command = String(profile.command || "").trim();
  if (!name) {
    throw new Error(`Profile at index ${index} is missing "name".`);
  }

  if (!command) {
    throw new Error(`Profile "${name}" is missing "command".`);
  }

  return { name, command };
}

function saveProfiles() {
  ensureConfig();
  fs.writeFileSync(profilesPath, `${JSON.stringify(profiles, null, 2)}\n`, "utf8");
}

function terminalSupportsRawMode() {
  return Boolean(process.stdin.isTTY && process.stdout.isTTY);
}

function setRawMode(enabled) {
  if (process.stdin.isTTY) {
    process.stdin.setRawMode(enabled);
  }
}

function clearScreen() {
  process.stdout.write("\x1b[2J\x1b[H");
}

function render() {
  if (isPrompting) {
    return;
  }

  clearScreen();
  process.stdout.write("Terminal Launcher\n");
  process.stdout.write("=================\n\n");

  if (profiles.length === 0) {
    process.stdout.write("No profiles configured. Press 'a' to add one.\n\n");
  } else {
    for (let i = 0; i < profiles.length; i += 1) {
      const marker = i === selectedIndex ? ">" : " ";
      const profile = profiles[i];
      process.stdout.write(`${marker} ${profile.name}\n`);
      process.stdout.write(`  ${profile.command}\n`);
      process.stdout.write("\n");
    }
  }

  process.stdout.write("Controls: Enter launch | a add | e edit | d delete | r reload | q quit\n");
  process.stdout.write(`Launch cwd: ${launchCwd}\n`);
  process.stdout.write(`Config: ${profilesPath}\n`);

  if (message) {
    const prefix = messageKind === "error" ? "Error" : "Info";
    process.stdout.write(`\n${prefix}: ${message}\n`);
  }
}

function setMessage(nextMessage, kind = "info") {
  message = nextMessage;
  messageKind = kind;
}

function commandExists(command) {
  if (process.platform !== "win32") {
    const result = childProcess.spawnSync("sh", ["-lc", `command -v ${shellQuote(command)}`], {
      stdio: "ignore",
    });
    return result.status === 0;
  }

  const checker = process.platform === "win32" ? "where.exe" : "command";
  const args = process.platform === "win32" ? [command] : ["-v", command];
  const result = childProcess.spawnSync(checker, args, { stdio: "ignore", shell: false });
  return result.status === 0;
}

function resolveWindowsTerminal() {
  if (process.platform !== "win32") {
    return null;
  }

  if (commandExists("wt.exe")) {
    return "wt.exe";
  }

  if (fs.existsSync(windowsTerminalFallbackPath)) {
    return windowsTerminalFallbackPath;
  }

  return null;
}

function shellQuote(value) {
  return `'${String(value).replace(/'/g, "'\\''")}'`;
}

function launchProfile(profile) {
  const cwd = launchCwd;
  const title = profile.name;

  if (process.platform === "win32") {
    const windowsTerminalPath = resolveWindowsTerminal();

    if (windowsTerminalPath) {
      childProcess.spawn(
        windowsTerminalPath,
        [
          "new-tab",
          "--title",
          title,
          "-d",
          cwd,
          "powershell.exe",
          "-NoExit",
          "-Command",
          profile.command,
        ],
        { detached: true, stdio: "ignore" },
      ).unref();
    } else {
      const escapedCommand = profile.command.replace(/'/g, "''");
      const escapedCwd = cwd.replace(/'/g, "''");
      const escapedTitle = title.replace(/'/g, "''");
      const psCommand = [
        `$argsList = @('-NoExit', '-Command', 'Set-Location -LiteralPath ''${escapedCwd}''; ${escapedCommand}')`,
        `Start-Process -FilePath 'powershell.exe' -ArgumentList $argsList -WorkingDirectory '${escapedCwd}' -WindowStyle Normal`,
        `$host.UI.RawUI.WindowTitle = '${escapedTitle}'`,
      ].join("; ");

      childProcess.spawn(
        "powershell.exe",
        ["-NoProfile", "-ExecutionPolicy", "Bypass", "-Command", psCommand],
        { detached: true, stdio: "ignore" },
      ).unref();
    }
  } else {
    childProcess.spawn(profile.command, {
      cwd,
      detached: true,
      shell: true,
      stdio: "ignore",
    }).unref();
  }

  setMessage(`Launched ${profile.name}`);
}

function prompt(question, defaultValue = "") {
  return new Promise((resolve) => {
    isPrompting = true;
    setRawMode(false);
    process.stdout.write("\n");

    const rl = readline.createInterface({
      input: process.stdin,
      output: process.stdout,
    });

    const label = defaultValue ? `${question} (${defaultValue}): ` : `${question}: `;

    rl.question(label, (answer) => {
      rl.close();
      setRawMode(true);
      isPrompting = false;
      resolve(answer.trim() || defaultValue);
    });
  });
}

async function addProfile() {
  const name = await prompt("Name");
  if (!name) {
    setMessage("Profile name is required.", "error");
    return;
  }

  const command = await prompt("Command");
  if (!command) {
    setMessage("Profile command is required.", "error");
    return;
  }

  profiles.push({ name, command });
  selectedIndex = profiles.length - 1;
  saveProfiles();
  setMessage(`Added ${name}`);
}

async function editProfile() {
  const profile = profiles[selectedIndex];
  if (!profile) {
    setMessage("No profile selected.", "error");
    return;
  }

  const name = await prompt("Name", profile.name);
  const command = await prompt("Command", profile.command);

  profiles[selectedIndex] = { name, command };
  saveProfiles();
  setMessage(`Updated ${name}`);
}

async function deleteProfile() {
  const profile = profiles[selectedIndex];
  if (!profile) {
    setMessage("No profile selected.", "error");
    return;
  }

  const answer = await prompt(`Delete "${profile.name}"? Type yes`);
  if (answer.toLowerCase() !== "yes") {
    setMessage("Delete cancelled.");
    return;
  }

  profiles.splice(selectedIndex, 1);
  if (selectedIndex >= profiles.length) {
    selectedIndex = Math.max(0, profiles.length - 1);
  }

  saveProfiles();
  setMessage(`Deleted ${profile.name}`);
}

async function handleKey(chunk) {
  const key = chunk.toString("utf8");

  if (key === "\u0003" || key.toLowerCase() === "q") {
    shutdown();
    return;
  }

  if (key === "\x1b[A") {
    selectedIndex = Math.max(0, selectedIndex - 1);
  } else if (key === "\x1b[B") {
    selectedIndex = Math.min(profiles.length - 1, selectedIndex + 1);
  } else if (key === "\r" || key === "\n") {
    const profile = profiles[selectedIndex];
    if (profile) {
      launchProfile(profile);
    }
  } else if (key.toLowerCase() === "a") {
    await addProfile();
  } else if (key.toLowerCase() === "e") {
    await editProfile();
  } else if (key.toLowerCase() === "d") {
    await deleteProfile();
  } else if (key.toLowerCase() === "r") {
    try {
      loadProfiles();
      setMessage("Reloaded profiles.");
    } catch (error) {
      setMessage(error.message, "error");
    }
  }

  render();
}

function shutdown() {
  setRawMode(false);
  clearScreen();
  process.exit(0);
}

function main() {
  if (process.argv.includes("--help") || process.argv.includes("-h")) {
    console.log("Usage: node src/terminal-launcher.js [--validate]");
    console.log("");
    console.log("Interactive controls: Enter launch | a add | e edit | d delete | r reload | q quit");
    return;
  }

  if (process.argv.includes("--validate")) {
    loadProfiles();
    console.log(`Loaded ${profiles.length} profile(s) from ${profilesPath}`);
    return;
  }

  if (!terminalSupportsRawMode()) {
    console.error("Terminal Launcher requires an interactive TTY.");
    process.exit(1);
  }

  try {
    loadProfiles();
  } catch (error) {
    console.error(`Failed to load profiles: ${error.message}`);
    process.exit(1);
  }

  readline.emitKeypressEvents(process.stdin);
  process.stdin.resume();
  setRawMode(true);
  process.stdin.on("data", (chunk) => {
    handleKey(chunk).catch((error) => {
      setMessage(error.message, "error");
      render();
    });
  });

  process.on("exit", () => setRawMode(false));
  process.on("SIGINT", shutdown);
  render();
}

main();
