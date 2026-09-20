const test = require("node:test");
const assert = require("node:assert/strict");
const { shellSpec, runCommand } = require("../operations-shell");

test("only CMD and PowerShell are accepted with bounded commands", () => {
    assert.match(shellSpec("cmd", "echo hello").file, /cmd\.exe$/i);
    assert.match(shellSpec("powershell", "Write-Output hello").file, /powershell\.exe$/i);
    assert.throws(() => shellSpec("bash", "echo hello"));
    assert.throws(() => shellSpec("cmd", " "));
    assert.throws(() => shellSpec("cmd", "a".repeat(2001)));
    assert.throws(() => shellSpec("cmd", "echo\0bad"));
});

test("CMD command streams output and exits", { skip: process.platform !== "win32" }, async () => {
    let output = "";
    const result = await new Promise((resolve) => runCommand("cmd", "echo CybeckConsoleCheck",
        (_stream, chunk) => { output += chunk; }, resolve));
    assert.equal(result.exitCode, 0);
    assert.match(output, /CybeckConsoleCheck/);
});

test("PowerShell command streams output and exits", { skip: process.platform !== "win32" }, async () => {
    let output = "";
    const result = await new Promise((resolve) => runCommand("powershell", "Write-Output CybeckPowerShellCheck",
        (_stream, chunk) => { output += chunk; }, resolve));
    assert.equal(result.exitCode, 0);
    assert.match(output, /CybeckPowerShellCheck/);
});
