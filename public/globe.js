/**
 * Nomisoft-style realtime visitors map — D3 Mercator SVG + animated routes.
 * @see https://github.com/nomisoft/rtwv-map
 */
(function () {
  'use strict';

  const MAP_W = 938;
  const MAP_H = 620;
  const COUNTRIES_URL = '/assets/countries-110m.json';
  const MAX_FEED_ROWS = 80;

  let countriesTopo = null;
  let mainMap = null;
  let sse = null;
  let mapReady = false;
  const pendingVisitors = [];
  let serverGeo = { lat: 51.5074, lon: -0.1278, label: 'GhostTrace' };
  const countryCounts = new Map();

  async function loadCountries() {
    if (countriesTopo) return countriesTopo;
    const res = await fetch(COUNTRIES_URL);
    if (!res.ok) throw new Error('Failed to load world map data');
    countriesTopo = await res.json();
    return countriesTopo;
  }

  function createMap(containerId) {
    const el = document.getElementById(containerId);
    if (!el) return null;
    el.innerHTML = '';

    const projection = d3.geoMercator()
      .scale(150)
      .translate([MAP_W / 2, MAP_H / 1.41]);

    const path = d3.geoPath().projection(projection);

    const svg = d3.select(el)
      .append('svg')
      .attr('class', 'rtwv-svg')
      .attr('viewBox', `0 0 ${MAP_W} ${MAP_H}`)
      .attr('preserveAspectRatio', 'xMidYMid meet');

    svg.append('g').attr('class', 'rtwv-countries');
    svg.append('g').attr('class', 'rtwv-routes');
    svg.append('g').attr('class', 'rtwv-markers');

    return {
      el,
      svg,
      projection,
      path,
      gRoutes: svg.select('.rtwv-routes'),
      gMarkers: svg.select('.rtwv-markers'),
      routes: [],
    };
  }

  function drawCountries(map) {
    const features = topojson.feature(countriesTopo, countriesTopo.objects.countries).features;
    map.svg.select('.rtwv-countries')
      .selectAll('path')
      .data(features)
      .join('path')
      .attr('d', map.path);
  }

  function drawServerMarker(map) {
    const [x, y] = map.projection([serverGeo.lon, serverGeo.lat]);
    if (x == null || y == null) return;

    map.gMarkers.selectAll('.rtwv-server').remove();
    const g = map.gMarkers.append('g').attr('class', 'rtwv-server').attr('transform', `translate(${x},${y})`);
    g.append('circle').attr('r', 6).attr('class', 'rtwv-server-ring');
    g.append('circle').attr('r', 3).attr('class', 'rtwv-server-core');
    g.append('text').attr('y', -10).attr('text-anchor', 'middle').attr('class', 'rtwv-server-label')
      .text(serverGeo.label || 'Server');
  }

  function flashVisitor(map, lat, lon, statusClass) {
    const [x, y] = map.projection([lon, lat]);
    if (x == null || y == null) return;

    map.gMarkers.append('circle')
      .attr('class', `rtwv-visitor-flash rtwv-flash-${statusClass}`)
      .attr('cx', x)
      .attr('cy', y)
      .attr('r', 0)
      .transition().duration(400).attr('r', 5)
      .transition().duration(1600).attr('r', 0).remove();
  }

  function addRoute(map, data) {
    const v = data.visitor;
    const s = data.server || serverGeo;
    if (!v?.geo || v.geo[0] == null) return;

    const vLat = v.geo[0];
    const vLon = v.geo[1];
    const sLat = s.lat ?? s.geo?.[0] ?? serverGeo.lat;
    const sLon = s.lon ?? s.geo?.[1] ?? serverGeo.lon;
    const statusClass = data.status || 'other';

    flashVisitor(map, vLat, vLon, statusClass);

    const route = map.gRoutes.append('path')
      .datum({
        type: 'LineString',
        coordinates: [[vLon, vLat], [sLon, sLat]],
      })
      .attr('class', `rtwv-route rtwv-route-${statusClass}`)
      .attr('d', map.path);

    const node = route.node();
    if (!node) return;

    const len = node.getTotalLength();
    route
      .attr('stroke-dasharray', `${len} ${len}`)
      .attr('stroke-dashoffset', len)
      .transition()
      .duration(1000)
      .ease(d3.easeLinear)
      .attr('stroke-dashoffset', 0);

    const key = map.routes.length;
    map.routes[key] = route;
    setTimeout(() => {
      route.transition().duration(5000).style('opacity', 0).remove();
      map.routes[key] = null;
    }, 2000);
  }

  function esc(s) {
    return String(s ?? '').replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
  }

  function prependFeedRow(data) {
    const tbody = document.getElementById('globeVisitsBody');
    if (!tbody) return;

    const tr = document.createElement('tr');
    tr.innerHTML = `
      <td class="mono">${esc(data.visitor?.ip || '?')}</td>
      <td><span class="rtwv-status rtwv-status-${data.status}">${esc(String(data.statusCode || data.status || '—'))}</span></td>
      <td class="mono" title="${esc(data.url || '')}">${esc(`${data.method || ''} ${data.url || ''}`.trim())}</td>`;
    tbody.prepend(tr);
    while (tbody.children.length > MAX_FEED_ROWS) tbody.removeChild(tbody.lastChild);
    const live = document.getElementById('globeLiveCount');
    if (live) live.textContent = tbody.children.length;
  }

  function updateCountryStats(data) {
    const c = data.visitor?.country;
    if (!c) return;
    countryCounts.set(c, (countryCounts.get(c) || 0) + 1);
    const el = document.getElementById('globeCountries');
    if (!el) return;
    el.innerHTML = [...countryCounts.entries()]
      .sort((a, b) => b[1] - a[1])
      .slice(0, 12)
      .map(([code, n]) => `<div class="globe-stat-row"><span>${esc(code)}</span><strong>${n}</strong></div>`)
      .join('');
  }

  function onVisitor(data) {
    if (!mapReady || !mainMap) {
      pendingVisitors.push(data);
      if (pendingVisitors.length > 200) pendingVisitors.shift();
      return;
    }
    addRoute(mainMap, data);
    prependFeedRow(data);
    updateCountryStats(data);
  }

  function resizeMap() {
    if (!mainMap) return;
    const w = mainMap.el.clientWidth || mainMap.el.parentElement?.clientWidth || 800;
    mainMap.svg.attr('width', Math.max(w, 400)).attr('height', Math.max(w, 400) * (MAP_H / MAP_W));
  }

  function setMapStatus(kind, message) {
    const host = document.getElementById('globeMap');
    if (!host || mapReady) return;
    host.innerHTML = `<div class="rtwv-map-${kind}">${message}</div>`;
  }

  async function activate() {
    if (typeof d3 === 'undefined' || typeof topojson === 'undefined') {
      setMapStatus('error', 'Map libraries failed to load. Refresh the page.');
      return;
    }

    if (!mapReady) {
      setMapStatus('loading', 'Loading world map…');
      try {
        await loadCountries();
      } catch (err) {
        setMapStatus('error', err.message || 'Could not load map data');
        return;
      }
      mainMap = createMap('globeMap');
      drawCountries(mainMap);
      drawServerMarker(mainMap);
      mapReady = true;

      fetch('/api/geo/globe', { credentials: 'include' })
        .then((r) => r.json())
        .then((d) => {
          if (d.success && d.data?.server) {
            serverGeo = d.data.server;
            drawServerMarker(mainMap);
          }
        })
        .catch(() => {});

      pendingVisitors.splice(0).forEach(onVisitor);
    }

    requestAnimationFrame(() => {
      resizeMap();
      drawServerMarker(mainMap);
    });

    if (!sse) connect();
  }

  function connect() {
    if (sse) sse.close();
    sse = new EventSource('/api/geo/stream', { withCredentials: true });

    sse.onerror = () => {
      if (window.GT) window.GT.toast('Live traffic stream disconnected — retrying…', 'warn');
    };

    sse.addEventListener('init', (e) => {
      try {
        const d = JSON.parse(e.data);
        if (d.server) {
          serverGeo = d.server;
          if (mainMap) drawServerMarker(mainMap);
        }
      } catch (_) {}
    });

    sse.addEventListener('visitor', (e) => {
      try { onVisitor(JSON.parse(e.data)); } catch (_) {}
    });
  }

  function boot() {
    window.addEventListener('resize', resizeMap);
    new MutationObserver(() => {
      if (mainMap) drawServerMarker(mainMap);
    }).observe(document.documentElement, { attributes: true, attributeFilter: ['data-theme'] });

    if (document.getElementById('page-globe')?.classList.contains('active')) {
      activate();
    }
  }

  window.Globe = {
    activate,
    start: connect,
    stop: () => { if (sse) { sse.close(); sse = null; } },
    redraw: resizeMap,
  };

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', boot);
  } else {
    boot();
  }
})();
