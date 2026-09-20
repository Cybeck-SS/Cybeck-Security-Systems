const DOWNLOAD_URL = "https://anydesk.com/en/downloads/windows";
const fs = require("node:fs");
const path = require("node:path");
const { execFileSync } = require("node:child_process");

function validateAnyDeskAddress(supplied) {
    const value = String(supplied || "").trim();
    const compactId = value.replace(/ /g, "");
    if (/^\d{9,10}$/.test(compactId)) return compactId;
    if (/^[a-z0-9][a-z0-9._-]{0,24}@[a-z0-9][a-z0-9._-]{0,24}$/i.test(value)) return value;
    throw new Error("Enter a 9–10 digit AnyDesk ID or an alias such as secondpc@ad.");
}

function candidatePaths(env = process.env) {
    const home = env.USERPROFILE || "";
    return [
        path.join(env["ProgramFiles(x86)"] || "C:\\Program Files (x86)", "AnyDesk", "AnyDesk.exe"),
        path.join(env.ProgramFiles || "C:\\Program Files", "AnyDesk", "AnyDesk.exe"),
        home && path.join(home, "Downloads", "AnyDesk.exe"),
        home && path.join(home, "Desktop", "AnyDesk.exe"),
        env.LOCALAPPDATA && path.join(env.LOCALAPPDATA, "Programs", "AnyDesk", "AnyDesk.exe")
    ].filter(Boolean);
}

function verifyAnyDeskExecutable(file) {
    if (typeof file !== "string" || !fs.existsSync(file) || path.extname(file).toLowerCase() !== ".exe") return false;
    const escaped = file.replace(/'/g, "''");
    const script = `$ErrorActionPreference='Stop'; $s=Get-AuthenticodeSignature -LiteralPath '${escaped}'; ` +
        `$v=(Get-Item -LiteralPath '${escaped}').VersionInfo; ` +
        `[pscustomobject]@{Status=[string]$s.Status; Signer=[string]$s.SignerCertificate.Subject; Product=[string]$v.ProductName} | ConvertTo-Json -Compress`;
    try {
        const raw = execFileSync("powershell.exe", ["-NoProfile", "-NonInteractive", "-Command", script], {
            encoding: "utf8", timeout: 15000, windowsHide: true,
            env: { ...process.env, PSModulePath: path.join(process.env.SystemRoot || "C:\\Windows", "System32", "WindowsPowerShell", "v1.0", "Modules") }
        });
        const result = JSON.parse(raw);
        return result.Status === "Valid" && /(?:^|, )O=AnyDesk Software GmbH(?:,|$)/.test(result.Signer) &&
            /^AnyDesk$/i.test(result.Product);
    } catch (_) { return false; }
}

function findAnyDesk(preferred, options = {}) {
    const exists = options.exists || fs.existsSync;
    const verify = options.verify || verifyAnyDeskExecutable;
    const candidates = [preferred, ...(options.candidates || candidatePaths())].filter(Boolean);
    for (const file of candidates) {
        if (exists(file) && verify(file)) return file;
    }
    return null;
}

module.exports = { DOWNLOAD_URL, validateAnyDeskAddress, candidatePaths, verifyAnyDeskExecutable, findAnyDesk };
