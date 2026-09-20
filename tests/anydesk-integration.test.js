const test = require("node:test");
const assert = require("node:assert/strict");
const { validateAnyDeskAddress, candidatePaths, findAnyDesk } = require("../anydesk-integration");

test("AnyDesk bridge accepts documented IDs and aliases", () => {
    assert.equal(validateAnyDeskAddress("123 456 789"), "123456789");
    assert.equal(validateAnyDeskAddress("secondpc@ad"), "secondpc@ad");
    assert.equal(validateAnyDeskAddress("1234567890"), "1234567890");
});

test("AnyDesk bridge rejects protocol and command injection", () => {
    for (const value of ["", "123", "anydesk:123456789", "pc@ad?x=1", "pc@ad;calc", "--remove", "pc@ad\n--with-password"]) {
        assert.throws(() => validateAnyDeskAddress(value));
    }
});

test("portable AnyDesk in Downloads is detected and unverified files are skipped", () => {
    const paths = candidatePaths({ USERPROFILE: "C:\\Users\\Test", ProgramFiles: "C:\\Program Files", "ProgramFiles(x86)": "C:\\Program Files (x86)" });
    assert.ok(paths.some((file) => file.endsWith("Downloads\\AnyDesk.exe")));
    const result = findAnyDesk("C:\\fake.exe", {
        candidates: ["C:\\Users\\Test\\Downloads\\AnyDesk.exe"],
        exists: () => true,
        verify: (file) => file.endsWith("Downloads\\AnyDesk.exe")
    });
    assert.equal(result, "C:\\Users\\Test\\Downloads\\AnyDesk.exe");
});
