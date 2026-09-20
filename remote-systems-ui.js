(() => {
    for (const id of ["ops-history-panel", "ops-console-panel", "ops-remote-panel"]) {
        const panel = document.getElementById(id);
        if (!panel) continue;
        try { panel.open = localStorage.getItem(`${id}-open`) === "true"; } catch (_) { /* Private storage unavailable. */ }
        panel.addEventListener("toggle", () => {
            try { localStorage.setItem(`${id}-open`, String(panel.open)); } catch (_) { /* Session-only toggle. */ }
        });
    }

    const bridge = window.windowControls;
    const form = document.getElementById("ops-remote-connect");
    if (!bridge?.connectRemoteSystem || !form) return;
    const get = (id) => document.getElementById(id);
    const host = get("ops-remote-host");
    const username = get("ops-remote-user");
    const port = get("ops-remote-port");
    const platform = get("ops-remote-os");
    const status = get("ops-remote-status");
    const operationStatus = get("ops-remote-operation-status");
    const output = get("ops-remote-output");
    const command = get("ops-remote-command");
    let target = null;
    let busy = false;
    let connecting = false;

    function refresh() {
        get("ops-remote-connect-btn").disabled = connecting || busy;
        get("ops-remote-disconnect").disabled = !target && !connecting;
        get("ops-remote-usage").disabled = !target || busy || connecting;
        get("ops-remote-run").disabled = !target || busy || connecting;
        get("ops-remote-stop").disabled = !busy;
        get("ops-remote-desktop").disabled = platform.value !== "windows" || !host.value.trim();
        get("ops-remote-check-rdp").disabled = platform.value !== "windows" || !host.value.trim();
        status.textContent = connecting ? "Connecting…" : target ? `Connected: ${target.username}@${target.host}` : "Not connected";
    }
    function append(value) {
        output.textContent = (output.textContent + value).slice(-140000);
        output.scrollTop = output.scrollHeight;
    }
    function suppliedTarget() {
        return { host: host.value.trim(), username: username.value.trim(), port: Number(port.value), platform: platform.value };
    }
    bridge.onRemoteCommandEvent((event) => {
        if (!busy) return;
        if (event.type === "output") append(event.output);
        if (event.type === "done") {
            append(`\n[${event.message}]`);
            operationStatus.textContent = event.message;
            busy = false;
            refresh();
        }
    });
    form.addEventListener("submit", async (event) => {
        event.preventDefault();
        if (connecting || busy) return;
        connecting = true;
        refresh();
        try {
            const result = await bridge.connectRemoteSystem(suppliedTarget());
            if (result.connected) target = result.target;
            else if (!result.canceled) operationStatus.textContent = result.error || "Connection failed";
        } catch (error) { operationStatus.textContent = `Connection failed: ${error.message}`; }
        finally { connecting = false; refresh(); }
    });
    get("ops-remote-disconnect").addEventListener("click", async () => {
        await bridge.disconnectRemoteSystem();
        target = null;
        connecting = false;
        operationStatus.textContent = "Remote access ended";
        refresh();
    });
    async function execute(label, action) {
        if (!target || busy) return;
        busy = true;
        output.textContent = `${target.username}@${target.host} · ${label}\n`;
        operationStatus.textContent = "Starting…";
        refresh();
        try {
            const result = await action();
            if (!result.started) {
                operationStatus.textContent = result.error || "Remote command could not start";
                busy = false;
                refresh();
            } else if (busy) operationStatus.textContent = "Running on remote computer…";
        } catch (error) {
            operationStatus.textContent = `Remote command failed: ${error.message}`;
            busy = false;
            refresh();
        }
    }
    get("ops-remote-usage").addEventListener("click", () => execute("Resource Usage", () => bridge.getRemoteUsage()));
    setInterval(() => {
        if (get("ops-remote-auto").checked && get("ops-remote-panel").open && target && !busy && !connecting) {
            execute("Resource Usage", () => bridge.getRemoteUsage());
        }
    }, 15000);
    get("ops-remote-run").addEventListener("click", () => {
        if (command.value.trim()) execute(command.value, () => bridge.runRemoteCommand(command.value));
    });
    get("ops-remote-stop").addEventListener("click", async () => {
        operationStatus.textContent = "Stopping…";
        await bridge.stopRemoteCommand();
    });
    get("ops-remote-desktop").addEventListener("click", async () => {
        const result = await bridge.openRemoteDesktop(host.value.trim());
        operationStatus.textContent = result.opened ? "Windows Remote Desktop opened. The second PC must support RDP hosting; Windows Home does not. Use Quick Assist for Home." : result.error;
    });
    get("ops-remote-check-rdp").addEventListener("click", async () => {
        operationStatus.textContent = "Checking RDP port 3389…";
        const result = await bridge.checkRemoteDesktop(host.value.trim());
        operationStatus.textContent = result.detail;
    });
    get("ops-remote-quick-assist").addEventListener("click", async () => {
        const result = await bridge.openQuickAssist();
        operationStatus.textContent = result.opened
            ? "Quick Assist opened. Select Help someone, then have the second PC enter the code and approve sharing."
            : result.error;
    });
    const anyDeskStatus = get("ops-anydesk-status");
    bridge.getAnyDeskStatus().then((result) => {
        anyDeskStatus.textContent = result.found
            ? `AnyDesk ready: ${result.path}`
            : "AnyDesk not found. Choose its .exe file or get it from the official site.";
    }).catch(() => { anyDeskStatus.textContent = "Unable to check AnyDesk installation."; });
    get("ops-anydesk-connect").addEventListener("click", async () => {
        anyDeskStatus.textContent = "Opening AnyDesk…";
        try {
            const result = await bridge.openAnyDeskSession(get("ops-anydesk-address").value);
            anyDeskStatus.textContent = result.opened
                ? "AnyDesk connection request opened. Approve it on the second computer."
                : result.error;
        } catch (error) { anyDeskStatus.textContent = `AnyDesk could not open: ${error.message}`; }
    });
    get("ops-anydesk-disconnect").addEventListener("click", async () => {
        if (!window.confirm("Close the entire local AnyDesk app? This will end all AnyDesk sessions on this PC.")) return;
        anyDeskStatus.textContent = "Closing AnyDesk…";
        try {
            const result = await bridge.closeAnyDeskApp();
            anyDeskStatus.textContent = result.closed ? "AnyDesk closed. Local sessions ended." : result.error;
        } catch (error) { anyDeskStatus.textContent = `AnyDesk could not be closed: ${error.message}`; }
    });
    get("ops-anydesk-download").addEventListener("click", async () => {
        try {
            const result = await bridge.openAnyDeskDownload();
            anyDeskStatus.textContent = result.opened ? "Official AnyDesk download page opened." : result.error;
        } catch (error) { anyDeskStatus.textContent = `Download page could not open: ${error.message}`; }
    });
    get("ops-anydesk-choose").addEventListener("click", async () => {
        try {
            const result = await bridge.chooseAnyDeskExecutable();
            if (result.found) anyDeskStatus.textContent = `AnyDesk ready: ${result.path}`;
            else if (!result.canceled) anyDeskStatus.textContent = result.error;
        } catch (error) { anyDeskStatus.textContent = `AnyDesk selection failed: ${error.message}`; }
    });
    host.addEventListener("input", refresh);
    platform.addEventListener("change", refresh);
    get("ops-remote-clear").addEventListener("click", () => { output.textContent = ""; });
    bridge.getRemoteSystem().then((saved) => {
        if (saved) {
            target = saved;
            host.value = saved.host;
            username.value = saved.username;
            port.value = saved.port;
            platform.value = saved.platform;
        }
        refresh();
    }).catch(refresh);
    refresh();
})();
