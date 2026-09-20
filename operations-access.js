function createSessionAccess() {
    let granted = false;
    let pending = null;
    let generation = 0;
    return {
        isGranted: () => granted,
        request(prompt) {
            if (granted) return Promise.resolve(true);
            if (pending) return pending;
            const current = generation;
            pending = Promise.resolve().then(prompt).then((approved) => {
                if (approved && generation === current) granted = true;
                return granted;
            }).finally(() => { pending = null; });
            return pending;
        },
        revoke() {
            generation += 1;
            granted = false;
        }
    };
}

module.exports = { createSessionAccess };
