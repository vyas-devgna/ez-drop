ez-drop ⚡ P2P File & Text Transfer

ez-drop is a zero-cost, serverless, peer-to-peer secure file and text transfer utility built entirely as a static web application. It runs directly inside modern web browsers using WebRTC DataChannels to pipe files and text snippets from device to device without ever touching or storing data on an intermediary server.

Developed by @vyas-devgna.

🎨 Visual Identity: Editorial Brutalist Sketchbook

ez-drop is built around a unique hybrid visual identity. It avoids generic, rounded SaaS interfaces in favor of:

Neo-Brutalist Foundations: Sharp border structures, bold, thick contrast ink margins, flat offset drop shadows, and high-impact sticker accents.

Newsprint Editorial: Clean, readable typography pairing high-fashion serif titles with precise monospace metadata readouts.

Sketchbook Accents: Playful paper background patterns, wobbly taped borders, and hand-drawn notations that make the interface feel highly organic, human, and interactive.

🚀 Core Features

True Peer-to-Peer (Serverless):
All byte data travels directly through encrypted peer connections ($RTCDataChannel$). There is no server upload, no storage database, and no bandwidth quota limits.

Simplified User Flow (Progressive Disclosure):
The app launches with only two distinct, clean pathways: "Share this device" and "Connect to another device". The complex workspace, file dropzones, and message logs stay hidden until a peer connection is actively established.

Adaptive Backpressure Streaming:
Large files are automatically divided into $64\text{ KB}$ binary array chunks. Transmission speeds are controlled using active queue polling of the WebRTC buffered queue (bufferedAmount), pausing chunks before buffers flood, ensuring massive transfers run stably in RAM.

Built-in QR Camera Scanner:
Integrated QR generation (qrcode.js) and high-performance camera decoding (html5-qrcode) allow mobile devices to pair instantly with a single button click.

Secure Challenge-Response Password Handshake:
Optional passphrase gatekeeper utilizing client-side SHA-256 hashes (Web Crypto API). It verifies peer credentials via mathematical proofs without ever transmitting the raw passcode.

Fully Offline Capable PWA:
A custom-built Service Worker (sw.js) dynamically caches critical app shells, stylesheets, and CDN-loaded scripts, ensuring the app launches offline. Includes standard native Android/Desktop install prompts and Safari-manual guides.

In-Memory Loopback Sandbox:
Includes a developer debug console simulator that mimics direct browser-to-browser streaming entirely within a single tab—ideal for debugging without needing a second device.

🛠️ Tech Stack & Architecture

Styling: Tailwind CSS

Signaling Protocol: PeerJS (utilizing the public free PeerJS Cloud Server for room handshakes and Google STUN arrays for NAT traversal)

Icons: Lucide Icons

P2P transport: WebRTC DataChannels (RTCDataChannel)

📦 File Transfer Chunk Protocol

To safely stream data through WebRTC without overwhelming browser memory, ez-drop uses a custom light transport payload protocol:

1. Metadata Handshake (file-meta)

Sent from transmitter to recipient before file streaming begins:

{
  "type": "file-meta",
  "from": "Paper Tiger",
  "payload": {
    "transferId": "tx-98asd2f3a",
    "name": "project_archive.zip",
    "size": 154857600,
    "type": "application/zip",
    "totalChunks": 2363
  }
}


2. Slices (file-chunk)

Sent repeatedly in synchronous loops throttled by backpressure mechanics:

{
  "type": "file-chunk",
  "payload": {
    "transferId": "tx-98asd2f3a",
    "chunkIndex": 412,
    "data": "[ArrayBuffer Slice Data]"
  }
}


3. Finish Signal (file-complete)

Indicates the payload has fully arrived. The recipient compiles the stored chunks into a single unified Blob and triggers the browser's native saving mechanism:

{
  "type": "file-complete",
  "payload": {
    "transferId": "tx-98asd2f3a"
  }
}


🚀 Easy Static Deployment

Since ez-drop requires no server backend or API database, you can host it entirely for free on static hosting providers like GitHub Pages.

Setup Instructions:

Clone your repository:

git clone [https://github.com/vyas-devgna/ez-drop.git](https://github.com/vyas-devgna/ez-drop.git)
cd ez-drop


Ensure you have the following directory file tree structure:

.
├── index.html
├── sw.js
└── assets/
    └── logo.png


Push your repository to GitHub, go to your repository Settings -> Pages, and set the build branch source to /root (main/master).

Your application will launch live instantly at https://vyas-devgna.github.io/ez-drop/!

🔒 Privacy & Security Audit

Zero-Storage Promise: No byte data is uploaded. Your documents, photos, or archives are stored strictly in local memory and pass through secure peer-to-peer networks.

DTLS/SRTP Encrypted: WebRTC enforces end-to-end encryption by default, preventing ISP or network snooping.

Secure Handshake Gate: Enabling the optional passphrase blocks incoming connections from pairing with your 5-digit room unless their devices can correctly solve the crypto proof check.

📜 License

This project is open-source and licensed under the MIT License.
