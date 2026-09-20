const test = require("node:test");
const assert = require("node:assert/strict");
const { validateAnyDeskAddress, sessionUri } = require("../anydesk-integration");

test("AnyDesk bridge accepts documented IDs and aliases", () => {
    assert.equal(validateAnyDeskAddress("123 456 789"), "123456789");
    assert.equal(sessionUri("secondpc@ad"), "anydesk:secondpc@ad");
    assert.equal(sessionUri("1234567890"), "anydesk:1234567890");
});

test("AnyDesk bridge rejects protocol and command injection", () => {
    for (const value of ["", "123", "anydesk:123456789", "pc@ad?x=1", "pc@ad;calc", "--remove", "pc@ad\n--with-password"]) {
        assert.throws(() => sessionUri(value));
    }
});
