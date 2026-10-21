// Media requests run here because GitHub's media hosts don't send CORS headers,
// so the content script can't read the files itself.

chrome.runtime.onMessage.addListener((message, _sender, sendResponse) => {
  const handler = { 'fetch-png': fetchPng, download }[message.type];
  if (!handler) return;

  handler(message.url).then(
    (result) => sendResponse({ result }),
    (error) => sendResponse({ error: String(error) }),
  );
  return true;
});

// Returns the image as base64-encoded PNG, the only image format the clipboard accepts.
async function fetchPng(url) {
  let blob = await (await fetchFresh(url)).blob();
  if (blob.type !== 'image/png') {
    const bitmap = await createImageBitmap(blob);
    const canvas = new OffscreenCanvas(bitmap.width, bitmap.height);
    canvas.getContext('2d').drawImage(bitmap, 0, 0);
    blob = await canvas.convertToBlob({ type: 'image/png' });
  }
  return new Uint8Array(await blob.arrayBuffer()).toBase64();
}

async function download(url) {
  const response = await fetchFresh(url, { method: 'HEAD' }).catch(() => null);
  return chrome.downloads.download({ url: response?.url ?? url });
}

// Uploaded media is served from signed URLs that expire after five minutes.
// When one has expired, ask GitHub for a fresh one via the attachment's permanent URL.
async function fetchFresh(url, init) {
  const response = await fetch(url, init);
  if (response.ok) return response;

  const uuid = url.startsWith('https://private-user-images.githubusercontent.com/')
    && new URL(url).pathname.match(/[0-9a-f]{8}-(?:[0-9a-f]{4}-){3}[0-9a-f]{12}/)?.[0];
  if (uuid) {
    const fresh = await fetch(`https://github.com/user-attachments/assets/${uuid}`, { ...init, credentials: 'include' });
    if (fresh.ok) return fresh;
  }
  throw new Error(`Request failed with status ${response.status}`);
}
