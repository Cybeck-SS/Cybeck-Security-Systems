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
    let busy = false;

    function setBusy(value) {
        busy = value;
        run.disabled = value;
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
    form.addEventListener("submit", async (event) => {
        event.preventDefault();
        if (busy || !command.value.trim()) return;
        output.textContent = `${shell.value === "cmd" ? "CMD" : "PowerShell"}> ${command.value}\n`;
        status.textContent = "Awaiting permission…";
        setBusy(true);
        try {
            const result = await bridge.runOperationsCommand(shell.value, command.value);
            if (!result.started) {
                status.textContent = result.canceled ? "Canceled" : result.error || "Could not start command";
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
