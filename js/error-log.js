(() => {
  const REPORT_ENDPOINT = 'https://chainway-chat.chainway.workers.dev/log';
  const MAX_REPORTS_PER_SESSION = 5;
  const seen = new Set();
  let sent = 0;

  function report(payload) {
    if (sent >= MAX_REPORTS_PER_SESSION) return;
    const signature = `${payload.type}|${payload.message}|${payload.source}|${payload.line}`;
    if (seen.has(signature)) return;
    seen.add(signature);
    sent += 1;
    try {
      fetch(REPORT_ENDPOINT, {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify(payload),
        keepalive: true,
      }).catch(() => {});
    } catch {}
  }

  addEventListener('error', event => {
    report({
      type: 'error',
      message: event.message || 'Unknown error',
      source: event.filename || '',
      line: event.lineno || 0,
      column: event.colno || 0,
      stack: event.error?.stack || '',
      page: location.href,
      userAgent: navigator.userAgent,
    });
  });

  addEventListener('unhandledrejection', event => {
    const reason = event.reason;
    report({
      type: 'unhandledrejection',
      message: (reason && reason.message) || String(reason),
      source: '',
      line: 0,
      column: 0,
      stack: (reason && reason.stack) || '',
      page: location.href,
      userAgent: navigator.userAgent,
    });
  });
})();
