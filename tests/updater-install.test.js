const test = require("node:test");
const assert = require("node:assert/strict");
const { installDownloadedUpdate } = require("../updater-install");

test("explicit update install is silent and forces Cybeck to relaunch", () => {
    const calls = [];
    installDownloadedUpdate({ quitAndInstall: (...args) => calls.push(args) });
    assert.deepEqual(calls, [[true, true]]);
});

test("update install rejects an invalid updater", () => {
    assert.throws(() => installDownloadedUpdate(null), /valid updater/);
});
