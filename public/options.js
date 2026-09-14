const DEFAULT_BACKEND_URL = 'https://evolvio-api-6nch.onrender.com';
const LEGACY_BACKEND_URL = 'https://gleameet.onrender.com';

function normalizeBackendUrl(value) {
  const normalized = typeof value === 'string' ? value.trim().replace(/\/+$/, '') : '';
  return !normalized || normalized === LEGACY_BACKEND_URL ? DEFAULT_BACKEND_URL : normalized;
}

document.addEventListener('DOMContentLoaded', () => {
  const input = document.getElementById('backendUrl');
  const saveBtn = document.getElementById('save');
  const status = document.getElementById('status');

  // Load saved URL
  chrome.storage.sync.get({ backendUrl: DEFAULT_BACKEND_URL }, (items) => {
    const backendUrl = normalizeBackendUrl(items.backendUrl);
    input.value = backendUrl;
    if (backendUrl !== items.backendUrl) chrome.storage.sync.set({ backendUrl });
  });

  saveBtn.addEventListener('click', () => {
    let url = input.value.trim();
    // Remove trailing slash
    if (url.endsWith('/')) url = url.slice(0, -1);
    url = normalizeBackendUrl(url);

    chrome.storage.sync.set({ backendUrl: url }, () => {
      status.textContent = 'Saved!';
      setTimeout(() => { status.textContent = ''; }, 2000);
    });
  });
});
