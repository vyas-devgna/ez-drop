# Contributing

Thanks for helping improve ez-drop. This project is a serverless browser/PWA file-transfer app, so changes should preserve the no-backend design unless the proposal is explicitly about optional integrations.

## Good First Contributions

- Browser compatibility fixes.
- Mobile layout and accessibility improvements.
- Clearer error and recovery messages.
- Focused transfer reliability fixes.
- Documentation and manual QA notes.

## Development Setup

No package install or build step is required.

```bash
python3 -m http.server 4173
```

Open:

```text
http://127.0.0.1:4173/
```

## Required Checks

Run these before opening a pull request:

```bash
node --check app.js
node --check sw.js
```

Also manually test at least one happy path:

1. Open ez-drop in two browsers/devices.
2. Pair using room code or QR code.
3. Accept the connection.
4. Send a small text message.
5. Send a small file.
6. Disconnect and reconnect.

For mobile-facing changes, test a narrow viewport and, when possible, a real phone.

## Pull Request Guidelines

- Keep changes focused and explain the user-visible effect.
- Do not introduce a required server, build tool, package manager, or account system without prior discussion.
- Avoid committing generated browser cache artifacts.
- Keep the app usable from a static host.
- Prefer progressive enhancement for browser-specific APIs.
- Mention any browser limitations clearly in the PR description.

## Code Style

- Plain HTML, CSS, and JavaScript.
- Keep browser feature detection explicit.
- Use `textContent` or safe DOM APIs for user-controlled text where possible.
- Keep transfer state transitions clear and easy to reason about.
- Avoid broad refactors in feature PRs unless they are necessary.

## Reporting Bugs

Please include:

- Browser and version.
- Desktop/mobile OS.
- Whether the PWA is installed or running in a tab.
- Network type: same Wi-Fi, hotspot, cellular, office/school network, VPN, etc.
- Steps to reproduce.
- Console errors, if any.

## Security

Please do not open public issues for sensitive security reports. Use the process in [SECURITY.md](SECURITY.md).
