import re

html_path = 'index.html'
with open(html_path, 'r', encoding='utf-8') as f:
    html = f.read()

# 1. Extract unified connection banner
banner_match = re.search(r'<!-- Unified Connection Info Badge -->.*?</button>\s*</div>', html, re.DOTALL)
banner_html = banner_match.group(0).replace('class="bg-[var(--surface-warm)]', 'id="active-connection-banner" class="hidden bg-[var(--surface-warm)] mb-6')

# 2. Extract dropzone and text input (the Interactive Core Workspace Grid)
grid_match = re.search(r'<!-- Interactive Core Workspace Grid -->.*?(?=<!-- Connected Transfer List Stream -->)', html, re.DOTALL)
grid_html = grid_match.group(0).strip()

# 3. Extract transfers and history
transfers_match = re.search(r'<!-- Connected Transfer List Stream -->.*?(?=<!-- Compact Session History Dropdown -->)', html, re.DOTALL)
transfers_html = transfers_match.group(0).strip()
history_match = re.search(r'<!-- Compact Session History Dropdown -->.*?(?=<div class="bg-\[var\(--surface\)\] brutal-border p-3 brutal-shadow-sm">)', html, re.DOTALL)
history_html = history_match.group(0).strip()

# 4. Remove state-connected completely, leave an empty div for app.js
html = re.sub(r'<section id="state-connected".*?</section>', '<section id="state-connected" class="hidden"></section>', html, flags=re.DOTALL)

# 5. Insert banner above state-ready
html = html.replace('<section id="state-ready"', banner_html + '\n\n    <section id="state-ready"')

# 6. Insert transfers and history into tab-receive
# Insert after internet-share-panel ends.
html = re.sub(r'(<!-- Collapsible internet share panel.*?</p>\s*</div>\s*</div>\s*</div>\s*</div>\s*</div>)', r'\1\n\n' + transfers_html + '\n\n' + history_html, html, flags=re.DOTALL)

# 7. Insert grid into tab-send
html = html.replace('<!-- Primary: nearby devices -->', grid_html + '\n\n        <!-- Primary: nearby devices -->')

with open(html_path, 'w', encoding='utf-8') as f:
    f.write(html)
print('DOM manipulation successful.')
