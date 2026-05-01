# DomainAge — Landing site

Static landing page for the DomainAge Chrome extension. No build step.

## Files

- `index.html` — single-page landing
- `styles.css` — all styles
- `assets/icon128.png` — brand logo (copied from the extension's `icons/`)
- `DomainAge.zip` — *generated* — the downloadable extension bundle

## Build the download ZIP

From the project root (`Domain Age checker/`), run:

```powershell
# PowerShell (Windows)
Compress-Archive -Path manifest.json,popup.*,welcome.*,options.*,background.js,icons -DestinationPath website\DomainAge.zip -Force
```

```bash
# bash
cd "Domain Age checker"
zip -r website/DomainAge.zip manifest.json popup.* welcome.* options.* background.js icons
```

## Deploy

- **GitHub Pages**: push the `website/` folder to a repo, enable Pages on it.
- **Netlify / Vercel**: drag-and-drop or connect the `website/` folder.
- **Cloudflare Pages**: same.
- **Any static host**: upload all files preserving folder structure.

## Customizing

- Replace the `★★★★★` rating row in `index.html` once you have real reviews.
- Add a "Chrome Web Store" button once published — change the `Download` link target.
- Swap social meta tags / OG image to brand to your liking.
