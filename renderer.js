// ======================================================
// CYBECK SECURITY SYSTEMS
// RENDERER
// ======================================================


// ======================================================
// PAGE NAVIGATION
// ======================================================

const navItems = document.querySelectorAll(".nav-item");
const pages = document.querySelectorAll(".page");
const pageTitle = document.getElementById("page-title");

function openPage(pageName) {

    pages.forEach((page) => {
        page.classList.remove("active-page");
    });

    navItems.forEach((item) => {
        item.classList.remove("active");
    });

    const targetPage =
        document.getElementById(pageName);

    if (targetPage) {
        targetPage.classList.add("active-page");
    }

    const targetNav =
        document.querySelector(
            `.nav-item[data-page="${pageName}"]`
        );

    if (targetNav) {
        targetNav.classList.add("active");
    }

    const titles = {
        dashboard: "Dashboard",
        operations: "Operations",
        vault: "Vault",
        notes: "Notes",
        tasks: "Tasks",
        network: "Network Monitor",
        settings: "Settings",
        about: "About"
    };

    if (pageTitle) {
        pageTitle.textContent =
            titles[pageName] || "Cybeck";
    }

    // Refresh immediately when Network Monitor opens.
    if (pageName === "network") {
        updateNetworkStatus();
    }
}


navItems.forEach((item) => {

    item.addEventListener("click", () => {

        const pageName =
            item.dataset.page;

        openPage(pageName);

    });

});


// ======================================================
// DASHBOARD QUICK ACTION NAVIGATION
// ======================================================

document
    .querySelectorAll(".action[data-page]")
    .forEach((button) => {

        button.addEventListener("click", () => {

            const pageName =
                button.dataset.page;

            openPage(pageName);

        });

    });


// ======================================================
// SESSION TIMER
// ======================================================

const sessionTime =
    document.getElementById("session-time");

const sessionStarted =
    Date.now();


function updateSessionTimer() {

    if (!sessionTime) {
        return;
    }

    const elapsed =
        Math.floor(
            (Date.now() - sessionStarted) / 1000
        );

    const hours =
        String(
            Math.floor(elapsed / 3600)
        ).padStart(2, "0");

    const minutes =
        String(
            Math.floor(
                (elapsed % 3600) / 60
            )
        ).padStart(2, "0");

    const seconds =
        String(
            elapsed % 60
        ).padStart(2, "0");

    sessionTime.textContent =
        `${hours}:${minutes}:${seconds}`;

}


updateSessionTimer();

setInterval(
    updateSessionTimer,
    1000
);


// ======================================================
// SYSTEM CHECK
// ======================================================

const systemCheckButton =
    document.getElementById("system-check");

const securityConsole =
    document.getElementById("console");


if (
    systemCheckButton &&
    securityConsole
) {

    systemCheckButton.addEventListener(
        "click",
        async () => {

            securityConsole.innerHTML = "";

            addConsoleLine(
                "[SCAN]",
                "Starting Cybeck system check..."
            );

            await delay(350);

            addConsoleLine(
                "[OK]",
                "Application environment responsive."
            );

            await delay(300);

            addConsoleLine(
                "[OK]",
                "Interface systems operational."
            );

            await delay(300);

            addConsoleLine(
                "[SCAN]",
                "Checking active network..."
            );

            try {

                const network =
                    await window.windowControls
                        .getNetworkInfo();

                if (network.connected) {

                    addConsoleLine(
                        "[OK]",
                        `Network connection detected: ${
                            network.ssid ||
                            network.adapter ||
                            "Active connection"
                        }`
                    );

                } else {

                    addConsoleLine(
                        "[WARN]",
                        "No active network connection detected."
                    );

                }

            } catch (error) {

                addConsoleLine(
                    "[WARN]",
                    "Network status could not be read."
                );

            }

            await delay(300);

            addConsoleLine(
                "[OK]",
                "Cybeck system check complete."
            );

        }
    );

}


function addConsoleLine(
    label,
    message
) {

    if (!securityConsole) {
        return;
    }

    const line =
        document.createElement("p");

    const marker =
        document.createElement("b");

    marker.textContent =
        label;

    line.appendChild(marker);

    line.appendChild(
        document.createTextNode(
            ` ${message}`
        )
    );

    securityConsole.appendChild(line);

}


function delay(milliseconds) {

    return new Promise(
        (resolve) =>
            setTimeout(
                resolve,
                milliseconds
            )
    );

}


// ======================================================
// WINDOW MODE CONTROL
// ======================================================

const windowModeButton =
    document.getElementById(
        "window-mode-btn"
    );


if (
    windowModeButton &&
    window.windowControls
) {

    windowModeButton.addEventListener(
        "click",
        () => {

            window.windowControls
                .fullscreen();

        }
    );

}

// ======================================================
// NETWORK LATENCY HISTORY
// ======================================================

const NETWORK_LATENCY_HISTORY_LIMIT = 60;

const networkLatencyHistory = [];


// ======================================================
// LIVE LATENCY GRAPH
// ======================================================

function ensureLatencyGraphPanel() {

    if (
        document.getElementById(
            "nm-latency-history-panel"
        )
    ) {
        return;
    }


    const healthPanel =
        document.querySelector(
            ".network-health-panel"
        );


    if (!healthPanel) {
        return;
    }


    const panel =
        document.createElement(
            "article"
        );


    panel.className =
        "network-panel network-latency-history-panel";


    panel.id =
        "nm-latency-history-panel";


    panel.innerHTML = `

        <div class="network-panel-heading">

            <span class="network-panel-icon">
                ϟ
            </span>

            <div>

                <h3>
                    Live Latency History
                </h3>

                <p>
                    Rolling internet response time
                </p>

            </div>

            <div class="latency-live-indicator">

                <span></span>

                LIVE

            </div>

        </div>


        <div class="latency-stat-grid">

            <div>

                <span>
                    CURRENT
                </span>

                <strong id="nm-history-current">
                    -- ms
                </strong>

            </div>


            <div>

                <span>
                    AVERAGE
                </span>

                <strong id="nm-history-average">
                    -- ms
                </strong>

            </div>


            <div>

                <span>
                    MINIMUM
                </span>

                <strong id="nm-history-minimum">
                    -- ms
                </strong>

            </div>


            <div>

                <span>
                    MAXIMUM
                </span>

                <strong id="nm-history-maximum">
                    -- ms
                </strong>

            </div>

        </div>


        <div class="latency-chart">

            <div class="latency-chart-scale">

                <span id="nm-chart-high">
                    100 ms
                </span>

                <span id="nm-chart-mid">
                    50 ms
                </span>

                <span>
                    0 ms
                </span>

            </div>


            <svg
                id="nm-latency-svg"
                viewBox="0 0 1000 220"
                preserveAspectRatio="none"
                aria-label="Live network latency graph"
            >

                <line
                    x1="0"
                    y1="55"
                    x2="1000"
                    y2="55"
                    class="latency-grid-line"
                ></line>

                <line
                    x1="0"
                    y1="110"
                    x2="1000"
                    y2="110"
                    class="latency-grid-line"
                ></line>

                <line
                    x1="0"
                    y1="165"
                    x2="1000"
                    y2="165"
                    class="latency-grid-line"
                ></line>


                <path
                    id="nm-latency-area"
                    class="latency-area"
                    d=""
                ></path>


                <path
                    id="nm-latency-line"
                    class="latency-line"
                    d=""
                ></path>

            </svg>


            <div
                class="latency-chart-empty"
                id="nm-latency-empty"
            >
                Collecting latency samples...
            </div>

        </div>


        <div class="latency-chart-footer">

            <span>
                OLDEST
            </span>

            <span id="nm-history-samples">
                0 / 60 SAMPLES
            </span>

            <span>
                NOW
            </span>

        </div>

    `;


    healthPanel.insertAdjacentElement(
        "afterend",
        panel
    );

}

function recordLatencySample(latency) {

    ensureLatencyGraphPanel();


    let sampleLatency = null;


    if (
        latency !== null &&
        latency !== undefined &&
        Number.isFinite(
            Number(latency)
        )
    ) {

        sampleLatency =
            Number(latency);

    }


    networkLatencyHistory.push({

        time: Date.now(),

        latency: sampleLatency

    });


    if (
        networkLatencyHistory.length >
        NETWORK_LATENCY_HISTORY_LIMIT
    ) {

        networkLatencyHistory.shift();

    }


    renderLatencyGraph();

}

function renderLatencyGraph() {

    const svgLine =
        document.getElementById(
            "nm-latency-line"
        );


    const svgArea =
        document.getElementById(
            "nm-latency-area"
        );


    const emptyMessage =
        document.getElementById(
            "nm-latency-empty"
        );


    if (
        !svgLine ||
        !svgArea
    ) {
        return;
    }


    const validSamples =
        networkLatencyHistory.filter(
            (sample) =>
                sample.latency !== null
        );


    setNetworkText(
        "nm-history-samples",
        `${networkLatencyHistory.length} / ${NETWORK_LATENCY_HISTORY_LIMIT} SAMPLES`
    );


    if (
        validSamples.length === 0
    ) {

        svgLine.setAttribute(
            "d",
            ""
        );


        svgArea.setAttribute(
            "d",
            ""
        );


        if (emptyMessage) {

            emptyMessage.hidden =
                false;

        }


        setNetworkText(
            "nm-history-current",
            "-- ms"
        );


        setNetworkText(
            "nm-history-average",
            "-- ms"
        );


        setNetworkText(
            "nm-history-minimum",
            "-- ms"
        );


        setNetworkText(
            "nm-history-maximum",
            "-- ms"
        );


        return;

    }


    if (emptyMessage) {

        emptyMessage.hidden =
            true;

    }


    const values =
        validSamples.map(
            (sample) =>
                sample.latency
        );


    const current =
        values[
            values.length - 1
        ];


    const minimum =
        Math.min(
            ...values
        );


    const maximum =
        Math.max(
            ...values
        );


    const average =
        Math.round(

            values.reduce(
                (total, value) =>
                    total + value,
                0
            )

            /

            values.length

        );


    setNetworkText(
        "nm-history-current",
        `${current} ms`
    );


    setNetworkText(
        "nm-history-average",
        `${average} ms`
    );


    setNetworkText(
        "nm-history-minimum",
        `${minimum} ms`
    );


    setNetworkText(
        "nm-history-maximum",
        `${maximum} ms`
    );


    // --------------------------------------------------
    // GRAPH SCALE
    // --------------------------------------------------

    let chartMaximum =
        Math.max(
            20,
            maximum + 10
        );


    chartMaximum =
        Math.ceil(
            chartMaximum / 10
        ) * 10;


    setNetworkText(
        "nm-chart-high",
        `${chartMaximum} ms`
    );


    setNetworkText(
        "nm-chart-mid",
        `${Math.round(
            chartMaximum / 2
        )} ms`
    );


    const width =
        1000;


    const height =
        220;


    const totalSlots =
        Math.max(
            NETWORK_LATENCY_HISTORY_LIMIT - 1,
            1
        );


    // --------------------------------------------------
    // BUILD SEPARATE PATH SEGMENTS
    // This creates a break if connectivity disappears.
    // --------------------------------------------------

    const segments = [];

    let currentSegment = [];


    networkLatencyHistory.forEach(
        (sample, index) => {

            if (
                sample.latency === null
            ) {

                if (
                    currentSegment.length > 0
                ) {

                    segments.push(
                        currentSegment
                    );

                    currentSegment = [];

                }

                return;

            }


            const x =

                (
                    index /
                    totalSlots
                )

                *

                width;


            const y =

                height -

                (
                    Math.min(
                        sample.latency,
                        chartMaximum
                    )

                    /

                    chartMaximum
                )

                *

                height;


            currentSegment.push({

                x,
                y

            });

        }
    );


    if (
        currentSegment.length > 0
    ) {

        segments.push(
            currentSegment
        );

    }


    // --------------------------------------------------
    // LINE PATH
    // --------------------------------------------------

    let linePath = "";


    segments.forEach(
        (segment) => {

            segment.forEach(
                (point, index) => {

                    linePath +=

                        index === 0

                            ? `M ${point.x} ${point.y} `

                            : `L ${point.x} ${point.y} `;

                }
            );

        }
    );


    svgLine.setAttribute(
        "d",
        linePath
    );


    // --------------------------------------------------
    // AREA FILL
    // Only use the latest continuous section.
    // --------------------------------------------------

    const latestSegment =
        segments[
            segments.length - 1
        ];


    if (
        latestSegment &&
        latestSegment.length > 1
    ) {

        let areaPath =

            `M ${latestSegment[0].x} ${height} `;


        latestSegment.forEach(
            (point) => {

                areaPath +=
                    `L ${point.x} ${point.y} `;

            }
        );


        const lastPoint =
            latestSegment[
                latestSegment.length - 1
            ];


        areaPath +=

            `L ${lastPoint.x} ${height} Z`;


        svgArea.setAttribute(
            "d",
            areaPath
        );

    }

    else {

        svgArea.setAttribute(
            "d",
            ""
        );

    }

}

// ======================================================
// LIVE NETWORK STATUS + NETWORK MONITOR
// ======================================================

let latestNetworkInfo = null;

let networkRefreshInProgress =
    false;


// ------------------------------------------------------
// SIGNAL QUALITY
// ------------------------------------------------------

function networkSignalQuality(
    strength
) {

    if (strength >= 80) {
        return "EXCELLENT";
    }

    if (strength >= 60) {
        return "STRONG";
    }

    if (strength >= 40) {
        return "FAIR";
    }

    if (strength > 0) {
        return "WEAK";
    }

    return "NO SIGNAL";

}


// ------------------------------------------------------
// LATENCY QUALITY
// ------------------------------------------------------

function networkLatencyQuality(
    latency
) {

    if (
        latency === null ||
        latency === undefined
    ) {

        return "UNAVAILABLE";

    }

    if (latency <= 30) {
        return "EXCELLENT";
    }

    if (latency <= 60) {
        return "GOOD";
    }

    if (latency <= 120) {
        return "FAIR";
    }

    return "HIGH";

}


// ------------------------------------------------------
// SAFE TEXT UPDATE
// ------------------------------------------------------

function setNetworkText(
    id,
    value
) {

    const element =
        document.getElementById(id);

    if (element) {
        element.textContent = value;
    }

}


// ------------------------------------------------------
// GAUGE VALUE
// ------------------------------------------------------

function setNetworkGauge(
    id,
    value
) {

    const element =
        document.getElementById(id);

    if (!element) {
        return;
    }

    const safeValue =
        Math.max(
            0,
            Math.min(
                100,
                Number(value) || 0
            )
        );

    element.style.setProperty(
        "--value",
        safeValue
    );

}


// ======================================================
// DASHBOARD NETWORK CARD
// ======================================================

function renderDashboardNetwork(
    network
) {

    const status =
        document.getElementById(
            "network-status"
        );

    const name =
        document.getElementById(
            "network-name"
        );

    const percent =
        document.getElementById(
            "network-percent"
        );

    const bars =
        document.querySelectorAll(
            "#signal-bars span"
        );


    if (
        !status ||
        !name ||
        !percent
    ) {

        return;

    }


    if (!network.connected) {

        status.textContent =
            "DISCONNECTED";

        name.textContent =
            "No active connection";

        percent.textContent =
            "0%";

        bars.forEach(
            (bar) =>
                bar.classList.remove(
                    "active"
                )
        );

        return;

    }


    const isWifi = network.connectionType === "Wi-Fi";
    const strength = isWifi ? Number(network.signal) || 0 : 100;


    status.textContent = isWifi
        ? networkSignalQuality(strength)
        : network.internet ? "CONNECTED" : "LOCAL ONLY";


    name.textContent =
        network.networkName ||
        network.ssid ||
        network.adapter ||
        "Connected";


    percent.textContent = isWifi ? `${strength}%` : network.linkSpeed || "LINK UP";
    setNetworkText("network-strength-label", isWifi ? "SIGNAL" : "LINK");
    const signalBars = document.getElementById("signal-bars");
    if (signalBars) signalBars.title = isWifi ? "Wi-Fi signal strength" : `${network.connectionType} link active`;


    let activeBars = 0;


    if (strength >= 80) {

        activeBars = 4;

    } else if (strength >= 60) {

        activeBars = 3;

    } else if (strength >= 40) {

        activeBars = 2;

    } else if (strength > 0) {

        activeBars = 1;

    }


    bars.forEach(
        (bar, index) => {

            bar.classList.toggle(
                "active",
                index < activeBars
            );

        }
    );

}


// ======================================================
// NETWORK MONITOR RENDERING
// ======================================================

function renderNetworkMonitor(
    network
) {

    const connected =
        Boolean(
            network.connected
        );

    const internet =
        Boolean(
            network.internet
        );

    const isWifi = network.connectionType === "Wi-Fi";
    const signal = isWifi ? Number(network.signal) || 0 : null;
    const linkValue = connected && !isWifi ? 100 : signal || 0;


    const latency =
        network.latency === null ||
        network.latency === undefined

            ? null

            : Number(
                network.latency
            );



    const signalQuality = isWifi ? networkSignalQuality(signal) : connected ? "LINK ACTIVE" : "LINK DOWN";


    const latencyQuality =
        networkLatencyQuality(
            latency
        );


    const connectionType =
        network.connectionType ||
        "Unknown";


    // --------------------------------------------------
    // LIVE MONITOR HEADER
    // --------------------------------------------------

    setNetworkText(
        "nm-live-state",
        connected
            ? "ACTIVE"
            : "OFFLINE"
    );


    setNetworkText(
    "nm-orb-status",

    internet
        ? "CONNECTED"
        : connected
            ? "INTERNET LOST"
            : "NO CONNECTION"
);


    setNetworkText(
        "nm-status",

        internet
            ? "ONLINE"
            : connected
                ? "LOCAL ONLY"
                : "OFFLINE"
    );


    setNetworkText(
    "nm-status-copy",

    internet

        ? `Your ${connectionType} connection is active and has internet access.`

        : connected

            ? "INTERNET CONNECTION LOST. Your local network is still connected, but Cybeck cannot reach the internet."

            : "NETWORK CONNECTION LOST. Cybeck cannot detect an active network connection."
);


    // --------------------------------------------------
    // TOP METRICS
    // --------------------------------------------------

    setNetworkText(
        "nm-connection-type",
        connectionType
    );


    setNetworkText(
        "nm-signal",
        isWifi ? `${signal}%` : connected ? "UP" : "DOWN"
    );

    setNetworkText("nm-signal-heading", isWifi ? "SIGNAL STRENGTH" : "LINK STATUS");


    setNetworkText(
        "nm-signal-label",
        signalQuality
    );


    setNetworkText(
        "nm-latency",

        latency === null
            ? "-- ms"
            : `${latency} ms`
    );


    setNetworkText(
        "nm-latency-label",
        latencyQuality
    );


    setNetworkText(
        "nm-internet",

        internet
            ? "ONLINE"
            : "OFFLINE"
    );


    setNetworkText(
        "nm-internet-label",

        internet
            ? "Reachable"
            : "Not reachable"
    );


    // --------------------------------------------------
    // SIGNAL TRACK
    // --------------------------------------------------

    setNetworkText(
        "nm-signal-track-value",
        isWifi ? `${signal}%` : network.linkSpeed || "UP"
    );


    const signalFill =
        document.getElementById(
            "nm-signal-fill"
        );


    if (signalFill) {

        signalFill.style.width =
            `${Math.max(
                0,
                Math.min(
                    100,
                    linkValue
                )
            )}%`;

    }

    const signalCaption = document.getElementById("nm-signal-caption");
    if (signalCaption) signalCaption.hidden = !isWifi;


    // --------------------------------------------------
    // CONNECTION DETAILS
    // --------------------------------------------------

    setNetworkText(
        "nm-ssid",
        network.networkName || network.ssid ||
        "Unavailable"
    );

    setNetworkText("nm-network-name-label", isWifi ? "SSID" : "Network Profile");


    setNetworkText(
        "nm-type-detail",
        connectionType
    );


    setNetworkText(
        "nm-signal-detail",
        isWifi ? `${signal}%` : network.linkSpeed || (connected ? "Up" : "Down")
    );

    setNetworkText("nm-signal-detail-label", isWifi ? "Signal Strength" : "Link Speed");


    setNetworkText(
        "nm-internet-detail",

        internet
            ? "Connected"
            : "Unavailable"
    );


    setNetworkText(
        "nm-latency-detail",

        latency === null
            ? "Unavailable"
            : `${latency} ms`
    );


    setNetworkText(
        "nm-quality",
        signalQuality
    );


    // --------------------------------------------------
    // NETWORK IDENTITY
    // --------------------------------------------------

    setNetworkText(
        "nm-ipv4",
        network.ipv4 ||
        "Unavailable"
    );


    setNetworkText(
        "nm-gateway",
        network.gateway ||
        "Unavailable"
    );


    setNetworkText(
        "nm-dns",
        network.dns ||
        "Unavailable"
    );


    setNetworkText(
        "nm-route",

        internet

            ? "Internet reachable via 1.1.1.1"

            : "Route not confirmed"
    );


    // --------------------------------------------------
    // ADAPTER
    // --------------------------------------------------

    setNetworkText(
        "nm-adapter",
        network.adapter ||
        "Unavailable"
    );


    setNetworkText(
        "nm-interface-description",

        network.interfaceDescription ||
        "Unavailable"
    );


    setNetworkText(
        "nm-mac",
        network.mac ||
        "Unavailable"
    );


    setNetworkText(
        "nm-link-speed",

        network.linkSpeed ||
        "Unavailable"
    );


    setNetworkText(
        "nm-adapter-status",

        connected
            ? "Up"
            : "Down"
    );


    // --------------------------------------------------
    // SIGNAL GAUGE
    // --------------------------------------------------

    setNetworkGauge(
        "nm-signal-gauge",
        linkValue
    );


    setNetworkText(
        "nm-signal-gauge-value",
        isWifi ? `${signal}%` : connected ? "UP" : "DOWN"
    );

    setNetworkText("nm-signal-gauge-heading", isWifi ? "SIGNAL" : "LINK");


    setNetworkText(
        "nm-signal-gauge-label",
        signalQuality
    );


    // --------------------------------------------------
    // LATENCY GAUGE
    // --------------------------------------------------

    const latencyGaugeValue =

        latency === null

            ? 0

            : Math.max(
                0,
                100 -
                Math.min(
                    latency,
                    100
                )
            );


    setNetworkGauge(
        "nm-latency-gauge",
        latencyGaugeValue
    );


    setNetworkText(
        "nm-latency-gauge-value",

        latency === null
            ? "--"
            : `${latency} ms`
    );


    setNetworkText(
        "nm-latency-gauge-label",
        latencyQuality
    );


    // --------------------------------------------------
    // INTERNET REACHABILITY GAUGE
    // --------------------------------------------------

    setNetworkGauge(
        "nm-stability-gauge",

        internet
            ? 100
            : 0
    );


    setNetworkText(
        "nm-stability-gauge-value",

        internet
            ? "100%"
            : "0%"
    );


    setNetworkText(
        "nm-stability-gauge-label",

        internet
            ? "Reachable"
            : "Offline"
    );


    // --------------------------------------------------
    // CONNECTION HEALTH SUMMARY
    // --------------------------------------------------

    const summary =
        document.getElementById(
            "nm-health-summary"
        );


    if (summary) {

        const title =
            summary.querySelector(
                "strong"
            );

        const copy =
            summary.querySelector(
                "small"
            );


        if (
            internet &&
            (!isWifi || signal >= 60) &&
            (
                latency === null ||
                latency <= 80
            )
        ) {

            if (title) {

                title.textContent =
                    "All Systems Healthy";

            }


            if (copy) {

                copy.textContent =
                    "Your network connection is performing well. No immediate issues detected.";

            }

        } else if (connected) {

            if (title) {

                title.textContent =
                    "Connection Requires Attention";

            }


            if (copy) {

                copy.textContent =
                    "Cybeck detected a weaker signal, higher latency, or unavailable internet route.";

            }

        } else {

            if (title) {

                title.textContent =
                    "Network Offline";

            }


            if (copy) {

                copy.textContent =
                    "No active network connection is currently available.";

            }

        }

    }


    // --------------------------------------------------
    // LAST UPDATED
    // --------------------------------------------------

    const timestamp =
        new Date()
            .toLocaleTimeString();


    setNetworkText(
        "nm-last-updated",
        timestamp
    );


    // --------------------------------------------------
    // LIVE INDICATOR
    // --------------------------------------------------

    const liveDot =
        document.querySelector(
            ".network-live-dot"
        );


    if (liveDot) {

        liveDot.classList.toggle(
            "offline",
            !connected
        );

    }


    // --------------------------------------------------
// HERO CONNECTION STATE
// --------------------------------------------------

const heroPanel =
    document.querySelector(
        ".network-hero-panel"
    );


if (heroPanel) {

    // Remove old state classes before applying
    // the current connection state.

    heroPanel.classList.remove(
        "network-offline",
        "network-internet-lost",
        "network-disconnected"
    );

// --------------------------------------------------
// CONNECTION RESTORED DETECTION
// --------------------------------------------------

if (
    previousInternetState === false &&
    internet === true
) {

    if (heroPanel) {

        heroPanel.classList.remove(
            "network-offline",
            "network-internet-lost",
            "network-disconnected"
        );


        heroPanel.classList.add(
            "network-restored"
        );

    }


    setNetworkText(
        "nm-orb-status",
        "RESTORED"
    );


    setNetworkText(
        "nm-status",
        "CONNECTION RESTORED"
    );


    setNetworkText(
        "nm-status-copy",
        "Internet access has been restored. Cybeck is back online."
    );


    if (networkRestoreTimer) {

        clearTimeout(
            networkRestoreTimer
        );

    }


    networkRestoreTimer =
        setTimeout(
            () => {

                if (heroPanel) {

                    heroPanel.classList.remove(
                        "network-restored"
                    );

                }


                setNetworkText(
                    "nm-orb-status",
                    "CONNECTED"
                );


                setNetworkText(
                    "nm-status",
                    "ONLINE"
                );


                setNetworkText(
                    "nm-status-copy",
                    `Your ${connectionType} connection is active and has internet access.`
                );

            },
            5000
        );

}


// Remember the state for the next network scan.

previousInternetState =
    internet;


    // --------------------------------------------------
    // FULL NETWORK DISCONNECT
    // --------------------------------------------------

    if (!connected) {

        heroPanel.classList.add(
            "network-offline",
            "network-internet-lost",
            "network-disconnected"
        );

    }


    // --------------------------------------------------
    // LOCAL NETWORK CONNECTED / INTERNET LOST
    // --------------------------------------------------

    else if (!internet) {

        heroPanel.classList.add(
            "network-internet-lost"
        );

    }

}


// --------------------------------------------------
// LATENCY HISTORY
// --------------------------------------------------

try {

    recordLatencySample(
        latency
    );

} catch (error) {

    console.error(
        "[CYBECK] Latency graph error:",
        error
    );

}

// --------------------------------------------------
// NETWORK SECURITY MONITOR
// --------------------------------------------------

try {

    updateNetworkSecurityMonitor(
        network
    );

    updateSessionStatistics(network);

} catch (error) {

    console.error(
        "[CYBECK] Security monitor update failed:",
        error
    );

}

}


// ======================================================
// FETCH NETWORK INFORMATION
// ======================================================

async function updateNetworkStatus() {

    if (networkRefreshInProgress) {
        return;
    }


    if (
        !window.windowControls ||
        !window.windowControls.getNetworkInfo
    ) {

        console.error(
            "Cybeck network bridge unavailable."
        );

        return;

    }


    networkRefreshInProgress = true;


    try {

        const network =
            await window.windowControls
                .getNetworkInfo();


        latestNetworkInfo =
            network;


        renderDashboardNetwork(
            network
        );


        renderNetworkMonitor(
            network
        );

    }

    catch (error) {

        console.error(
            "Network detection failed:",
            error
        );


        const fallback = {

            connected: false,

            internet: false,

            ssid:
                "Unavailable",

            signal: 0,

            latency: null,

            connectionType:
                "Unknown",

            ipv4:
                "Unavailable",

            gateway:
                "Unavailable",

            dns:
                "Unavailable",

            adapter:
                "Unavailable",

            interfaceDescription:
                "Unavailable",

            mac:
                "Unavailable",

            linkSpeed:
                "Unavailable"

        };


        latestNetworkInfo =
            fallback;


        renderDashboardNetwork(
            fallback
        );


        renderNetworkMonitor(
            fallback
        );

    }

    finally {

        networkRefreshInProgress =
            false;

    }

}


// ======================================================
// NETWORK DIAGNOSTICS SUMMARY
// ======================================================

function showNetworkDiagnostics() {

    const consolePanel =
        document.getElementById(
            "nm-diagnostic-console"
        );


    const output =
        document.getElementById(
            "nm-diagnostic-output"
        );


    if (
        !consolePanel ||
        !output
    ) {

        return;

    }


    const network =
        latestNetworkInfo;


    consolePanel.hidden =
        false;


    if (!network) {

        output.innerHTML =
            "<p><b>[WAIT]</b> Network data has not been collected yet.</p>";

        return;

    }


    const latencyText =

        network.latency === null ||
        network.latency === undefined

            ? "Unavailable"

            : `${network.latency} ms`;


    const lines = [

        [
            "[STATUS]",

            network.connected

                ? "Active network connection detected."

                : "No active network connection detected."
        ],

        [
            "[TYPE]",

            `Connection type: ${
                network.connectionType ||
                "Unknown"
            }`
        ],

        ["[NETWORK]", `Network: ${network.networkName || network.ssid || "Unavailable"}`],

        [
            network.connectionType === "Wi-Fi" ? "[SIGNAL]" : "[LINK]",
            network.connectionType === "Wi-Fi"
                ? `Signal strength: ${Number(network.signal) || 0}% (${networkSignalQuality(Number(network.signal) || 0)})`
                : `Link state: ${network.linkState || (network.connected ? "Up" : "Down")} · ${network.linkSpeed || "speed unavailable"}`
        ],

        [
            "[IP]",

            `IPv4 address: ${
                network.ipv4 ||
                "Unavailable"
            }`
        ],

        [
            "[GATEWAY]",

            `Default gateway: ${
                network.gateway ||
                "Unavailable"
            }`
        ],

        [
            "[DNS]",

            `DNS servers: ${
                network.dns ||
                "Unavailable"
            }`
        ],

        [
            "[ADAPTER]",

            `Adapter: ${
                network.adapter ||
                "Unavailable"
            }`
        ],

        [
            "[LINK]",

            `Link speed: ${
                network.linkSpeed ||
                "Unavailable"
            }`
        ],

        [
            "[PING]",

            `1.1.1.1 latency: ${
                latencyText
            }`
        ],

        [
            "[INTERNET]",

            network.internet

                ? "Internet reachability confirmed."

                : "Internet reachability was not confirmed."
        ]

    ];


    output.innerHTML = "";


    lines.forEach(
        ([label, text]) => {

            const paragraph =
                document.createElement(
                    "p"
                );


            const marker =
                document.createElement(
                    "b"
                );


            marker.textContent =
                label;


            paragraph.appendChild(
                marker
            );


            paragraph.appendChild(
                document.createTextNode(
                    ` ${text}`
                )
            );


            output.appendChild(
                paragraph
            );

        }
    );


    consolePanel.scrollIntoView({

        behavior: "smooth",

        block: "nearest"

    });

}

// ======================================================
// ADVANCED NETWORK DIAGNOSTICS V1.1
// ======================================================

async function runAdvancedNetworkDiagnostics() {

    const consolePanel =
        document.getElementById(
            "nm-diagnostic-console"
        );

    const output =
        document.getElementById(
            "nm-diagnostic-output"
        );


    if (!consolePanel || !output) {
        return;
    }


    consolePanel.hidden = false;

    output.innerHTML = "";


    // --------------------------------------------------
    // START MESSAGE
    // --------------------------------------------------

    const startLine =
        document.createElement("p");

    startLine.innerHTML =
        "<b>[SCAN]</b> Running Cybeck advanced network diagnostics...";

    output.appendChild(startLine);


    // --------------------------------------------------
    // CHECK IPC CONNECTION
    // --------------------------------------------------

    if (
        !window.windowControls ||
        !window.windowControls.runNetworkDiagnostics
    ) {

        const errorLine =
            document.createElement("p");

        errorLine.innerHTML =
            "<b>[ERROR]</b> Diagnostic backend is unavailable.";

        output.appendChild(errorLine);

        return;
    }


    try {

        const result =
            await window.windowControls
                .runNetworkDiagnostics();


        output.innerHTML = "";


        // ==================================================
        // HELPER
        // ==================================================

        function addDiagnosticLine(
            label,
            message
        ) {

            const line =
                document.createElement("p");

            const marker =
                document.createElement("b");

            marker.textContent =
                label;


            line.appendChild(marker);

            line.appendChild(
                document.createTextNode(
                    ` ${message}`
                )
            );

            output.appendChild(line);

        }


        // ==================================================
        // GATEWAY
        // ==================================================

        if (result.gateway.address) {

            addDiagnosticLine(
                "[OK]",
                `Default gateway detected: ${result.gateway.address}`
            );

        } else {

            addDiagnosticLine(
                "[WARN]",
                "Default gateway could not be detected."
            );

        }


        if (result.gateway.reachable) {

            addDiagnosticLine(
                "[OK]",
                `Gateway reachable${
                    result.gateway.latency !== null
                        ? ` — ${result.gateway.latency} ms`
                        : ""
                }`
            );

        } else {

            addDiagnosticLine(
                "[WARN]",
                "Gateway did not respond to the test."
            );

        }


        // ==================================================
        // INTERNET
        // ==================================================

        if (result.internet.reachable) {

            addDiagnosticLine(
                "[OK]",
                "Internet connection reachable."
            );

        } else {

            addDiagnosticLine(
                "[WARN]",
                "Internet connection could not be confirmed."
            );

        }


        // ==================================================
        // DNS
        // ==================================================

        if (result.dns.working) {

            addDiagnosticLine(
                "[OK]",
                `DNS resolution successful — ${result.dns.resolvedAddress}`
            );

        } else {

            addDiagnosticLine(
                "[WARN]",
                "DNS resolution test failed."
            );

        }


        // ==================================================
        // LATENCY
        // ==================================================

        if (
            result.internet.averageLatency !== null
        ) {

            addDiagnosticLine(
                "[LATENCY]",
                `Average: ${result.internet.averageLatency} ms`
            );


            addDiagnosticLine(
                "[RANGE]",
                `Minimum: ${result.internet.minimumLatency} ms / Maximum: ${result.internet.maximumLatency} ms`
            );

        } else {

            addDiagnosticLine(
                "[LATENCY]",
                "Latency information unavailable."
            );

        }


        // ==================================================
        // PACKET LOSS
        // ==================================================

        addDiagnosticLine(
            "[LOSS]",
            `Packet loss: ${result.internet.packetLoss}%`
        );


        // ==================================================
        // HEALTH SCORE
        // ==================================================

        let healthScore = 100;


        if (!result.gateway.reachable) {
            healthScore -= 25;
        }


        if (!result.internet.reachable) {
            healthScore -= 40;
        }


        if (!result.dns.working) {
            healthScore -= 20;
        }


        if (
            result.internet.packetLoss >= 25
        ) {

            healthScore -= 20;

        } else if (
            result.internet.packetLoss > 0
        ) {

            healthScore -= 10;

        }


        if (
            result.internet.averageLatency !== null
        ) {

            if (
                result.internet.averageLatency > 150
            ) {

                healthScore -= 20;

            } else if (
                result.internet.averageLatency > 80
            ) {

                healthScore -= 10;

            }

        }


        healthScore =
            Math.max(
                0,
                Math.min(
                    100,
                    healthScore
                )
            );


        let healthLabel;


        if (healthScore >= 90) {

            healthLabel =
                "EXCELLENT";

        } else if (healthScore >= 75) {

            healthLabel =
                "GOOD";

        } else if (healthScore >= 55) {

            healthLabel =
                "FAIR";

        } else {

            healthLabel =
                "POOR";

        }


        addDiagnosticLine(
            "[RESULT]",
            `NETWORK HEALTH: ${healthLabel} (${healthScore}%)`
        );


        console.log(
            "[CYBECK] Advanced diagnostics:",
            result
        );

    }

    catch (error) {

        console.error(
            "[CYBECK] Diagnostics failed:",
            error
        );


        output.innerHTML = "";


        const errorLine =
            document.createElement("p");

        errorLine.innerHTML =
            "<b>[ERROR]</b> Cybeck was unable to complete the diagnostic scan.";

        output.appendChild(errorLine);

    }


    consolePanel.scrollIntoView({

        behavior: "smooth",

        block: "nearest"

    });

}


// ======================================================
// GATEWAY INFORMATION
// ======================================================

function verifyGatewayLocally() {

    if (
        !latestNetworkInfo ||
        !latestNetworkInfo.connected
    ) {

        showNetworkDiagnostics();

        return;

    }


    const consolePanel =
        document.getElementById(
            "nm-diagnostic-console"
        );


    const output =
        document.getElementById(
            "nm-diagnostic-output"
        );


    if (
        !consolePanel ||
        !output
    ) {

        return;

    }


    consolePanel.hidden =
        false;


    output.innerHTML =
        "";


    const rows = [

        [
            "[GATEWAY]",

            latestNetworkInfo.gateway &&
            latestNetworkInfo.gateway !==
                "Unavailable"

                ? `Active default gateway detected: ${
                    latestNetworkInfo.gateway
                }`

                : "No default gateway was reported."
        ],

        [
            "[ROUTE]",

            latestNetworkInfo.internet

                ? "Internet route is reachable through the active network configuration."

                : "Internet reachability is currently unavailable."
        ],

        [
            "[NOTE]",

            "This view verifies the gateway reported by Windows; it does not send a separate gateway ping."
        ]

    ];


    rows.forEach(
        ([label, text]) => {

            const paragraph =
                document.createElement(
                    "p"
                );


            const marker =
                document.createElement(
                    "b"
                );


            marker.textContent =
                label;


            paragraph.appendChild(
                marker
            );


            paragraph.appendChild(
                document.createTextNode(
                    ` ${text}`
                )
            );


            output.appendChild(
                paragraph
            );

        }
    );

}

// ======================================================
// NETWORK SECURITY MONITOR ENGINE
// PHASE 1B
// ======================================================

function formatSecurityDuration(milliseconds) {

    const totalSeconds =
        Math.max(
            0,
            Math.round(milliseconds / 1000)
        );


    if (totalSeconds < 60) {
        return `${totalSeconds}s`;
    }


    const minutes =
        Math.floor(totalSeconds / 60);


    const seconds =
        totalSeconds % 60;


    return seconds > 0
        ? `${minutes}m ${seconds}s`
        : `${minutes}m`;

}


function addSecurityEvent(
    type,
    message,
    severity = "info",
    eventKey = null,
    cooldownMs = SECURITY_EVENT_DEFAULT_COOLDOWN
) {

    const now =
        Date.now();


    const dedupeKey =
        eventKey ||
        `${type}:${message}`;


    const lastSeen =
        securityEventLastSeen.get(
            dedupeKey
        );


    if (
        lastSeen !== undefined &&
        (
            now - lastSeen
        ) < cooldownMs
    ) {

        return false;

    }


    securityEventLastSeen.set(
        dedupeKey,
        now
    );


    const event = {
        time: new Date(now),
        type,
        message,
        severity,
        key: dedupeKey
    };


    securityEvents.unshift(
        event
    );


    if (
        securityEvents.length >
        SECURITY_EVENT_LIMIT
    ) {

        securityEvents.length =
            SECURITY_EVENT_LIMIT;

    }


    renderSecurityEventTimeline();

    sessionStatistics.eventCount += 1;
    if (type === "RESOLVED") {
        sessionStatistics.resolvedAlerts += 1;
    }
    renderSessionStatistics();

    document.dispatchEvent(new CustomEvent("cybeck-security-event", { detail: {
        time: event.time.toISOString(), type: event.type, message: event.message,
        severity: event.severity, key: event.key
    } }));

    return true;

}


function renderSecurityEventTimeline() {

    const timeline =
        document.getElementById(
            "security-event-timeline"
        );


    if (!timeline) {
        return;
    }


    timeline.innerHTML = "";


    const visibleEvents = securityEvents.filter(
        (event) => securityEventFilter === "ALL" || event.type === securityEventFilter
    );

    if (visibleEvents.length === 0) {

        timeline.innerHTML = `
            <div class="security-empty-events">

                <span>◇</span>

                <strong>
                    Monitoring Network
                </strong>

                <small>
                    ${securityEventFilter === "ALL"
                        ? "Security events will appear here when Cybeck detects a network state change."
                        : `No ${securityEventFilter.toLowerCase()} events in the recent history.`}
                </small>

            </div>
        `;

        return;

    }


    visibleEvents.forEach(
        (event) => {

            const row =
                document.createElement(
                    "div"
                );


            row.className =
                `security-event ${event.severity}`;


            const time =
                document.createElement(
                    "span"
                );


            time.className =
                "security-event-time";


            time.textContent =
                event.time
                    .toLocaleTimeString();


            const type =
                document.createElement(
                    "span"
                );


            type.className =
                "security-event-type";


            type.textContent =
                event.type;


            const message =
                document.createElement(
                    "span"
                );


            message.className =
                "security-event-message";


            message.textContent =
                event.message;


            row.appendChild(
                time
            );


            row.appendChild(
                type
            );


            row.appendChild(
                message
            );


            timeline.appendChild(
                row
            );

        }
    );

}


function setSecurityCondition(
    condition,
    active
) {

    if (active) {

        activeSecurityConditions.add(
            condition
        );

    } else {

        activeSecurityConditions.delete(
            condition
        );

    }

}


function updateNetworkSecurityMonitor(
    network
) {

    try {

        const now =
            Date.now();


        const connected =
            Boolean(
                network.connected
            );


        const internet =
            Boolean(
                network.internet
            );


        const signal =
            Number(
                network.signal
            ) || 0;

        const isWifi = network.connectionType === "Wi-Fi";


        const ssid =
            network.networkName ||
            network.ssid ||
            "Unavailable";


        const gateway =
            network.gateway ||
            "Unavailable";


        const timestamp =
            new Date(now)
                .toLocaleTimeString();


        // ----------------------------------------------
        // LIVE ANALYSIS VALUES
        // ----------------------------------------------

        setNetworkText(
            "security-last-analysis",
            timestamp
        );


        setNetworkText(
            "security-internet-state",

            internet
                ? "ONLINE"
                : "OFFLINE"
        );


        setNetworkText(
            "security-network-state",

            connected
                ? "CONNECTED"
                : "DISCONNECTED"
        );


        let signalState =
            "UNAVAILABLE";


        if (connected && isWifi) {

            if (signal >= 70) {

                signalState =
                    `GOOD · ${signal}%`;

            }

            else if (signal >= 40) {

                signalState =
                    `FAIR · ${signal}%`;

            }

            else {

                signalState =
                    `WEAK · ${signal}%`;

            }

        }
        else if (connected) {
            signalState = `${network.connectionType || "NETWORK"} · ${network.linkSpeed || "LINK UP"}`.toUpperCase();
        }


        setNetworkText(
            "security-signal-state",
            signalState
        );


        const gatewayAvailable =
            gateway !== "Unavailable" &&
            gateway !== "";


        setNetworkText(
            "security-gateway-state",

            gatewayAvailable
                ? "AVAILABLE"
                : "UNAVAILABLE"
        );


        // ----------------------------------------------
        // FIRST SECURITY SCAN
        // ----------------------------------------------

        if (
            previousSecurityNetworkState === null
        ) {

            addSecurityEvent(
                "INFO",
                "Network security monitoring started.",
                "info",
                "monitor-started",
                60000
            );


            if (connected) {

                addSecurityEvent(
                    "NETWORK",
                    `Connected to ${ssid}.`,
                    "info",
                    `initial-network:${ssid}`,
                    60000
                );

            }


            if (internet) {

                addSecurityEvent(
                    "NETWORK",
                    "Internet connectivity confirmed.",
                    "info",
                    "initial-internet-online",
                    60000
                );

            }


            setSecurityCondition(
                "network-offline",
                !connected
            );


            setSecurityCondition(
                "internet-offline",
                connected && !internet
            );


            setSecurityCondition(
                "weak-signal",
                connected && isWifi && signal < SECURITY_SIGNAL_WEAK_THRESHOLD
            );


            if (!connected) {

                securityOutageState.networkStartedAt =
                    now;

            }


            if (connected && !internet) {

                securityOutageState.internetStartedAt =
                    now;

            }


            if (
                connected && isWifi &&
                signal < SECURITY_SIGNAL_WEAK_THRESHOLD
            ) {

                securityOutageState.weakSignalStartedAt =
                    now;

            }


            previousSecurityNetworkState = {

                connected,
                internet,
                signal,
                ssid,
                gateway,
                connectionType: network.connectionType || "Unknown"

            };


            updateSecurityRiskDisplay(
                network
            );


            return;

        }


        const previous =
            previousSecurityNetworkState;


        // ----------------------------------------------
        // NETWORK LOST
        // ----------------------------------------------

        if (
            previous.connected === true &&
            connected === false
        ) {

            securityOutageState.networkStartedAt =
                now;


            setSecurityCondition(
                "network-offline",
                true
            );


            setSecurityCondition(
                "internet-offline",
                false
            );


            addSecurityEvent(
                "ALERT",
                "Network connection lost.",
                "danger",
                "network-lost",
                SECURITY_EVENT_STATE_COOLDOWN
            );

        }


        // ----------------------------------------------
        // NETWORK RESTORED
        // ----------------------------------------------

        if (
            previous.connected === false &&
            connected === true
        ) {

            const outageDuration =
                securityOutageState.networkStartedAt
                    ? now - securityOutageState.networkStartedAt
                    : null;


            setSecurityCondition(
                "network-offline",
                false
            );


            addSecurityEvent(
                "NETWORK",
                `Network connection restored${ssid !== "Unavailable" ? ` — ${ssid}` : ""}.`,
                "info",
                "network-restored",
                SECURITY_EVENT_STATE_COOLDOWN
            );


            if (outageDuration !== null) {

                addSecurityEvent(
                    "RESOLVED",
                    `Network outage cleared after ${formatSecurityDuration(outageDuration)}.`,
                    "info",
                    `network-outage-resolved:${securityOutageState.networkStartedAt}`,
                    0
                );

            }


            securityOutageState.networkStartedAt =
                null;

        }


        // ----------------------------------------------
        // INTERNET LOST WHILE LOCAL NETWORK REMAINS UP
        // ----------------------------------------------

        if (
            (previous.internet === true || previous.connected === false) &&
            internet === false &&
            connected === true
        ) {

            securityOutageState.internetStartedAt =
                now;


            setSecurityCondition(
                "internet-offline",
                true
            );


            addSecurityEvent(
                "WARNING",
                "Internet access lost. Local network remains connected.",
                "warning",
                "internet-lost",
                SECURITY_EVENT_STATE_COOLDOWN
            );

        }


        // ----------------------------------------------
        // INTERNET RESTORED
        // ----------------------------------------------

        if (
            previous.internet === false &&
            internet === true
        ) {

            const internetDuration =
                securityOutageState.internetStartedAt
                    ? now - securityOutageState.internetStartedAt
                    : null;


            setSecurityCondition(
                "internet-offline",
                false
            );


            addSecurityEvent(
                "NETWORK",
                "Internet connectivity restored.",
                "info",
                "internet-restored",
                SECURITY_EVENT_STATE_COOLDOWN
            );


            if (internetDuration !== null) {

                addSecurityEvent(
                    "RESOLVED",
                    `Internet outage cleared after ${formatSecurityDuration(internetDuration)}.`,
                    "info",
                    `internet-outage-resolved:${securityOutageState.internetStartedAt}`,
                    0
                );

            }


            securityOutageState.internetStartedAt =
                null;

        }


        // If a full network outage occurs, do not keep a separate
        // local-only internet alert active at the same time.
        if (!connected) {

            setSecurityCondition(
                "internet-offline",
                false
            );


            securityOutageState.internetStartedAt =
                null;

        }


        // ----------------------------------------------
        // ACTIVE NETWORK CHANGED
        // ----------------------------------------------

        if (
            connected &&
            previous.connected &&
            (previous.ssid !== ssid || previous.connectionType !== network.connectionType) &&
            previous.ssid !== "Unavailable" && ssid !== "Unavailable"
        ) {

            addSecurityEvent(
                "NETWORK",
                `Active network changed from ${previous.connectionType || "network"} (${previous.ssid}) to ${network.connectionType || "network"} (${ssid}).`,
                "warning",
                `ssid-change:${previous.ssid}->${ssid}`,
                SECURITY_EVENT_CHANGE_COOLDOWN
            );

        }


        // ----------------------------------------------
        // DEFAULT GATEWAY CHANGED
        // ----------------------------------------------

        if (
            connected &&
            previous.gateway !== gateway &&
            previous.gateway !== "Unavailable" &&
            gateway !== "Unavailable"
        ) {

            addSecurityEvent(
                "NETWORK",
                `Default gateway changed from ${previous.gateway} to ${gateway}.`,
                "warning",
                `gateway-change:${previous.gateway}->${gateway}`,
                SECURITY_EVENT_CHANGE_COOLDOWN
            );

        }


        // ----------------------------------------------
        // WEAK SIGNAL ENTERED
        // Uses hysteresis so 39% / 40% fluctuations do not spam.
        // ----------------------------------------------

        if (
            connected && isWifi &&
            signal < SECURITY_SIGNAL_WEAK_THRESHOLD &&
            !activeSecurityConditions.has("weak-signal")
        ) {

            securityOutageState.weakSignalStartedAt =
                now;


            setSecurityCondition(
                "weak-signal",
                true
            );


            addSecurityEvent(
                "WARNING",
                `Weak Wi-Fi signal detected at ${signal}%.`,
                "warning",
                "weak-signal-entered",
                SECURITY_EVENT_SIGNAL_COOLDOWN
            );

        }


        // ----------------------------------------------
        // WEAK SIGNAL RECOVERED
        // Recovery threshold is intentionally higher than entry.
        // ----------------------------------------------

        if (
            connected && isWifi &&
            signal >= SECURITY_SIGNAL_RECOVERY_THRESHOLD &&
            activeSecurityConditions.has("weak-signal")
        ) {

            const weakSignalDuration =
                securityOutageState.weakSignalStartedAt
                    ? now - securityOutageState.weakSignalStartedAt
                    : null;


            setSecurityCondition(
                "weak-signal",
                false
            );


            addSecurityEvent(
                "RESOLVED",
                weakSignalDuration !== null
                    ? `Wi-Fi signal recovered to ${signal}% after ${formatSecurityDuration(weakSignalDuration)}.`
                    : `Wi-Fi signal recovered to ${signal}%.`,
                "info",
                "weak-signal-resolved",
                SECURITY_EVENT_SIGNAL_COOLDOWN
            );


            securityOutageState.weakSignalStartedAt =
                null;

        }


        if (!connected || !isWifi) {

            setSecurityCondition(
                "weak-signal",
                false
            );


            securityOutageState.weakSignalStartedAt =
                null;

        }


        previousSecurityNetworkState = {

            connected,
            internet,
            signal,
            ssid,
            gateway,
            connectionType: network.connectionType || "Unknown"

        };


        updateSecurityRiskDisplay(
            network
        );

    }

    catch (error) {

        console.error(
            "[CYBECK] Security monitor error:",
            error
        );

    }

}


function updateSecurityRiskDisplay(
    network
) {

    const connected =
        Boolean(
            network.connected
        );


    const internet =
        Boolean(
            network.internet
        );


    const signal =
        Number(
            network.signal
        ) || 0;


    let risk =
        "LOW";


    let description =
        "No unusual activity detected";


    let riskClass =
        "security-risk-low";


    let anomalyTitle =
        "No Anomalies Detected";


    let anomalyDescription =
        "Cybeck has not detected unusual network behaviour during this session.";


    let anomalyIcon =
        "✓";


    if (!connected) {

        risk =
            "HIGH";


        description =
            "Network connection unavailable";


        riskClass =
            "security-risk-high";


        anomalyTitle =
            "Network Connection Lost";


        anomalyDescription =
            securityOutageState.networkStartedAt
                ? `Network connectivity has been unavailable for ${formatSecurityDuration(Date.now() - securityOutageState.networkStartedAt)}.`
                : "Cybeck cannot detect an active network connection.";


        anomalyIcon =
            "!";

    }

    else if (!internet) {

        risk =
            "MEDIUM";


        description =
            "Internet access unavailable";


        riskClass =
            "security-risk-medium";


        anomalyTitle =
            "Internet Connectivity Lost";


        anomalyDescription =
            securityOutageState.internetStartedAt
                ? `The local network remains connected, but internet access has been unavailable for ${formatSecurityDuration(Date.now() - securityOutageState.internetStartedAt)}.`
                : "The local network is connected, but internet access cannot currently be confirmed.";


        anomalyIcon =
            "!";

    }

    else if (activeSecurityConditions.has("dns-failures")) {

        risk = "MEDIUM";
        description = "Repeated DNS lookup failures";
        riskClass = "security-risk-medium";
        anomalyTitle = "DNS Resolution Degraded";
        anomalyDescription = "The configured DNS resolver has failed three consecutive checks while internet reachability was reported.";
        anomalyIcon = "!";

    }

    else if (
        network.connectionType === "Wi-Fi" && signal < SECURITY_SIGNAL_WEAK_THRESHOLD
    ) {

        risk =
            "MEDIUM";


        description =
            "Weak network signal detected";


        riskClass =
            "security-risk-medium";


        anomalyTitle =
            "Weak Network Signal";


        anomalyDescription =
            "Cybeck detected degraded Wi-Fi signal strength.";


        anomalyIcon =
            "!";

    }


    const riskElement =
        document.getElementById(
            "security-risk-level"
        );


    if (riskElement) {

        riskElement.textContent =
            risk;


        riskElement.classList.remove(
            "security-risk-low",
            "security-risk-medium",
            "security-risk-high"
        );


        riskElement.classList.add(
            riskClass
        );

    }


    setNetworkText(
        "security-risk-description",
        description
    );


    setNetworkText(
        "security-event-count",
        sessionStatistics.eventCount
    );


    setNetworkText(
        "security-alert-count",
        activeSecurityConditions.size
    );


    setNetworkText(
        "security-anomaly-title",
        anomalyTitle
    );


    setNetworkText(
        "security-anomaly-description",
        anomalyDescription
    );


    setNetworkText(
        "security-anomaly-icon",
        anomalyIcon
    );

}


// ======================================================
// NETWORK CONNECTION STATE MEMORY
// ======================================================

let previousInternetState = null;

let networkRestoreTimer = null;


// ======================================================
// NETWORK SECURITY MONITOR - PHASE 1
// ======================================================

let previousSecurityNetworkState = null;

const securityEvents = [];

const securityEventLastSeen = new Map();

const activeSecurityConditions = new Set();

const securityOutageState = {
    networkStartedAt: null,
    internetStartedAt: null,
    weakSignalStartedAt: null
};

const SECURITY_EVENT_LIMIT = 50;

const SECURITY_EVENT_DEFAULT_COOLDOWN = 15000;
const SECURITY_EVENT_STATE_COOLDOWN = 10000;
const SECURITY_EVENT_CHANGE_COOLDOWN = 60000;
const SECURITY_EVENT_SIGNAL_COOLDOWN = 45000;

const SECURITY_SIGNAL_WEAK_THRESHOLD = 40;
const SECURITY_SIGNAL_RECOVERY_THRESHOLD = 55;

function formatSessionClock(milliseconds) {
    const seconds = Math.max(0, Math.floor(milliseconds / 1000));
    return [Math.floor(seconds / 3600), Math.floor(seconds / 60) % 60, seconds % 60]
        .map((part) => String(part).padStart(2, "0"))
        .join(":");
}

// Phase 1D session totals remain independent of the 50-row event history.
const sessionStatistics = {
    startedAt: Date.now(),
    firstScanAt: null,
    previous: null,
    eventCount: 0,
    resolvedAlerts: 0,
    networkOutages: 0,
    internetOutages: 0,
    networkChanges: 0,
    gatewayChanges: 0,
    downtimeMs: 0,
    downtimeStartedAt: null,
    longestOutageMs: 0,
    recoveryTotalMs: 0,
    recoveryCount: 0,
    signalTotal: 0,
    signalSquaredTotal: 0,
    signalSamples: 0,
    lowestSignal: null,
    currentSignal: null
};

let securityEventFilter = "ALL";

function updateSessionStatistics(network) {
    const stats = sessionStatistics;
    const now = Date.now();
    const current = {
        connected: Boolean(network.connected),
        internet: Boolean(network.internet),
        ssid: network.networkName || network.ssid || "Unavailable",
        gateway: network.gateway || "Unavailable",
        connectionType: network.connectionType || "Unknown"
    };
    const previous = stats.previous;

    if (stats.firstScanAt === null) stats.firstScanAt = now;

    if (!previous || (previous.connected && !current.connected)) {
        if (!current.connected) stats.networkOutages += 1;
    }
    if (!previous || (previous.internet && !current.internet) ||
        (!previous.connected && current.connected && !current.internet)) {
        if (current.connected && !current.internet) stats.internetOutages += 1;
    }

    // Downtime is the union of network and internet loss, so overlapping
    // outages are counted once.
    if (!current.connected || !current.internet) {
        if (stats.downtimeStartedAt === null) stats.downtimeStartedAt = now;
    } else if (stats.downtimeStartedAt !== null) {
        const duration = now - stats.downtimeStartedAt;
        stats.downtimeMs += duration;
        stats.longestOutageMs = Math.max(stats.longestOutageMs, duration);
        stats.recoveryTotalMs += duration;
        stats.recoveryCount += 1;
        stats.downtimeStartedAt = null;
    }

    if (previous && previous.connected && current.connected) {
        if ((previous.ssid !== current.ssid || previous.connectionType !== current.connectionType) && previous.ssid !== "Unavailable" && current.ssid !== "Unavailable") {
            stats.networkChanges += 1;
        }
        if (previous.gateway !== current.gateway && previous.gateway !== "Unavailable" && current.gateway !== "Unavailable") {
            stats.gatewayChanges += 1;
        }
    }

    const signal = Number(network.signal);
    stats.currentSignal = current.connected && network.connectionType === "Wi-Fi" && Number.isFinite(signal)
        ? Math.max(0, Math.min(100, signal)) : null;
    if (stats.currentSignal !== null) {
        stats.signalTotal += stats.currentSignal;
        stats.signalSquaredTotal += stats.currentSignal ** 2;
        stats.signalSamples += 1;
        stats.lowestSignal = stats.lowestSignal === null
            ? stats.currentSignal : Math.min(stats.lowestSignal, stats.currentSignal);
    }

    stats.previous = current;
    renderSessionStatistics();
    document.dispatchEvent(new CustomEvent("cybeck-network-sample", { detail: {
        time: new Date(now).toISOString(), connected: current.connected,
        internet: current.internet, ssid: current.ssid, gateway: current.gateway,
        connectionType: current.connectionType, adapter: network.adapter || "Unavailable",
        dns: network.dns || "Unavailable", signal: stats.currentSignal,
        eventCount: stats.eventCount, networkOutages: stats.networkOutages,
        internetOutages: stats.internetOutages, activeAlerts: activeSecurityConditions.size
    } }));
}

function renderSessionStatistics() {
    const stats = sessionStatistics;
    const now = Date.now();
    const activeOutage = stats.downtimeStartedAt === null ? 0 : now - stats.downtimeStartedAt;
    const downtime = stats.downtimeMs + activeOutage;
    const monitored = stats.firstScanAt === null ? 0 : now - stats.firstScanAt;
    const signalAverage = stats.signalSamples ? stats.signalTotal / stats.signalSamples : 0;
    const signalDeviation = stats.signalSamples > 1
        ? Math.sqrt(Math.max(0, stats.signalSquaredTotal / stats.signalSamples - signalAverage ** 2))
        : null;
    const values = {
        "session-monitor-duration": formatSessionClock(now - stats.startedAt),
        "session-events": stats.eventCount,
        "session-active-alerts": activeSecurityConditions.size,
        "session-resolved-alerts": stats.resolvedAlerts,
        "session-network-outages": stats.networkOutages,
        "session-internet-outages": stats.internetOutages,
        "session-total-downtime": formatSessionClock(downtime),
        "session-longest-outage": formatSessionClock(Math.max(stats.longestOutageMs, activeOutage)),
        "session-network-changes": stats.networkChanges,
        "session-gateway-changes": stats.gatewayChanges,
        "session-lowest-signal": stats.lowestSignal === null ? "--" : `${stats.lowestSignal}%`,
        "session-current-signal": stats.currentSignal === null ? "--" : `${stats.currentSignal}%`,
        "session-average-signal": stats.signalSamples ? `${Math.round(signalAverage)}%` : "--",
        "session-signal-stability": signalDeviation === null ? "--"
            : signalDeviation <= 5 ? "GOOD" : signalDeviation <= 12 ? "FAIR" : "VARIABLE",
        "session-recovery-time": stats.recoveryCount ? formatSecurityDuration(stats.recoveryTotalMs / stats.recoveryCount) : "--",
        "session-reliability": monitored ? `${Math.max(0, (1 - downtime / monitored) * 100).toFixed(1)}%` : "--"
    };
    Object.entries(values).forEach(([id, value]) => setNetworkText(id, value));
}

document.querySelectorAll("[data-event-filter]").forEach((button) => {
    button.addEventListener("click", () => {
        securityEventFilter = button.dataset.eventFilter;
        document.querySelectorAll("[data-event-filter]").forEach((item) => {
            const selected = item === button;
            item.classList.toggle("active", selected);
            item.setAttribute("aria-pressed", String(selected));
        });
        renderSecurityEventTimeline();
    });
});

setInterval(renderSessionStatistics, 1000);

window.cybeckMonitor = {
    getEvents: () => securityEvents.map((event) => ({
        time: event.time.toISOString(), type: event.type,
        message: event.message, severity: event.severity, key: event.key
    })),
    getStatistics: () => ({ ...sessionStatistics, activeAlerts: activeSecurityConditions.size })
};


// ======================================================
// NETWORK MONITOR
// ======================================================


// ======================================================
// NETWORK MONITOR BUTTONS
// ======================================================

[
    "nm-refresh-btn",
    "nm-quick-refresh",
    "nm-test-internet"

].forEach((id) => {

    const button =
        document.getElementById(id);


    if (button) {

        button.addEventListener(
            "click",
            updateNetworkStatus
        );

    }

});


const networkDiagnosticsButton =
    document.getElementById(
        "nm-diagnostics-btn"
    );

if (networkDiagnosticsButton) {

    networkDiagnosticsButton
        .addEventListener(
            "click",
            runAdvancedNetworkDiagnostics
        );

}

const viewNetworkDetailsButton =
    document.getElementById(
        "nm-view-details"
    );


if (viewNetworkDetailsButton) {

    viewNetworkDetailsButton
        .addEventListener(
            "click",
            showNetworkDiagnostics
        );

}


const gatewayButton =
    document.getElementById(
        "nm-ping-gateway"
    );


if (gatewayButton) {

    gatewayButton.addEventListener(
        "click",
        verifyGatewayLocally
    );

}


const closeNetworkDiagnostics =
    document.getElementById(
        "nm-close-diagnostics"
    );


if (closeNetworkDiagnostics) {

    closeNetworkDiagnostics
        .addEventListener(
            "click",
            () => {

                const panel =
                    document.getElementById(
                        "nm-diagnostic-console"
                    );


                if (panel) {

                    panel.hidden =
                        true;

                }

            }
        );

}


// ======================================================
// START NETWORK MONITORING
// ======================================================

updateNetworkStatus();


setInterval(
    updateNetworkStatus,
    5000
);


// ======================================================
// APPLICATION INFORMATION
// ======================================================

async function loadApplicationInformation() {

    if (
        !window.windowControls ||
        !window.windowControls.getAppInfo
    ) {

        return;

    }


    try {

        const info =
            await window.windowControls
                .getAppInfo();


        const versionElement =
            document.getElementById(
                "app-version"
            );


        const buildDateElement =
            document.getElementById(
                "app-build-date"
            );


        const channelElement =
            document.getElementById(
                "app-channel"
            );


        const releaseVersionElement =
            document.getElementById(
                "release-version"
            );


        const sidebarVersion =
            document.querySelector(
                ".sidebar-footer .version"
            );


        if (versionElement) {

            versionElement.textContent =
                `v${info.version}`;

        }


        if (buildDateElement) {

            buildDateElement.textContent =
                info.buildDate;

        }


        if (channelElement) {

            channelElement.textContent =
                info.releaseChannel;

        }


        if (releaseVersionElement) {

            releaseVersionElement.textContent =
                info.version;

        }


        if (sidebarVersion) {

            sidebarVersion.textContent =
                `v${info.version}`;

        }

    }

    catch (error) {

        console.error(
            "Unable to load application information:",
            error
        );

    }

}


loadApplicationInformation();


// ======================================================
// APPLICATION UPDATE SYSTEM
// ======================================================

const checkUpdateButton =
    document.getElementById(
        "check-update-btn"
    );


const downloadUpdateButton =
    document.getElementById(
        "download-update-btn"
    );


const installUpdateButton =
    document.getElementById(
        "install-update-btn"
    );


const updateStatus =
    document.getElementById(
        "update-status"
    );


const updateMessage =
    document.getElementById(
        "update-message"
    );


const updateProgress =
    document.getElementById(
        "update-progress"
    );


const updateProgressFill =
    document.getElementById(
        "update-progress-fill"
    );


const updateProgressText =
    document.getElementById(
        "update-progress-text"
    );


const latestVersion =
    document.getElementById(
        "latest-version"
    );


const latestVersionNumber =
    document.getElementById(
        "latest-version-number"
    );


// ------------------------------------------------------
// CHECK FOR UPDATES
// ------------------------------------------------------

if (
    checkUpdateButton &&
    window.windowControls &&
    window.windowControls.checkForUpdates
) {

    checkUpdateButton.addEventListener(
        "click",
        async () => {

            if (updateStatus) {

                updateStatus.textContent =
                    "CHECKING";

            }


            if (updateMessage) {

                updateMessage.textContent =
                    "Contacting the Cybeck release server...";

            }


            checkUpdateButton.disabled =
                true;


            try {

                const result =
                    await window.windowControls
                        .checkForUpdates();


                if (
                    result &&
                    result.development
                ) {

                    if (updateStatus) {

                        updateStatus.textContent =
                            "DEVELOPMENT BUILD";

                    }


                    if (updateMessage) {

                        updateMessage.textContent =
                            result.message;

                    }


                    checkUpdateButton.disabled =
                        false;

                    return;

                }


                if (
                    result &&
                    result.success === false
                ) {

                    if (updateStatus) {

                        updateStatus.textContent =
                            "UPDATE ERROR";

                    }


                    if (updateMessage) {

                        updateMessage.textContent =
                            result.message ||
                            "Unable to check for updates.";

                    }


                    checkUpdateButton.disabled =
                        false;

                }

            }

            catch (error) {

                if (updateStatus) {

                    updateStatus.textContent =
                        "UPDATE ERROR";

                }


                if (updateMessage) {

                    updateMessage.textContent =
                        error.message ||
                        "Unable to check for updates.";

                }


                checkUpdateButton.disabled =
                    false;

            }

        }
    );

}


// ------------------------------------------------------
// DOWNLOAD UPDATE
// ------------------------------------------------------

if (
    downloadUpdateButton &&
    window.windowControls &&
    window.windowControls.downloadUpdate
) {

    downloadUpdateButton.addEventListener(
        "click",
        async () => {

            downloadUpdateButton.disabled =
                true;


            if (updateStatus) {

                updateStatus.textContent =
                    "DOWNLOADING";

            }


            if (updateMessage) {

                updateMessage.textContent =
                    "Downloading the latest Cybeck release...";

            }


            if (updateProgress) {

                updateProgress.hidden =
                    false;

            }


            const result =
                await window.windowControls
                    .downloadUpdate();


            if (
                result &&
                result.success === false
            ) {

                if (updateStatus) {

                    updateStatus.textContent =
                        "DOWNLOAD ERROR";

                }


                if (updateMessage) {

                    updateMessage.textContent =
                        result.message ||
                        "Unable to download update.";

                }


                downloadUpdateButton.disabled =
                    false;

            }

        }
    );

}


// ------------------------------------------------------
// INSTALL UPDATE
// ------------------------------------------------------

if (
    installUpdateButton &&
    window.windowControls &&
    window.windowControls.installUpdate
) {

    installUpdateButton.addEventListener(
        "click",
        () => {

            window.windowControls
                .installUpdate();

        }
    );

}

// ======================================================
// NETWORK QUICK ACTIONS DROPDOWN
// ======================================================

const networkQuickToggle =
    document.getElementById(
        "network-quick-toggle"
    );


const networkQuickDropdown =
    document.getElementById(
        "network-quick-dropdown"
    );


const networkQuickMenu =
    document.getElementById(
        "network-quick-menu"
    );


if (
    networkQuickToggle &&
    networkQuickDropdown &&
    networkQuickMenu
) {

    networkQuickToggle.addEventListener(
        "click",
        () => {

            const isOpen =
                networkQuickDropdown
                    .classList
                    .toggle(
                        "open"
                    );


            networkQuickMenu.hidden =
                !isOpen;

            networkQuickToggle.setAttribute("aria-expanded", String(isOpen));

        }
    );

}


// ------------------------------------------------------
// UPDATE EVENTS FROM MAIN PROCESS
// ------------------------------------------------------

if (
    window.windowControls &&
    window.windowControls.onUpdateStatus
) {

    window.windowControls.onUpdateStatus(
        (data) => {

            if (!data) {
                return;
            }


            switch (data.type) {

                case "checking":

                    if (updateStatus) {

                        updateStatus.textContent =
                            "CHECKING";

                    }


                    if (updateMessage) {

                        updateMessage.textContent =
                            "Contacting the Cybeck release server...";

                    }

                    break;


                case "available":

                    if (updateStatus) {

                        updateStatus.textContent =
                            "UPDATE AVAILABLE";

                    }


                    if (updateMessage) {

                        updateMessage.textContent =
                            `Cybeck ${
                                data.version
                            } is available.`;

                    }


                    if (
                        latestVersion &&
                        latestVersionNumber
                    ) {

                        latestVersion.hidden =
                            false;

                        latestVersionNumber.textContent =
                            data.version;

                    }


                    if (downloadUpdateButton) {

                        downloadUpdateButton.hidden =
                            false;

                        downloadUpdateButton.disabled =
                            false;

                    }


                    if (checkUpdateButton) {

                        checkUpdateButton.disabled =
                            false;

                    }

                    break;


                case "not-available":

                    if (updateStatus) {

                        updateStatus.textContent =
                            "UP TO DATE";

                    }


                    if (updateMessage) {

                        updateMessage.textContent =
                            "You are currently running the latest version of Cybeck.";

                    }


                    if (
                        latestVersion &&
                        latestVersionNumber
                    ) {

                        latestVersion.hidden =
                            false;

                        latestVersionNumber.textContent =
                            data.version ||
                            "Current";

                    }


                    if (checkUpdateButton) {

                        checkUpdateButton.disabled =
                            false;

                    }

                    break;


                case "progress":

                    if (updateProgress) {

                        updateProgress.hidden =
                            false;

                    }


                    if (updateProgressFill) {

                        updateProgressFill.style.width =
                            `${data.percent}%`;

                    }


                    if (updateProgressText) {

                        updateProgressText.textContent =
                            `${data.percent}%`;

                    }

                    break;


                case "downloaded":

                    if (updateStatus) {

                        updateStatus.textContent =
                            "READY TO INSTALL";

                    }


                    if (updateMessage) {

                        updateMessage.textContent =
                            `Cybeck ${
                                data.version
                            } has been downloaded and is ready to install.`;

                    }


                    if (downloadUpdateButton) {

                        downloadUpdateButton.hidden =
                            true;

                    }


                    if (installUpdateButton) {

                        installUpdateButton.hidden =
                            false;

                    }


                    if (updateProgressFill) {

                        updateProgressFill.style.width =
                            "100%";

                    }


                    if (updateProgressText) {

                        updateProgressText.textContent =
                            "100%";

                    }

                    break;


                case "installing":

                    if (updateStatus) {
                        updateStatus.textContent = "INSTALLING AND RESTARTING";
                    }

                    if (updateMessage) {
                        updateMessage.textContent = data.message ||
                            "Installing the update. Cybeck will restart automatically.";
                    }

                    if (installUpdateButton) {
                        installUpdateButton.disabled = true;
                    }

                    break;


                case "error":

                    if (updateStatus) {

                        updateStatus.textContent =
                            "UPDATE ERROR";

                    }


                    if (updateMessage) {

                        updateMessage.textContent =
                            data.message ||
                            "An update error occurred.";

                    }


                    if (checkUpdateButton) {

                        checkUpdateButton.disabled =
                            false;

                    }


                    if (downloadUpdateButton) {

                        downloadUpdateButton.disabled =
                            false;

                    }

                    break;

            }

        }
    );

}
