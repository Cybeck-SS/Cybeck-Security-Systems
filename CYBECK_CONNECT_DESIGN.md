# Cybeck Connect design

Cybeck Connect is a companion feature for attended screen sharing and remote control between computers the user owns or administers. It is separate from the existing SSH command channel and Windows Remote Desktop launcher. A Windows Home PC can be a Cybeck Connect host.

## First usable session

1. Install Cybeck on both computers. The second computer opens **Share this PC** and generates a short-lived, single-use login code. A code identifies a pending session; it is not a reusable account password or encryption key.
2. The controlling computer opens **Cybeck Connect**, enters the code, and requests to view the screen. A rate-limited pairing service forwards the request without granting screen access.
3. The second computer shows the requesting device and explicitly approves one session. Approval automatically starts screen sharing for that session, with no RDP setting or Windows administrator change.
4. Cybeck displays the live desktop in a dedicated viewer. Mouse and keyboard input remain disabled until the second computer approves a separate **Allow control** request.
5. Both computers show an always-visible sharing indicator and **End session** button. Closing either app, ending the session, or losing the connection clears permissions and invalidates the code.

## Components

- **Host companion:** captures the selected display, encodes frames, receives approved input, and owns the local consent window. The host must never silently enable unattended access.
- **Viewer:** shows the remote display, handles scaling and display selection, and sends input only while control is approved.
- **Signaling:** pairs both sides with an expiring code and exchanges connection setup messages. It does not carry desktop content when a direct peer connection succeeds.
- **Transport:** WebRTC with encrypted media and data channels. A TURN relay is required for many internet connections; local-network discovery can be used for a LAN-only first release.
- **Identity:** each installation has its own device key. Pairing must authenticate the device identities and bind the approval to the current session to prevent a code being reused or redirected.

## Encryption and code handling

- Use TLS for signaling and WebRTC's DTLS-SRTP media and encrypted data channels for the screen and control stream. Do not derive media keys from the short login code.
- Bind the approved device identities and the exact session to the encrypted WebRTC handshake. The signaling service must not be able to swap a viewer or host without detection.
- Keep only a verifier for each expiring code on the pairing service, never store the plaintext code. Limit guesses per device and network, expire the code after a few minutes, and consume it after one successful pairing.
- Relay screen traffic through TURN only when direct connectivity fails. The relay should forward encrypted packets and should not receive control permissions or desktop content in plaintext.
- Store session permissions in memory on the host and viewer. Do not persist unattended access or a reusable remote-control token.

## Release gates

- Screen sharing works on Windows Home and Pro with two test PCs and no administrator privilege for normal sessions.
- The second PC can deny viewing, deny control, revoke control, or end the session at any point.
- Codes expire, cannot be replayed, and are rate limited. No desktop content or input commands are saved by the signaling service.
- The viewer cannot access a host before approval, after revocation, or after either app exits.
- Network interruption ends control promptly and requires a fresh approval before resuming.
- The installer and host executable are code signed before public distribution when a trusted signing identity is available.

## Current status

Cybeck Connect is planned and is not included in v0.1.10. Existing Remote Systems supports SSH commands, the Windows RDP client, an RDP port check, Quick Assist, and an AnyDesk launcher that detects installed or portable signed AnyDesk executables. AnyDesk opens its own window and handles its own remote session; Cybeck does not embed its viewer or bundle its software.
