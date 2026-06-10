# Changelog

All notable project changes should be documented here.

## Unreleased

- Documentation refresh for open-source contributors.
- Added project governance files and GitHub templates.

## 1.3.0

- Local-first home screen: nearby devices are the primary pairing path; QR/code/link sharing now lives behind an Internet toggle on the identity card.
- Identity hero card with inline device rename and radar presence animation.
- Large incoming files (>128 MB) stream directly to disk via the File System Access API on Chromium instead of buffering in RAM.
- Outgoing files now stream one at a time for accurate per-file speed and no chunk interleaving.
- Transfer cards gained file-type icons, animated progress stripes, smoothed speed, and ETA readouts.
- Live latency chip and clearer route explanation on the connected banner.
- View Transition API crossfades between app states, button hover lifts, staggered card entrances, haptic feedback, and app badge counts for active transfers (all reduced-motion safe).
- Active transfers now warn before tab close and fail visibly if the peer drops mid-stream.
- Untrusted incoming filenames are sanitized before save/download.

## 1.2.0

- Serverless WebRTC file and text transfer.
- PWA app shell and install support.
- Web Share Target intake for supported installed PWAs.
- LAN route detection and LAN transfer profile.
- File offer/accept flow before transfer.
- IndexedDB-backed history, queued shares, and known browser clients.
- Mobile layout, wake lock, and download/save improvements.
