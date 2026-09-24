(() => {
    const bridge = window.windowControls;
    const get = (id) => document.getElementById(id);
    window.cybeckProfileReady = false;
    let profiles = [];

    function status(message, error = false) {
        const line = get("profile-gate-status");
        line.textContent = message || "";
        line.classList.toggle("error", error);
    }

    function selectedId() { return get("profile-gate-select").value || null; }

    function renderProfiles(selected) {
        const select = get("profile-gate-select");
        select.replaceChildren();
        for (const profile of profiles) {
            const option = document.createElement("option");
            option.value = profile.id;
            option.textContent = `${profile.name} · ${profile.role}`;
            option.selected = profile.id === selected;
            select.append(option);
        }
        if (!profiles.length) { const option = document.createElement("option"); option.value = ""; option.textContent = "Create your first profile"; select.append(option); }
        select.disabled = !profiles.length;
        get("profile-gate-login").disabled = !profiles.length;
        get("profile-gate-delete").disabled = !profiles.length;
    }

    function enter(profile) {
        window.cybeckProfileReady = true;
        window.cybeckActiveProfile = profile;
        get("profile-gate").hidden = true;
        get("app-shell").hidden = false;
        get("active-profile-name").textContent = profile.name;
        window.dispatchEvent(new CustomEvent("cybeck-profile-ready", { detail: profile }));
    }

    function showCreate() {
        get("profile-login-view").hidden = true;
        get("profile-gate-create-form").hidden = false;
        get("profile-gate-heading").textContent = profiles.length ? "Create another profile" : "Create your Cybeck account";
        get("profile-gate-copy").textContent = "This local profile protects and separates its Tasks, Notes, and monitoring history.";
        get("profile-gate-name").focus();
        status("Use a password of at least 10 characters.");
    }

    function showLogin() {
        get("profile-gate-create-form").hidden = true;
        get("profile-login-view").hidden = false;
        get("profile-gate-heading").textContent = "Welcome to Cybeck";
        get("profile-gate-copy").textContent = "Choose your local profile and enter its password.";
        status("");
    }

    get("profile-gate-login").addEventListener("click", async () => {
        const profileId = selectedId();
        const password = get("profile-gate-password").value;
        if (!profileId || !password) { status("Choose a profile and enter its password.", true); return; }
        status("Signing in…");
        const result = await bridge.unlockVault(profileId, password);
        if (result.error) { status(result.error, true); get("profile-gate-password").select(); return; }
        get("profile-gate-password").value = "";
        enter(result.profile);
    });
    get("profile-gate-password").addEventListener("keydown", (event) => { if (event.key === "Enter") get("profile-gate-login").click(); });
    get("profile-gate-create").addEventListener("click", showCreate);
    get("profile-gate-cancel").addEventListener("click", showLogin);
    get("profile-gate-create-form").addEventListener("submit", async (event) => {
        event.preventDefault();
        const password = get("profile-gate-new-password").value;
        if (password !== get("profile-gate-confirm").value) { status("The confirmation password does not match.", true); return; }
        status("Creating protected profile…");
        const result = await bridge.createVaultProfile({ name: get("profile-gate-name").value, role: get("profile-gate-role").value, password });
        if (result.error) { status(result.error, true); return; }
        enter(result.profile);
    });
    get("profile-gate-delete").addEventListener("click", async () => {
        const profileId = selectedId();
        const profile = profiles.find((item) => item.id === profileId);
        const password = get("profile-gate-password").value;
        if (!profile || !password) { status("Enter the selected profile password before deleting it.", true); return; }
        if (!window.confirm(`Permanently delete the profile “${profile.name}”? Its profile Tasks, Notes, and monitoring history will also be deleted.`)) return;
        const result = await bridge.deleteVaultProfile(profileId, password, true);
        if (result.error) { status(result.error, true); return; }
        profiles = result.profiles || [];
        get("profile-gate-password").value = "";
        renderProfiles(profiles[0]?.id);
        if (!profiles.length) showCreate(); else status("Profile and its local data were deleted.");
    });
    get("profile-sign-out").addEventListener("click", async () => { await bridge.lockVault(); window.location.reload(); });

    bridge.getVaultSession().then((result) => {
        if (result.error) { status(result.error, true); return; }
        profiles = result.profiles || [];
        renderProfiles(result.unlockedProfileId || profiles[0]?.id);
        const unlocked = profiles.find((profile) => profile.id === result.unlockedProfileId);
        if (unlocked) enter(unlocked);
        else if (!profiles.length) showCreate();
    }).catch((error) => status(`Profile sign in could not start: ${error.message}`, true));
})();
