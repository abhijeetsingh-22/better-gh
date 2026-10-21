// Opens media in issue, pull request, and discussion threads in the viewer instead of a new tab.

const MEDIA = '.markdown-body img, .markdown-body video';
// GitHub links uploaded and proxied images to the file itself; any other link is a real link.
const MEDIA_LINK = /^https:\/\/([\w-]+\.githubusercontent\.com|github\.com\/user-attachments\/assets)\//;

// GitHub navigates without full page loads, so check the page on every interaction.
function onThreadPage() {
  return /\/(pull|issues|discussions)\/\d+/.test(location.pathname);
}

function isViewable(el) {
  if (!el.matches(MEDIA) || !el.getClientRects().length) return false;
  if (el.tagName === 'VIDEO') return true;

  const link = el.closest('a');
  if (link && link.href !== el.src && !MEDIA_LINK.test(link.href)) return false;

  // Skip emoji, badges, and other inline icons.
  return Math.min(el.naturalWidth || el.width, el.naturalHeight || el.height) >= 40;
}

function openGallery(el) {
  const items = [...document.querySelectorAll(MEDIA)].filter(isViewable);
  viewer.open(items, items.indexOf(el));
}

addEventListener('click', (event) => {
  if (event.button !== 0 || event.metaKey || event.ctrlKey || event.shiftKey || event.altKey) return;
  const el = event.target;
  if (el.tagName !== 'IMG' || !onThreadPage() || !isViewable(el)) return;

  event.preventDefault();
  event.stopPropagation();
  openGallery(el);
}, true);

// Videos play inline when clicked, so they get a button for opening them in the viewer.

const expandButton = document.createElement('button');
expandButton.type = 'button';
expandButton.className = 'bgh-expand';
expandButton.title = 'Open in viewer';
expandButton.setAttribute('aria-label', 'Open in viewer');
expandButton.innerHTML = icon('expand');

let hoveredVideo = null;

expandButton.addEventListener('click', (event) => {
  event.stopPropagation();
  expandButton.remove();
  openGallery(hoveredVideo);
});

document.addEventListener('pointerover', (event) => {
  if (event.target === expandButton || expandButton.contains(event.target)) return;

  const video = event.target;
  if (video.tagName !== 'VIDEO' || !onThreadPage() || !isViewable(video)) {
    expandButton.remove();
    return;
  }

  hoveredVideo = video;
  const rect = video.getBoundingClientRect();
  expandButton.style.top = `${rect.top + scrollY + 8}px`;
  expandButton.style.left = `${rect.right + scrollX - 40}px`;
  document.body.append(expandButton);
});
