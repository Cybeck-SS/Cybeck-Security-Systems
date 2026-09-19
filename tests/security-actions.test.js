const assert = require("node:assert/strict");
const test = require("node:test");
const { firewallTarget } = require("../security-actions");
const { renderIncidentReport } = require("../incident-report");

test("firewall targets accept only exact incident IDs and IP addresses", () => {
    assert.deepEqual(firewallTarget("CYB-00017", "198.51.100.9"), {
        name: "Cybeck-CYB-00017", remoteAddress: "198.51.100.9"
    });
    assert.equal(firewallTarget("CYB-00017'; Remove-NetFirewallRule", "198.51.100.9"), null);
    assert.equal(firewallTarget("CYB-00017", "example.com"), null);
    assert.equal(firewallTarget("CYB-00017", "0.0.0.0"), null);
});

test("PDF report markup escapes incident content", () => {
    const html = renderIncidentReport({ id: "CYB-00017", evidence: "<script>alert('x')</script>",
        notes: "A&B", timeline: [{ time: "2026-09-19", action: "Reviewed" }] });
    assert.ok(html.includes("&lt;script&gt;"));
    assert.ok(html.includes("A&amp;B"));
    assert.ok(!html.includes("<script>"));
    assert.ok(html.includes("Reviewed"));
});
