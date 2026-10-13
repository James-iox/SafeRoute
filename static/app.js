'use strict';

const state = {
  map: null,
  start: 'Room 1',
  blockedEdges: new Set(),
  blockedExits: new Set(),
  route: null,
  requestVersion: 0,
  activity: [],
  toastTimer: null,
};

const $ = (selector) => document.querySelector(selector);
const $$ = (selector) => [...document.querySelectorAll(selector)];

async function getJson(url, options = {}) {
  const response = await fetch(url, { headers: { Accept: 'application/json' }, ...options });
  let data;
  try { data = await response.json(); }
  catch { throw new Error(`The server returned an unreadable response (${response.status}).`); }
  if (!response.ok) throw new Error(data.error || `Request failed (${response.status})`);
  return data;
}

function svgElement(tag, attrs = {}, text = '') {
  const element = document.createElementNS('http://www.w3.org/2000/svg', tag);
  Object.entries(attrs).forEach(([key, value]) => element.setAttribute(key, String(value)));
  if (text !== '') element.textContent = text;
  return element;
}

function boundaryPoint(node, other) {
  const dx = other.x - node.x;
  const dy = other.y - node.y;
  const length = Math.hypot(dx, dy) || 1;
  if (node.kind === 'junction') {
    const distance = 17 / length;
    return { x: node.x + dx * distance, y: node.y + dy * distance };
  }
  const halfW = (node.w || 90) / 2 + 1;
  const halfH = (node.h || 48) / 2 + 1;
  const scale = 1 / Math.max(Math.abs(dx) / halfW || 0.0001, Math.abs(dy) / halfH || 0.0001);
  return { x: node.x + dx * scale, y: node.y + dy * scale };
}

function edgeLabelPosition(a, b) {
  const dx = b.x - a.x;
  const dy = b.y - a.y;
  const x = (a.x + b.x) / 2 + (Math.abs(dy) > Math.abs(dx) * 0.65 ? 12 : 0);
  const y = (a.y + b.y) / 2 - (Math.abs(dy) > Math.abs(dx) * 0.65 ? 2 : 11);
  return { x, y };
}

function drawMap() {
  const svg = $('#building-map');
  svg.replaceChildren();
  const { nodes, edges } = state.map;

  const defs = svgElement('defs');
  const glow = svgElement('filter', { id: 'routeGlow', x: '-40%', y: '-40%', width: '180%', height: '180%' });
  glow.appendChild(svgElement('feGaussianBlur', { stdDeviation: '3', result: 'blur' }));
  const merge = svgElement('feMerge');
  merge.append(svgElement('feMergeNode', { in: 'blur' }), svgElement('feMergeNode', { in: 'SourceGraphic' }));
  glow.appendChild(merge);
  defs.appendChild(glow);
  svg.appendChild(defs);

  const corridorLayer = svgElement('g', { id: 'corridor-layer' });
  const labelLayer = svgElement('g', { id: 'corridor-label-layer' });
  const hitLayer = svgElement('g', { id: 'corridor-hit-layer' });

  for (const [edgeId, edge] of Object.entries(edges)) {
    const fromNode = nodes[edge.from];
    const toNode = nodes[edge.to];
    const from = boundaryPoint(fromNode, toNode);
    const to = boundaryPoint(toNode, fromNode);

    // Base link and high-contrast route overlay share the same graph/API data.
    const line = svgElement('line', {
      x1: from.x, y1: from.y, x2: to.x, y2: to.y,
      class: 'corridor', 'data-edge-id': edgeId,
      'aria-label': `${edgeId}, ${edge.from} to ${edge.to}`,
    });
    const title = svgElement('title', {}, `${edgeId}: ${edge.from} ↔ ${edge.to} · cost ${edge.cost}`);
    line.appendChild(title);
    corridorLayer.appendChild(line);

    const labelPos = edgeLabelPosition(from, to);
    labelLayer.appendChild(svgElement('text', {
      x: labelPos.x, y: labelPos.y, class: 'edge-label', 'data-edge-label': edgeId,
      'text-anchor': 'middle',
    }, edgeId));

    const hitTarget = svgElement('line', {
      x1: from.x, y1: from.y, x2: to.x, y2: to.y,
      class: 'edge-hit', 'data-edge-hit': edgeId,
      tabindex: '0', role: 'button',
      'aria-label': `Toggle ${edgeId} between ${edge.from} and ${edge.to}`,
    });
    hitTarget.appendChild(svgElement('title', {}, `Click to toggle ${edgeId} blocked / available`));
    hitTarget.addEventListener('click', () => toggleEdge(edgeId));
    hitTarget.addEventListener('keydown', (event) => {
      if (event.key === 'Enter' || event.key === ' ') {
        event.preventDefault();
        toggleEdge(edgeId);
      }
    });
    hitLayer.appendChild(hitTarget);
  }

  svg.append(corridorLayer, labelLayer, hitLayer);

  const blockLayer = svgElement('g', { id: 'block-marker-layer' });
  svg.appendChild(blockLayer);
  const nodeLayer = svgElement('g', { id: 'node-layer' });
  for (const [nodeId, node] of Object.entries(nodes)) {
    const group = svgElement('g', {
      class: `map-node ${node.kind}`,
      'data-node-id': nodeId,
    });
    group.appendChild(svgElement('title', {}, `${node.label || nodeId}${node.kind === 'room' ? ' · starting location' : ''}`));

    if (node.kind === 'junction') {
      group.appendChild(svgElement('circle', { cx: node.x, cy: node.y, r: 16 }));
      group.appendChild(svgElement('text', { x: node.x, y: node.y + 3.5 }, node.label || nodeId));
    } else {
      group.appendChild(svgElement('rect', {
        x: node.x - node.w / 2, y: node.y - node.h / 2,
        width: node.w, height: node.h,
      }));
      const labelY = node.kind === 'room' ? node.y - 2 : node.y - 1;
      group.appendChild(svgElement('text', { x: node.x, y: labelY }, node.label || nodeId));
      if (node.kind === 'room') {
        group.appendChild(svgElement('text', { x: node.x, y: node.y + 13, class: 'node-sub', 'data-room-sub': nodeId }, 'ROOM'));
      } else if (node.kind === 'exit') {
        group.appendChild(svgElement('text', { x: node.x, y: node.y + 13, class: 'node-sub' }, 'AVAILABLE'));
      }
    }
    nodeLayer.appendChild(group);
  }
  svg.appendChild(nodeLayer);
  updateMap(state.route);
}

function drawCorridorControls() {
  const container = $('#corridor-controls');
  container.replaceChildren();
  Object.keys(state.map.edges).forEach((edgeId) => {
    const button = document.createElement('button');
    button.type = 'button';
    button.className = 'corridor-toggle';
    button.dataset.edgeId = edgeId;
    button.setAttribute('aria-pressed', 'false');
    button.setAttribute('aria-label', `Block corridor ${edgeId}`);
    const code = document.createElement('span');
    code.className = 'corridor-code';
    code.textContent = edgeId;
    const dot = document.createElement('span');
    dot.className = 'corridor-state-dot';
    button.append(code, dot);
    button.addEventListener('click', () => toggleEdge(edgeId));
    container.appendChild(button);
  });
}

function drawBlockMarkers() {
  const layer = $('#block-marker-layer');
  if (!layer || !state.map) return;
  layer.replaceChildren();
  for (const edgeId of state.blockedEdges) {
    const edge = state.map.edges[edgeId];
    if (!edge) continue;
    const from = boundaryPoint(state.map.nodes[edge.from], state.map.nodes[edge.to]);
    const to = boundaryPoint(state.map.nodes[edge.to], state.map.nodes[edge.from]);
    const cx = (from.x + to.x) / 2;
    const cy = (from.y + to.y) / 2;
    const marker = svgElement('g', { class: 'block-marker', 'pointer-events': 'none' });
    marker.appendChild(svgElement('circle', { cx, cy, r: 12 }));
    marker.appendChild(svgElement('path', { d: `M ${cx - 4} ${cy - 4} L ${cx + 4} ${cy + 4} M ${cx + 4} ${cy - 4} L ${cx - 4} ${cy + 4}` }));
    layer.appendChild(marker);
  }
}

function updateMap(route) {
  if (!state.map) return;
  $$('.corridor').forEach((line) => {
    const id = line.dataset.edgeId;
    const blocked = state.blockedEdges.has(id);
    const selected = route?.route_edges?.includes(id) && !blocked;
    line.classList.toggle('is-blocked', blocked);
    line.classList.toggle('is-route', Boolean(selected));
    line.style.filter = selected ? 'url(#routeGlow)' : '';
  });
  $$('[data-edge-label]').forEach((label) => {
    const id = label.dataset.edgeLabel;
    label.classList.toggle('is-blocked-label', state.blockedEdges.has(id));
    label.classList.toggle('is-route-label', Boolean(route?.route_edges?.includes(id) && !state.blockedEdges.has(id)));
  });
  $$('.map-node').forEach((nodeElement) => {
    const id = nodeElement.dataset.nodeId;
    nodeElement.classList.toggle('is-start', id === state.start);
    nodeElement.classList.toggle('is-route-node', Boolean(route?.route_nodes?.includes(id)));
    nodeElement.classList.toggle('is-blocked', state.blockedExits.has(id));
    const sub = nodeElement.querySelector('[data-room-sub]');
    if (sub) sub.textContent = id === state.start ? 'START' : 'ROOM';
    const exitSub = nodeElement.querySelector('.node-sub');
    if (exitSub && nodeElement.classList.contains('exit')) exitSub.textContent = state.blockedExits.has(id) ? 'BLOCKED' : 'AVAILABLE';
  });
  drawBlockMarkers();
  $('#map-state-label').textContent = route?.route_found ? 'ROUTE ACTIVE' : 'NO ROUTE AVAILABLE';
  $('.map-state-pill').classList.toggle('unavailable', !route?.route_found);
}

function renderRoute(route) {
  const blockCount = state.blockedEdges.size + state.blockedExits.size;
  $('#stat-blocks').textContent = String(blockCount);
  $('#stat-status').textContent = route.route_found ? 'Route available' : 'No route';
  $('#stat-status-note').textContent = route.route_found ? 'An available exit is reachable' : 'No available exit can be reached';
  $('#status-track').style.width = route.route_found ? (blockCount ? '76%' : '100%') : '8%';
  $('#status-track').style.background = route.route_found ? 'var(--lime)' : 'var(--red)';
  $('#status-mini').textContent = route.route_found ? 'PATH FOUND' : 'NO PATH';
  $('#stat-exit').textContent = route.selected_exit || 'None';
  $('#exit-note').textContent = route.route_found ? `${route.route_nodes.length - 1} graph steps` : 'No reachable exit';
  $('#stat-cost').textContent = route.total_cost === null || route.total_cost === undefined ? '—' : String(route.total_cost);
  $('#block-note').textContent = blockCount === 0 ? 'All links available' : `${blockCount} condition${blockCount === 1 ? '' : 's'} active`;

  const badge = $('#route-badge');
  const message = $('#route-message');
  const steps = $('#route-steps');
  steps.replaceChildren();
  badge.className = `result-badge ${route.route_found ? 'success' : 'failure'}`;
  badge.textContent = route.route_found ? 'ROUTE FOUND' : 'NO ROUTE';
  message.className = `route-message ${route.route_found ? 'success' : 'failure'}`;
  message.textContent = route.message;
  $('#path-length').textContent = route.route_found
    ? `${route.route_edges.length} corridor${route.route_edges.length === 1 ? '' : 's'} · ${route.visited_nodes} nodes checked`
    : '0 available paths';

  if (route.route_found) {
    route.route_nodes.forEach((nodeId, index) => {
      const step = document.createElement('div');
      step.className = `route-step ${nodeId.startsWith('Exit ') ? 'exit-step' : ''}`;
      const indexTag = document.createElement('span');
      indexTag.className = 'step-index';
      indexTag.textContent = String(index + 1).padStart(2, '0');
      const name = document.createElement('strong');
      name.textContent = nodeId;
      step.append(indexTag, name);
      steps.appendChild(step);
      if (index < route.route_nodes.length - 1) {
        const arrow = document.createElement('span');
        arrow.className = 'step-arrow';
        arrow.textContent = '→';
        steps.appendChild(arrow);
      }
    });
  } else {
    const empty = document.createElement('div');
    empty.className = 'route-placeholder';
    const marker = document.createElement('span');
    marker.className = 'placeholder-error';
    marker.textContent = '×';
    const text = document.createElement('span');
    text.textContent = 'No route is displayed for the selected conditions. Clear or change a block to test recovery.';
    empty.append(marker, text);
    steps.appendChild(empty);
  }
  updateMap(route);
  syncControlState();
}

function describeScenario() {
  if (state.blockedEdges.size === 0 && state.blockedExits.size === 0) return 'Normal conditions';
  if (state.blockedEdges.size === 0 && state.blockedExits.size === 1 && state.blockedExits.has('Exit A')) return 'Exit A unavailable';
  if (state.blockedEdges.size === 1 && state.blockedEdges.has('C3') && state.blockedExits.size === 0) return 'Central corridor blocked';
  if (state.blockedEdges.size === 1 && state.blockedEdges.has('C1') && state.blockedExits.size === 0 && state.start === 'Room 1') return 'Room 1 disconnected';
  if (state.blockedEdges.size === 0 && state.blockedExits.size === 2) return 'Both exits unavailable';
  return 'Custom hazard scenario';
}

function syncControlState() {
  $$('.corridor-toggle').forEach((button) => {
    const blocked = state.blockedEdges.has(button.dataset.edgeId);
    button.setAttribute('aria-pressed', String(blocked));
    button.classList.toggle('blocked', blocked);
    button.setAttribute('aria-label', `${blocked ? 'Unblock' : 'Block'} corridor ${button.dataset.edgeId}`);
  });
  $$('.exit-checkbox').forEach((input) => { input.checked = state.blockedExits.has(input.value); });
  $('#corridor-count').textContent = `${state.blockedEdges.size} BLOCKED`;
  const activeScenario = describeScenario();
  const scenarioIds = {
    'Normal conditions': 'scenario-normal',
    'Exit A unavailable': 'scenario-exita',
    'Central corridor blocked': 'scenario-c3',
    'Room 1 disconnected': 'scenario-isolated',
    'Both exits unavailable': 'scenario-noexits',
  };
  $$('.scenario-card').forEach((button) => button.classList.toggle('active', button.id === scenarioIds[activeScenario]));
}

function addActivity(label, route) {
  const now = new Date();
  state.activity.unshift({
    label,
    found: Boolean(route.route_found),
    exit: route.selected_exit,
    time: now.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
    blocks: state.blockedEdges.size + state.blockedExits.size,
  });
  state.activity = state.activity.slice(0, 3);
  renderActivity();
}

function renderActivity() {
  const container = $('#activity-list');
  container.replaceChildren();
  if (!state.activity.length) {
    const empty = document.createElement('div');
    empty.className = 'activity-empty';
    empty.textContent = 'Your scenario changes will be listed here as you test the routing behaviour.';
    container.appendChild(empty);
    return;
  }
  state.activity.forEach((item) => {
    const card = document.createElement('article');
    card.className = 'activity-item';
    const icon = document.createElement('span');
    icon.className = `activity-symbol ${item.found ? '' : 'alert'}`;
    icon.textContent = item.found ? '↗' : '×';
    const copy = document.createElement('div');
    const title = document.createElement('strong');
    title.textContent = item.label;
    const detail = document.createElement('small');
    detail.textContent = item.found ? `${item.exit} selected · ${item.blocks} active block(s) · ${item.time}` : `No route · ${item.blocks} active block(s) · ${item.time}`;
    copy.append(title, detail);
    card.append(icon, copy);
    container.appendChild(card);
  });
}

function showToast(message, isError = false) {
  const toast = $('#toast');
  toast.textContent = message;
  toast.classList.toggle('error', isError);
  toast.classList.add('show');
  window.clearTimeout(state.toastTimer);
  state.toastTimer = window.setTimeout(() => toast.classList.remove('show'), 2500);
}

async function refreshRoute({ record = true, activityLabel = null } = {}) {
  if (!state.map) return;
  state.start = $('#start-room').value;
  const version = ++state.requestVersion;
  $('#route-badge').className = 'result-badge waiting';
  $('#route-badge').textContent = 'CALCULATING';
  try {
    const route = await getJson('/api/route', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        start: state.start,
        blocked_edges: [...state.blockedEdges],
        blocked_exits: [...state.blockedExits],
      }),
    });
    if (version !== state.requestVersion) return;
    state.route = route;
    renderRoute(route);
    if (record) addActivity(activityLabel || describeScenario(), route);
  } catch (error) {
    if (version !== state.requestVersion) return;
    $('#route-badge').className = 'result-badge failure';
    $('#route-badge').textContent = 'API ERROR';
    $('#route-message').className = 'route-message failure';
    $('#route-message').textContent = `The routing API could not calculate this scenario: ${error.message}`;
    showToast('Could not reach the local route API. Start the Flask app and reload.', true);
  }
}

function setScenario({ edges = [], exits = [], start = null, label = null }, toast = true) {
  state.blockedEdges = new Set(edges);
  state.blockedExits = new Set(exits);
  if (start) $('#start-room').value = start;
  syncControlState();
  refreshRoute({ activityLabel: label || describeScenario() });
  if (toast) showToast(`${label || describeScenario()} loaded`);
}

function toggleEdge(edgeId) {
  if (state.blockedEdges.has(edgeId)) state.blockedEdges.delete(edgeId);
  else state.blockedEdges.add(edgeId);
  syncControlState();
  refreshRoute({ activityLabel: describeScenario() });
}

function resetSimulation({ toast = true } = {}) {
  $('#start-room').value = 'Room 1';
  state.blockedEdges.clear();
  state.blockedExits.clear();
  syncControlState();
  refreshRoute({ activityLabel: 'Normal conditions' });
  if (toast) showToast('Simulation reset');
}

async function initialise() {
  try {
    state.map = await getJson('/api/map');
    drawMap();
    drawCorridorControls();
    $('#start-room').addEventListener('change', () => refreshRoute({ activityLabel: `Start: ${$('#start-room').value}` }));
    $('#scenario-normal').addEventListener('click', () => setScenario({ start: 'Room 1', label: 'Normal conditions' }));
    $('#scenario-exita').addEventListener('click', () => setScenario({ exits: ['Exit A'], label: 'Exit A unavailable' }));
    $('#scenario-c3').addEventListener('click', () => setScenario({ edges: ['C3'], label: 'Central corridor blocked' }));
    $('#scenario-isolated').addEventListener('click', () => setScenario({ edges: ['C1'], start: 'Room 1', label: 'Room 1 disconnected' }));
    $('#scenario-noexits').addEventListener('click', () => setScenario({ exits: ['Exit A', 'Exit B'], label: 'Both exits unavailable' }));
    $('#reset-button')?.addEventListener('click', () => resetSimulation());
    $('#reset-button-desktop')?.addEventListener('click', () => resetSimulation());
    $('#map-reset-button')?.addEventListener('click', () => resetSimulation());
    $('#hero-run-button')?.addEventListener('click', () => setScenario({ start: 'Room 1', label: 'Normal conditions' }));
    $$('.exit-checkbox').forEach((input) => input.addEventListener('change', () => {
      if (input.checked) state.blockedExits.add(input.value);
      else state.blockedExits.delete(input.value);
      syncControlState();
      refreshRoute({ activityLabel: describeScenario() });
    }));
    syncControlState();
    await refreshRoute({ record: true, activityLabel: 'Normal conditions' });
  } catch (error) {
    $('#route-badge').className = 'result-badge failure';
    $('#route-badge').textContent = 'INITIALISATION ERROR';
    $('#route-message').className = 'route-message failure';
    $('#route-message').textContent = `Could not initialise the dashboard: ${error.message}. Make sure the Flask app is running from the project folder.`;
    showToast('SafeRoute needs its local Flask server to run.', true);
  }
}

document.addEventListener('DOMContentLoaded', initialise);
