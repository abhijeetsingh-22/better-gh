<img src="assets/icon.svg" width="64" height="64" alt="">

# better-gh

A Chrome extension that opens images and videos in GitHub issues, pull requests, and discussions in a full-screen viewer instead of a new tab.

- Click an image to open it. Videos get an expand button in their top-right corner on hover.
- Step through every image and video on the page.
- Zoom with the scroll wheel, a trackpad pinch, or a click on the image; drag to pan.
- Copy images to the clipboard and download images and videos.
- ⌘/Ctrl-click still opens the file in a new tab.

| Key | Action |
| --- | --- |
| `←` `→` | Previous / next |
| `+` `-` `0` | Zoom in / out / reset |
| `⌘C` / `Ctrl+C` | Copy image |
| `⌘S` / `Ctrl+S` | Download |
| `Esc` | Close |

## Install from source

1. Open `chrome://extensions` and turn on **Developer mode**.
2. Click **Load unpacked** and select this folder.

## Publish

There is no build step. Zip the extension files and upload the zip to the [Chrome Web Store Developer Dashboard](https://chrome.google.com/webstore/devconsole):

```sh
zip -r better-gh.zip manifest.json src icons
```

## How it works

- `src/content.js` intercepts clicks on media inside comments and collects the page's media for navigation.
- `src/viewer.js` and `src/viewer.css` are the lightbox.
- `src/background.js` fetches files for copy and download, because GitHub's media hosts don't allow cross-origin reads from the page. Uploaded media URLs expire after five minutes, so it falls back to the attachment's permanent URL when one has expired.
