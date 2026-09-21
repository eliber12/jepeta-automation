/** Jepeta public UI. No credentials, wallet libraries or trading actions. */
export const API = 'https://aitgmgfumsdqecmanrab.supabase.co/functions/v1/jepeta-risk-scan';
export const SITE = 'https://eliber12.github.io/jepeta-automation/';
export const EVENT_API = 'https://aitgmgfumsdqecmanrab.supabase.co/functions/v1/jepeta-event';
export const ACP_URL = 'https://app.virtuals.io/acp/agent/01a0b446-374c-7eb8-8fe8-cd1a9945ea70';
export const PASS_DEMO = '0x532f27101965dd16442e59d40670faf5ebb142e4'; // BRETT: PASS when verified 2026-09-21
export const WARN_DEMO = '0x940181a94a35a4569e4529a3cdfb74e38fd98631'; // AERO: WARN when verified 2026-09-21
export const BLOCK_DEMO = '0x3eacac56ea67611250b236af99fc7b01ba62aa96'; // TAP: GoPlus honeypot/BLOCK when verified 2026-09-21
export const DEMOS = Object.freeze({ pass: PASS_DEMO, warn: WARN_DEMO, block: BLOCK_DEMO });

const BURN = new Set([
  '0x0000000000000000000000000000000000000000',
  '0x000000000000000000000000000000000000dead'
]);

export function validAddress(value) {
  return typeof value === 'string' &&
    /^0x[a-fA-F0-9]{40}$/.test(value.trim()) &&
    !BURN.has(value.trim().toLowerCase());
}

const REQUIRED_KEYS = [
  'schema_version','chain_id','token_address','decision','risk_score','risk_level',
  'is_honeypot','is_mintable','buy_tax_percent','sell_tax_percent',
  'top10_holder_concentration_percent','top10_holder_count',
  'lp_locked_percent_observed','lp_holder_sample_count','liquidity_usd',
  'data_quality','source_status','warnings','observed_at','paid_report'
];

function numberOrNull(value, min = 0, max = Number.POSITIVE_INFINITY) {
  return value === null || (typeof value === 'number' && Number.isFinite(value) && value >= min && value <= max);
}

/** Reject wrong-token, wrong-chain, malformed or undocumented provider responses. */
export function validatePreview(data, address) {
  if (!data || typeof data !== 'object' || Array.isArray(data)) throw new Error('The provider returned an incomplete or mismatched result. No assessment is shown. Try again.');
  const keys = Object.keys(data);
  if (REQUIRED_KEYS.some(key => !(key in data)) || keys.some(key => !REQUIRED_KEYS.includes(key)) ||
      data.schema_version !== '4.0.0' ||
      data.chain_id !== 8453 ||
      typeof data.token_address !== 'string' || data.token_address.toLowerCase() !== address.toLowerCase() ||
      !['PASS','WARN','BLOCK'].includes(data.decision) ||
      typeof data.risk_score !== 'number' || !Number.isFinite(data.risk_score) || data.risk_score < 0 || data.risk_score > 100 ||
      !['LOW','MEDIUM','HIGH','CRITICAL'].includes(data.risk_level) ||
      typeof data.is_honeypot !== 'boolean' || typeof data.is_mintable !== 'boolean' ||
      !numberOrNull(data.buy_tax_percent, 0, 100) ||
      !numberOrNull(data.sell_tax_percent, 0, 100) ||
      !numberOrNull(data.top10_holder_concentration_percent, 0, 100) ||
      !Number.isInteger(data.top10_holder_count) || data.top10_holder_count < 0 || data.top10_holder_count > 10 ||
      !numberOrNull(data.lp_locked_percent_observed, 0, 100) ||
      !Number.isInteger(data.lp_holder_sample_count) || data.lp_holder_sample_count < 0 || data.lp_holder_sample_count > 10 ||
      !numberOrNull(data.liquidity_usd, 0) ||
      !['HIGH','MEDIUM','LOW'].includes(data.data_quality) ||
      !data.source_status || typeof data.source_status !== 'object' || Array.isArray(data.source_status) ||
      data.source_status.goplus !== 'OK' ||
      !['OK','PARTIAL','RATE_LIMITED','UNAVAILABLE'].includes(data.source_status.dexscreener) ||
      Object.keys(data.source_status).some(key => !['goplus','dexscreener'].includes(key)) ||
      !Array.isArray(data.warnings) || data.warnings.length > 12 ||
      data.warnings.some(w => typeof w !== 'string' || w.length > 4000) ||
      typeof data.observed_at !== 'string' || !Number.isFinite(Date.parse(data.observed_at)) ||
      !data.paid_report || typeof data.paid_report !== 'object' ||
      data.paid_report.protocol !== 'Virtuals ACP v2' ||
      data.paid_report.offering !== 'Token Risk Scan' ||
      data.paid_report.priceUSDC !== '0.03') {
    throw new Error('The provider returned an incomplete or mismatched result. No assessment is shown. Try again.');
  }
  return data;
}

export function requestError(status, body = {}) {
  const code = typeof body?.code === 'string' ? body.code : '';
  if (code === 'JEPETA_RATE_LIMITED' || code === 'TOKEN_RATE_LIMITED') return 'Jepeta is rate-limiting repeated scans to protect upstream capacity. Wait briefly, then try again.';
  if (status === 429 || code === 'GOPLUS_RATE_LIMITED') return 'GoPlus is rate-limiting security checks right now. No verdict was issued. Wait about a minute, then try again.';
  if (code === 'DEXSCREENER_RATE_LIMITED') return 'DEX Screener is rate-limiting market data. Retry shortly.';
  if (code === 'MINTABLE_STATUS_UNKNOWN') return 'GoPlus could not confirm whether this token can mint new supply. A strict machine verdict was not issued.';
  if (code === 'HONEYPOT_UNKNOWN') return 'GoPlus could not confirm honeypot status. A strict machine verdict was not issued.';
  if (status === 422 || code === 'TOKEN_NOT_COVERED') return 'This exact Base token is not sufficiently covered by GoPlus. No assessment can be issued.';
  if (status === 400 || code === 'INVALID_ADDRESS') return 'Check the contract address and make sure it is a Base ERC-20 token.';
  if (status >= 500 || code === 'GOPLUS_UNAVAILABLE') return 'The security data is temporarily unavailable. No assessment has been issued. Please try again shortly.';
  return typeof body?.error === 'string' && body.error.length < 300 ? body.error : 'The scan could not be completed. Please try again.';
}

export function integrationCode(language) {
  if (language === 'curl') return `# Exact Base token contract.
curl --get \\\n  '${API}' \\\n  --data-urlencode 'tokenAddress=TOKEN_ADDRESS'

# Machine contract:
# decision = PASS | WARN | BLOCK
# is_honeypot / is_mintable are explicit booleans.
# PASS is a screening result, not permission to trade.`;
  return `// Exact Base token contract
const tokenAddress = 'TOKEN_ADDRESS';
const endpoint = '${API}';

const response = await fetch(
  endpoint + '?tokenAddress=' + encodeURIComponent(tokenAddress)
);
const body = await response.json();
if (!response.ok) throw new Error(body.code || 'SCAN_UNAVAILABLE');

if (body.decision === 'BLOCK') {
  // Stop your execution path.
}
console.log(body.decision, body.is_honeypot, body.is_mintable);`;
}

export function canonicalScanUrl(address) {
  const url = new URL(SITE);
  url.searchParams.set('token', address.toLowerCase());
  url.hash = 'scanner';
  return url.toString();
}

function init() {
  const $ = id => document.getElementById(id);
  const form = $('scan-form'), input = $('token'), status = $('status');
  let currentResult = null, busy = false, language = 'javascript', toastTimer;
  let debounceTimer = null, lastRequestedAddress = '', lastRequestAt = 0;

  const pageParams = new URLSearchParams(window.location.search);
  const sessionKey = 'jepeta_session_id';
  let sessionId = sessionStorage.getItem(sessionKey);
  if (!sessionId) {
    sessionId = crypto.randomUUID ? crypto.randomUUID() : String(Date.now()) + '-' + Math.random().toString(16).slice(2);
    sessionStorage.setItem(sessionKey, sessionId);
  }
  const attribution = {
    utm_source: pageParams.get('utm_source'),
    utm_medium: pageParams.get('utm_medium'),
    utm_campaign: pageParams.get('utm_campaign'),
    utm_content: pageParams.get('utm_content'),
    referrer_host: (() => { try { return document.referrer ? new URL(document.referrer).host : null; } catch { return null; } })()
  };
  function track(event_name, detail = {}) {
    const payload = {
      event_name, session_id: sessionId,
      token_address: detail.token_address || currentResult?.token_address || null,
      decision: detail.decision || currentResult?.decision || null,
      status_code: Number.isInteger(detail.status_code) ? detail.status_code : null,
      duration_ms: Number.isInteger(detail.duration_ms) ? detail.duration_ms : null,
      ...attribution,
      metadata: detail.metadata || {}
    };
    fetch(EVENT_API, {
      method: 'POST', headers: {'Content-Type':'application/json'},
      body: JSON.stringify(payload), keepalive: true
    }).catch(() => {});
  }

  const setStatus = (message, error = false) => {
    status.textContent = message;
    status.classList.toggle('error', error);
  };

  function toast(message) {
    clearTimeout(toastTimer);
    $('toast').textContent = message;
    $('toast').hidden = false;
    toastTimer = setTimeout(() => { $('toast').hidden = true; }, 3500);
  }

  async function copy(text, message) {
    try {
      if (!navigator.clipboard?.writeText) throw new Error('clipboard unavailable');
      await navigator.clipboard.writeText(text);
      toast(message);
    } catch {
      $('copy-value').value = text;
      $('copy-dialog').showModal();
      $('copy-value').focus();
      $('copy-value').select();
    }
  }

  function setTab(buttons, active, render) {
    buttons.forEach(button => {
      const selected = button === active;
      button.setAttribute('aria-selected', String(selected));
      button.tabIndex = selected ? 0 : -1;
    });
    render(active);
  }

  function bindTabs(selector, render) {
    const buttons = [...document.querySelectorAll(selector)];
    buttons.forEach(button => {
      button.addEventListener('click', () => setTab(buttons, button, render));
      button.addEventListener('keydown', event => {
        const index = buttons.indexOf(button);
        let next;
        if (event.key === 'ArrowRight') next = buttons[(index + 1) % buttons.length];
        if (event.key === 'ArrowLeft') next = buttons[(index - 1 + buttons.length) % buttons.length];
        if (event.key === 'Home') next = buttons[0];
        if (event.key === 'End') next = buttons.at(-1);
        if (next) { event.preventDefault(); setTab(buttons, next, render); next.focus(); }
      });
    });
    return buttons;
  }

  const resultTabs = bindTabs('[data-result-tab]', button => {
    const summary = button.dataset.resultTab === 'summary';
    $('summary-panel').hidden = !summary;
    $('json-panel').hidden = summary;
  });

  function showCode() {
    const code = integrationCode(language);
    $('code-content').replaceChildren();
    const lines = code.split('\n');
    lines.forEach((line, i) => {
      const span = document.createElement('span');
      span.textContent = line + (i === lines.length - 1 ? '' : '\n');
      if (line.trim().startsWith('//') || line.trim().startsWith('#')) span.className = 'code-comment';
      else if (line.includes('https://') || line.includes('TOKEN_ADDRESS')) span.className = 'code-string';
      else if (/^(const|if|curl)/.test(line)) span.className = 'code-keyword';
      $('code-content').append(span);
    });
    $('integration-code').setAttribute('aria-labelledby', language === 'curl' ? 'curl-tab' : 'javascript-tab');
  }

  bindTabs('[data-code-tab]', button => { language = button.dataset.codeTab; showCode(); });
  showCode();

  const demoButtons = [...document.querySelectorAll('[data-demo-address]')];

  function setBusy(value) {
    busy = value;
    $('scan').disabled = value;
    demoButtons.forEach(button => { button.disabled = value; });
    $('paste').disabled = value;
    input.readOnly = value;
    $('scan-label').textContent = value ? 'Analyzing…' : 'Analyze token';
    $('scan-arrow').toggleAttribute('hidden', value);
    $('scan-spinner').hidden = !value;
    $('output-panel').setAttribute('aria-busy', String(value));
    $('loading-state').hidden = !value;
  }

  function resetOutput() {
    currentResult = null;
    $('result').hidden = true;
    $('empty-state').hidden = false;
  }

  const formatPercent = value => value === null ? 'Unavailable' : `${Number(value).toFixed(2)}%`;
  const formatUsd = value => value === null ? 'Unavailable' : new Intl.NumberFormat(undefined, {
    style: 'currency', currency: 'USD', maximumFractionDigits: value >= 1000 ? 0 : 2
  }).format(value);

  function render(data) {
    currentResult = data;
    const severity = { LOW: 'var(--mint)', MEDIUM: 'var(--amber)', HIGH: 'var(--amber)', CRITICAL: 'var(--red)' };
    $('result').style.setProperty('--result-color', data.decision === 'BLOCK' ? 'var(--red)' : severity[data.risk_level]);
    $('score-dial').style.setProperty('--score-angle', `${data.risk_score * 3.6}deg`);
    $('score').textContent = String(data.risk_score);
    $('risk-badge').textContent = `${data.risk_level} RISK`;
    $('verdict-title').textContent = {
      BLOCK: 'Hard blocker detected.',
      WARN: 'Review before acting.',
      PASS: 'No configured warning found.'
    }[data.decision];
    $('verdict').textContent = data.decision;
    $('honeypot').textContent = data.is_honeypot ? 'Detected' : 'Not detected';
    $('mintable').textContent = data.is_mintable ? 'Yes' : 'No';
    $('quality').textContent = data.data_quality.charAt(0) + data.data_quality.slice(1).toLowerCase();
    $('warning-count').textContent = String(data.warnings.length);
    $('buy-tax').textContent = formatPercent(data.buy_tax_percent);
    $('sell-tax').textContent = formatPercent(data.sell_tax_percent);
    $('top10').textContent = formatPercent(data.top10_holder_concentration_percent);
    $('lp-locked').textContent = data.lp_locked_percent_observed === null
      ? 'Unavailable'
      : `${formatPercent(data.lp_locked_percent_observed)} observed`;
    $('liquidity-usd').textContent = formatUsd(data.liquidity_usd);
    $('source-goplus').textContent = data.source_status.goplus;
    $('source-dex').textContent = data.source_status.dexscreener;
    $('summary').textContent = data.decision === 'PASS'
      ? 'PASS means no configured BLOCK/WARN condition was observed in the available data. It is not a safety guarantee.'
      : data.decision === 'WARN'
        ? 'One or more material risk or data-quality conditions require review before an execution policy proceeds.'
        : 'A configured hard blocker was observed. An automated execution policy should stop.';
    $('warnings').replaceChildren();
    data.warnings.forEach(warning => {
      const li = document.createElement('li');
      li.textContent = warning;
      $('warnings').append(li);
    });
    $('result-json').textContent = JSON.stringify(data, null, 2);
    $('result-address').textContent = `${data.token_address.slice(0, 10)}…${data.token_address.slice(-6)}`;
    $('result-address').title = data.token_address;
    $('observed-at').textContent = 'Observed ' + new Date(data.observed_at).toLocaleString(undefined, {
      month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit'
    });
    $('observed-at').title = data.observed_at;
    const contextual = $('contextual-acp');
    if (contextual) {
      contextual.hidden = !['WARN','BLOCK'].includes(data.decision);
      contextual.href = ACP_URL;
    }
    resultTabs[0].click();
    $('empty-state').hidden = true;
    $('result').hidden = false;
  }

  function syncTokenUrl(address) {
    const next = new URL(window.location.href);
    next.searchParams.delete('tokenAddress');
    next.searchParams.set('token', address.toLowerCase());
    next.hash = 'scanner';
    history.replaceState({ token: address.toLowerCase() }, '', next);
  }

  async function runScan() {
    if (busy) return;
    resetOutput();
    const address = input.value.trim();
    input.removeAttribute('aria-invalid');

    if (!validAddress(address)) {
      input.setAttribute('aria-invalid', 'true');
      setStatus('Enter a valid Base token contract: 0x followed by 40 hexadecimal characters. Zero and burn addresses are not supported.', true);
      input.focus();
      return;
    }

    const normalized = address.toLowerCase();
    const now = Date.now();
    if (normalized === lastRequestedAddress && now - lastRequestAt < 1200) {
      setStatus('That token was just requested. Wait a moment before scanning it again.');
      return;
    }
    lastRequestedAddress = normalized;
    lastRequestAt = now;
    syncTokenUrl(normalized);

    setBusy(true);
    $('empty-state').hidden = true;
    setStatus('Requesting GoPlus security and DEX Screener market data…');
    const scanStartedAt = performance.now();
    track('scan_started', { token_address: normalized });
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 20000);
    let success = false;

    try {
      const response = await fetch(`${API}?tokenAddress=${encodeURIComponent(normalized)}`, {
        method: 'GET',
        headers: { Accept: 'application/json' },
        signal: controller.signal,
        cache: 'no-store'
      });
      const text = await response.text();
      if (text.length > 64000) throw new Error('The provider returned an unexpected response. No assessment is shown.');
      let body = {};
      try { body = text ? JSON.parse(text) : {}; } catch {
        throw new Error('The provider returned an unreadable response. No assessment is shown.');
      }
      if (!response.ok) {
        const failure = new Error(requestError(response.status, body));
        failure.statusCode = response.status;
        failure.errorCode = body?.code || null;
        throw failure;
      }
      const validated = validatePreview(body, normalized);
      render(validated);
      setStatus('Scan complete. Review the raw signals, source status and limitations.');
      track('scan_success', {
        token_address: normalized,
        decision: validated.decision,
        status_code: 200,
        duration_ms: Math.round(performance.now() - scanStartedAt),
        metadata: { cache: response.headers.get('x-jepeta-cache') || null }
      });
      success = true;
    } catch (error) {
      resetOutput();
      const message = error?.name === 'AbortError'
        ? 'The scan timed out. No assessment has been issued. Please try again.'
        : error instanceof TypeError
          ? 'The scanner could not be reached. Check your connection and try again.'
          : error?.message || 'The scan could not be completed. No assessment is shown.';
      setStatus(message, true);
      track('scan_error', {
        token_address: normalized,
        status_code: Number.isInteger(error?.statusCode) ? error.statusCode : null,
        duration_ms: Math.round(performance.now() - scanStartedAt),
        metadata: { code: error?.errorCode || error?.name || 'CLIENT_ERROR' }
      });
    } finally {
      clearTimeout(timeout);
      setBusy(false);
      if (success && window.matchMedia('(max-width: 620px)').matches) {
        $('output-panel').scrollIntoView({
          behavior: window.matchMedia('(prefers-reduced-motion: reduce)').matches ? 'auto' : 'smooth',
          block: 'start'
        });
      }
    }
  }

  function scheduleScan(delay = 350) {
    clearTimeout(debounceTimer);
    debounceTimer = setTimeout(() => runScan(), delay);
  }

  form.addEventListener('submit', event => { event.preventDefault(); scheduleScan(); });
  input.addEventListener('input', () => {
    input.removeAttribute('aria-invalid');
    if (!busy) setStatus('');
  });

  demoButtons.forEach(button => {
    button.addEventListener('click', () => {
      input.value = button.dataset.demoAddress;
      input.removeAttribute('aria-invalid');
      setStatus(`Loading the ${button.dataset.demoLabel} demo with live data…`);
      const label = String(button.dataset.demoLabel || '').toLowerCase();
      if (['pass','warn','block'].includes(label)) track('demo_' + label, { token_address: button.dataset.demoAddress });
      scheduleScan(120);
    });
  });

  $('paste').addEventListener('click', async () => {
    try {
      if (!navigator.clipboard?.readText) throw new Error('unsupported');
      const text = (await navigator.clipboard.readText()).trim();
      if (text.length > 100) {
        setStatus('Copy only the token contract address, then paste again.', true);
        return;
      }
      input.value = text;
      input.removeAttribute('aria-invalid');
      input.focus();
      setStatus('Address pasted. Select Analyze token to continue.');
    } catch {
      setStatus('Paste access is unavailable. Press and hold the address field, or use your keyboard to paste.');
      input.focus();
    }
  });

  $('copy-json').addEventListener('click', () => {
    if (currentResult) copy(JSON.stringify(currentResult, null, 2), 'Scan JSON copied.');
  });
  $('share-scan').addEventListener('click', () => {
    if (currentResult) copy(canonicalScanUrl(currentResult.token_address), 'Scan link copied. Opening it runs a fresh scan.');
  });
  $('copy-code').addEventListener('click', () => copy(integrationCode(language), 'Integration code copied.'));
  document.querySelectorAll('[data-track]').forEach(link => {
    link.addEventListener('click', () => {
      const eventName = link.dataset.track;
      if (eventName === 'acp_outbound') {
        track('full_report_clicked', { metadata: { placement: link.dataset.placement || 'site' } });
        track('acp_outbound', { metadata: { placement: link.dataset.placement || 'site' } });
      } else if (eventName) {
        track(eventName, { metadata: { placement: link.dataset.placement || 'site' } });
      }
    });
  });
  $('copy-dialog').addEventListener('click', event => {
    if (event.target === $('copy-dialog')) $('copy-dialog').close();
  });

  const params = new URLSearchParams(window.location.search);
  const supplied = params.get('token') || params.get('tokenAddress');
  if (supplied) {
    input.value = supplied.slice(0, 100);
    if (validAddress(supplied)) {
      if (!params.get('token')) syncTokenUrl(supplied);
      $('scanner').scrollIntoView({ behavior: 'instant', block: 'start' });
      scheduleScan(80);
    } else {
      input.setAttribute('aria-invalid', 'true');
      setStatus('The shared link does not contain a valid Base token address.', true);
    }
  }
}

if (typeof document !== 'undefined') init();
