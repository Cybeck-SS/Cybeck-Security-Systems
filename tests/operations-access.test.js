const test = require("node:test");
const assert = require("node:assert/strict");
const { createSessionAccess } = require("../operations-access");

test("approval is requested once while the session remains open", async () => {
    const access = createSessionAccess();
    let prompts = 0;
    const prompt = () => { prompts += 1; return true; };
    assert.equal(access.isGranted(), false);
    assert.equal(await access.request(prompt), true);
    assert.equal(await access.request(prompt), true);
    assert.equal(prompts, 1);
    access.revoke();
    assert.equal(access.isGranted(), false);
    assert.equal(await access.request(prompt), true);
    assert.equal(prompts, 2);
});

test("denied and pending requests do not grant access", async () => {
    const access = createSessionAccess();
    assert.equal(await access.request(() => false), false);
    let complete;
    let prompts = 0;
    const approval = new Promise((resolve) => { complete = resolve; });
    const first = access.request(() => { prompts += 1; return approval; });
    const second = access.request(() => { prompts += 1; return true; });
    access.revoke();
    complete(true);
    assert.equal(await first, false);
    assert.equal(await second, false);
    assert.equal(prompts, 1);
    assert.equal(access.isGranted(), false);
});
