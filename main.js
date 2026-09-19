const { app, BrowserWindow, ipcMain, Menu, dialog, safeStorage } = require("electron");
const path = require("path");
const os = require("os");
const dns = require("dns").promises;
const fs = require("fs/promises");
const { promisify } = require("util");
const { exec, execFile } = require("child_process");
const { autoUpdater } = require("electron-updater");
const { normalizeConnections, findConnectionObservations, parseNetstatAttempts } = require("./security-core");
const { renderIncidentReport } = require("./incident-report");
const { firewallTarget } = require("./security-actions");

const execFileAsync = promisify(execFile);
const historyPath = () => path.join(app.getPath("userData"), "security-history.json");
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
    const temporary = `${destination}.tmp`;
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

// ======================================================
// AUTO UPDATER CONFIGURATION
// ======================================================

autoUpdater.autoDownload = false;
autoUpdater.autoInstallOnAppQuit = true;
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

    mainWindow.loadFile("index.html");

    // Start maximized
    mainWindow.maximize();

    // Prevent menu from reappearing
    mainWindow.setMenuBarVisibility(false);

    mainWindow.on("closed", () => {
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

    // --------------------------------------------------
    // DEFAULT RESPONSE
    // --------------------------------------------------

    const networkInfo = {
        connected: false,
        internet: false,

        ssid: "No Wi-Fi connection",
        signal: 0,

        ipv4: "Unavailable",
        gateway: "Unavailable",
        dns: "Unavailable",

        adapter: "Unavailable",
        interfaceDescription: "Unavailable",
        mac: "Unavailable",
        linkSpeed: "Unavailable",

        connectionType: "Unknown",

        latency: null
    };


    // ==================================================
    // 1. WIFI INFORMATION
    // ==================================================

    try {

        const wifiOutput = await new Promise((resolve, reject) => {

            exec(
                "netsh wlan show interfaces",
                {
                    windowsHide: true
                },
                (error, stdout) => {

                    if (error) {
                        reject(error);
                        return;
                    }

                    resolve(stdout);
                }
            );

        });


        // ----------------------------------------------
        // CONNECTION STATE
        // ----------------------------------------------

        const stateMatch =
            wifiOutput.match(/State\s*:\s*(.+)/i);

        const state =
            stateMatch
                ? stateMatch[1].trim()
                : "unknown";


        networkInfo.connected =
            state.toLowerCase() === "connected";


        // ----------------------------------------------
        // SSID
        // ----------------------------------------------

        const ssidMatch =
            wifiOutput.match(/^\s*SSID\s*:\s*(.+)$/im);

        if (ssidMatch) {

            networkInfo.ssid =
                ssidMatch[1].trim();

        }


        // ----------------------------------------------
        // SIGNAL
        // ----------------------------------------------

        const signalMatch =
            wifiOutput.match(/Signal\s*:\s*(\d+)%/i);

        if (signalMatch) {

            networkInfo.signal =
                Number(signalMatch[1]);

        }


        // ----------------------------------------------
        // CONNECTION TYPE
        // ----------------------------------------------

        if (networkInfo.connected) {

            networkInfo.connectionType = "Wi-Fi";

        }

    }

    catch (error) {

        console.error(
            "[NETWORK] Wi-Fi detection failed:",
            error.message
        );

    }


    // ==================================================
    // 2. WINDOWS NETWORK CONFIGURATION
    // ==================================================

    try {

        const powerShellScript = `

$ErrorActionPreference = "SilentlyContinue"

$config = Get-NetIPConfiguration |
    Where-Object {
        $_.IPv4DefaultGateway -ne $null
    } |
    Select-Object -First 1

if ($config) {

    $adapter = Get-NetAdapter |
        Where-Object {
            $_.InterfaceIndex -eq $config.InterfaceIndex
        } |
        Select-Object -First 1

    $dnsServers = @()

    if ($config.DNSServer) {
        $dnsServers = $config.DNSServer.ServerAddresses
    }

    [PSCustomObject]@{

        IPv4 = if ($config.IPv4Address) {
            $config.IPv4Address.IPAddress
        }
        else {
            ""
        }

        Gateway = if ($config.IPv4DefaultGateway) {
            $config.IPv4DefaultGateway.NextHop
        }
        else {
            ""
        }

        DNS = $dnsServers -join ", "

        Adapter = if ($adapter) {
            $adapter.Name
        }
        else {
            $config.InterfaceAlias
        }

        InterfaceDescription = if ($adapter) {
            $adapter.InterfaceDescription
        }
        else {
            ""
        }

        MAC = if ($adapter) {
            $adapter.MacAddress
        }
        else {
            ""
        }

        LinkSpeed = if ($adapter) {
            $adapter.LinkSpeed
        }
        else {
            ""
        }

    } | ConvertTo-Json -Compress

}
`;

        const adapterOutput =
            await new Promise((resolve, reject) => {

                execFile(
                    "powershell.exe",
                    [
                        "-NoProfile",
                        "-NonInteractive",
                        "-Command",
                        powerShellScript
                    ],
                    {
                        windowsHide: true,
                        maxBuffer: 1024 * 1024
                    },
                    (error, stdout) => {

                        if (error) {
                            reject(error);
                            return;
                        }

                        resolve(stdout);

                    }
                );

            });


        if (adapterOutput.trim()) {

            const data =
                JSON.parse(adapterOutput.trim());


            networkInfo.ipv4 =
                data.IPv4 ||
                "Unavailable";


            networkInfo.gateway =
                data.Gateway ||
                "Unavailable";


            networkInfo.dns =
                data.DNS ||
                "Unavailable";


            networkInfo.adapter =
                data.Adapter ||
                "Unavailable";


            networkInfo.interfaceDescription =
                data.InterfaceDescription ||
                "Unavailable";


            networkInfo.mac =
                data.MAC ||
                "Unavailable";


            networkInfo.linkSpeed =
                data.LinkSpeed ||
                "Unavailable";


            // Detect Ethernet if Windows is using one
            if (
                !networkInfo.connected &&
                networkInfo.adapter !== "Unavailable"
            ) {

                networkInfo.connectionType =
                    networkInfo.adapter
                        .toLowerCase()
                        .includes("wi-fi")
                        ? "Wi-Fi"
                        : "Ethernet";

            }

        }

    }

    catch (error) {

        console.error(
            "[NETWORK] Adapter detection failed:",
            error.message
        );

    }


    // ==================================================
    // 3. INTERNET CONNECTIVITY + LATENCY
    // ==================================================

    try {

        const pingOutput =
            await new Promise((resolve, reject) => {

                exec(
                    "ping 1.1.1.1 -n 1 -w 1500",
                    {
                        windowsHide: true
                    },
                    (error, stdout) => {

                        if (error) {
                            reject(error);
                            return;
                        }

                        resolve(stdout);

                    }
                );

            });


        networkInfo.internet = true;


        // Windows may return:
        // time=18ms
        // time<1ms

        const latencyMatch =
            pingOutput.match(
                /time[=<]\s*(\d+)ms/i
            );


        if (latencyMatch) {

            networkInfo.latency =
                Number(latencyMatch[1]);

        }

    }

    catch (error) {

        networkInfo.internet = false;
        networkInfo.latency = null;

    }


    // ==================================================
    // FINAL CONNECTION CHECK
    // ==================================================

    // A machine may have Ethernet instead of Wi-Fi.
    if (
        !networkInfo.connected &&
        networkInfo.ipv4 !== "Unavailable"
    ) {

        networkInfo.connected = true;

    }


    console.log(
        "[NETWORK] Current network:",
        networkInfo
    );


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
    () => {

        if (!app.isPackaged) {
            return;
        }

        autoUpdater.quitAndInstall();

    }
);

// ======================================================
// APPLICATION INFORMATION
// ======================================================

ipcMain.handle("get-app-info", async () => {

    return {
        productName: "Cybeck Security Systems",
        version: app.getVersion(),
        buildDate: "19 September 2026",
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
