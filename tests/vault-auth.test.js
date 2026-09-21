const test = require("node:test");
const assert = require("node:assert/strict");
const { createProfile, verifyPassword, publicProfile } = require("../vault-auth");

test("Vault profiles store a salted verifier and validate the correct password", () => {
    const profile = createProfile("Primary Profile", "Administrator", "correct horse battery staple");
    assert.equal(verifyPassword(profile, "correct horse battery staple"), true);
    assert.equal(verifyPassword(profile, "incorrect password"), false);
    assert.equal(profile.password, undefined);
    assert.equal(publicProfile(profile).hash, undefined);
});

test("Vault profile passwords require at least ten characters", () => {
    assert.throws(() => createProfile("Operator", "User", "short"), /between 10 and 256/);
});
