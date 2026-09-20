const { spawn } = require("child_process");
const path = require("path");

const MAX_OUTPUT_BYTES = 128 * 1024;
const MAX_RUNTIME_MS = 30000;

function validateHost(supplied) {
    const host = String(supplied || "").trim();
    if (!/^[a-z0-9](?:[a-z0-9.-]{0,251}[a-z0-9])?$/i.test(host) || host.includes("..")) {
        throw new Error("Enter a valid DNS name or IPv4 address.");
    }
    return host;
}

function validateTarget(supplied) {
    const host = validateHost(supplied?.host);
    const username = String(supplied?.username || "").trim();
    const port = Number(supplied?.port === undefined || supplied.port === "" ? 22 : supplied.port);
    const platform = supplied?.platform;
    if (!/^[a-z0-9._-]{1,64}$/i.test(username) || username.startsWith("-")) {
        throw new Error("Enter a valid SSH username.");
    }
    if (!Number.isInteger(port) || port < 1 || port > 65535) throw new Error("Enter an SSH port from 1 to 65535.");
    if (!["windows", "linux", "macos"].includes(platform)) throw new Error("Choose the remote OS.");
    return { host, username, port, platform };
}

function sshSpec(target, command, systemRoot = process.env.SystemRoot || "C:\\Windows") {
    const safe = validateTarget(target);
    if (typeof command !== "string" || !command.trim() || command.length > 2000 || /\0/.test(command)) {
        throw new Error("Enter a remote command of 1–2000 characters.");
    }
    return {
        file: path.join(systemRoot, "System32", "OpenSSH", "ssh.exe"),
        args: ["-T", "-p", String(safe.port), "-o", "BatchMode=yes", "-o", "StrictHostKeyChecking=yes",
            "-o", "ConnectTimeout=8", "-o", "ServerAliveInterval=5", "-o", "ServerAliveCountMax=1",
            `${safe.username}@${safe.host}`, command]
    };
}

function resourceCommand(platform) {
    if (platform === "windows") {
        const script = `$ProgressPreference='SilentlyContinue'; ` +
            `try{"CPU load: $([math]::Round((Get-Counter '\\Processor(_Total)\\% Processor Time' -EA Stop).CounterSamples.CookedValue,1))%"}catch{'CPU load unavailable'};` +
            `try{"Memory available: $([math]::Round((Get-Counter '\\Memory\\Available MBytes' -EA Stop).CounterSamples.CookedValue,0)) MB"}catch{'Memory unavailable'};` +
            `[IO.DriveInfo]::GetDrives()|Where-Object IsReady|ForEach-Object{"Disk $($_.Name) free: $([math]::Round($_.AvailableFreeSpace/1GB,1)) GB"};` +
            `'Top processes by memory:';Get-Process|Sort-Object WorkingSet64 -Descending|Select-Object -First 8 ProcessName,Id,@{N='MB';E={[math]::Round($_.WorkingSet64/1MB,1)}}|Format-Table -AutoSize|Out-String`;
        return `powershell.exe -NoLogo -NoProfile -NonInteractive -EncodedCommand ${Buffer.from(script, "utf16le").toString("base64")}`;
    }
    if (platform === "macos") return "uname -s; uptime; memory_pressure | head -n 8; df -h /; top -l 1 -n 8 -stats pid,command,cpu,mem | head -n 14";
    return "uname -s; uptime; free -h; df -h /; ps -eo pid,comm,%cpu,%mem --sort=-%cpu | head -n 9";
}

function runRemote(target, command, onOutput, onDone) {
    const spec = sshSpec(target, command);
    const child = spawn(spec.file, spec.args, { windowsHide: true, shell: false, stdio: ["ignore", "pipe", "pipe"] });
    let bytes = 0;
    let finished = false;
    let reason = "";
    const finish = (result) => {
        if (finished) return;
        finished = true;
        clearTimeout(timer);
        onDone(result);
    };
    const timer = setTimeout(() => { reason = "Remote command stopped after 30 seconds."; child.kill(); }, MAX_RUNTIME_MS);
    for (const [stream, name] of [[child.stdout, "stdout"], [child.stderr, "stderr"]]) {
        stream.on("data", (chunk) => {
            if (finished) return;
            const available = MAX_OUTPUT_BYTES - bytes;
            if (available <= 0) return;
            const data = chunk.subarray(0, available);
            bytes += data.length;
            onOutput(name, data.toString("utf8"));
            if (bytes >= MAX_OUTPUT_BYTES) { reason = "Remote output limit reached (128 KB)."; child.kill(); }
        });
    }
    child.once("error", (error) => finish({ exitCode: null, message: error.message }));
    child.once("close", (code) => finish({ exitCode: code, message: reason || `Exited with code ${code}.` }));
    return { stop: () => { if (finished) return false; reason = "Stopped by user."; child.kill(); return true; } };
}

module.exports = { validateHost, validateTarget, sshSpec, resourceCommand, runRemote };
