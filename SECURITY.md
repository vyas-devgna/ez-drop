# Security Policy

## Supported Versions

The `main` branch is the actively supported version of ez-drop.

## Reporting A Vulnerability

Please do not create a public GitHub issue for a security vulnerability.

Instead, contact the maintainer privately through GitHub. Include:

- A clear description of the issue.
- Steps to reproduce.
- Browser and OS details.
- Impact and any suggested mitigation.

## Scope

Security-sensitive areas include:

- WebRTC connection handling.
- DataChannel message parsing.
- File metadata rendering.
- IndexedDB persistence.
- Service worker fetch/share-target handling.
- Clipboard, notification, camera, and file-system permission flows.

## Privacy Model

ez-drop is serverless and does not intentionally upload file contents to an application backend. However:

- PeerJS signaling is used to establish peer connections.
- Browser WebRTC internals decide direct, LAN, NAT, or relay routes.
- Shared payloads and history may be stored locally in IndexedDB.
- Received files may be held in browser memory until saved or cleared.

## Responsible Disclosure

Please allow reasonable time for investigation and a fix before public disclosure.
