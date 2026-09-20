# Cybeck Security Systems v0.1.8

- Added a read-only check for the default Windows Remote Desktop port (3389) to help diagnose connection failures.
- Explained in Remote Systems that Windows Home cannot host Remote Desktop.
- Added an Open Quick Assist button for attended screen sharing and control with a Windows Home computer. The second computer must enter the session code and approve sharing and control in Microsoft's separate app.
- Added a Cybeck Connect design document for a future in-app screen sharing and control feature. Cybeck Connect is not implemented in this release.

The RDP check only tests TCP reachability. It does not prove that sign-in or screen control will succeed. SSH remote commands remain separate. The installer is unsigned; Windows security policy may warn or block it. Windows Application Control blocked the packaged executable on the build machine, so a packaged-app smoke test could not be completed there.
