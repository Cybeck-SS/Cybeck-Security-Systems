# Cybeck Connect design

Cybeck Connect is a companion feature for attended screen sharing and remote control between computers the user owns or administers. It is separate from the existing SSH command channel and Windows Remote Desktop launcher. A Windows Home PC can be a Cybeck Connect host.

## First usable session

1. Install Cybeck on both computers. The second computer opens **Share this PC** and sees a short-lived pairing code.
2. The controlling computer opens **Cybeck Connect**, enters the code, and requests to view the screen.
3. The second computer sees the requesting device and explicitly allows this session.
4. Cybeck displays the live desktop in a dedicated viewer. Mouse and keyboard input remain disabled until the second computer approves a separate **Allow control** request.
5. Both computers show an always-visible sharing indicator and **End session** button. Closing either app ends the session and clears its permissions.

## Components

- **Host companion:** captures the selected display, encodes frames, receives approved input, and owns the local consent window. The host must never silently enable unattended access.
- **Viewer:** shows the remote display, handles scaling and display selection, and sends input only while control is approved.
- **Signaling:** pairs both sides with an expiring code and exchanges connection setup messages. It does not carry desktop content when a direct peer connection succeeds.
- **Transport:** WebRTC with encrypted media and data channels. A TURN relay is required for many internet connections; local-network discovery can be used for a LAN-only first release.
- **Identity:** each installation has its own device key. Pairing must authenticate the device identities and bind the approval to the current session to prevent a code being reused or redirected.

## Release gates

- Screen sharing works on Windows Home and Pro with two test PCs and no administrator privilege for normal sessions.
- The second PC can deny viewing, deny control, revoke control, or end the session at any point.
- Codes expire, cannot be replayed, and are rate limited. No desktop content or input commands are saved by the signaling service.
- The viewer cannot access a host before approval, after revocation, or after either app exits.
- Network interruption ends control promptly and requires a fresh approval before resuming.
- The installer and host executable are code signed before public distribution when a trusted signing identity is available.

## Current status

Cybeck Connect is planned and is not included in v0.1.8. Existing Remote Systems supports SSH commands and the Windows RDP client. Version 0.1.8 adds an RDP port check and Quick Assist launcher for attended Windows Home sessions.
