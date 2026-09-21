(() => {
    const bridge = window.windowControls;
    if (!bridge?.getVaultSession) return;
    const get = (id) => document.getElementById(id);
    let profiles = [];
    let selectedProfileId = null;

    const status = (message, error = false) => {
        get("vault-status").textContent = message || "";
        get("vault-status").classList.toggle("error", error);
    };

    function initials(name) {
        return name.split(/\s+/).filter(Boolean).slice(0, 2).map((part) => part[0]).join("").toUpperCase();
    }

    function renderProfiles() {
        const list = get("vault-profile-list");
        list.replaceChildren();
        for (const profile of profiles) {
            const button = document.createElement("button");
            button.type = "button";
            button.className = `vault-profile${selectedProfileId === profile.id ? " active" : ""}`;
            button.dataset.profileId = profile.id;
            const avatar = document.createElement("span"); avatar.className = "vault-avatar"; avatar.textContent = initials(profile.name);
            const copy = document.createElement("span");
            const name = document.createElement("strong"); name.textContent = profile.name;
            const role = document.createElement("small"); role.textContent = profile.role;
            copy.append(name, role); button.append(avatar, copy);
            button.addEventListener("click", () => { selectedProfileId = profile.id; get("vault-unlock-form").hidden = false; get("vault-create-form").hidden = true; renderProfiles(); get("vault-password").focus(); status(""); });
            list.append(button);
        }
        get("vault-unlock-form").hidden = !selectedProfileId;
    }

    function showUnlocked(profile) {
        get("vault-locked-view").hidden = true;
        get("vault-unlocked-view").hidden = false;
        get("vault-welcome-name").textContent = `${profile.name} is unlocked`;
        get("vault-password").value = "";
    }

    async function refresh() {
        const result = await bridge.getVaultSession();
        if (result.error) { status(result.error, true); return; }
        profiles = result.profiles || [];
        selectedProfileId = profiles.some((profile) => profile.id === selectedProfileId) ? selectedProfileId : profiles[0]?.id || null;
        renderProfiles();
        if (!profiles.length) { get("vault-create-form").hidden = false; get("vault-unlock-form").hidden = true; status("Create the first local Vault profile."); }
        if (result.unlockedProfileId) {
            const profile = profiles.find((item) => item.id === result.unlockedProfileId);
            if (profile) showUnlocked(profile);
        }
    }

    get("vault-add-profile").addEventListener("click", () => { get("vault-create-form").hidden = false; get("vault-unlock-form").hidden = true; get("vault-profile-name").focus(); status("Passwords require at least 10 characters."); });
    get("vault-cancel-profile").addEventListener("click", () => { get("vault-create-form").reset(); get("vault-create-form").hidden = true; get("vault-unlock-form").hidden = !selectedProfileId; status(""); });
    get("vault-unlock-form").addEventListener("submit", async (event) => {
        event.preventDefault(); status("Checking profile…");
        const result = await bridge.unlockVault(selectedProfileId, get("vault-password").value);
        if (result.error) { status(result.error, true); get("vault-password").select(); return; }
        showUnlocked(result.profile);
    });
    get("vault-create-form").addEventListener("submit", async (event) => {
        event.preventDefault();
        const password = get("vault-new-password").value;
        if (password !== get("vault-confirm-password").value) { status("The confirmation password does not match.", true); return; }
        status("Creating protected profile…");
        const result = await bridge.createVaultProfile({ name: get("vault-profile-name").value, role: get("vault-profile-role").value, password });
        if (result.error) { status(result.error, true); return; }
        profiles.push(result.profile); selectedProfileId = result.profile.id; get("vault-create-form").reset(); renderProfiles(); showUnlocked(result.profile);
    });
    get("vault-lock").addEventListener("click", async () => { await bridge.lockVault(); get("vault-unlocked-view").hidden = true; get("vault-locked-view").hidden = false; renderProfiles(); status("Vault locked for this session."); });
    const reveal = (button, input) => button.addEventListener("click", () => { input.type = input.type === "password" ? "text" : "password"; button.setAttribute("aria-pressed", String(input.type === "text")); });
    reveal(get("vault-show-password"), get("vault-password"));
    document.querySelectorAll("[data-vault-reveal]").forEach((button) => reveal(button, get(button.dataset.vaultReveal)));
    refresh().catch((error) => status(`Vault could not start: ${error.message}`, true));
})();
