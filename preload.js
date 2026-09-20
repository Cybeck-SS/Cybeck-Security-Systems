const { contextBridge, ipcRenderer } = require("electron");

contextBridge.exposeInMainWorld(
    "windowControls",
    {

        fullscreen: () => {
            ipcRenderer.send(
                "window-fullscreen"
            );
        },

        maximize: () => {
            ipcRenderer.send(
                "window-maximize"
            );
        },

        minimize: () => {
            ipcRenderer.send(
                "window-minimize"
            );
        },

        close: () => {
            ipcRenderer.send(
                "window-close"
            );
        },

        getNetworkInfo: () => {
            return ipcRenderer.invoke(
                "get-network-info"
            );
        },

        runNetworkDiagnostics: () => {
            return ipcRenderer.invoke(
                "run-network-diagnostics"
            );
        },

        getActiveConnections: () => ipcRenderer.invoke("get-active-connections"),
        getConnectionAttempts: () => ipcRenderer.invoke("get-connection-attempts"),
        loadSecurityHistory: () => ipcRenderer.invoke("load-security-history"),
        saveSecurityHistory: (history) => ipcRenderer.invoke("save-security-history", history),
        exportIncidentReport: (report) => ipcRenderer.invoke("export-incident-report", report),
        blockIncidentIp: (incidentId, remoteAddress) => ipcRenderer.invoke("block-incident-ip", incidentId, remoteAddress),
        removeIncidentBlock: (incidentId, remoteAddress) => ipcRenderer.invoke("remove-incident-block", incidentId, remoteAddress),
        getIncidentBlockStatus: (incidentId, remoteAddress) => ipcRenderer.invoke("get-incident-block-status", incidentId, remoteAddress),
        getOperationsAccess: () => ipcRenderer.invoke("get-operations-access"),
        requestOperationsAccess: () => ipcRenderer.invoke("request-operations-access"),
        revokeOperationsAccess: () => ipcRenderer.invoke("revoke-operations-access"),
        runOperationsCommand: (shell, command) => ipcRenderer.invoke("run-operations-command", shell, command),
        stopOperationsCommand: () => ipcRenderer.invoke("stop-operations-command"),
        onOperationsCommandEvent: (callback) => ipcRenderer.on("operations-command-event", (_event, data) => callback(data)),

        getAppInfo: () => {
            return ipcRenderer.invoke(
                "get-app-info"
            );
        },

        checkForUpdates: () => {
            return ipcRenderer.invoke(
                "check-for-updates"
            );
        },

        downloadUpdate: () => {
            return ipcRenderer.invoke(
                "download-update"
            );
        },

        installUpdate: () => {
            ipcRenderer.send(
                "install-update"
            );
        },

        onUpdateStatus: (callback) => {

            ipcRenderer.on(
                "update-status",
                (_event, data) => {
                    callback(data);
                }
            );

        }

    }
);
