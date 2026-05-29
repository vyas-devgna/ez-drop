<!-- Brutalist Sketch Tape Sticker -->
<div class="absolute -top-4 left-10 right-10 h-8 bg-[rgba(212,175,55,0.4)] border-y border-dashed border-[var(--ink)] rotate-[-1deg] pointer-events-none"></div>

<!-- Header Block -->
<header class="border-b-4 border-solid border-[var(--ink)] pb-6 mb-8 flex flex-col md:flex-row justify-between items-start md:items-end gap-4">
  <div>
    <div class="bg-[var(--yellow)] brutal-border p-2 px-4 rotate-[-1.5deg] inline-block brutal-shadow-sm mb-4">
      <span class="text-xs font-mono-custom font-bold tracking-widest uppercase text-black">P2P Technical Doc</span>
    </div>
    <h1 class="serif-display text-4xl md:text-5xl font-extrabold tracking-tight">ez-drop ⚡</h1>
    <p class="text-sm font-mono-custom text-[var(--muted)] mt-2">Zero-Cost • Serverless • Peer-to-Peer Secure File Transfer</p>
  </div>
  <div class="text-right font-mono-custom text-xs">
    <div>CREATED BY: <a href="https://github.com/vyas-devgna" class="underline font-bold hover:text-[var(--blue)]">@vyas-devgna</a></div>
    <div class="opacity-75">VERSION: 1.2.0-STABLE</div>
  </div>
</header>

<!-- Visual SVG Illustration (P2P Channel Handshake diagram) -->
<div class="mb-10 p-6 bg-[var(--surface-warm)] brutal-border brutal-shadow-sm flex flex-col items-center gap-4 relative overflow-hidden">
  <div class="absolute top-2 right-2 rotate-[4deg] bg-[var(--violet)] text-black text-[10px] font-mono-custom font-bold px-2 py-0.5 border border-black brutal-shadow-sm">
    DIRECT WEB-RTC TUNNEL
  </div>
  <h3 class="serif-display font-bold text-lg text-center">Transmission Vector Diagram</h3>
  
  <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 600 160" class="w-full max-w-xl h-auto">
    <!-- Node A -->
    <rect x="20" y="30" width="130" height="80" fill="#FFFFFF" stroke="#111111" stroke-width="3" rx="4" filter="drop-shadow(3px 3px 0px #111111)"/>
    <text x="85" y="65" font-family="Plus Jakarta Sans" font-weight="bold" font-size="14" text-anchor="middle" fill="#111111">Browser Client A</text>
    <text x="85" y="85" font-family="JetBrains Mono" font-size="11" text-anchor="middle" fill="#6C6863">Room Host</text>

    <!-- Dynamic Handshake Arrow -->
    <path d="M 170,70 L 410,70" fill="none" stroke="#111111" stroke-width="4" stroke-dasharray="8 8"/>
    <!-- Loopback Indicator -->
    <path d="M 285,55 L 295,70 L 285,85" fill="none" stroke="#111111" stroke-width="4"/>
    <path d="M 295,85 L 285,70 L 295,55" fill="none" stroke="#111111" stroke-width="4"/>
    <rect x="210" y="90" width="160" height="30" fill="#FFD93D" stroke="#111111" stroke-width="2" rx="2" filter="drop-shadow(2px 2px 0px #111111)"/>
    <text x="290" y="110" font-family="JetBrains Mono" font-weight="bold" font-size="10" text-anchor="middle" fill="#111111">Encrypted DataChannel</text>

    <!-- Node B -->
    <rect x="430" y="30" width="130" height="80" fill="#FFFFFF" stroke="#111111" stroke-width="3" rx="4" filter="drop-shadow(3px 3px 0px #111111)"/>
    <text x="495" y="65" font-family="Plus Jakarta Sans" font-weight="bold" font-size="14" text-anchor="middle" fill="#111111">Browser Client B</text>
    <text x="495" y="85" font-family="JetBrains Mono" font-size="11" text-anchor="middle" fill="#6C6863">Connector Node</text>
  </svg>
  
  <p class="text-xs font-mono-custom text-[var(--muted)] text-center mt-2">All data streams directly as chunks in active RAM memory between browser contexts. No cloud databases or intermediates used.</p>
</div>

<!-- Editorial Sections -->
<section class="flex flex-col gap-8">
  
  <!-- Visual Identity -->
  <article class="flex flex-col gap-3">
    <h2 class="serif-display text-2xl font-bold border-b-2 border-solid border-[var(--ink)] pb-1.5 flex items-center gap-2">
      <span class="w-4 h-4 bg-[var(--yellow)] border-2 border-black inline-block"></span>
      <span>Visual Identity Summary</span>
    </h2>
    <p class="text-sm leading-relaxed text-[var(--charcoal)]">
      ez-drop rejects standard corporate SaaS blueprints in favor of our signature <strong>Editorial Brutalist Sketchbook</strong> architecture. It prioritizes newsprint aesthetics, high information density, tactile bordered action elements, and wobbly organic accents. The workspace has been rigorously simplified, completely hiding diagnostic statistics like milliseconds latencies to keep focus on simple sharing.
    </p>
  </article>

  <!-- Chunk Protocol -->
  <article class="flex flex-col gap-3">
    <h2 class="serif-display text-2xl font-bold border-b-2 border-solid border-[var(--ink)] pb-1.5 flex items-center gap-2">
      <span class="w-4 h-4 bg-[var(--blue)] border-2 border-black inline-block"></span>
      <span>Adaptive Transmission Protocol</span>
    </h2>
    <p class="text-sm leading-relaxed text-[var(--charcoal)]">
      Files are divided into structured $64\text{ KB}$ array segments streamed via WebRTC channels. In order to manage performance, active backpressure polling halts transmission whenever the socket queue size peaks.
    </p>

    <!-- Technical Code Blocks -->
    <div class="grid grid-cols-1 md:grid-cols-2 gap-4 mt-2">
      
      <!-- Metablock Card -->
      <div class="bg-[var(--surface-warm)] brutal-border p-4">
        <div class="text-[10px] font-mono-custom font-bold uppercase text-[var(--muted)] border-b border-dashed border-black pb-1 mb-2">1. Handshake (file-meta)</div>
        <pre class="font-mono-custom text-[11px] overflow-x-auto whitespace-pre">
{"type": "file-meta","from": "Paper Tiger","payload": {"transferId": "tx-98asd2f3a","name": "archive.zip","size": 154857600,"type": "application/zip","totalChunks": 2363}}      <!-- Chunkblock Card -->
      <div class="bg-[var(--surface-warm)] brutal-border p-4">
        <div class="text-[10px] font-mono-custom font-bold uppercase text-[var(--muted)] border-b border-dashed border-black pb-1 mb-2">2. Streaming (file-chunk)</div>
        <pre class="font-mono-custom text-[11px] overflow-x-auto whitespace-pre">
{"type": "file-chunk","payload": {"transferId": "tx-98asd2f3a","chunkIndex": 412,"data": "[ArrayBuffer Slice]"}}    </div>
  </article>

  <!-- Deployment & Setup -->
  <article class="flex flex-col gap-3">
    <h2 class="serif-display text-2xl font-bold border-b-2 border-solid border-[var(--ink)] pb-1.5 flex items-center gap-2">
      <span class="w-4 h-4 bg-[var(--violet)] border-2 border-black inline-block"></span>
      <span>Zero-Backend Static Deployment</span>
    </h2>
    <p class="text-sm leading-relaxed text-[var(--charcoal)]">
      ez-drop has zero server dependencies. You can compile, run, and host the client completely free using static pages configurations.
    </p>

    <!-- Directory tree card -->
    <div class="bg-[var(--surface-warm)] brutal-border p-4 font-mono-custom text-xs max-w-sm">
      <div class="font-bold border-b border-[var(--ink)] pb-1.5 mb-2 uppercase">GitHub Pages Tree Structure</div>
      <div>.</div>
      <div>├── index.html</div>
      <div>├── sw.js</div>
      <div>└── assets/</div>
      <div class="pl-4">└── logo.png</div>
    </div>
  </article>

  <!-- Security Parameters -->
  <article class="flex flex-col gap-3">
    <h2 class="serif-display text-2xl font-bold border-b-2 border-solid border-[var(--ink)] pb-1.5 flex items-center gap-2">
      <span class="w-4 h-4 bg-[var(--gold)] border-2 border-black inline-block"></span>
      <span>Security & Privacy Handshake</span>
    </h2>
    <ul class="list-disc pl-5 text-sm flex flex-col gap-1.5 text-[var(--charcoal)]">
      <li><strong>Direct End-to-End Cryptography</strong>: Secured with native DTLS / SRTP layers.</li>
      <li><strong>Zero Storage Cloud Print</strong>: Packets exist strictly inside browser scopes. No data footprints remain in the public domain.</li>
      <li><strong>Crypto-Handshake Passcodes</strong>: Challenge verification handshake built with standard SHA-256 hashes ensures secure access controls.</li>
    </ul>
  </article>

</section>

<!-- Footer block -->
<footer class="mt-12 pt-6 border-t-4 border-solid border-[var(--ink)] text-center font-mono-custom text-xs text-[var(--muted)] flex justify-between items-center">
  <span>Project under MIT License</span>
  <a href="https://github.com/vyas-devgna/ez-drop" class="underline font-bold text-black hover:text-[var(--blue)]">vyas-devgna / ez-drop</a>
</footer>
