const { spawn } = require("child_process");
const os = require("os");
const path = require("path");

const MAX_COMMAND_LENGTH = 2000;
const MAX_OUTPUT_BYTES = 128 * 1024;
const MAX_RUNTIME_MS = 30000;

function shellSpec(shell, command, systemRoot = process.env.SystemRoot || "C:\\Windows") {
    if (typeof command !== "string" || !command.trim() || command.length > MAX_COMMAND_LENGTH || /\0/.test(command)) {
        throw new Error("Enter a command of 1–2000 characters.");
    }
    if (shell === "cmd") return {
        file: path.join(systemRoot, "System32", "cmd.exe"), args: ["/d", "/s", "/c", command]
    };
    if (shell === "powershell") return {
        file: path.join(systemRoot, "System32", "WindowsPowerShell", "v1.0", "powershell.exe"),
        args: ["-NoLogo", "-NoProfile", "-NonInteractive", "-Command", command]
    };
    throw new Error("Choose CMD or PowerShell.");
}

function runCommand(shell, command, onOutput, onDone) {
    const spec = shellSpec(shell, command);
    const child = spawn(spec.file, spec.args, {
        cwd: os.homedir(), windowsHide: true, shell: false, stdio: ["ignore", "pipe", "pipe"]
    });
    let bytes = 0;
    let finished = false;
    let reason = "";
    const finish = (result) => {
        if (finished) return;
        finished = true;
        clearTimeout(timer);
        onDone(result);
    };
    const timer = setTimeout(() => {
        reason = "Command stopped after 30 seconds.";
        child.kill();
    }, MAX_RUNTIME_MS);
    for (const [stream, name] of [[child.stdout, "stdout"], [child.stderr, "stderr"]]) {
        stream.on("data", (chunk) => {
            if (finished) return;
            const available = MAX_OUTPUT_BYTES - bytes;
            if (available <= 0) return;
            const data = chunk.subarray(0, available);
            bytes += data.length;
            onOutput(name, data.toString("utf8"));
            if (bytes >= MAX_OUTPUT_BYTES) {
                reason = "Output limit reached (128 KB). Command stopped.";
                child.kill();
            }
        });
    }
    child.once("error", (error) => finish({ exitCode: null, message: error.message }));
    child.once("close", (code) => finish({ exitCode: code, message: reason || `Exited with code ${code}.` }));
    return {
        stop() {
            if (finished) return false;
            reason = "Stopped by user.";
            child.kill();
            return true;
        }
    };
}

module.exports = { shellSpec, runCommand };
