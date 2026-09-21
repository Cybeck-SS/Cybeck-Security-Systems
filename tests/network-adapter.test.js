const test = require("node:test");
const assert = require("node:assert/strict");
const { classifyConnectionType, chooseActiveAdapter } = require("../network-adapter");

test("physical media distinguishes Wi-Fi and Ethernet", () => {
    assert.equal(classifyConnectionType({ PhysicalMediaType: "Native 802.11" }), "Wi-Fi");
    assert.equal(classifyConnectionType({ MediaType: "802.3", InterfaceDescription: "Intel Ethernet Controller" }), "Ethernet");
});

test("active adapter follows the lowest-metric usable default route", () => {
    const active = chooseActiveAdapter([
        { Name: "Wi-Fi", Status: "Up", IPv4: "192.168.1.4", Gateway: "192.168.1.1", EffectiveMetric: 45, PhysicalMediaType: "Native 802.11" },
        { Name: "Ethernet", Status: "Up", IPv4: "10.0.0.4", Gateway: "10.0.0.1", EffectiveMetric: 15, MediaType: "802.3" }
    ]);
    assert.equal(active.Name, "Ethernet");
    assert.equal(active.ConnectionType, "Ethernet");
});

test("disconnected and gateway-less adapters are not active", () => {
    assert.equal(chooseActiveAdapter([{ Name: "Ethernet", Status: "Down", IPv4: "10.0.0.4", Gateway: "10.0.0.1", EffectiveMetric: 5 }]), null);
    assert.equal(chooseActiveAdapter([{ Name: "Wi-Fi", Status: "Up", IPv4: "192.168.1.4", Gateway: "", EffectiveMetric: 5 }]), null);
});
