const test = require("node:test");
const assert = require("node:assert/strict");
const { networkRepairSpec, actionNames } = require("../network-repair");

test("network repair exposes only fixed approved actions", () => {
    assert.deepEqual(actionNames, ["renew-dhcp", "flush-dns", "reconnect-wifi", "restart-adapter", "reset-network"]);
    for (const action of actionNames) {
        const spec = networkRepairSpec(action);
        assert.ok(spec.title && spec.detail && spec.script);
        assert.equal(typeof spec.restartRequired, "boolean");
    }
});

test("network repair rejects arbitrary commands", () => {
    assert.throws(() => networkRepairSpec("; Remove-Item C:\\ -Recurse"), /Unsupported network repair action/);
});
