const test = require("node:test");
const assert = require("node:assert/strict");
const { validateHost, validateTarget, sshSpec, resourceCommand } = require("../remote-systems");

test("remote target validation prevents option and shell injection", () => {
    const target = validateTarget({ host: "second-pc.local", username: "keithan", port: 22, platform: "windows" });
    assert.equal(target.host, "second-pc.local");
    for (const host of ["-oProxyCommand=bad", "pc;whoami", "pc/other", "pc..local", ""]) {
        assert.throws(() => validateHost(host));
        assert.throws(() => validateTarget({ ...target, host }));
    }
    assert.throws(() => validateTarget({ ...target, username: "user;command" }));
    assert.throws(() => validateTarget({ ...target, port: 0 }));
    assert.throws(() => validateTarget({ ...target, platform: "unknown" }));
});

test("SSH keeps the destination separate from the user's explicit command", () => {
    const target = { host: "192.168.1.20", username: "remoteuser", port: 2222, platform: "linux" };
    const spec = sshSpec(target, "uptime");
    assert.match(spec.file, /ssh\.exe$/i);
    assert.deepEqual(spec.args.slice(-2), ["remoteuser@192.168.1.20", "uptime"]);
    assert.ok(spec.args.includes("StrictHostKeyChecking=yes"));
    assert.ok(spec.args.includes("BatchMode=yes"));
    assert.throws(() => sshSpec(target, " "));
});

test("resource checks cover Windows, Linux, and macOS", () => {
    for (const platform of ["windows", "linux", "macos"]) {
        const command = resourceCommand(platform);
        assert.ok(command.length > 20 && command.length <= 2000);
    }
    assert.match(resourceCommand("windows"), /-EncodedCommand/);
    assert.match(resourceCommand("linux"), /free -h/);
    assert.match(resourceCommand("macos"), /memory_pressure/);
});
