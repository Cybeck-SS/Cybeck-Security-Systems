(() => {
    const bridge = window.windowControls;
    const form = document.getElementById("ops-command-form");
    if (!bridge?.runOperationsCommand || !form) return;
    const shell = document.getElementById("ops-shell");
    const command = document.getElementById("ops-command");
    const output = document.getElementById("ops-output");
    const status = document.getElementById("ops-command-status");
    const run = document.getElementById("ops-run");
    const stop = document.getElementById("ops-stop");
    const enable = document.getElementById("ops-enable-access");
    const revoke = document.getElementById("ops-revoke-access");
    const accessStatus = document.getElementById("ops-access-status");
    let busy = false;
    let accessGranted = false;
    let accessRevision = 0;

    function setAccess(value) {
        accessGranted = value;
        enable.disabled = value;
        revoke.disabled = !value;
        run.disabled = !value || busy;
        accessStatus.textContent = value ? "Console access on for this session" : "Console access off";
    }

    function setBusy(value) {
        busy = value;
        run.disabled = value || !accessGranted;
        stop.disabled = !value;
        shell.disabled = value;
    }
    function append(value) {
        output.textContent = (output.textContent + value).slice(-140000);
        output.scrollTop = output.scrollHeight;
    }

    bridge.onOperationsCommandEvent((event) => {
        if (!busy) return;
        if (event.type === "output") append(event.output);
        if (event.type === "done") {
            append(`\n[${event.message}]`);
            status.textContent = event.message;
            setBusy(false);
        }
    });
    enable.addEventListener("click", async () => {
        accessRevision += 1;
        enable.disabled = true;
        accessStatus.textContent = "Awaiting session permission…";
        try {
            setAccess(await bridge.requestOperationsAccess());
        } catch (error) {
            setAccess(false);
            accessStatus.textContent = `Access unavailable: ${error.message}`;
        }
    });
    revoke.addEventListener("click", async () => {
        accessRevision += 1;
        try {
            await bridge.revokeOperationsAccess();
            setAccess(false);
            status.textContent = "Console access revoked";
        } catch (error) { accessStatus.textContent = `Could not revoke access: ${error.message}`; }
    });
    bridge.getOperationsAccess().then((value) => {
        if (accessRevision === 0) setAccess(value);
    }).catch(() => { if (accessRevision === 0) setAccess(false); });
    form.addEventListener("submit", async (event) => {
        event.preventDefault();
        if (busy || !accessGranted || !command.value.trim()) return;
        output.textContent = `${shell.value === "cmd" ? "CMD" : "PowerShell"}> ${command.value}\n`;
        status.textContent = "Starting…";
        setBusy(true);
        try {
            const result = await bridge.runOperationsCommand(shell.value, command.value);
            if (!result.started) {
                status.textContent = result.error || "Could not start command";
                setBusy(false);
            } else if (busy) status.textContent = "Running locally…";
        } catch (error) {
            status.textContent = `Could not start command: ${error.message}`;
            setBusy(false);
        }
    });
    command.addEventListener("keydown", (event) => {
        if (event.key === "Enter" && event.ctrlKey) {
            event.preventDefault();
            form.requestSubmit();
        }
    });
    stop.addEventListener("click", async () => {
        if (busy) {
            status.textContent = "Stopping…";
            await bridge.stopOperationsCommand();
        }
    });
    document.getElementById("ops-clear").addEventListener("click", () => {
        output.textContent = "";
    });
})();
