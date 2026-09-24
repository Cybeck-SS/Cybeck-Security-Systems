const { app, BrowserWindow, ipcMain, Menu, dialog, safeStorage, shell } = require("electron");
const path = require("path");
const { pathToFileURL } = require("url");
const os = require("os");
const dns = require("dns").promises;
const fs = require("fs/promises");
const { promisify } = require("util");
const { exec, execFile, spawn } = require("child_process");
const { autoUpdater } = require("electron-updater");
const { normalizeConnections, findConnectionObservations, parseNetstatAttempts } = require("./security-core");
const { renderIncidentReport } = require("./incident-report");
const { firewallTarget } = require("./security-actions");
const { shellSpec, runCommand } = require("./operations-shell");
const { createSessionAccess } = require("./operations-access");
const { validateHost, validateTarget, checkRemoteDesktop, resourceCommand, runRemote } = require("./remote-systems");
const { DOWNLOAD_URL: ANYDESK_DOWNLOAD_URL, validateAnyDeskAddress, findAnyDesk, verifyAnyDeskExecutable } = require("./anydesk-integration");
const { normalizeWorkItems } = require("./work-items-store");
const { renderNoteFile, parseNoteFile, noteFileName, historyFileName, noteFolder } = require("./note-files");
const { createProfile, verifyPassword, publicProfile, normalizeVaultProfiles } = require("./vault-auth");
const { installDownloadedUpdate } = require("./updater-install");
const { chooseActiveAdapter } = require("./network-adapter");

const execFileAsync = promisify(execFile);
const historyPath = () => path.join(app.getPath("userData"), "security-history.json");
const workItemsPath = () => path.join(app.getPath("userData"), "work-items.json");
const notesFolderPath = () => noteFolder(app.getPath("documents"));
const vaultProfilesPath = () => path.join(app.getPath("userData"), "vault-profiles.json");
let unlockedVaultProfileId = null;
const vaultFailures = new Map();

async function loadVaultStore() {
    try {
        const stored = JSON.parse(await fs.readFile(vaultProfilesPath(), "utf8"));
        if (!stored.encrypted) throw new Error("Unencrypted Vault profile store rejected.");
        return normalizeVaultProfiles(JSON.parse(safeStorage.decryptString(Buffer.from(stored.data, "base64"))));
    } catch (error) {
        if (error.code === "ENOENT") return { schema: 1, profiles: [] };
        throw error;
    }
}

async function saveVaultStore(store) {
    if (!safeStorage.isEncryptionAvailable()) throw new Error("Windows encryption is unavailable.");
    const destination = vaultProfilesPath();
    const temporary = `${destination}.${process.pid}.${Date.now()}.tmp`;
    const encrypted = safeStorage.encryptString(JSON.stringify(store));
    await fs.mkdir(path.dirname(destination), { recursive: true });
    await fs.writeFile(temporary, JSON.stringify({ encrypted: true, data: encrypted.toString("base64") }), "utf8");
    await fs.rename(temporary, destination);
}

async function syncReadableNotes(notes) {
    const root = notesFolderPath();
    const current = path.join(root, "Current");
    const history = path.join(root, "History");
    await fs.mkdir(current, { recursive: true });
    await fs.mkdir(history, { recursive: true });
    const activeNames = new Set(notes.map(noteFileName));
    for (const note of notes) {
        const name = noteFileName(note);
        const destination = path.join(current, name);
        const next = renderNoteFile(note);
        try {
            const existing = await fs.readFile(destination, "utf8");
            if (existing === next) continue;
            const noteHistory = path.join(history, note.id);
            await fs.mkdir(noteHistory, { recursive: true });
            await fs.writeFile(path.join(noteHistory, historyFileName()), existing, "utf8");
        } catch (error) { if (error.code !== "ENOENT") throw error; }
        await fs.writeFile(destination, next, "utf8");
    }
    for (const name of await fs.readdir(current)) {
        if (!name.endsWith(".txt") || activeNames.has(name)) continue;
        const id = path.basename(name, ".txt");
        const archived = path.join(history, id);
        await fs.mkdir(archived, { recursive: true });
        await fs.rename(path.join(current, name), path.join(archived, `deleted-${historyFileName()}`));
    }
    return root;
}
let previousConnectionScan = null;

ipcMain.handle("get-connection-attempts", async () => {
    if (process.platform !== "win32") return [];
    try {
        const { stdout } = await execFileAsync("netstat.exe", ["-ano", "-p", "tcp"], {
            windowsHide: true, timeout: 3000, maxBuffer: 2 * 1024 * 1024
        });
        return parseNetstatAttempts(stdout).slice(0, 100);
    } catch (error) { return []; }
});

ipcMain.handle("get-active-connections", async () => {
    if (process.platform !== "win32") return { connections: [], error: "Windows connection telemetry is unavailable on this platform." };
    const script = `
      $ErrorActionPreference = 'Stop'
      $rows = @(Get-NetTCPConnection -State Established,Listen -ErrorAction Stop |
        Sort-Object OwningProcess,LocalPort,RemoteAddress,RemotePort | Select-Object -First 250 | ForEach-Object {
        [pscustomobject]@{ protocol='TCP'; processId=$_.OwningProcess; localAddress=$_.LocalAddress;
          localPort=$_.LocalPort; remoteAddress=$_.RemoteAddress; remotePort=$_.RemotePort; state=[string]$_.State }
      })
      $rows += @(Get-NetUDPEndpoint -ErrorAction Stop | Select-Object -First 50 | ForEach-Object {
        [pscustomobject]@{ protocol='UDP'; processId=$_.OwningProcess; localAddress=$_.LocalAddress;
          localPort=$_.LocalPort; remoteAddress=''; remotePort=0; state='Listening' }
      })
      $names = @{}
      foreach ($pidValue in @($rows | Select-Object -ExpandProperty processId -Unique)) {
        try { $names[[int]$pidValue] = (Get-Process -Id $pidValue -ErrorAction Stop).ProcessName + '.exe' }
        catch { $names[[int]$pidValue] = 'Unknown' }
      }
      $rows | ForEach-Object { $_ | Add-Member -NotePropertyName process -NotePropertyValue $names[[int]$_.processId] -PassThru } | ConvertTo-Json -Depth 3 -Compress
    `;
    try {
        const { stdout } = await execFileAsync("powershell.exe", ["-NoProfile", "-NonInteractive", "-Command", script], {
            windowsHide: true, timeout: 12000, maxBuffer: 2 * 1024 * 1024
        });
        const connections = normalizeConnections(stdout.trim() ? JSON.parse(stdout) : []);
        const observations = findConnectionObservations(previousConnectionScan, connections);
        previousConnectionScan = connections;
        const dnsWorking = await Promise.race([
            dns.lookup("example.com", { family: 4 }).then(() => true, () => false),
            new Promise((resolve) => setTimeout(() => resolve(false), 4000))
        ]);
        return { connections, observations, deviceName: os.hostname(), dnsWorking, error: null };
    } catch (error) {
        return { connections: [], error: `Connection scan unavailable: ${error.message}` };
    }
});

ipcMain.handle("load-security-history", async () => {
    try {
        const stored = JSON.parse(await fs.readFile(historyPath(), "utf8"));
        if (!stored.encrypted) return stored; // Migrate earlier local history on the next save.
        return JSON.parse(safeStorage.decryptString(Buffer.from(stored.data, "base64")));
    }
    catch (error) {
        if (error.code === "ENOENT") return { days: {}, incidents: [], events: [] };
        return { error: `Saved history could not be read: ${error.message}` };
    }
});

ipcMain.handle("save-security-history", async (_event, supplied) => {
    if (!supplied || typeof supplied !== "object") return false;
    const safe = {
        days: Object.fromEntries(Object.entries(supplied.days || {}).slice(-31)),
        incidents: Array.isArray(supplied.incidents) ? supplied.incidents.slice(-200) : [],
        events: Array.isArray(supplied.events) ? supplied.events.slice(-500) : []
    };
    const destination = historyPath();
    const temporary = `${destination}.${process.pid}.${Date.now()}.tmp`;
    try {
        if (!safeStorage.isEncryptionAvailable()) return false;
        const encrypted = safeStorage.encryptString(JSON.stringify(safe));
        await fs.mkdir(path.dirname(destination), { recursive: true });
        await fs.writeFile(temporary, JSON.stringify({ encrypted: true, data: encrypted.toString("base64") }), "utf8");
        await fs.rename(temporary, destination);
        return true;
    } catch (error) {
        console.error("[SECURITY] History save failed:", error);
        return false;
    }
});

ipcMain.handle("load-work-items", async (event) => {
    if (!isLocalOperationsWindow(event)) return { error: "Local Cybeck window required." };
    try {
        const stored = JSON.parse(await fs.readFile(workItemsPath(), "utf8"));
        if (!stored.encrypted) throw new Error("Unencrypted work items file rejected.");
        return normalizeWorkItems(JSON.parse(safeStorage.decryptString(Buffer.from(stored.data, "base64"))));
    } catch (error) {
        return error.code === "ENOENT" ? { schema: 1, tasks: [], notes: [] } : { error: `Work items could not be read: ${error.message}` };
    }
});

ipcMain.handle("save-work-items", async (event, supplied) => {
    if (!isLocalOperationsWindow(event)) return { saved: false, error: "Local Cybeck window required." };
    try {
        if (!safeStorage.isEncryptionAvailable()) throw new Error("Windows encryption is unavailable.");
        const data = normalizeWorkItems(supplied);
        const destination = workItemsPath();
        const temporary = `${destination}.${process.pid}.${Date.now()}.tmp`;
        const encrypted = safeStorage.encryptString(JSON.stringify(data));
        await fs.mkdir(path.dirname(destination), { recursive: true });
        await fs.writeFile(temporary, JSON.stringify({ encrypted: true, data: encrypted.toString("base64") }), "utf8");
        await fs.rename(temporary, destination);
        const notesFolder = await syncReadableNotes(data.notes);
        return { saved: true, data, notesFolder };
    } catch (error) { return { saved: false, error: error.message }; }
});

ipcMain.handle("export-work-items", async (event, supplied) => {
    if (!isLocalOperationsWindow(event)) return { saved: false, error: "Local Cybeck window required." };
    try {
        const data = normalizeWorkItems(supplied);
        const result = await dialog.showSaveDialog(mainWindow, { title: "Export Tasks and Notes", defaultPath: "cybeck-work-items.json", filters: [{ name: "JSON", extensions: ["json"] }] });
        if (result.canceled || !result.filePath) return { canceled: true };
        await fs.writeFile(result.filePath, JSON.stringify(data, null, 2), { encoding: "utf8", flag: "w" });
        return { saved: true };
    } catch (error) { return { saved: false, error: error.message }; }
});

ipcMain.handle("import-work-items", async (event) => {
    if (!isLocalOperationsWindow(event)) return { error: "Local Cybeck window required." };
    try {
        const result = await dialog.showOpenDialog(mainWindow, { title: "Import Tasks and Notes", properties: ["openFile"], filters: [{ name: "JSON", extensions: ["json"] }] });
        if (result.canceled || !result.filePaths.length) return { canceled: true };
        const file = await fs.readFile(result.filePaths[0], "utf8");
        if (file.length > 6 * 1024 * 1024) throw new Error("File exceeds 6 MB limit.");
        return { data: normalizeWorkItems(JSON.parse(file)) };
    } catch (error) { return { error: `Import failed: ${error.message}` }; }
});

ipcMain.handle("open-notes-folder", async (event) => {
    if (!isLocalOperationsWindow(event)) return { error: "Local Cybeck window required." };
    try {
        const folder = notesFolderPath();
        await fs.mkdir(path.join(folder, "Current"), { recursive: true });
        await fs.mkdir(path.join(folder, "History"), { recursive: true });
        const error = await shell.openPath(folder);
        return error ? { error } : { opened: true, folder };
    } catch (error) { return { error: error.message }; }
});

ipcMain.handle("import-note-file", async (event) => {
    if (!isLocalOperationsWindow(event)) return { error: "Local Cybeck window required." };
    try {
        const result = await dialog.showOpenDialog(mainWindow, { title: "Restore a Cybeck Note", defaultPath: path.join(notesFolderPath(), "Current"), properties: ["openFile"], filters: [{ name: "Cybeck Notes", extensions: ["txt"] }] });
        if (result.canceled || !result.filePaths.length) return { canceled: true };
        const file = await fs.readFile(result.filePaths[0], "utf8");
        if (file.length > 1024 * 1024) throw new Error("Note exceeds 1 MB limit.");
        const normalized = normalizeWorkItems({ schema: 1, tasks: [], notes: [parseNoteFile(file)] });
        return { note: normalized.notes[0] };
    } catch (error) { return { error: `Restore failed: ${error.message}` }; }
});

ipcMain.handle("get-vault-session", async (event) => {
    if (!isLocalOperationsWindow(event)) return { error: "Local Cybeck window required." };
    try {
        const store = await loadVaultStore();
        return { profiles: store.profiles.map(publicProfile), unlockedProfileId: unlockedVaultProfileId };
    } catch (error) { return { error: `Vault profiles could not be read: ${error.message}` }; }
});

ipcMain.handle("create-vault-profile", async (event, supplied) => {
    if (!isLocalOperationsWindow(event)) return { error: "Local Cybeck window required." };
    try {
        const store = await loadVaultStore();
        if (store.profiles.length >= 8) throw new Error("The Vault supports up to 8 local profiles.");
        const profile = createProfile(supplied?.name, supplied?.role, supplied?.password);
        store.profiles.push(profile);
        await saveVaultStore(store);
        unlockedVaultProfileId = profile.id;
        return { created: true, profile: publicProfile(profile), unlockedProfileId: profile.id };
    } catch (error) { return { error: error.message }; }
});

ipcMain.handle("delete-vault-profile", async (event, profileId, password) => {
    if (!isLocalOperationsWindow(event)) return { error: "Local Cybeck window required." };
    try {
        const store = await loadVaultStore();
        const profile = store.profiles.find((item) => item.id === profileId);
        if (!profile || !verifyPassword(profile, password)) return { error: "The selected profile password was not recognized." };
        store.profiles = store.profiles.filter((item) => item.id !== profileId);
        await saveVaultStore(store);
        if (unlockedVaultProfileId === profileId) unlockedVaultProfileId = null;
        vaultFailures.delete(profileId);
        return { deleted: true, profiles: store.profiles.map(publicProfile) };
    } catch (error) { return { error: error.message }; }
});

ipcMain.handle("unlock-vault", async (event, profileId, password) => {
    if (!isLocalOperationsWindow(event)) return { error: "Local Cybeck window required." };
    const now = Date.now();
    const failure = vaultFailures.get(profileId) || { count: 0, blockedUntil: 0 };
    if (failure.blockedUntil > now) return { error: `Too many attempts. Try again in ${Math.ceil((failure.blockedUntil - now) / 1000)} seconds.` };
    try {
        const store = await loadVaultStore();
        const profile = store.profiles.find((item) => item.id === profileId);
        if (!profile || !verifyPassword(profile, password)) {
            failure.count += 1;
            if (failure.count >= 5) { failure.count = 0; failure.blockedUntil = now + 30000; }
            vaultFailures.set(profileId, failure);
            return { error: "Profile or password was not recognized." };
        }
        vaultFailures.delete(profileId);
        unlockedVaultProfileId = profile.id;
        return { unlocked: true, profile: publicProfile(profile) };
    } catch (error) { return { error: error.message }; }
});

ipcMain.handle("lock-vault", (event) => {
    if (!isLocalOperationsWindow(event)) return { error: "Local Cybeck window required." };
    unlockedVaultProfileId = null;
    return { locked: true };
});

ipcMain.handle("export-incident-report", async (_event, report) => {
    if (!report || typeof report !== "object" || !/^CYB-\d{5}$/.test(report.id || "")) return { success: false };
    const result = await dialog.showSaveDialog(mainWindow, {
        title: `Export ${report.id} report`,
        defaultPath: `${report.id}.pdf`,
        filters: [{ name: "PDF report", extensions: ["pdf"] }, { name: "JSON evidence", extensions: ["json"] }]
    });
    if (result.canceled || !result.filePath) return { success: false, canceled: true };
    try {
        if (path.extname(result.filePath).toLowerCase() === ".json") {
            await fs.writeFile(result.filePath, JSON.stringify(report, null, 2), "utf8");
        } else {
            const reportWindow = new BrowserWindow({ show: false, webPreferences: { nodeIntegration: false, contextIsolation: true, sandbox: true } });
            try {
                await reportWindow.loadURL(`data:text/html;charset=utf-8,${encodeURIComponent(renderIncidentReport(report))}`);
                const pdf = await reportWindow.webContents.printToPDF({ printBackground: true, pageSize: "A4", preferCSSPageSize: true });
                await fs.writeFile(result.filePath, pdf);
            } finally { reportWindow.close(); }
        }
        return { success: true };
    } catch (error) { return { success: false, error: error.message }; }
});

ipcMain.handle("block-incident-ip", async (_event, incidentId, remoteAddress) => {
    const target = firewallTarget(incidentId, remoteAddress);
    if (!target) return { success: false, error: "This incident has no blockable remote IP address." };
    const confirmation = await dialog.showMessageBox(mainWindow, {
        type: "warning", buttons: ["Cancel", "Block Outbound IP"], defaultId: 0, cancelId: 0,
        title: "Confirm network containment",
        message: `Block outbound traffic to ${target.remoteAddress}?`,
        detail: `Cybeck will add a Windows Firewall rule for ${incidentId}. This may interrupt legitimate applications. The rule can be removed from this incident. Administrator access may be required.`
    });
    if (confirmation.response !== 1) return { success: false, canceled: true };
    const command = `$ErrorActionPreference='Stop'; ` +
        `if (Get-NetFirewallRule -Name '${target.name}' -ErrorAction SilentlyContinue) { throw 'A rule with this name already exists.' }; ` +
        `New-NetFirewallRule -Name '${target.name}' -DisplayName '${target.name}' -Group 'Cybeck Security Systems' ` +
        `-Direction Outbound -Action Block -RemoteAddress '${target.remoteAddress}' -Profile Any -ErrorAction Stop | Out-Null`;
    try {
        await execFileAsync("powershell.exe", ["-NoProfile", "-NonInteractive", "-Command", command], {
            windowsHide: true, timeout: 12000, maxBuffer: 100000
        });
        return { success: true, ruleName: target.name };
    } catch (error) { return { success: false, error: `Firewall block failed: ${error.message}` }; }
});

ipcMain.handle("remove-incident-block", async (_event, incidentId, remoteAddress) => {
    const target = firewallTarget(incidentId, remoteAddress);
    if (!target) return { success: false, error: "Invalid incident or remote IP address." };
    const confirmation = await dialog.showMessageBox(mainWindow, {
        type: "question", buttons: ["Cancel", "Remove Block"], defaultId: 0, cancelId: 0,
        title: "Remove network containment",
        message: `Remove the Cybeck outbound block for ${target.remoteAddress}?`,
        detail: `Only the exact Windows Firewall rule ${target.name} will be removed.`
    });
    if (confirmation.response !== 1) return { success: false, canceled: true };
    const command = `$ErrorActionPreference='Stop'; ` +
        `$rule = Get-NetFirewallRule -Name '${target.name}' -ErrorAction Stop; ` +
        `if ($rule.Group -ne 'Cybeck Security Systems') { throw 'The rule is not owned by Cybeck.' }; ` +
        `$address = @($rule | Get-NetFirewallAddressFilter).RemoteAddress; ` +
        `if ($address -notcontains '${target.remoteAddress}') { throw 'The rule address does not match this incident.' }; ` +
        `$rule | Remove-NetFirewallRule -ErrorAction Stop`;
    try {
        await execFileAsync("powershell.exe", ["-NoProfile", "-NonInteractive", "-Command", command], {
            windowsHide: true, timeout: 12000, maxBuffer: 100000
        });
        return { success: true };
    } catch (error) { return { success: false, error: `Removing the block failed: ${error.message}` }; }
});

ipcMain.handle("get-incident-block-status", async (_event, incidentId, remoteAddress) => {
    const target = firewallTarget(incidentId, remoteAddress);
    if (!target) return false;
    const command = `$rule = Get-NetFirewallRule -Name '${target.name}' -ErrorAction SilentlyContinue; ` +
        `if (!$rule -or $rule.Group -ne 'Cybeck Security Systems') { 'false' } ` +
        `elseif (@($rule | Get-NetFirewallAddressFilter).RemoteAddress -contains '${target.remoteAddress}') { 'true' } else { 'false' }`;
    try {
        const { stdout } = await execFileAsync("powershell.exe", ["-NoProfile", "-NonInteractive", "-Command", command], {
            windowsHide: true, timeout: 6000, maxBuffer: 100000
        });
        return stdout.trim() === "true";
    } catch (error) { return null; }
});

let mainWindow;
let activeOperationsCommand = null;
const operationsAccess = createSessionAccess();
let remoteTarget = null;
let activeRemoteCommand = null;
let remoteConnecting = false;
let remoteGeneration = 0;

function isLocalOperationsWindow(event) {
    return process.platform === "win32" && mainWindow &&
        event.sender === mainWindow.webContents &&
        event.sender.getURL() === pathToFileURL(path.join(__dirname, "index.html")).href;
}

ipcMain.handle("get-operations-access", (event) =>
    Boolean(isLocalOperationsWindow(event) && operationsAccess.isGranted()));

ipcMain.handle("request-operations-access", async (event) => {
    if (!isLocalOperationsWindow(event)) return false;
    const window = mainWindow;
    return operationsAccess.request(async () => {
        const approval = await dialog.showMessageBox(window, {
            type: "warning", buttons: ["Cancel", "Allow for This Session"], defaultId: 0, cancelId: 0,
            title: "Enable local command console",
            message: "Allow CMD and PowerShell commands until Cybeck closes?",
            detail: "Commands you enter can read or change files, run programs, and change settings using your Windows account permissions. Cybeck will not ask again during this app session. Administrator actions still require Windows authorization. Access ends when this window closes."
        });
        return approval.response === 1 && mainWindow === window && !window.isDestroyed();
    });
});

ipcMain.handle("revoke-operations-access", (event) => {
    if (!isLocalOperationsWindow(event)) return false;
    operationsAccess.revoke();
    activeOperationsCommand?.stop();
    return true;
});

ipcMain.handle("run-operations-command", async (event, shell, command) => {
    if (!isLocalOperationsWindow(event)) {
        return { started: false, error: "Local Cybeck window required." };
    }
    if (!operationsAccess.isGranted()) return { started: false, error: "Enable console access for this session first." };
    if (activeOperationsCommand) return { started: false, error: "A command is already running." };
    try { shellSpec(shell, command); }
    catch (error) { return { started: false, error: error.message }; }
    const sender = event.sender;
    const emit = (data) => { if (!sender.isDestroyed()) sender.send("operations-command-event", data); };
    try {
        const operation = runCommand(shell, command,
            (stream, output) => emit({ type: "output", stream, output }),
            (result) => {
                activeOperationsCommand = null;
                emit({ type: "done", ...result });
            });
        activeOperationsCommand = operation;
        return { started: true };
    } catch (error) { return { started: false, error: error.message }; }
});

ipcMain.handle("stop-operations-command", (event) => {
    if (!mainWindow || event.sender !== mainWindow.webContents) return false;
    return activeOperationsCommand?.stop() || false;
});

ipcMain.handle("get-remote-system", (event) =>
    isLocalOperationsWindow(event) ? remoteTarget : null);

ipcMain.handle("connect-remote-system", async (event, supplied) => {
    if (!isLocalOperationsWindow(event)) return { connected: false, error: "Local Cybeck window required." };
    if (remoteConnecting || activeRemoteCommand) return { connected: false, error: "Wait for the current remote operation." };
    let target;
    try { target = validateTarget(supplied); }
    catch (error) { return { connected: false, error: error.message }; }
    if (remoteTarget && JSON.stringify(remoteTarget) === JSON.stringify(target)) return { connected: true, target };
    remoteConnecting = true;
    const generation = remoteGeneration;
    const window = mainWindow;
    try {
        const approval = await dialog.showMessageBox(window, {
            type: "warning", buttons: ["Cancel", "Connect with SSH"], defaultId: 0, cancelId: 0,
            title: "Connect to remote computer",
            message: `Connect to ${target.username}@${target.host}:${target.port}?`,
            detail: "Cybeck can view resource usage and run commands on this computer using your existing SSH key and the remote account's permissions. Access lasts only for this Cybeck window session. The remote computer must already allow SSH and trust your key."
        });
        if (approval.response !== 1) return { connected: false, canceled: true };
        let output = "";
        const result = await new Promise((resolve) => runRemote(target, "echo CYBECK_REMOTE_READY",
            (_stream, chunk) => { output += chunk; }, resolve));
        if (result.exitCode !== 0 || !output.includes("CYBECK_REMOTE_READY")) {
            return { connected: false, error: `SSH connection failed: ${output.trim() || result.message}. Configure SSH keys and verify the host key on this computer first.` };
        }
        if (remoteGeneration !== generation || mainWindow !== window || window.isDestroyed()) {
            return { connected: false, error: "Cybeck window closed during connection." };
        }
        remoteTarget = target;
        return { connected: true, target };
    } catch (error) { return { connected: false, error: error.message }; }
    finally { remoteConnecting = false; }
});

ipcMain.handle("disconnect-remote-system", (event) => {
    if (!isLocalOperationsWindow(event)) return false;
    remoteGeneration += 1;
    remoteTarget = null;
    activeRemoteCommand?.stop();
    return true;
});

function startRemoteOperation(event, command) {
    if (!isLocalOperationsWindow(event)) return { started: false, error: "Local Cybeck window required." };
    if (!remoteTarget) return { started: false, error: "Connect to a remote computer first." };
    if (activeRemoteCommand || remoteConnecting) return { started: false, error: "A remote operation is already running." };
    const sender = event.sender;
    const emit = (data) => { if (!sender.isDestroyed()) sender.send("remote-command-event", data); };
    try {
        const operation = runRemote(remoteTarget, command,
            (stream, output) => emit({ type: "output", stream, output }),
            (result) => { activeRemoteCommand = null; emit({ type: "done", ...result }); });
        activeRemoteCommand = operation;
        return { started: true };
    } catch (error) { return { started: false, error: error.message }; }
}

ipcMain.handle("run-remote-command", (event, command) => startRemoteOperation(event, command));
ipcMain.handle("get-remote-usage", (event) => startRemoteOperation(event, remoteTarget ? resourceCommand(remoteTarget.platform) : ""));
ipcMain.handle("stop-remote-command", (event) =>
    isLocalOperationsWindow(event) ? activeRemoteCommand?.stop() || false : false);

ipcMain.handle("open-remote-desktop", (event, suppliedHost) => {
    if (!isLocalOperationsWindow(event)) return { opened: false, error: "Local Cybeck window required." };
    try {
        const host = validateHost(suppliedHost);
        const child = spawn(path.join(process.env.SystemRoot || "C:\\Windows", "System32", "mstsc.exe"),
            [`/v:${host}`], { detached: true, stdio: "ignore", windowsHide: false });
        child.once("error", (error) => console.error("[REMOTE] Remote Desktop failed:", error));
        child.unref();
        return { opened: true };
    } catch (error) { return { opened: false, error: error.message }; }
});

ipcMain.handle("check-remote-desktop", async (event, suppliedHost) => {
    if (!isLocalOperationsWindow(event)) return { reachable: false, detail: "Local Cybeck window required." };
    try { return await checkRemoteDesktop(suppliedHost); }
    catch (error) { return { reachable: false, detail: error.message }; }
});

ipcMain.handle("open-quick-assist", async (event) => {
    if (!isLocalOperationsWindow(event)) return { opened: false, error: "Local Cybeck window required." };
    try {
        await shell.openExternal("ms-quick-assist:");
        return { opened: true };
    } catch (error) { return { opened: false, error: `Quick Assist could not open: ${error.message}` }; }
});

ipcMain.handle("open-anydesk-session", async (event, suppliedAddress) => {
    if (!isLocalOperationsWindow(event)) return { opened: false, error: "Local Cybeck window required." };
    try {
        const address = validateAnyDeskAddress(suppliedAddress);
        const file = findAnyDesk(selectedAnyDeskPath);
        if (!file) return { opened: false, error: "AnyDesk executable not found. Select its .exe file or install AnyDesk from the official site." };
        selectedAnyDeskPath = file;
        await new Promise((resolve, reject) => {
            const child = spawn(file, [address], { detached: true, stdio: "ignore", shell: false, windowsHide: false });
            child.once("spawn", () => { child.unref(); resolve(); });
            child.once("error", reject);
        });
        return { opened: true, path: file };
    } catch (error) { return { opened: false, error: `AnyDesk could not open: ${error.message}` }; }
});

ipcMain.handle("close-anydesk-app", async (event) => {
    if (!isLocalOperationsWindow(event)) return { closed: false, error: "Local Cybeck window required." };
    if (process.platform !== "win32") return { closed: false, error: "Available on Windows only." };
    try {
        await execFileAsync("taskkill.exe", ["/IM", "AnyDesk.exe", "/T", "/F"], { windowsHide: true, timeout: 10000 });
        return { closed: true };
    } catch (error) { return { closed: false, error: "AnyDesk could not be closed. End the session in AnyDesk directly." }; }
});

let selectedAnyDeskPath = null;
ipcMain.handle("get-anydesk-status", (event) => {
    if (!isLocalOperationsWindow(event)) return { found: false };
    const file = findAnyDesk(selectedAnyDeskPath);
    if (file) selectedAnyDeskPath = file;
    return { found: Boolean(file), path: file };
});

ipcMain.handle("choose-anydesk-executable", async (event) => {
    if (!isLocalOperationsWindow(event)) return { found: false, error: "Local Cybeck window required." };
    const result = await dialog.showOpenDialog(mainWindow, {
        title: "Select the signed AnyDesk executable",
        properties: ["openFile"], filters: [{ name: "Windows applications", extensions: ["exe"] }]
    });
    if (result.canceled || !result.filePaths.length) return { found: false, canceled: true };
    const file = result.filePaths[0];
    if (!verifyAnyDeskExecutable(file)) return { found: false, error: "That file is not a valid AnyDesk executable signed by AnyDesk Software GmbH." };
    selectedAnyDeskPath = file;
    return { found: true, path: file };
});

ipcMain.handle("open-anydesk-download", async (event) => {
    if (!isLocalOperationsWindow(event)) return { opened: false, error: "Local Cybeck window required." };
    try {
        await shell.openExternal(ANYDESK_DOWNLOAD_URL);
        return { opened: true };
    } catch (error) { return { opened: false, error: `AnyDesk download page could not open: ${error.message}` }; }
});

// ======================================================
// AUTO UPDATER CONFIGURATION
// ======================================================

autoUpdater.autoDownload = false;
// Install only after the user chooses Install and Restart. An ordinary app exit
// must not trigger a silent update that has no forced relaunch.
autoUpdater.autoInstallOnAppQuit = false;
autoUpdater.autoRunAppAfterInstall = true;
autoUpdater.logger = console;

function createWindow() {
    // Remove Electron's default File/Edit/View menu completely
    Menu.setApplicationMenu(null);

    mainWindow = new BrowserWindow({
        width: 1400,
        height: 900,

        minWidth: 1000,
        minHeight: 650,

        backgroundColor: "#050806",

        title: "Cybeck Security Systems",

        icon: path.join(__dirname, "assets", "app.ico"),

        // Removes the menu bar
        autoHideMenuBar: true,

        // Keep the normal Windows frame/buttons
        frame: true,

        // Makes width/height refer to usable content area
        useContentSize: true,

        webPreferences: {
    preload: path.join(__dirname, "preload.js"),
    contextIsolation: true,
    nodeIntegration: false
}
    
    });

    const appUrl = pathToFileURL(path.join(__dirname, "index.html")).href;
    mainWindow.webContents.on("will-navigate", (event, url) => {
        if (url !== appUrl) event.preventDefault();
    });
    mainWindow.webContents.setWindowOpenHandler(() => ({ action: "deny" }));
    mainWindow.loadFile("index.html");

    // Start maximized
    mainWindow.maximize();

    // Prevent menu from reappearing
    mainWindow.setMenuBarVisibility(false);

    mainWindow.on("closed", () => {
        operationsAccess.revoke();
        activeOperationsCommand?.stop();
        remoteGeneration += 1;
        remoteTarget = null;
        activeRemoteCommand?.stop();
        mainWindow = null;
    });
}


// ======================================================
// WINDOW CONTROLS
// ======================================================

// True fullscreen
ipcMain.on("window-fullscreen", () => {
    if (!mainWindow) return;

    mainWindow.setFullScreen(!mainWindow.isFullScreen());
});


// Normal window / maximized toggle
ipcMain.on("window-maximize", () => {
    if (!mainWindow) return;

    if (mainWindow.isMaximized()) {
        mainWindow.unmaximize();
    } else {
        mainWindow.maximize();
    }
});


// Minimize
ipcMain.on("window-minimize", () => {
    if (!mainWindow) return;

    mainWindow.minimize();
});


// Close
ipcMain.on("window-close", () => {
    if (!mainWindow) return;

    mainWindow.close();
});

// ======================================================
// NETWORK INFORMATION
// ======================================================

ipcMain.handle("get-network-info", async () => {
    const networkInfo = {
        connected: false, internet: false, ssid: "Unavailable", networkName: "Unavailable", signal: null,
        ipv4: "Unavailable", gateway: "Unavailable", dns: "Unavailable", adapter: "Unavailable",
        interfaceDescription: "Unavailable", mac: "Unavailable", linkSpeed: "Unavailable",
        connectionType: "Unknown", interfaceIndex: null, routeMetric: null, linkState: "Down", latency: null
    };

    // Wi-Fi can remain associated while Ethernet carries the actual route.
    // Select Windows' usable IPv4 default route with the lowest combined metric.
    try {
        const powerShellScript = `
$ErrorActionPreference = "SilentlyContinue"
$rows = @(Get-NetRoute -AddressFamily IPv4 -DestinationPrefix "0.0.0.0/0" |
    Where-Object { $_.NextHop -and $_.NextHop -ne "0.0.0.0" } | ForEach-Object {
        $route = $_
        $adapter = Get-NetAdapter -InterfaceIndex $route.InterfaceIndex -ErrorAction SilentlyContinue
        $ipInterface = Get-NetIPInterface -AddressFamily IPv4 -InterfaceIndex $route.InterfaceIndex -ErrorAction SilentlyContinue
        $config = Get-NetIPConfiguration -InterfaceIndex $route.InterfaceIndex -ErrorAction SilentlyContinue
        $profile = Get-NetConnectionProfile -InterfaceIndex $route.InterfaceIndex -ErrorAction SilentlyContinue
        [PSCustomObject]@{
            InterfaceIndex = $route.InterfaceIndex
            EffectiveMetric = [int]$route.RouteMetric + [int]$ipInterface.InterfaceMetric
            Name = $adapter.Name
            InterfaceDescription = $adapter.InterfaceDescription
            Status = [string]$adapter.Status
            MediaType = [string]$adapter.MediaType
            PhysicalMediaType = [string]$adapter.PhysicalMediaType
            MAC = $adapter.MacAddress
            LinkSpeed = $adapter.LinkSpeed
            IPv4 = [string]($config.IPv4Address | Select-Object -First 1).IPAddress
            Gateway = [string]$route.NextHop
            DNS = [string](($config.DNSServer.ServerAddresses | Where-Object { $_ }) -join ", ")
            ProfileName = [string]$profile.Name
        }
    })
$rows | ConvertTo-Json -Depth 3 -Compress`;
        const { stdout } = await execFileAsync("powershell.exe", ["-NoProfile", "-NonInteractive", "-Command", powerShellScript], {
            windowsHide: true, timeout: 8000, maxBuffer: 1024 * 1024
        });
        const active = chooseActiveAdapter(stdout.trim() ? JSON.parse(stdout) : []);
        if (active) {
            networkInfo.connected = true;
            networkInfo.ipv4 = active.IPv4 || "Unavailable";
            networkInfo.gateway = active.Gateway || "Unavailable";
            networkInfo.dns = active.DNS || "Unavailable";
            networkInfo.adapter = active.Name || "Unavailable";
            networkInfo.interfaceDescription = active.InterfaceDescription || "Unavailable";
            networkInfo.mac = active.MAC || "Unavailable";
            networkInfo.linkSpeed = active.LinkSpeed || "Unavailable";
            networkInfo.connectionType = active.ConnectionType;
            networkInfo.interfaceIndex = Number(active.InterfaceIndex) || null;
            networkInfo.routeMetric = Number(active.EffectiveMetric) || null;
            networkInfo.linkState = "Up";
            networkInfo.networkName = active.ProfileName || active.Name || active.ConnectionType;
        }
    } catch (error) {
        console.error("[NETWORK] Active adapter detection failed:", error.message);
    }

    // Radio information is meaningful only when the selected route is Wi-Fi.
    if (networkInfo.connected && networkInfo.connectionType === "Wi-Fi") {
        try {
            const { stdout } = await execFileAsync("netsh.exe", ["wlan", "show", "interfaces"], {
                windowsHide: true, timeout: 4000, maxBuffer: 512 * 1024
            });
            const blocks = stdout.split(/\r?\n\s*\r?\n/);
            const expected = networkInfo.adapter.toLowerCase();
            const block = blocks.find((part) =>
                part.match(/^\s*Name\s*:\s*(.+)$/im)?.[1]?.trim().toLowerCase() === expected
            ) || stdout;
            const ssid = block.match(/^\s*SSID\s*:\s*(.+)$/im)?.[1]?.trim();
            const signal = block.match(/^\s*Signal\s*:\s*(\d+)%/im)?.[1];
            if (ssid) networkInfo.ssid = ssid;
            if (signal !== undefined) networkInfo.signal = Math.max(0, Math.min(100, Number(signal)));
            networkInfo.networkName = ssid || networkInfo.networkName;
        } catch (error) {
            console.error("[NETWORK] Wi-Fi radio details unavailable:", error.message);
        }
    } else if (networkInfo.connected && networkInfo.connectionType === "Ethernet") {
        networkInfo.ssid = "Not applicable (wired)";
    }

    // TCP 443 confirms usable connectivity even when a network blocks ICMP ping.
    if (networkInfo.connected) {
        const startedAt = Date.now();
        try {
            const net = require("net");
            await new Promise((resolve, reject) => {
                const socket = net.createConnection({ host: "1.1.1.1", port: 443 });
                const timer = setTimeout(() => socket.destroy(new Error("Connectivity probe timed out.")), 2500);
                socket.once("connect", () => { clearTimeout(timer); socket.destroy(); resolve(); });
                socket.once("error", (error) => { clearTimeout(timer); reject(error); });
            });
            networkInfo.internet = true;
            networkInfo.latency = Math.max(1, Date.now() - startedAt);
        } catch (error) {
            networkInfo.internet = false;
            networkInfo.latency = null;
        }
    }

    console.log("[NETWORK] Current network:", networkInfo);
    return networkInfo;
});

// ======================================================
// NETWORK DIAGNOSTICS V1.1
// ======================================================

ipcMain.handle(
    "run-network-diagnostics",
    async () => {

        const diagnostics = {

            gateway: {
                address: null,
                reachable: false,
                latency: null
            },

            internet: {
                reachable: false,
                target: "1.1.1.1",
                averageLatency: null,
                minimumLatency: null,
                maximumLatency: null,
                packetLoss: 100
            },

            dns: {
                working: false,
                target: "cloudflare.com",
                resolvedAddress: null
            },

            timestamp:
                new Date().toISOString()

        };


        // ==================================================
        // 1. FIND DEFAULT GATEWAY
        // ==================================================

        try {

            const gatewayScript = `

$ErrorActionPreference = "SilentlyContinue"

$config = Get-NetIPConfiguration |
    Where-Object {
        $_.IPv4DefaultGateway -ne $null
    } |
    Select-Object -First 1

if ($config -and $config.IPv4DefaultGateway) {
    $config.IPv4DefaultGateway.NextHop
}

`;


            const gatewayOutput =
                await new Promise(
                    (resolve, reject) => {

                        execFile(
                            "powershell.exe",

                            [
                                "-NoProfile",
                                "-NonInteractive",
                                "-Command",
                                gatewayScript
                            ],

                            {
                                windowsHide: true
                            },

                            (
                                error,
                                stdout
                            ) => {

                                if (error) {

                                    reject(error);

                                    return;

                                }


                                resolve(
                                    stdout.trim()
                                );

                            }
                        );

                    }
                );


            if (gatewayOutput) {

                diagnostics.gateway.address =
                    gatewayOutput;

            }

        }

        catch (error) {

            console.error(
                "[DIAGNOSTICS] Gateway detection failed:",
                error.message
            );

        }


        // ==================================================
        // 2. PING DEFAULT GATEWAY
        // ==================================================

        if (
            diagnostics.gateway.address
        ) {

            try {

                const gatewayPing =
                    await new Promise(
                        (
                            resolve,
                            reject
                        ) => {

                            exec(
                                `ping ${diagnostics.gateway.address} -n 1 -w 1500`,

                                {
                                    windowsHide: true
                                },

                                (
                                    error,
                                    stdout
                                ) => {

                                    if (error) {

                                        reject(error);

                                        return;

                                    }


                                    resolve(stdout);

                                }
                            );

                        }
                    );


                diagnostics.gateway.reachable =
                    true;


                const latencyMatch =
                    gatewayPing.match(
                        /time[=<]\s*(\d+)ms/i
                    );


                if (latencyMatch) {

                    diagnostics.gateway.latency =
                        Number(
                            latencyMatch[1]
                        );

                }

            }

            catch (error) {

                diagnostics.gateway.reachable =
                    false;

            }

        }


        // ==================================================
        // 3. INTERNET PING + PACKET LOSS
        // ==================================================

        try {

            const internetPing =
                await new Promise(
                    (
                        resolve,
                        reject
                    ) => {

                        exec(
                            "ping 1.1.1.1 -n 4 -w 1500",

                            {
                                windowsHide: true
                            },

                            (
                                error,
                                stdout
                            ) => {

                                /*
                                 * Windows ping may return a
                                 * non-zero exit code when
                                 * packets are lost.
                                 *
                                 * We still want stdout so
                                 * packet loss can be analysed.
                                 */

                                if (
                                    error &&
                                    !stdout
                                ) {

                                    reject(error);

                                    return;

                                }


                                resolve(stdout);

                            }
                        );

                    }
                );


            // ----------------------------------------------
            // PACKET LOSS
            // ----------------------------------------------

            const lossMatch =
                internetPing.match(
                    /(\d+)%\s*loss/i
                );


            if (lossMatch) {

                diagnostics.internet.packetLoss =
                    Number(
                        lossMatch[1]
                    );

            }


            diagnostics.internet.reachable =
                diagnostics.internet.packetLoss < 100;


            // ----------------------------------------------
            // INDIVIDUAL LATENCY SAMPLES
            // ----------------------------------------------

            const latencyMatches =
                [
                    ...internetPing.matchAll(
                        /time[=<]\s*(\d+)ms/gi
                    )
                ];


            const samples =
                latencyMatches.map(
                    (match) =>
                        Number(
                            match[1]
                        )
                );


            if (
                samples.length > 0
            ) {

                diagnostics.internet.minimumLatency =
                    Math.min(
                        ...samples
                    );


                diagnostics.internet.maximumLatency =
                    Math.max(
                        ...samples
                    );


                diagnostics.internet.averageLatency =
                    Math.round(

                        samples.reduce(
                            (
                                total,
                                value
                            ) =>
                                total +
                                value,

                            0
                        )

                        /

                        samples.length

                    );

            }

        }

        catch (error) {

            console.error(
                "[DIAGNOSTICS] Internet test failed:",
                error.message
            );

        }


        // ==================================================
        // 4. DNS RESOLUTION TEST
        // ==================================================

        try {

            const dnsScript = `

$ErrorActionPreference = "Stop"

$result =
    Resolve-DnsName
        -Name "cloudflare.com"
        -Type A |
    Where-Object {
        $_.IPAddress
    } |
    Select-Object -First 1

if ($result) {
    $result.IPAddress
}

`;


            const dnsOutput =
                await new Promise(
                    (
                        resolve,
                        reject
                    ) => {

                        execFile(
                            "powershell.exe",

                            [
                                "-NoProfile",
                                "-NonInteractive",
                                "-Command",
                                dnsScript
                            ],

                            {
                                windowsHide: true
                            },

                            (
                                error,
                                stdout
                            ) => {

                                if (error) {

                                    reject(error);

                                    return;

                                }


                                resolve(
                                    stdout.trim()
                                );

                            }
                        );

                    }
                );


            if (dnsOutput) {

                diagnostics.dns.working =
                    true;


                diagnostics.dns.resolvedAddress =
                    dnsOutput;

            }

        }

        catch (error) {

            diagnostics.dns.working =
                false;


            console.error(
                "[DIAGNOSTICS] DNS test failed:",
                error.message
            );

        }


        // ==================================================
        // FINAL RESULT
        // ==================================================

        console.log(
            "[DIAGNOSTICS] Results:",
            diagnostics
        );


        return diagnostics;

    }
);

// ======================================================
// AUTO UPDATE SYSTEM
// ======================================================

function sendUpdateStatus(type, data = {}) {

    if (!mainWindow || mainWindow.isDestroyed()) {
        return;
    }

    mainWindow.webContents.send(
        "update-status",
        {
            type,
            ...data
        }
    );
}


// ------------------------------------------------------
// CHECKING
// ------------------------------------------------------

autoUpdater.on(
    "checking-for-update",
    () => {

        sendUpdateStatus(
            "checking"
        );

    }
);


// ------------------------------------------------------
// UPDATE AVAILABLE
// ------------------------------------------------------

autoUpdater.on(
    "update-available",
    (info) => {

        sendUpdateStatus(
            "available",
            {
                version: info.version,
                releaseName:
                    info.releaseName || "",
                releaseNotes:
                    info.releaseNotes || ""
            }
        );

    }
);


// ------------------------------------------------------
// NO UPDATE
// ------------------------------------------------------

autoUpdater.on(
    "update-not-available",
    (info) => {

        sendUpdateStatus(
            "not-available",
            {
                version: info.version
            }
        );

    }
);


// ------------------------------------------------------
// DOWNLOAD PROGRESS
// ------------------------------------------------------

autoUpdater.on(
    "download-progress",
    (progress) => {

        sendUpdateStatus(
            "progress",
            {
                percent:
                    Math.round(progress.percent),

                transferred:
                    progress.transferred,

                total:
                    progress.total,

                bytesPerSecond:
                    progress.bytesPerSecond
            }
        );

    }
);


// ------------------------------------------------------
// UPDATE DOWNLOADED
// ------------------------------------------------------

autoUpdater.on(
    "update-downloaded",
    (info) => {

        sendUpdateStatus(
            "downloaded",
            {
                version: info.version
            }
        );

    }
);


// ------------------------------------------------------
// ERROR
// ------------------------------------------------------

autoUpdater.on(
    "error",
    (error) => {

        sendUpdateStatus(
            "error",
            {
                message:
                    error?.message ||
                    "Unknown update error"
            }
        );

    }
);


// ======================================================
// IPC — CHECK FOR UPDATE
// ======================================================

ipcMain.handle("check-for-updates", async () => {

    if (!app.isPackaged) {
        const message =
            "Update checking is disabled while running with npm start.";

        sendUpdateStatus("error", { message });

        return {
            success: false,
            development: true,
            message
        };
    }

    try {

        console.log("[UPDATER] Starting update check...");
        console.log("[UPDATER] Current version:", app.getVersion());

        const result = await autoUpdater.checkForUpdates();

        console.log("[UPDATER] Update check completed.");

        return {
            success: true,
            updateInfo: result?.updateInfo || null
        };

    } catch (error) {

        console.error("[UPDATER] Check failed:", error);

        const message =
            error?.message ||
            "Unable to contact the Cybeck update server.";

        sendUpdateStatus("error", {
            message
        });

        return {
            success: false,
            message
        };
    }
});
// ======================================================
// IPC — DOWNLOAD UPDATE
// ======================================================

ipcMain.handle(
    "download-update",
    async () => {

        if (!app.isPackaged) {

            return {
                success: false,
                message:
                    "Updates cannot be downloaded in development mode."
            };

        }

        try {

            await autoUpdater.downloadUpdate();

            return {
                success: true
            };

        }

        catch (error) {

            return {
                success: false,
                message:
                    error.message
            };

        }

    }
);


// ======================================================
// IPC — INSTALL UPDATE
// ======================================================

ipcMain.on(
    "install-update",
    (event) => {

        if (!app.isPackaged || !isLocalOperationsWindow(event)) {
            return;
        }

        sendUpdateStatus("installing", {
            message: "Installing the update. Cybeck will restart automatically."
        });

        installDownloadedUpdate(autoUpdater);

    }
);

// ======================================================
// APPLICATION INFORMATION
// ======================================================

ipcMain.handle("get-app-info", async () => {

    return {
        productName: "Cybeck Security Systems",
        version: app.getVersion(),
        buildDate: "24 September 2026",
        releaseChannel: "Stable"
    };

});

// ======================================================
// APPLICATION
// ======================================================

app.whenReady().then(() => {

    createWindow();

    app.on("activate", () => {
        if (BrowserWindow.getAllWindows().length === 0) {
            createWindow();
        }
    });
});


app.on("window-all-closed", () => {
    if (process.platform !== "darwin") {
        app.quit();
    }
});
