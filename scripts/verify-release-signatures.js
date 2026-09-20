const { execFileSync } = require("node:child_process");
const path = require("node:path");
const { existsSync } = require("node:fs");
const version = require("../package.json").version;

const files = [
    path.join(__dirname, "..", "release", `Cybeck Security Systems Setup ${version}.exe`),
    path.join(__dirname, "..", "release", "win-unpacked", "Cybeck Security Systems.exe"),
    path.join(__dirname, "..", "release", "win-unpacked", "resources", "elevate.exe")
];

let failed = false;
for (const file of files) {
    if (!existsSync(file)) {
        console.error(`MISSING: ${file}`);
        failed = true;
        continue;
    }
    const escaped = file.replace(/'/g, "''");
    const command = `$ErrorActionPreference='Stop'; $s=Get-AuthenticodeSignature -LiteralPath '${escaped}'; ` +
        `[pscustomobject]@{Status=[string]$s.Status; Subject=[string]$s.SignerCertificate.Subject; ` +
        `Algorithm=[string]$s.SignerCertificate.PublicKey.Oid.Value} | ConvertTo-Json -Compress`;
    try {
        const result = JSON.parse(execFileSync("powershell.exe", ["-NoProfile", "-NonInteractive", "-Command", command], {
            encoding: "utf8", timeout: 15000, windowsHide: true,
            env: { ...process.env, PSModulePath: path.join(process.env.SystemRoot || "C:\\Windows", "System32", "WindowsPowerShell", "v1.0", "Modules") }
        }));
        const valid = result.Status === "Valid" && result.Algorithm === "1.2.840.113549.1.1.1";
        console.log(`${valid ? "SIGNED" : "REJECTED"}: ${path.basename(file)} (${result.Status}, ${result.Subject || "no signer"})`);
        if (!valid) failed = true;
    } catch (error) {
        console.error(`SIGNATURE CHECK FAILED: ${file}: ${error.message}`);
        failed = true;
    }
}

if (failed) {
    console.error("Release rejected. Sign the application, elevation helper, and installer with a publicly trusted RSA code-signing identity, then rebuild.");
    process.exitCode = 1;
}
