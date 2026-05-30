# Support

ez-drop is a small open-source project. Support is community-driven and best-effort.

## Before Opening An Issue

Try these steps:

1. Hard refresh both devices.
2. Make sure both browsers support WebRTC.
3. Try another network or hotspot if pairing fails.
4. Disable strict ad blockers for the app if PeerJS or QR libraries are blocked.
5. Check whether a service worker update is pending.

## Useful Issue Details

When asking for help, include:

- Browser and version.
- Device and operating system.
- Installed PWA or browser tab.
- Same Wi-Fi, hotspot, cellular, VPN, or restricted network.
- What you expected to happen.
- What actually happened.
- Console errors or screenshots where helpful.

## Known Browser Limits

Serverless browser apps cannot use raw TCP, run local HTTP servers, or send UDP multicast discovery packets. Features depending on those capabilities require native apps or helper services.
