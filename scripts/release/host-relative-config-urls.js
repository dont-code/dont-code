/*
 * Injected into the released host index.html by assemble-bundle.mjs.
 *
 * The released configuration files use paths relative to each app's
 * <base href>, so the same bundle works at the domain root and under a
 * YunoHost sub-path. The dashboard already resolves relative URLs itself;
 * the host does not (it passes projectApiUrl to new URL()), so normalise the
 * values of any fetched repository config before the host reads them.
 */
(() => {
  if (window.__dontCodeRelativeConfigUrls) return;
  window.__dontCodeRelativeConfigUrls = true;

  const fetchConfig = window.fetch;
  if (typeof fetchConfig !== 'function') return;

  const isAbsolute = (value) =>
    typeof value === 'string' &&
    (/^[a-zA-Z][a-zA-Z\d+.-]*:/.test(value) || value.startsWith('//'));
  const resolve = (value) =>
    !isAbsolute(value) && value ? new URL(value, document.baseURI).toString() : value;
  const configUrl = (url) => /(?:^|\/)assets\/config\/[^/?#]+\.json(?:[?#]|$)/.test(url);

  window.fetch = async (input, init) => {
    const response = await fetchConfig.call(window, input, init);
    const url = typeof input === 'string' ? input : input?.url;
    if (!response.ok || typeof url !== 'string' || !configUrl(url)) return response;

    let config;
    try {
      config = await response.clone().json();
    } catch {
      return response;
    }
    if (config == null || typeof config !== 'object') return response;

    let changed = false;
    const fields = [
      'projectApiUrl', 'storeApiUrl', 'documentApiUrl',
      'generateApiUrl', 'applicationHostUrl', 'webSocketUrl'
    ];
    for (const field of fields) {
      const value = config[field];
      if (typeof value === 'string' && !isAbsolute(value)) {
        config[field] = resolve(value);
        changed = true;
      }
    }
    for (const plugin of config.plugins ?? []) {
      const info = plugin?.info;
      const value = info?.['remote-entry'];
      if (typeof value === 'string' && !isAbsolute(value)) {
        info['remote-entry'] = resolve(value);
        changed = true;
      }
    }
    if (!changed) return response;

    return new Response(JSON.stringify(config), {
      status: response.status,
      statusText: response.statusText,
      headers: { 'Content-Type': response.headers.get('content-type') || 'application/json' }
    });
  };
})();
