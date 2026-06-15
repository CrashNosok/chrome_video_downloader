(() => {
  const embedUrls = new Set();

  function scanForIframes() {
    const iframes = document.querySelectorAll('iframe[src*="kinescope.io/embed/"]');
    for (const iframe of iframes) {
      embedUrls.add(iframe.src);
    }
  }

  scanForIframes();

  const observer = new MutationObserver(() => scanForIframes());
  observer.observe(document.body, { childList: true, subtree: true });

  chrome.runtime.onMessage.addListener((message, _sender, sendResponse) => {
    if (message.action === 'getEmbedUrls') {
      scanForIframes();
      sendResponse(Array.from(embedUrls));
    }
    return true;
  });
})();
