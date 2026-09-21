function installDownloadedUpdate(updater) {
    if (!updater || typeof updater.quitAndInstall !== "function") {
        throw new TypeError("A valid updater is required.");
    }

    // A user who clicks Install expects the update to finish without the assisted
    // NSIS wizard and expects Cybeck to return when installation completes.
    updater.quitAndInstall(true, true);
}

module.exports = { installDownloadedUpdate };
