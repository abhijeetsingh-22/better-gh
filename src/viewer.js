// Full-screen lightbox for the images and videos in a GitHub thread.
const viewer = (() => {
  const MAX_ZOOM = 8;
  const MOD = /Mac|iPhone|iPad/.test(navigator.platform) ? '⌘' : 'Ctrl+';

  let root, stage, counter, prevButton, nextButton, copyButton, toastEl, toastTimer;
  let items = [];
  let index = 0;
  let media = null;
  let returnFocus = null;
  let zoom = { scale: 1, x: 0, y: 0 };
  let drag = null;
  let dragged = false;

  function button(action, label, className = '') {
    return `<button type="button" class="bgh-button ${className}" data-action="${action}" title="${label}" aria-label="${label}">${icon(action)}</button>`;
  }

  function build() {
    root = document.createElement('div');
    root.className = 'bgh';
    root.tabIndex = -1;
    root.setAttribute('role', 'dialog');
    root.setAttribute('aria-modal', 'true');
    root.setAttribute('aria-label', 'Media viewer');
    root.innerHTML = `
      <div class="bgh-stage"></div>
      <div class="bgh-bar">
        <span class="bgh-counter"></span>
        <div class="bgh-actions">
          ${button('copy', `Copy image (${MOD}C)`)}
          ${button('download', `Download (${MOD}S)`)}
          ${button('close', 'Close (Esc)')}
        </div>
      </div>
      ${button('prev', 'Previous (←)', 'bgh-nav bgh-prev')}
      ${button('next', 'Next (→)', 'bgh-nav bgh-next')}
      <div class="bgh-toast" role="status"></div>
    `;

    stage = root.querySelector('.bgh-stage');
    counter = root.querySelector('.bgh-counter');
    prevButton = root.querySelector('[data-action="prev"]');
    nextButton = root.querySelector('[data-action="next"]');
    copyButton = root.querySelector('[data-action="copy"]');
    toastEl = root.querySelector('.bgh-toast');

    root.addEventListener('click', onClick);
    root.addEventListener('keydown', onKeyDown);
    root.addEventListener('wheel', onWheel, { passive: false });
    stage.addEventListener('pointerdown', onPointerDown);
    stage.addEventListener('pointermove', onPointerMove);
    stage.addEventListener('pointerup', onPointerUp);
    stage.addEventListener('pointercancel', onPointerUp);
  }

  function open(newItems, startIndex) {
    if (!root) build();
    items = newItems;
    returnFocus = document.activeElement;
    root.classList.toggle('bgh-single', items.length < 2);
    document.documentElement.classList.add('bgh-open');
    document.body.append(root);
    root.focus();
    // Browser back closes the viewer instead of leaving it over the next page.
    addEventListener('popstate', close);
    show(startIndex);
  }

  function close() {
    root.remove();
    stage.replaceChildren();
    media = null;
    document.documentElement.classList.remove('bgh-open');
    removeEventListener('popstate', close);
    returnFocus?.focus({ preventScroll: true });
  }

  function show(i) {
    if (i < 0 || i >= items.length) return;
    index = i;
    const source = items[i];
    const isVideo = source.tagName === 'VIDEO';

    media = document.createElement(isVideo ? 'video' : 'img');
    media.className = 'bgh-media';
    media.src = source.currentSrc || source.src;
    if (isVideo) {
      media.controls = true;
      media.autoplay = true;
      // Continue where the inline video was.
      media.currentTime = source.currentTime;
      source.pause();
    } else {
      media.alt = source.alt;
      media.draggable = false;
    }
    stage.replaceChildren(media);
    setZoom(1);

    counter.textContent = `${i + 1} / ${items.length}`;
    prevButton.disabled = i === 0;
    nextButton.disabled = i === items.length - 1;
    copyButton.hidden = isVideo;
  }

  const isImage = () => media?.tagName === 'IMG';

  // Zoom and pan

  function setZoom(scale, x = 0, y = 0, animate = false) {
    zoom = scale > 1 ? { scale, x, y } : { scale: 1, x: 0, y: 0 };
    media.style.transition = animate ? '' : 'none';
    media.style.transform = `translate(${zoom.x}px, ${zoom.y}px) scale(${zoom.scale})`;
    root.classList.toggle('bgh-zoomed', zoom.scale > 1);
  }

  // Zooms to `scale` while keeping the point under (clientX, clientY) in place.
  function zoomAt(scale, clientX = innerWidth / 2, clientY = innerHeight / 2, animate = false) {
    if (!isImage()) return;
    scale = Math.min(Math.max(scale, 1), MAX_ZOOM);
    const px = clientX - innerWidth / 2;
    const py = clientY - innerHeight / 2;
    const ratio = scale / zoom.scale;
    setZoom(scale, px - (px - zoom.x) * ratio, py - (py - zoom.y) * ratio, animate);
  }

  // Clicking the image toggles between fit-to-screen and its natural size (at least 2x).
  function toggleZoom(event) {
    if (zoom.scale > 1) return setZoom(1, 0, 0, true);
    zoomAt(Math.max(2, media.naturalWidth / media.clientWidth), event.clientX, event.clientY, true);
  }

  function onWheel(event) {
    event.preventDefault();
    // Trackpad pinches arrive as ctrl+wheel with much smaller deltas.
    zoomAt(zoom.scale * Math.exp(-event.deltaY * (event.ctrlKey ? 0.01 : 0.002)), event.clientX, event.clientY);
  }

  function onPointerDown(event) {
    if (zoom.scale === 1 || event.target !== media || event.button !== 0) return;
    drag = { startX: event.clientX, startY: event.clientY, x: zoom.x, y: zoom.y };
    dragged = false;
    media.setPointerCapture(event.pointerId);
  }

  function onPointerMove(event) {
    if (!drag) return;
    const dx = event.clientX - drag.startX;
    const dy = event.clientY - drag.startY;
    dragged ||= Math.hypot(dx, dy) > 3;
    setZoom(zoom.scale, drag.x + dx, drag.y + dy);
  }

  function onPointerUp() {
    drag = null;
  }

  // Input

  const actions = {
    prev: () => show(index - 1),
    next: () => show(index + 1),
    copy,
    download,
    close,
  };

  function onClick(event) {
    const action = event.target.closest('[data-action]')?.dataset.action;
    if (action) actions[action]();
    else if (event.target === stage) close();
    else if (event.target === media && isImage()) {
      // The click that ends a pan shouldn't also zoom out.
      if (dragged) dragged = false;
      else toggleZoom(event);
    }
  }

  function onKeyDown(event) {
    // Keep GitHub's own keyboard shortcuts from firing behind the viewer.
    event.stopPropagation();

    const mod = event.metaKey || event.ctrlKey;
    const key = event.key.toLowerCase();
    let handler;
    if (mod && key === 'c') handler = copy;
    else if (mod && key === 's') handler = download;
    else if (!mod && !event.altKey) {
      handler = {
        escape: close,
        arrowleft: actions.prev,
        arrowright: actions.next,
        '+': () => zoomAt(zoom.scale * 1.5, undefined, undefined, true),
        '=': () => zoomAt(zoom.scale * 1.5, undefined, undefined, true),
        '-': () => zoomAt(zoom.scale / 1.5, undefined, undefined, true),
        0: () => setZoom(1, 0, 0, true),
      }[key];
    }

    if (handler) {
      event.preventDefault();
      handler();
    }
  }

  // Actions

  async function copy() {
    if (!isImage()) return;
    try {
      // Passing a promise keeps the clipboard write tied to the user's click while the image loads.
      const png = request('fetch-png', media.src).then((base64) => new Blob([Uint8Array.fromBase64(base64)], { type: 'image/png' }));
      await navigator.clipboard.write([new ClipboardItem({ 'image/png': png })]);
      toast('Image copied');
    } catch {
      toast('Couldn’t copy image');
    }
  }

  async function download() {
    try {
      await request('download', media.src);
    } catch {
      toast('Couldn’t download');
    }
  }

  async function request(type, url) {
    const { result, error } = await chrome.runtime.sendMessage({ type, url });
    if (error) throw new Error(error);
    return result;
  }

  function toast(message) {
    toastEl.textContent = message;
    toastEl.classList.add('bgh-visible');
    clearTimeout(toastTimer);
    toastTimer = setTimeout(() => toastEl.classList.remove('bgh-visible'), 1600);
  }

  return { open };
})();
