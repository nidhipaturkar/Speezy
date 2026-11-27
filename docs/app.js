/* =====================================================================
   Speezy — one persistent interactive world.
   The map never leaves. Scrolling changes what is happening ON the map.
   ===================================================================== */
(() => {
  'use strict';

  const COUNTRIES = window.SPEEZY_COUNTRIES;
  const TOPO = window.WORLD_TOPO;
  const STAGES = 8; // explore · labels · connect · pair · surfaces · discovery · construction · payment
  const FX_REFRESH_MS = 45000;
  const FX_TIMEOUT_MS = 8000;
  const FX_CACHE_KEY = 'speezy.fx.lastGood.v1';

  /* ------------------------------------------------------------------
     FX SOURCES — tried in order. All are free, keyless and CORS-enabled.
     Rates are always USD-based; any cross rate = rates[B] / rates[A].
     ------------------------------------------------------------------ */
  const upperKeys = (o) => { const r = {}; for (const k in o) if (typeof o[k] === 'number') r[k.toUpperCase()] = o[k]; return r; };
  const FX_SOURCES = [
    { name: 'OPEN.ER-API', url: 'https://open.er-api.com/v6/latest/USD',
      parse: (j) => j && j.result === 'success' && j.rates ? { rates: j.rates, published: new Date(j.time_last_update_unix * 1000) } : null },
    { name: 'CURRENCY-API · JSDELIVR', url: 'https://cdn.jsdelivr.net/npm/@fawazahmed0/currency-api@latest/v1/currencies/usd.json',
      parse: (j) => j && j.usd ? { rates: upperKeys(j.usd), published: new Date(j.date + 'T00:00:00Z') } : null },
    { name: 'CURRENCY-API · MIRROR', url: 'https://latest.currency-api.pages.dev/v1/currencies/usd.json',
      parse: (j) => j && j.usd ? { rates: upperKeys(j.usd), published: new Date(j.date + 'T00:00:00Z') } : null },
    { name: 'FRANKFURTER · ECB', url: 'https://api.frankfurter.app/latest?from=USD',
      parse: (j) => j && j.rates ? { rates: Object.assign({ USD: 1 }, j.rates), published: new Date(j.date + 'T16:00:00Z') } : null },
  ];

  /* ------------------------------------------------------------------
     PAYMENT SURFACES — illustrative, not live executable rails.
     kind: instant | card | bank | wallet | mobile. First entry = the
     method a local buyer would most likely reach for ("familiar").
     ------------------------------------------------------------------ */
  const S = (name, kind) => ({ name, kind });
  const SURFACES = {
    IN: [S('UPI', 'instant'), S('CARD', 'card'), S('IMPS', 'bank')],
    BR: [S('PIX', 'instant'), S('CARD', 'card'), S('TED', 'bank')],
    US: [S('CARD', 'card'), S('ACH', 'bank'), S('FEDNOW', 'instant')],
    JP: [S('CARD', 'card'), S('BANK TRANSFER', 'bank'), S('PAYPAY', 'wallet')],
    CN: [S('ALIPAY', 'wallet'), S('WECHAT PAY', 'wallet'), S('UNIONPAY', 'card'), S('CNAPS', 'bank')],
    GB: [S('FASTER PAYMENTS', 'instant'), S('CARD', 'card'), S('BACS', 'bank')],
    SG: [S('PAYNOW', 'instant'), S('CARD', 'card'), S('GIRO', 'bank')],
    TH: [S('PROMPTPAY', 'instant'), S('CARD', 'card'), S('BANK', 'bank')],
    MY: [S('DUITNOW', 'instant'), S('FPX', 'bank'), S('CARD', 'card')],
    ID: [S('QRIS', 'instant'), S('BI-FAST', 'bank'), S('CARD', 'card')],
    PH: [S('INSTAPAY', 'instant'), S('GCASH', 'wallet'), S('CARD', 'card'), S('PESONET', 'bank')],
    VN: [S('NAPAS 247', 'instant'), S('MOMO', 'wallet'), S('CARD', 'card'), S('BANK', 'bank')],
    KR: [S('CARD', 'card'), S('KAKAOPAY', 'wallet'), S('BANK TRANSFER', 'bank')],
    HK: [S('FPS', 'instant'), S('CARD', 'card'), S('OCTOPUS', 'wallet'), S('CHATS', 'bank')],
    TW: [S('CARD', 'card'), S('LINE PAY', 'wallet'), S('BANK TRANSFER', 'bank')],
    AU: [S('PAYID · NPP', 'instant'), S('CARD', 'card'), S('BPAY', 'bank')],
    NZ: [S('CARD', 'card'), S('BANK TRANSFER', 'bank'), S('WALLET', 'wallet')],
    AE: [S('AANI', 'instant'), S('CARD', 'card'), S('UAEFTS', 'bank')],
    SA: [S('MADA', 'card'), S('SARIE', 'instant'), S('STC PAY', 'wallet'), S('BANK', 'bank')],
    MX: [S('SPEI', 'instant'), S('CARD', 'card'), S('OXXO', 'wallet'), S('BANK', 'bank')],
    AR: [S('TRANSFERENCIAS 3.0', 'instant'), S('CARD', 'card'), S('MERCADO PAGO', 'wallet'), S('BANK', 'bank')],
    CO: [S('PSE', 'bank'), S('NEQUI', 'wallet'), S('CARD', 'card')],
    CL: [S('CARD', 'card'), S('TRANSFERENCIA', 'bank'), S('WALLET', 'wallet')],
    PE: [S('YAPE', 'wallet'), S('CARD', 'card'), S('CCE', 'bank')],
    CA: [S('INTERAC', 'instant'), S('CARD', 'card'), S('EFT', 'bank')],
    KE: [S('M-PESA', 'mobile'), S('PESALINK', 'instant'), S('CARD', 'card'), S('BANK', 'bank')],
    NG: [S('NIP', 'instant'), S('CARD', 'card'), S('USSD', 'mobile'), S('BANK', 'bank')],
    GH: [S('MOBILE MONEY', 'mobile'), S('GHIPSS', 'bank'), S('CARD', 'card')],
    ZA: [S('PAYSHAP', 'instant'), S('EFT', 'bank'), S('CARD', 'card')],
    EG: [S('INSTAPAY', 'instant'), S('MEEZA', 'card'), S('BANK', 'bank')],
    TR: [S('FAST', 'instant'), S('CARD', 'card'), S('EFT', 'bank')],
    PK: [S('RAAST', 'instant'), S('CARD', 'card'), S('JAZZCASH', 'wallet'), S('IBFT', 'bank')],
    BD: [S('BKASH', 'mobile'), S('NPSB', 'bank'), S('CARD', 'card')],
    LK: [S('LANKAPAY', 'instant'), S('CARD', 'card'), S('BANK', 'bank')],
    NP: [S('FONEPAY', 'instant'), S('CARD', 'card'), S('BANK', 'bank')],
    RU: [S('SBP', 'instant'), S('MIR', 'card'), S('BANK', 'bank')],
    IL: [S('CARD', 'card'), S('BIT', 'wallet'), S('BANK TRANSFER', 'bank')],
    // Europe — local schemes on top of SEPA
    NL: [S('IDEAL', 'instant'), S('SEPA INSTANT', 'bank'), S('CARD', 'card')],
    BE: [S('BANCONTACT', 'card'), S('SEPA INSTANT', 'bank'), S('WALLET', 'wallet')],
    FR: [S('CARTES BANCAIRES', 'card'), S('SEPA INSTANT', 'instant'), S('BANK', 'bank')],
    DE: [S('SEPA INSTANT', 'instant'), S('CARD', 'card'), S('PAYPAL', 'wallet'), S('BANK', 'bank')],
    IT: [S('CARD', 'card'), S('SEPA INSTANT', 'instant'), S('BANCOMAT PAY', 'wallet'), S('BANK', 'bank')],
    ES: [S('BIZUM', 'instant'), S('CARD', 'card'), S('SEPA', 'bank')],
    PT: [S('MB WAY', 'instant'), S('MULTIBANCO', 'card'), S('SEPA', 'bank')],
    AT: [S('EPS', 'bank'), S('SEPA INSTANT', 'instant'), S('CARD', 'card')],
    PL: [S('BLIK', 'instant'), S('CARD', 'card'), S('ELIXIR', 'bank')],
    SE: [S('SWISH', 'instant'), S('CARD', 'card'), S('BANKGIRO', 'bank')],
    DK: [S('MOBILEPAY', 'instant'), S('DANKORT', 'card'), S('BANK', 'bank')],
    FI: [S('MOBILEPAY', 'instant'), S('CARD', 'card'), S('SEPA', 'bank')],
    NO: [S('VIPPS', 'instant'), S('CARD', 'card'), S('BANK', 'bank')],
    CH: [S('TWINT', 'instant'), S('CARD', 'card'), S('SIC', 'bank')],
  };
  const EUROZONE = new Set(['AT', 'BE', 'HR', 'CY', 'EE', 'FI', 'FR', 'DE', 'GR', 'IE', 'IT', 'LV', 'LT', 'LU', 'MT', 'NL', 'PT', 'SK', 'SI', 'ES', 'XK', 'ME', 'AD', 'MC', 'SM', 'VA']);
  function surfacesFor(d) {
    if (SURFACES[d.iso2]) return SURFACES[d.iso2];
    if (EUROZONE.has(d.iso2) || d.currency === 'EUR') return [S('SEPA INSTANT', 'instant'), S('CARD', 'card'), S('WALLET', 'wallet')];
    if (d.region === 'Africa') return [S('MOBILE MONEY', 'mobile'), S('BANK TRANSFER', 'bank'), S('CARD', 'card')];
    return [S('CARD', 'card'), S('BANK TRANSFER', 'bank'), S('WALLET', 'wallet')];
  }

  // Corridors the prototype treats as non-routable (illustrative screening rule).
  const RESTRICTED = new Set(['KP', 'IR', 'SY', 'CU', 'RU', 'BY']);

  // Financial hubs used by the legacy candidate paths.
  const HUBS = [
    { city: 'NEW YORK', iso2: 'US', ll: [-74.0, 40.71] },
    { city: 'LONDON', iso2: 'GB', ll: [-0.13, 51.51] },
    { city: 'FRANKFURT', iso2: 'DE', ll: [8.68, 50.11] },
    { city: 'SINGAPORE', iso2: 'SG', ll: [103.82, 1.35] },
    { city: 'DUBAI', iso2: 'AE', ll: [55.27, 25.2] },
    { city: 'HONG KONG', iso2: 'HK', ll: [114.17, 22.32] },
  ];
  const MAJORS = new Set(['USD', 'EUR', 'JPY', 'GBP', 'CHF', 'CAD', 'AUD', 'SGD', 'HKD', 'CNY', 'NZD', 'SEK', 'NOK', 'DKK']);
  const EMERGING = new Set(['INR', 'BRL', 'MXN', 'ZAR', 'KRW', 'TWD', 'THB', 'MYR', 'IDR', 'PHP', 'PLN', 'CZK', 'HUF', 'TRY', 'AED', 'SAR', 'ILS', 'CLP', 'COP', 'PEN', 'VND', 'QAR', 'KWD', 'BHD', 'OMR', 'EGP', 'KES', 'NGN', 'PKR', 'BDT', 'RON', 'ISK']);
  const TICKER = ['USD', 'EUR', 'JPY', 'GBP', 'INR', 'SGD', 'BRL', 'CNY', 'AUD', 'CAD', 'CHF', 'AED', 'MXN', 'ZAR', 'KRW', 'HKD'];

  /* ------------------------------------------------------------------ state */
  const state = {
    src: null, dst: null, auto: false, pairAt: 0,
    routes: null, winner: null,
    t: d3.zoomIdentity,
    stage: 0, local: 0, lastStage: -1, cameraKey: '',
    fx: null, fxPrevRates: null, fxNextAt: 0, fxChecking: false,
    drag: null, hover: null,
  };

  /* ------------------------------------------------------------------ dom */
  const $ = (id) => document.getElementById(id);
  const svg = d3.select('#map');
  const flow = d3.select('#flow');
  const el = {
    map: $('map'), track: $('scrollTrack'), hover: $('hover'), tagSrc: $('tagSrc'), tagDst: $('tagDst'),
    pairBlock: $('pairBlock'), pbSrcName: $('pbSrcName'), pbSrcCode: $('pbSrcCode'), pbDstName: $('pbDstName'), pbDstCode: $('pbDstCode'),
    pbRate: $('pbRate'), pbRate2: $('pbRate2'), pbMeta: $('pbMeta'), prompt: $('prompt'), rail: $('rail'),
    routeStatus: $('routeStatus'), checkout: $('checkout'), pairLiveSym: $('pairLiveSym'), pairLiveRate: $('pairLiveRate'),
    liveDot: $('liveDot'), liveTxt: $('liveTxt'), updated: $('updated'), routeCount: $('routeCount'), tickerTrack: $('tickerTrack'),
  };
  const cache = new Map();
  const setHTML = (node, html) => { if (cache.get(node) !== html) { cache.set(node, html); node.innerHTML = html; } };
  const setOn = (node, on, cls = 'on') => { if (node.classList.contains(cls) !== !!on) node.classList.toggle(cls, !!on); };
  const clamp = (v, a, b) => Math.max(a, Math.min(b, v));
  const ease = (x) => { x = clamp(x, 0, 1); return x < 0.5 ? 2 * x * x : 1 - Math.pow(-2 * x + 2, 2) / 2; };
  const coarse = window.matchMedia('(pointer: coarse)').matches;

  for (let i = 0; i < STAGES; i++) el.rail.appendChild(document.createElement('i'));

  /* ------------------------------------------------------------------ map */
  let W = 0, H = 0, projection, path;
  const root = svg.append('g').attr('class', 'root');
  const gSphere = root.append('path').attr('class', 'sphere');
  const gGrat = root.append('path').attr('class', 'graticule');
  const gHalo = root.append('g').attr('class', 'halos');   // invisible tap areas for tiny countries, BELOW real land
  const gCountries = root.append('g').attr('class', 'countries');
  const gMicro = root.append('g').attr('class', 'micros');  // visible dots for tiny countries
  const gLabels = svg.append('g').attr('class', 'labels').style('opacity', 0);

  const allFeatures = topojson.feature(TOPO, TOPO.objects.countries).features
    .filter((f) => f.properties.name !== 'Antarctica' && f.properties.name !== 'Ashmore and Cartier Is.');

  const records = allFeatures.map((f) => {
    const key = f.id || 'X-' + f.properties.name.replace(/\W/g, '');
    const d = COUNTRIES[key] || null;
    const ll = d && f.id && d.lat != null ? [d.lon, d.lat] : d3.geoCentroid(largestPolygon(f));
    return { key, f, d, ll, area: 0, path: null, micro: null };
  });
  const live = records.filter((r) => r.d);
  const byIso2 = {};
  live.forEach((r) => { if (!byIso2[r.d.iso2] || r.f.id) byIso2[r.d.iso2] = r; });

  function largestPolygon(f) {
    if (f.geometry.type !== 'MultiPolygon') return f;
    let best = null, bestA = -1;
    for (const c of f.geometry.coordinates) {
      const g = { type: 'Polygon', coordinates: c }; const a = d3.geoArea(g);
      if (a > bestA) { bestA = a; best = g; }
    }
    return { type: 'Feature', geometry: best };
  }

  const countryPaths = gCountries.selectAll('path').data(records).join('path')
    .attr('class', (r) => 'country' + (r.d ? '' : ' inert'))
    .attr('data-iso', (r) => (r.d ? r.d.iso2 : null))
    .attr('data-key', (r) => r.key)
    .each(function (r) { r.path = this; this.__rec = r.d ? r : null; });

  const zoom = d3.zoom()
    .scaleExtent([1, 28])
    .filter((ev) => {
      if (ev.type === 'wheel') return ev.ctrlKey || ev.metaKey;
      if (ev.type === 'dblclick') return false;
      if (ev.type === 'touchstart') return ev.touches.length > 1;
      if (ev.target && ev.target.__rec) return false; // countries handle their own pointer (select / draw)
      return !ev.button;
    })
    .on('start', () => el.map.classList.add('panning'))
    .on('end', () => { el.map.classList.remove('panning'); placeLabels(); })
    .on('zoom', (ev) => {
      state.t = ev.transform;
      root.attr('transform', ev.transform);
      gMicro.selectAll('circle').attr('r', 2.2 / ev.transform.k);
      gHalo.selectAll('circle').attr('r', (coarse ? 11 : 7) / ev.transform.k);
      placeLabels();
    });
  svg.call(zoom).on('dblclick.zoom', null);

  function layout() {
    W = innerWidth; H = innerHeight;
    el.track.style.height = (STAGES + 1) * H + 'px';
    const small = W < 760;
    const top = small ? 70 : 64, bottom = small ? 70 : 56;
    projection = d3.geoNaturalEarth1().fitExtent([[small ? 6 : 30, top], [W - (small ? 6 : 30), H - bottom]], { type: 'FeatureCollection', features: allFeatures });
    path = d3.geoPath(projection);
    gSphere.attr('d', path({ type: 'Sphere' }));
    gGrat.attr('d', path(d3.geoGraticule().step([15, 15])()));
    countryPaths.attr('d', (r) => path(r.f));
    records.forEach((r) => { r.area = path.area(r.f); r.partArea = path.area(largestPolygon(r.f)); r.p = projection(r.ll); });
    // tiny or fragmented countries (Singapore, Fiji, island states) get a visible tap target
    const micros = live.filter((r) => r.partArea < 22 * Math.min(1, W / 1280) && r.p);
    gHalo.selectAll('circle').data(micros, (r) => r.key).join('circle')
      .attr('class', 'halo').attr('cx', (r) => r.p[0]).attr('cy', (r) => r.p[1]).attr('r', (coarse ? 11 : 7) / state.t.k)
      .each(function (r) { this.__rec = r; });
    gMicro.selectAll('circle').data(micros, (r) => r.key).join('circle')
      .attr('class', 'micro').attr('data-iso', (r) => r.d.iso2)
      .attr('cx', (r) => r.p[0]).attr('cy', (r) => r.p[1]).attr('r', 2.2 / state.t.k)
      .each(function (r) { r.micro = this; this.__rec = r; });
    zoom.translateExtent([[-W * 0.25, -H * 0.25], [W * 1.25, H * 1.25]]).extent([[0, 0], [W, H]]);
    buildLabels();
    state.cameraKey = '';
  }

  /* country name labels (screen space, collision-aware) */
  let labelSel = null;
  function buildLabels() {
    const cands = live.filter((r) => r.p && r.area > 3).sort((a, b) => b.area - a.area);
    labelSel = gLabels.selectAll('text').data(cands, (r) => r.key).join('text').text((r) => r.d.name.toUpperCase());
    placeLabels();
  }
  function placeLabels() {
    if (!labelSel) return;
    const k = state.t.k, boxes = [];
    labelSel.each(function (r) {
      const [x, y] = state.t.apply(r.p);
      const w = r.d.name.length * 5.8 + 6, h = 11;
      let show = r.area * k * k > 900 && x > 0 && x < W && y > 50 && y < H - 30;
      if (show) for (const b of boxes) if (Math.abs(b.x - x) * 2 < b.w + w && Math.abs(b.y - y) * 2 < b.h + h) { show = false; break; }
      if (show) boxes.push({ x, y, w, h });
      this.setAttribute('x', x); this.setAttribute('y', y + 3);
      this.style.display = show ? '' : 'none';
    });
  }

  const screenOf = (rec) => state.t.apply(projection(rec.ll));
  const screenLL = (ll) => state.t.apply(projection(ll));

  /* ------------------------------------------------------------------ pointer: hover / click / drag-to-connect */
  function recAt(x, y) {
    const n = document.elementFromPoint(x, y);
    return n && n.__rec ? n.__rec : null;
  }
  function setHoverClass(rec, cls, on) {
    if (!rec) return;
    rec.path.classList.toggle(cls, on);
    if (rec.micro) rec.micro.classList.toggle(cls, on);
  }

  el.map.addEventListener('pointerdown', (ev) => {
    const rec = ev.target.__rec;
    if (!rec || ev.button !== 0) return;
    if (ev.pointerType === 'mouse') ev.preventDefault();
    state.drag = { rec, x0: ev.clientX, y0: ev.clientY, moved: false, touch: ev.pointerType === 'touch', x: ev.clientX, y: ev.clientY, target: null };
  });
  window.addEventListener('pointermove', (ev) => {
    const dg = state.drag;
    if (dg) {
      dg.x = ev.clientX; dg.y = ev.clientY;
      if (!dg.touch && !dg.moved && Math.hypot(dg.x - dg.x0, dg.y - dg.y0) > 6) {
        dg.moved = true;
        // a drag always starts a fresh pair from the pressed country
        state.src = dg.rec; state.dst = null; state.routes = null; state.auto = false; applyClasses();
      }
      if (dg.moved) {
        const t = recAt(dg.x, dg.y);
        const target = t && t !== dg.rec ? t : null;
        if (target !== dg.target) { setHoverClass(dg.target, 'is-target', false); dg.target = target; setHoverClass(target, 'is-target', true); }
        showHover(target, dg.x, dg.y);
      }
      return;
    }
    const rec = el.map.contains(ev.target) ? ev.target.__rec || null : null;
    if (rec !== state.hover) { setHoverClass(state.hover, 'hover', false); state.hover = rec; setHoverClass(rec, 'hover', true); }
    showHover(rec, ev.clientX, ev.clientY);
  });
  window.addEventListener('pointerup', (ev) => {
    const dg = state.drag; if (!dg) return;
    state.drag = null;
    setHoverClass(dg.target, 'is-target', false);
    showHover(null);
    if (dg.moved) {
      const target = recAt(ev.clientX, ev.clientY);
      if (target && target !== dg.rec) setPair(dg.rec, target);
      else setSource(dg.rec);
      return;
    }
    // click (or tap)
    if (state.src && !state.dst && dg.rec !== state.src) setPair(state.src, dg.rec);
    else setSource(dg.rec);
  });
  window.addEventListener('pointercancel', () => { if (state.drag) { setHoverClass(state.drag.target, 'is-target', false); state.drag = null; } });
  el.map.addEventListener('pointerleave', () => { if (!state.drag) { setHoverClass(state.hover, 'hover', false); state.hover = null; showHover(null); } });
  window.addEventListener('keydown', (ev) => { if (ev.key === 'Escape') clearSelection(); });

  function showHover(rec, x, y) {
    if (!rec || coarse) { setOn(el.hover, false); return; }
    setHTML(el.hover, `${rec.d.name.toUpperCase()}<i>${rec.d.currency} ${rec.d.symbol}</i>`);
    el.hover.style.left = x + 'px'; el.hover.style.top = y + 'px';
    setOn(el.hover, true);
  }

  /* ------------------------------------------------------------------ selection */
  function applyClasses() {
    countryPaths.classed('is-src', (r) => r === state.src).classed('is-dst', (r) => r === state.dst);
    gMicro.selectAll('circle').classed('is-src', (r) => r === state.src).classed('is-dst', (r) => r === state.dst);
  }
  function setSource(rec) {
    state.src = rec; state.dst = null; state.routes = null; state.winner = null; state.auto = false;
    applyClasses();
    if (state.stage >= 3) jumpTo(2, 0.35, false);
  }
  function setPair(a, b, auto = false) {
    state.src = a; state.dst = b; state.auto = auto; state.pairAt = performance.now();
    state.routes = buildRoutes(a, b);
    state.winner = state.routes.find((r) => r.win) || null;
    applyClasses(); rebuildTicker();
    state.cameraKey = '';
    if (!auto) jumpTo(3, 0.12, state.stage < 3);
  }
  function clearSelection() {
    state.src = state.dst = null; state.routes = null; state.winner = null; applyClasses(); rebuildTicker();
    if (state.stage >= 3) jumpTo(2, 0.35, false);
  }
  function jumpTo(stage, frac, smooth) {
    window.scrollTo({ top: Math.round((stage + frac) * H), behavior: smooth ? 'smooth' : 'auto' });
  }
  function ensurePair() {
    if (state.src && state.dst) return;
    const a = state.src || byIso2.JP;
    const b = a.d.iso2 === 'BR' ? byIso2.JP : byIso2.BR;
    setPair(a, b, true);
  }

  /* ------------------------------------------------------------------ route model (visualised, modeled — not live execution) */
  function hashStr(s) { let h = 2166136261; for (let i = 0; i < s.length; i++) { h ^= s.charCodeAt(i); h = Math.imul(h, 16777619); } return (h >>> 0) / 4294967295; }
  const liq = (c) => (MAJORS.has(c) ? 1 : EMERGING.has(c) ? 0.6 : 0.3);

  function buildRoutes(a, b) {
    const sa = surfacesFor(a.d), sb = surfacesFor(b.d);
    const pick = (list, kinds) => list.find((x) => kinds.includes(x.kind));
    const srcCard = pick(sa, ['card']) || S('CARD', 'card');
    const srcBank = pick(sa, ['bank']) || pick(sa, ['instant']) || S('BANK', 'bank');
    const srcFam = sa[0];
    const dstBank = pick(sb, ['bank']) || S('BANK', 'bank');
    const dstFast = pick(sb, ['instant', 'mobile', 'wallet']) || dstBank;
    const same = a.d.currency === b.d.currency;
    const L = 1 - Math.min(liq(a.d.currency), liq(b.d.currency)); // 0 = deep liquidity, 0.7 = thin
    const j = (k) => hashStr(a.d.iso2 + b.d.iso2 + k);
    const blocked = RESTRICTED.has(a.d.iso2) || RESTRICTED.has(b.d.iso2);
    const inPair = (h) => h.iso2 === a.d.iso2 || h.iso2 === b.d.iso2;
    const hubA = HUBS.slice(0, 3).find((h) => !inPair(h));
    const hubB = HUBS.filter((h) => !inPair(h) && h !== hubA)
      .map((h) => ({ h, d: d3.geoDistance(a.ll, h.ll) + d3.geoDistance(h.ll, b.ll) }))
      .sort((x, y) => x.d - y.d)[0].h;
    const fxCost = same ? 0 : 1;
    const instantDst = ['instant', 'mobile', 'wallet'].includes(dstFast.kind);

    const routes = [
      { id: 'A', name: 'CARD RAIL', hub: hubA,
        nodes: [srcCard.name, 'CARD NETWORK', 'ACQUIRER · ' + hubA.city, dstBank.name],
        fee: 2.4 + fxCost * (0.6 + L * 1.6) + j('a') * 0.5,
        success: 92.5 - L * 7 - j('as') * 2.2,
        eta: 86400 * (1.6 + L * 1.4 + j('at')) },
      { id: 'B', name: 'CORRESPONDENT', hub: hubB,
        nodes: [srcBank.name, 'SWIFT', 'FX SWAP · ' + hubB.city, dstFast.name],
        fee: 1.1 + fxCost * (0.35 + L * 1.2) + j('b') * 0.4,
        success: 95.6 - L * 5 - j('bs') * 1.6,
        eta: 3600 * (5 + L * 26 + j('bt') * 8) },
      { id: 'C', name: 'SPEEZY ROUTE', hub: null,
        nodes: [srcFam.name, 'SPEEZY', same ? 'NO FX · ' + a.d.currency : 'FX ' + a.d.currency + '/' + b.d.currency, dstFast.name],
        fee: 0.22 + fxCost * (0.12 + L * 0.55) + j('c') * 0.12,
        success: Math.min(99.4, 97.3 + (1 - L) * 1.5 + j('cs') * 0.5),
        eta: instantDst ? 9 + L * 30 + j('ct') * 12 : 3600 * (1.5 + j('ct') * 2) },
    ];
    routes.forEach((r) => {
      r.blocked = blocked;
      r.score = r.success - r.fee * 3 - Math.log10(r.eta) * 2;
    });
    if (!blocked) routes.reduce((best, r) => (r.score > best.score ? r : best)).win = true;
    routes.familiar = srcFam; routes.dstFast = dstFast; routes.same = same;
    return routes;
  }
  const fmtEta = (s) => (s < 90 ? Math.round(s) + 's' : s < 5400 ? Math.round(s / 60) + 'm' : s < 172800 ? (s / 3600).toFixed(s < 36000 ? 1 : 0) + 'h' : (s / 86400).toFixed(1) + 'd');

  /* ------------------------------------------------------------------ FX */
  function rate(a, b) {
    const R = state.fx && state.fx.rates;
    if (!R || !R[a] || !R[b]) return null;
    return R[b] / R[a];
  }
  const fmtRate = (x) => (x == null ? '—' : x >= 1000 ? x.toLocaleString('en', { maximumFractionDigits: 2 }) : x >= 1 ? x.toFixed(4) : x.toPrecision(5));
  const fracDigits = (code) => { try { return new Intl.NumberFormat('en', { style: 'currency', currency: code }).resolvedOptions().maximumFractionDigits; } catch (e) { return 2; } };
  const fmtMoney = (amt, d) => amt == null ? d.currency + ' —' : d.symbol + (d.symbol.length > 2 ? ' ' : '') + amt.toLocaleString('en', { minimumFractionDigits: fracDigits(d.currency), maximumFractionDigits: fracDigits(d.currency) });
  const hhmmss = (d) => d.toLocaleTimeString('en-GB', { hour12: false });

  function validRates(r) {
    if (!r || typeof r !== 'object') return false;
    const n = Object.values(r).filter((v) => typeof v === 'number' && v > 0).length;
    return n >= 25 && Math.abs((r.USD || 0) - 1) < 1e-6;
  }
  async function fetchJSON(url) {
    const ctl = new AbortController(); const to = setTimeout(() => ctl.abort(), FX_TIMEOUT_MS);
    try { const res = await fetch(url, { cache: 'no-store', signal: ctl.signal }); if (!res.ok) throw new Error('HTTP ' + res.status); return await res.json(); }
    finally { clearTimeout(to); }
  }
  async function fetchFx() {
    if (state.fxChecking) return;
    state.fxChecking = true;
    for (const src of FX_SOURCES) {
      try {
        const parsed = src.parse(await fetchJSON(src.url));
        if (!parsed || !validRates(parsed.rates)) throw new Error('bad payload');
        state.fxPrevRates = state.fx && !state.fx.stale ? state.fx.rates : state.fxPrevRates;
        state.fx = { rates: parsed.rates, source: src.name, published: parsed.published, fetchedAt: new Date(), stale: false };
        try { localStorage.setItem(FX_CACHE_KEY, JSON.stringify({ rates: parsed.rates, source: src.name, published: parsed.published.toISOString(), fetchedAt: state.fx.fetchedAt.toISOString() })); } catch (e) { /* storage unavailable */ }
        finish(); return;
      } catch (e) { console.warn('[speezy] FX source failed:', src.name, e.message || e); }
    }
    // every source failed: keep the last successfully retrieved rates, clearly marked stale
    if (state.fx) state.fx.stale = true;
    else loadCachedFx();
    finish();
    function finish() { state.fxChecking = false; state.fxNextAt = Date.now() + FX_REFRESH_MS; rebuildTicker(true); }
  }
  function loadCachedFx() {
    try {
      const c = JSON.parse(localStorage.getItem(FX_CACHE_KEY) || 'null');
      if (c && validRates(c.rates)) state.fx = { rates: c.rates, source: c.source, published: new Date(c.published), fetchedAt: new Date(c.fetchedAt), stale: true };
    } catch (e) { /* ignore */ }
  }

  function rebuildTicker(flash) {
    const fx = state.fx;
    const items = [];
    const pairCodes = state.src && state.dst ? [state.src.d.currency, state.dst.d.currency] : null;
    if (pairCodes) {
      const r = rate(pairCodes[0], pairCodes[1]);
      items.push(`<span class="it sel">${pairCodes[0]}/${pairCodes[1]}<b>${fmtRate(r)}</b></span>`);
    }
    for (const c of TICKER) {
      if (c === 'USD') continue;
      const inv = c === 'EUR' || c === 'GBP' || c === 'AUD';
      const v = fx && fx.rates[c] ? (inv ? 1 / fx.rates[c] : fx.rates[c]) : null;
      const pv = state.fxPrevRates && state.fxPrevRates[c] ? (inv ? 1 / state.fxPrevRates[c] : state.fxPrevRates[c]) : null;
      const dir = v != null && pv != null && v !== pv ? (v > pv ? '<span class="up">▲</span>' : '<span class="dn">▼</span>') : '<span>·</span>';
      items.push(`<span class="it${flash ? ' flash' : ''}">${inv ? c + '/USD' : 'USD/' + c}<b>${fmtRate(v)}</b> ${dir}</span>`);
    }
    if (fx) items.push(`<span class="it">SRC ${fx.source}${fx.stale ? ' · STALE' : ''}</span>`);
    const html = items.join('');
    setHTML(el.tickerTrack, html + html);
    if (flash) setTimeout(() => el.tickerTrack.querySelectorAll('.flash').forEach((n) => n.classList.remove('flash')), 900);
  }

  /* ------------------------------------------------------------------ geometry for routes (screen space) */
  function quad(p0, p1, bend, n = 48) {
    const dx = p1[0] - p0[0], dy = p1[1] - p0[1], len = Math.hypot(dx, dy) || 1;
    let px = -dy / len, py = dx / len;
    if (py > 0) { px = -px; py = -py; } // bend "up" by default
    const c = [(p0[0] + p1[0]) / 2 + px * bend * len, (p0[1] + p1[1]) / 2 + py * bend * len];
    const pts = [];
    for (let i = 0; i <= n; i++) {
      const t = i / n, u = 1 - t;
      pts.push([u * u * p0[0] + 2 * u * t * c[0] + t * t * p1[0], u * u * p0[1] + 2 * u * t * c[1] + t * t * p1[1]]);
    }
    return pts;
  }
  function poly(pts) {
    const cum = [0];
    for (let i = 1; i < pts.length; i++) cum.push(cum[i - 1] + Math.hypot(pts[i][0] - pts[i - 1][0], pts[i][1] - pts[i - 1][1]));
    const total = cum[cum.length - 1] || 1;
    const at = (u) => {
      const L = clamp(u, 0, 1) * total;
      let i = d3.bisectLeft(cum, L); if (i <= 0) return pts[0].slice(); if (i >= pts.length) return pts[pts.length - 1].slice();
      const f = (L - cum[i - 1]) / ((cum[i] - cum[i - 1]) || 1);
      return [pts[i - 1][0] + (pts[i][0] - pts[i - 1][0]) * f, pts[i - 1][1] + (pts[i][1] - pts[i - 1][1]) * f];
    };
    const upto = (u) => {
      if (u <= 0) return [];
      const L = clamp(u, 0, 1) * total, out = [];
      for (let i = 0; i < pts.length && cum[i] <= L; i++) out.push(pts[i]);
      out.push(at(u)); return out;
    };
    return { pts, total, at, upto };
  }
  const dOf = (pts) => (pts.length < 2 ? '' : 'M' + pts.map((p) => p[0].toFixed(1) + ',' + p[1].toFixed(1)).join('L'));

  function routeGeom(route) {
    const a = screenOf(state.src), b = screenOf(state.dst);
    if (!route.hub) {
      const g = poly(quad(a, b, 0.22));
      g.nodeU = [0.14, 0.38, 0.62, 0.86];
      return g;
    }
    const h = screenLL(route.hub.ll);
    const sign = route.id === 'A' ? 1 : -1;
    const s1 = quad(a, h, 0.16 * sign), s2 = quad(h, b, 0.16 * sign);
    const g = poly(s1.concat(s2.slice(1)));
    const hu = poly(s1).total / g.total;
    g.hubU = hu; g.hubPt = h;
    g.nodeU = [hu * 0.33, hu * 0.66, hu, hu + (1 - hu) * 0.55];
    return g;
  }

  /* ------------------------------------------------------------------ flow layer (route drawing, particles) */
  const fl = {
    drag: flow.append('path').attr('class', 'drag'),
    pair: flow.append('path').attr('class', 'pairArc'),
    cands: flow.append('g'),
    nodes: flow.append('g'),
    particles: flow.append('g'),
    labels: flow.append('g'),
    rings: flow.append('g'),
  };
  const candPaths = ['A', 'B', 'C'].map((id) => fl.cands.append('path').attr('class', 'cand').attr('data-route', id));

  function renderFlow(now) {
    const st = state.stage, t = state.local, R = state.routes;
    // --- drag line (user drawing a connection) ---
    const dg = state.drag;
    if (dg && dg.moved) {
      const a = screenOf(dg.rec), b = dg.target ? screenOf(dg.target) : [dg.x, dg.y];
      fl.drag.attr('d', dOf(quad(a, b, 0.2))).style('opacity', 1);
    } else fl.drag.style('opacity', 0);

    // endpoint rings
    const rings = [];
    if (state.src) rings.push({ p: screenOf(state.src), c: 'var(--src)', k: 's' });
    if (state.dst) rings.push({ p: screenOf(state.dst), c: 'var(--dst)', k: 'd' });
    fl.rings.selectAll('g').data(rings, (r) => r.k).join((en) => { const g = en.append('g'); g.append('circle').attr('class', 'endpoint').attr('r', 3); g.append('circle').attr('class', 'ring'); return g; })
      .attr('transform', (r) => `translate(${r.p[0]},${r.p[1]})`)
      .call((g) => { g.select('.endpoint').style('fill', (r) => r.c); g.select('.ring').style('stroke', (r) => r.c).attr('r', 6 + 4 * ((now / 1400) % 1)).style('opacity', 1 - ((now / 1400) % 1)); });

    const pair = state.src && state.dst && R;
    // --- simple connection arc (forms itself), stages 0–4 ---
    if (pair && st <= 4) {
      const g = poly(quad(screenOf(state.src), screenOf(state.dst), 0.22));
      const grow = ease((now - state.pairAt) / 900);
      fl.pair.attr('d', dOf(g.upto(grow))).style('opacity', 1);
    } else fl.pair.style('opacity', 0);

    const labels = [], nodes = [], parts = [];
    // --- candidate discovery (5) / construction (6) / payment (7) ---
    candPaths.forEach((p) => p.style('opacity', 0));
    if (pair && st >= 5) {
      R.forEach((r, i) => {
        const g = routeGeom(r);
        r.g = g;
        const p = candPaths[i];
        p.classed('win', false).classed('blocked', r.blocked);
        if (st === 5) {
          const grow = ease((t - i * 0.16) / 0.34);
          p.attr('d', dOf(g.upto(grow))).style('opacity', grow > 0 ? 0.95 : 0);
          if (r.hub && grow > 0.3) hubMark(g, r, Math.min(1, (grow - 0.3) / 0.4));
          if (grow >= 1) candLabel(r, g, clamp((t - i * 0.16 - 0.34) / 0.1, 0, 1));
        } else if (st === 6) {
          if (r.win) {
            p.classed('win', true);
            // the route constructs itself stop by stop: rail → partner → exchange → destination rail → merchant
            const stops = g.nodeU.concat([1]);
            const x = clamp((t - 0.06) / 0.7, 0, 1) * stops.length;
            const i = Math.min(stops.length - 1, Math.floor(x));
            const from = i === 0 ? 0 : stops[i - 1];
            const reach = x >= stops.length ? 1 : from + (stops[i] - from) * ease((x - i) * 1.6);
            p.attr('d', dOf(g.upto(reach))).style('opacity', 1);
            r.nodes.forEach((nm, k) => { if (g.nodeU[k] <= reach + 1e-6) nodeAt(g, r, k, nm, 1); });
            if (reach >= 0.999) { const m = g.at(1), dir = screenOf(state.src)[0] >= m[0] ? 1 : -1; labels.push({ x: m[0] + dir * 40, y: m[1] + 16, s: 'MERCHANT', c: 'win' }); }
            flowParticles(g, reach, now, 10, 70);
          } else {
            p.attr('d', dOf(g.pts)).style('opacity', r.blocked ? 0.9 : 0.22 + 0.5 * (1 - clamp(t / 0.15, 0, 1)));
            if (r.hub) hubMark(g, r, 0.35);
            candLabel(r, g, r.blocked ? 1 : 0.32);
          }
        } else if (st === 7) {
          if (r.win) {
            p.classed('win', true).attr('d', dOf(g.pts)).style('opacity', 0.75);
            const m = g.at(g.nodeU[1]);
            nodes.push({ x: m[0], y: m[1], cls: 'node speezy' });
            labels.push({ x: m[0], y: m[1] - 12, s: 'SPEEZY', c: 'win' });
            flowParticles(g, 1, now, 8, 55);
            // the payment itself: one bright packet travelling buyer → merchant
            const pay = clamp((t - 0.45) / 0.35, 0, 1);
            if (pay > 0 && pay < 1) for (let q = 0; q < 6; q++) { const pt = g.at(Math.max(0, ease(pay) - q * 0.012)); parts.push({ x: pt[0], y: pt[1], r: 3.2 - q * 0.45, o: 1 - q * 0.15 }); }
          } else if (r.blocked) {
            p.attr('d', dOf(g.pts)).style('opacity', 0.6);
          }
        }
      });
    }

    function hubMark(g, r, o) {
      nodes.push({ x: g.hubPt[0], y: g.hubPt[1], cls: 'hub', o });
      labels.push({ x: g.hubPt[0], y: g.hubPt[1] + (r.id === 'A' ? -10 : 18), s: r.hub.city, c: 'k', o });
    }
    function candLabel(r, g, o) {
      if (o <= 0) return;
      const u = r.hub ? (r.id === 'A' ? g.hubU * 0.5 : g.hubU + (1 - g.hubU) * 0.5) : 0.5;
      const m = g.at(u), off = r.id === 'B' ? 18 : -16;
      labels.push({ x: m[0], y: m[1] + off, s: `${r.id} · ${r.name}`, c: r.win && st === 5 ? '' : 'dim', o });
      labels.push({ x: m[0], y: m[1] + off + 11, s: r.blocked ? 'BLOCKED · RESTRICTED CORRIDOR' : `FEE ${r.fee.toFixed(1)}%  ETA ${fmtEta(r.eta)}  OK ${r.success.toFixed(1)}%`, c: 'k', o });
    }
    function nodeAt(g, r, k, nm, o) {
      const u = g.nodeU[k], p = g.at(u), q = g.at(Math.min(1, u + 0.01)), p0 = g.at(Math.max(0, u - 0.01));
      const speezy = nm === 'SPEEZY';
      nodes.push({ x: p[0], y: p[1], cls: 'node' + (speezy ? ' speezy' : ''), o });
      // label sits off the path, alternating sides, so short routes stay legible
      let tx = q[0] - p0[0], ty = q[1] - p0[1]; const tl = Math.hypot(tx, ty) || 1; tx /= tl; ty /= tl;
      const side = k % 2 ? 1 : -1, nx = -ty * side, ny = tx * side, d = 12;
      const anchor = Math.abs(nx) > 0.45 ? (nx > 0 ? 'start' : 'end') : 'middle';
      labels.push({ x: p[0] + nx * d, y: p[1] + ny * d + (ny > 0.3 ? 7 : ny < -0.3 ? 0 : 3), s: nm, c: speezy ? 'win' : '', o, a: anchor });
    }
    function flowParticles(g, reach, now2, n, speed) {
      const period = Math.max(1.2, g.total / speed);
      for (let i = 0; i < n; i++) {
        const u = (((now2 / 1000) / period + i / n) % 1) * reach;
        const pt = g.at(u);
        parts.push({ x: pt[0], y: pt[1], r: 1.6, o: 0.35 + 0.65 * Math.sin(Math.PI * (u / Math.max(reach, 0.001))) });
      }
    }

    fl.nodes.selectAll('circle').data(nodes).join('circle').attr('class', (d) => d.cls).attr('cx', (d) => d.x).attr('cy', (d) => d.y).attr('r', (d) => (d.cls === 'hub' ? 3.5 : d.cls.includes('speezy') ? 4.5 : 3.2)).style('opacity', (d) => d.o ?? 1);
    fl.particles.selectAll('circle').data(parts).join('circle').attr('class', 'particle').attr('cx', (d) => d.x).attr('cy', (d) => d.y).attr('r', (d) => d.r).style('opacity', (d) => d.o);
    fl.labels.selectAll('text').data(labels).join('text').attr('class', (d) => d.c).attr('x', (d) => d.x).attr('y', (d) => d.y).attr('text-anchor', (d) => d.a || 'middle').style('opacity', (d) => d.o ?? 1).text((d) => d.s);
  }

  /* ------------------------------------------------------------------ HUD (only what is relevant now) */
  function renderHUD() {
    const st = state.stage, t = state.local, R = state.routes;
    const pair = !!(state.src && state.dst && R);
    const a = state.src && state.src.d, b = state.dst && state.dst.d;

    // rail
    [...el.rail.children].forEach((n, i) => setOn(n, i === st));

    // map emphasis
    gLabels.style('opacity', st === 1 || st === 2 ? 1 : 0);
    el.map.classList.toggle('dim-world', st >= 5 && pair);

    // top bar: the selected pair is always the main FX information
    const fx = state.fx;
    const r = pair ? rate(a.currency, b.currency) : null;
    if (pair) {
      setHTML(el.pairLiveSym, `${a.currency}/${b.currency}`);
      setHTML(el.pairLiveRate, r == null ? 'NO PUBLIC RATE' : fmtRate(r) + (fx && fx.stale ? ' <span class="badge stale">STALE</span>' : ''));
      setOn(el.pairLiveRate, true, 'has');
    } else {
      setHTML(el.pairLiveSym, '—');
      setHTML(el.pairLiveRate, state.src ? `${a.currency} → SELECT DESTINATION` : 'SELECT TWO COUNTRIES');
      setOn(el.pairLiveRate, false, 'has');
    }
    setOn(el.liveDot, fx && !fx.stale, 'live'); setOn(el.liveDot, fx && fx.stale, 'stale');
    setHTML(el.liveTxt, !fx ? (state.fxChecking ? 'CONNECTING' : 'FX UNAVAILABLE') : fx.stale ? 'STALE' : 'LIVE');
    setHTML(el.updated, fx ? hhmmss(fx.fetchedAt) : '--:--:--');
    setHTML(el.routeCount, pair ? String(R.filter((x) => !x.blocked).length) : '—');

    // prompt — one obvious thing to do
    let pr = '';
    if (st === 0) pr = 'EXPLORE THE NETWORK<span class="cue">↓</span><span class="sub">SCROLL · OR CLICK ANY COUNTRY</span>';
    else if (st === 1) pr = `${live.length} MARKETS · ${new Set(live.map((x) => x.d.currency)).size} CURRENCIES<span class="sub">HOVER ANY COUNTRY</span>`;
    else if (st === 2) pr = !state.src ? 'SELECT A SOURCE COUNTRY' + '<span class="sub">CLICK · OR PRESS AND DRAG TO ANOTHER COUNTRY</span>'
      : !state.dst ? `${a.name.toUpperCase()} SELECTED — ${coarse ? 'TAP' : 'DRAG OR CLICK'} A DESTINATION` : 'CONNECTED<span class="cue">↓</span>';
    else if (st === 3) pr = state.auto ? 'EXAMPLE PAIR<span class="sub">CLICK ANY TWO COUNTRIES TO CHANGE IT</span>' : '';
    else if (st === 4) pr = 'SUPPORTED PAYMENT SURFACES<span class="sub">ILLUSTRATIVE · NOT LIVE RAILS</span>';
    else if (st === 7 && t > 0.9) pr = 'CLICK ANY COUNTRY TO ROUTE A NEW PAIR';
    setHTML(el.prompt, pr); setOn(el.prompt, !!pr);

    // selected-country tags, directly beside the countries
    placeTag(el.tagSrc, state.src, 'src', pair);
    placeTag(el.tagDst, state.dst, 'dst', pair);

    // currency pair block — only while the pair is the current interaction
    const showPair = pair && st === 3;
    setOn(el.pairBlock, showPair);
    if (pair) {
      setHTML(el.pbSrcName, a.name); setHTML(el.pbSrcCode, `${a.currency} <span style="color:var(--ink-3)">${a.symbol}</span>`);
      setHTML(el.pbDstName, b.name); setHTML(el.pbDstCode, `${b.currency} <span style="color:var(--ink-3)">${b.symbol}</span>`);
      if (r == null) {
        setHTML(el.pbRate, fx ? `NO PUBLIC RATE FOR ${a.currency}/${b.currency}` : 'RATE UNAVAILABLE');
        setHTML(el.pbRate2, fx ? 'SOURCE DOES NOT QUOTE THIS CURRENCY' : 'ALL FX SOURCES UNREACHABLE · NO RATE SHOWN');
      } else {
        setHTML(el.pbRate, a.currency === b.currency ? `1 ${a.currency} = 1 ${b.currency} · SAME CURRENCY` : `1 ${a.currency} = ${fmtRate(r)} ${b.currency}`);
        setHTML(el.pbRate2, `${a.symbol}1 = ${b.symbol}${fmtRate(r)} &nbsp;·&nbsp; 1 ${b.currency} = ${fmtRate(1 / r)} ${a.currency}`);
      }
      if (fx) {
        const next = Math.max(0, Math.round((state.fxNextAt - Date.now()) / 1000));
        setHTML(el.pbMeta, `<span class="badge ${fx.stale ? 'stale' : 'live'}">${fx.stale ? 'STALE · LAST KNOWN' : 'LIVE'}</span>UPDATED ${hhmmss(fx.fetchedAt)} · NEXT CHECK ${next}s<br>SOURCE ${fx.source} · PUBLISHED ${fx.published.toUTCString().slice(5, 22)} UTC`);
      } else setHTML(el.pbMeta, '<span class="badge stale">NO DATA</span>RETRYING EVERY 45s');
    }

    // route status strip
    let rs = '';
    if (pair && st === 5 && t > 0.05) {
      const n = R.filter((x) => !x.blocked).length;
      rs = cell('ROUTE DISCOVERY', `${a.currency} → ${b.currency}`) + cell('CANDIDATES', t > 0.75 ? `${n} VIABLE PATH${n === 1 ? '' : 'S'}` : 'SCANNING…', n === 0 && t > 0.75 ? 'bad' : '') + cell('MODEL', 'COST · SUCCESS · SPEED');
    } else if (pair && st === 6) {
      const w = state.winner;
      if (!w) rs = cell('RESULT', '0 VIABLE PATHS', 'bad') + cell('REASON', 'RESTRICTED CORRIDOR', 'bad');
      else if (t < 0.78) rs = cell('CONSTRUCTING', `${w.id} · ${w.name}`) + cell('PATH', `${a.currency} → ${b.currency}`);
      else rs = cell('ROUTE SELECTED', `${w.id} · ${w.name}`, 'win') + cell('SUCCESS', w.success.toFixed(1) + '%') + cell('FEE', w.fee.toFixed(1) + '%') + cell('ETA', fmtEta(w.eta)) + cell('BASIS', 'MODELED');
    }
    setHTML(el.routeStatus, rs); setOn(el.routeStatus, !!rs);

    // payment experience
    renderCheckout(pair, st, t, a, b, r);
  }
  const cell = (k, v, c = '') => `<div><span class="k">${k}</span><span class="v ${c}">${v}</span></div>`;

  function placeTag(node, rec, role, pair) {
    if (!rec) { setOn(node, false); return; }
    const st = state.stage, t = state.local, d = rec.d;
    const roleTxt = st === 7 ? (role === 'src' ? 'BUYER' : 'MERCHANT') : role === 'src' ? 'SOURCE' : 'DESTINATION';
    const surf = surfacesFor(d).map((s) => `<div class="r"><span>${s.name}</span><i>${s.kind}</i></div>`).join('');
    let recv = '';
    const price = role === 'dst' && pair && st === 7 && state.winner ? merchantPrice(d) : null;
    if (price != null && rate(state.src.d.currency, d.currency) != null) recv = `✓ RECEIVED ${fmtMoney(price, d)}`;
    setHTML(node, `<div class="role">${roleTxt}</div><div class="nm">${d.name}</div><div class="cur"><b>${d.currency}</b> ${d.symbol}</div><div class="surf"><div class="h">SUPPORTED PAYMENT SURFACES</div>${surf}</div><div class="recv">${recv}</div>`);
    setOn(node, true);
    setOn(node, pair && st === 4, 'show-surf');
    setOn(node, !!recv && t > 0.8, 'show-recv');
    // position beside the country; source/destination push apart horizontally
    const [x, y] = screenOf(rec);
    const other = role === 'src' ? state.dst : state.src;
    const ox = other ? screenOf(other)[0] : x + 1;
    const left = role === 'src' ? x <= ox : x < ox;
    const w = node.offsetWidth, h = node.offsetHeight, barH = W < 760 ? 42 : 46;
    let px = left ? x - w - 14 : x + 14;
    let py = y - 22;
    px = clamp(px, 6, W - w - 6); py = clamp(py, barH + 6, H - h - 34);
    node.style.transform = `translate(${px.toFixed(0)}px, ${py.toFixed(0)}px)`;
    node.style.left = '0px'; node.style.top = '0px';
  }

  function merchantPrice(d) {
    // the merchant's sticker price: ≈ 12 USD expressed in the destination currency, rounded like a real price
    if (d.currency === 'USD') return 12;
    const r = rate('USD', d.currency);
    if (r == null) return null;
    const v = 12 * r, m = Math.pow(10, Math.max(0, Math.floor(Math.log10(v)) - 1));
    return Math.round(v / m) * m;
  }

  function renderCheckout(pair, st, t, a, b, r) {
    const on = pair && st === 7;
    setOn(el.checkout, on);
    if (!on) return;
    const R = state.routes, w = state.winner;
    const price = merchantPrice(b);
    const fam = R.familiar;
    let html = `<div class="lbl"><span>FOREIGN CHECKOUT</span><span>SIMULATED</span></div>`;
    html += `<div class="merchant">MERCHANT · ${(b.capital || b.name).toUpperCase()}, ${b.iso2}</div>`;
    html += `<div class="price">${price == null ? b.currency + ' —' : fmtMoney(price, b)}</div>`;
    if (!w) {
      html += `<button class="pay clickable" disabled>ROUTE UNAVAILABLE</button><div class="state">NO VIABLE PATH · RESTRICTED CORRIDOR</div>`;
    } else if (price == null || r == null) {
      html += `<button class="pay clickable" disabled>QUOTE PAUSED</button><div class="state">NO LIVE RATE · SPEEZY WILL NOT QUOTE AN INVENTED PRICE</div>`;
    } else {
      const s1 = t > 0.2, s2 = t > 0.45, done = t > 0.8;
      const buyer = (price / r) * (1 + w.fee / 100);
      html += `<button class="pay clickable" data-pay ${s2 ? 'disabled' : ''}>${done ? 'PAID ✓' : s2 ? 'ROUTING…' : 'PAY WITH SPEEZY'}</button>`;
      html += `<div class="step ${s1 ? 'on' : ''}"><div class="flowline">SPEEZY → YOUR <b>${fam.name}</b> · FAMILIAR METHOD</div><div class="buyer"><span>YOU PAY</span><span>${fmtMoney(buyer, a)}</span></div></div>`;
      html += `<div class="step ${s2 ? 'on' : ''}"><div class="state ${done ? 'done' : ''}">${done ? `✓ MERCHANT PAID ${fmtMoney(price, b)} · ${fmtEta(w.eta)}` : `${fam.name} → SPEEZY → ${a.currency === b.currency ? 'NO FX' : a.currency + '/' + b.currency} → ${R.dstFast.name}`}</div></div>`;
    }
    setHTML(el.checkout, html);
    // anchor beside the buyer's country tag
    if (W >= 760) {
      const tr = el.tagSrc.style.transform.match(/translate\(([-\d.]+)px, ([-\d.]+)px\)/);
      if (tr) {
        let x = +tr[1], y = +tr[2] + el.tagSrc.offsetHeight + 10;
        const h = el.checkout.offsetHeight;
        if (y + h > H - 40) y = +tr[2] - h - 10;
        el.checkout.style.left = clamp(x, 8, W - 240) + 'px'; el.checkout.style.top = clamp(y, 56, H - h - 36) + 'px';
      }
    } else { el.checkout.style.left = ''; el.checkout.style.top = ''; }
  }
  el.checkout.addEventListener('click', (ev) => { if (ev.target.closest('[data-pay]') && !ev.target.disabled) jumpTo(7, 0.86, true); });

  /* ------------------------------------------------------------------ camera: the same map re-frames itself per interaction */
  function camera() {
    const st = state.stage, pair = state.src && state.dst;
    let key;
    if (st <= 1) key = 'world';
    else if (st === 2) return; // the user is exploring: leave the camera where they put it
    else if (pair) key = (st === 5 ? 'hubs:' : 'pair:') + state.src.key + '>' + state.dst.key;
    else key = state.cameraKey;
    if (key === state.cameraKey) return;
    state.cameraKey = key;
    let T = d3.zoomIdentity;
    if (key.startsWith('pair:') || key.startsWith('hubs:')) {
      const pts = [projection(state.src.ll), projection(state.dst.ll)];
      if (key.startsWith('hubs:') && state.routes) state.routes.forEach((r) => r.hub && pts.push(projection(r.hub.ll)));
      const small = W < 760;
      const padL = small ? 40 : 190, padR = small ? 40 : 190, padT = small ? 120 : 130, padB = small ? 170 : st === 3 ? 230 : 120;
      const xs = pts.map((p) => p[0]), ys = pts.map((p) => p[1]);
      const bw = Math.max(1, d3.max(xs) - d3.min(xs)), bh = Math.max(1, d3.max(ys) - d3.min(ys));
      const k = clamp(Math.min((W - padL - padR) / bw, (H - padT - padB) / bh), 1, 5);
      const cx = (d3.min(xs) + d3.max(xs)) / 2, cy = (d3.min(ys) + d3.max(ys)) / 2;
      T = d3.zoomIdentity.translate(padL + (W - padL - padR) / 2 - k * cx, padT + (H - padT - padB) / 2 - k * cy).scale(k);
    }
    svg.interrupt().transition().duration(1100).ease(d3.easeCubicInOut).call(zoom.transform, T);
  }

  /* ------------------------------------------------------------------ zoom buttons */
  document.querySelectorAll('#zoom button').forEach((b) => b.addEventListener('click', () => {
    const z = b.dataset.z;
    if (z === 'in') svg.transition().duration(350).call(zoom.scaleBy, 1.6);
    else if (z === 'out') svg.transition().duration(350).call(zoom.scaleBy, 1 / 1.6);
    else svg.transition().duration(600).call(zoom.transform, d3.zoomIdentity); // holds until the stage or pair changes
  }));

  /* ------------------------------------------------------------------ main loop */
  function readScroll() {
    const s = window.scrollY / H;
    state.stage = clamp(Math.floor(s), 0, STAGES - 1);
    state.local = clamp(s - state.stage, 0, 1);
  }
  let frameErr = 0;
  function frame(now) {
    requestAnimationFrame(frame); // keep the world alive even if one frame fails
    try {
      readScroll();
      if (state.stage >= 3 && !(state.src && state.dst)) ensurePair();
      if (state.stage !== state.lastStage) { state.lastStage = state.stage; document.body.dataset.stage = state.stage; }
      camera();
      renderHUD();
      renderFlow(now);
    } catch (e) { if (frameErr++ < 3) console.error('[speezy] frame error', e); }
  }

  let rz;
  window.addEventListener('resize', () => { clearTimeout(rz); rz = setTimeout(() => { svg.call(zoom.transform, d3.zoomIdentity); layout(); }, 120); });

  layout();
  loadCachedFx(); // show last known (marked stale) until the first live response arrives
  rebuildTicker();
  fetchFx();
  setInterval(fetchFx, FX_REFRESH_MS);
  requestAnimationFrame(frame);

  // Small public surface for debugging / automated tests.
  window.speezy = {
    state, records: live, byIso2, FX_SOURCES, surfacesFor,
    select: (iso) => setSource(byIso2[iso]),
    pair: (x, y) => setPair(byIso2[x], byIso2[y]),
    refreshFx: () => { state.fxChecking = false; return fetchFx(); },
    rate,
  };
})();
