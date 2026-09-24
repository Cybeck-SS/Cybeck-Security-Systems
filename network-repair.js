const actions = Object.freeze({
    "renew-dhcp": {
        title: "Renew DHCP address",
        detail: "Windows will release and renew DHCP addresses. Network access may stop briefly.",
        script: "$ErrorActionPreference='Stop'; & ipconfig.exe /release | Out-Null; & ipconfig.exe /renew | Out-Null; if($LASTEXITCODE -ne 0){throw 'DHCP renewal failed.'}",
        restartRequired: false
    },
    "flush-dns": {
        title: "Flush DNS cache",
        detail: "Windows will clear locally cached DNS lookup results.",
        script: "$ErrorActionPreference='Stop'; & ipconfig.exe /flushdns | Out-Null; if($LASTEXITCODE -ne 0){throw 'DNS cache flush failed.'}",
        restartRequired: false
    },
    "reconnect-wifi": {
        title: "Reconnect Wi-Fi",
        detail: "Windows will disconnect and reconnect the currently associated Wi-Fi profile. This does not apply to Ethernet.",
        script: "$ErrorActionPreference='Stop'; $raw=& netsh.exe wlan show interfaces; $interface=([regex]::Match(($raw -join \"`n\"),'(?im)^\\s*Name\\s*:\\s*(.+)$')).Groups[1].Value.Trim(); $profile=([regex]::Match(($raw -join \"`n\"),'(?im)^\\s*Profile\\s*:\\s*(.+)$')).Groups[1].Value.Trim(); if(!$interface -or !$profile){throw 'No connected Wi-Fi profile was found.'}; & netsh.exe wlan disconnect \"interface=$interface\" | Out-Null; Start-Sleep -Seconds 2; & netsh.exe wlan connect \"name=$profile\" \"interface=$interface\" | Out-Null; if($LASTEXITCODE -ne 0){throw 'Wi-Fi reconnection failed.'}",
        restartRequired: false
    },
    "restart-adapter": {
        title: "Restart active network adapter",
        detail: "Windows will disable and re-enable the adapter carrying the default IPv4 route. Connectivity will stop temporarily.",
        script: "$ErrorActionPreference='Stop'; $route=Get-NetRoute -AddressFamily IPv4 -DestinationPrefix '0.0.0.0/0' | Where-Object {$_.NextHop -and $_.NextHop -ne '0.0.0.0'} | Sort-Object @{Expression={[int]$_.RouteMetric + [int](Get-NetIPInterface -AddressFamily IPv4 -InterfaceIndex $_.InterfaceIndex).InterfaceMetric}} | Select-Object -First 1; if(!$route){throw 'No active default-route adapter was found.'}; $adapter=Get-NetAdapter -InterfaceIndex $route.InterfaceIndex -ErrorAction Stop; Disable-NetAdapter -Name $adapter.Name -Confirm:$false -ErrorAction Stop; Start-Sleep -Seconds 2; Enable-NetAdapter -Name $adapter.Name -Confirm:$false -ErrorAction Stop",
        restartRequired: false
    },
    "reset-network": {
        title: "Reset Windows networking",
        detail: "Windows will reset Winsock and TCP/IP settings. A computer restart is required afterward. Custom network settings may need to be restored.",
        script: "$ErrorActionPreference='Stop'; & netsh.exe winsock reset | Out-Null; if($LASTEXITCODE -ne 0){throw 'Winsock reset failed.'}; & netsh.exe int ip reset | Out-Null; if($LASTEXITCODE -ne 0){throw 'TCP/IP reset failed.'}",
        restartRequired: true
    }
});

function networkRepairSpec(action) {
    if (typeof action !== "string" || !Object.hasOwn(actions, action)) throw new Error("Unsupported network repair action.");
    return actions[action];
}

module.exports = { networkRepairSpec, actionNames: Object.keys(actions) };
