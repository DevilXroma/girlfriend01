const canvas = document.querySelector('#tagCanvas');
const wrap = document.querySelector('#canvasWrap');
const ctx = canvas.getContext('2d');
const resetButton = document.querySelector('#resetView');
const fitButton = document.querySelector('#fitView');
const infoTitle = document.querySelector('#infoTitle');
const infoText = document.querySelector('#infoText');
const infoMeta = document.querySelector('#infoMeta');
const relatedTags = document.querySelector('#relatedTags');
const searchInput = document.querySelector('#searchInput');
const miniStats = document.querySelector('#miniStats');
const notesGrid = document.querySelector('#notesGrid');
const addForm = document.querySelector('#addForm');
const sectionSelect = document.querySelector('#sectionSelect');
const newSectionInput = document.querySelector('#newSectionInput');
const itemTitle = document.querySelector('#itemTitle');
const itemText = document.querySelector('#itemText');
const itemTags = document.querySelector('#itemTags');

const STORE_KEY = 'memory-web-v2';
const state = { selectedId: null, hoveredId: null, query: '' };
let dpr = 1;
let width = 0;
let height = 0;
let sections = [];
let items = [];
let nodes = [];
let links = [];
let dragged = null;

function loadData() {
  const saved = localStorage.getItem(STORE_KEY);
  if (saved) {
    try {
      const parsed = JSON.parse(saved);
      sections = parsed.sections || DEFAULT_SECTIONS;
      items = parsed.items || DEFAULT_ITEMS;
      return;
    } catch (error) {
      console.warn(error);
    }
  }
  sections = structuredClone(DEFAULT_SECTIONS);
  items = structuredClone(DEFAULT_ITEMS);
}

function saveData() {
  localStorage.setItem(STORE_KEY, JSON.stringify({ sections, items }));
}

function slug(value) {
  return String(value || '')
    .toLowerCase()
    .replace(/[^a-zа-яё0-9]+/gi, '-')
    .replace(/^-|-$/g, '') || `node-${Date.now()}`;
}

function normalize(value) {
  return String(value || '').toLowerCase().trim();
}

function resize() {
  const rect = wrap.getBoundingClientRect();
  dpr = Math.min(window.devicePixelRatio || 1, 2);
  width = Math.max(340, rect.width);
  height = Math.max(520, rect.height);
  canvas.width = Math.floor(width * dpr);
  canvas.height = Math.floor(height * dpr);
  canvas.style.width = `${width}px`;
  canvas.style.height = `${height}px`;
}

function buildGraph(spread = false) {
  const sectionCount = sections.length;
  const majorRadiusX = Math.min(width * 0.37, 420);
  const majorRadiusY = Math.min(height * 0.34, 300);
  nodes = [];
  links = [];

  sections.forEach((section, index) => {
    const angle = -Math.PI / 2 + index / sectionCount * Math.PI * 2;
    const x = Math.cos(angle) * majorRadiusX;
    const y = Math.sin(angle) * majorRadiusY;
    nodes.push({
      id: section.id,
      type: 'section',
      title: section.title,
      text: section.note,
      color: section.color,
      x: spread ? x : x * 0.85,
      y: spread ? y : y * 0.85,
      homeX: x,
      homeY: y,
      vx: 0,
      vy: 0,
      r: 28,
      sectionId: section.id,
      tags: []
    });
  });

  sections.forEach((section) => {
    const parent = nodes.find((node) => node.id === section.id);
    const childItems = items.filter((item) => item.sectionId === section.id);
    childItems.forEach((item, index) => {
      const angle = index / Math.max(1, childItems.length) * Math.PI * 2 + 0.7;
      const orbit = 105 + (index % 3) * 34;
      const node = {
        id: item.id,
        type: 'item',
        title: item.title,
        text: item.text,
        color: section.color,
        x: parent.homeX + Math.cos(angle) * orbit,
        y: parent.homeY + Math.sin(angle) * orbit,
        homeX: parent.homeX + Math.cos(angle) * orbit,
        homeY: parent.homeY + Math.sin(angle) * orbit,
        vx: 0,
        vy: 0,
        r: 15,
        sectionId: section.id,
        tags: item.tags || []
      };
      nodes.push(node);
      links.push({ a: parent, b: node, type: 'parent', weight: 2.3 });
    });
  });

  for (let i = 0; i < nodes.length; i += 1) {
    for (let j = i + 1; j < nodes.length; j += 1) {
      const a = nodes[i];
      const b = nodes[j];
      if (a.type !== 'item' || b.type !== 'item') continue;
      const shared = a.tags.filter((tag) => b.tags.includes(tag));
      if (shared.length) links.push({ a, b, type: 'tag', weight: shared.length * 0.55 });
    }
  }
}

function selectedNode() {
  return nodes.find((node) => node.id === (state.hoveredId || state.selectedId));
}

function relatedIds(node) {
  if (!node) return new Set();
  const result = new Set([node.id]);
  links.forEach((link) => {
    if (link.a.id === node.id) result.add(link.b.id);
    if (link.b.id === node.id) result.add(link.a.id);
  });
  if (node.type === 'section') {
    nodes.filter((item) => item.sectionId === node.id).forEach((item) => result.add(item.id));
  }
  return result;
}

function physics() {
  const focus = selectedNode();
  const related = relatedIds(focus);

  nodes.forEach((node) => {
    if (node === dragged) return;
    const homeForce = node.type === 'section' ? 0.006 : 0.003;
    node.vx += (node.homeX - node.x) * homeForce;
    node.vy += (node.homeY - node.y) * homeForce;
    if (focus && !related.has(node.id)) {
      node.vx += (node.x > 0 ? 0.012 : -0.012);
      node.vy += (node.y > 0 ? 0.008 : -0.008);
    }
  });

  links.forEach((link) => {
    const dx = link.b.x - link.a.x;
    const dy = link.b.y - link.a.y;
    const dist = Math.hypot(dx, dy) || 1;
    const target = link.type === 'parent' ? 130 : 220;
    const force = (dist - target) * 0.0009 * link.weight;
    const fx = dx / dist * force;
    const fy = dy / dist * force;
    if (link.a !== dragged) { link.a.vx += fx; link.a.vy += fy; }
    if (link.b !== dragged) { link.b.vx -= fx; link.b.vy -= fy; }
  });

  for (let i = 0; i < nodes.length; i += 1) {
    for (let j = i + 1; j < nodes.length; j += 1) {
      const a = nodes[i];
      const b = nodes[j];
      const dx = b.x - a.x;
      const dy = b.y - a.y;
      const dist = Math.hypot(dx, dy) || 1;
      const min = a.r + b.r + (a.type === 'section' || b.type === 'section' ? 58 : 32);
      if (dist < min) {
        const push = (min - dist) * 0.012;
        const fx = dx / dist * push;
        const fy = dy / dist * push;
        if (a !== dragged) { a.vx -= fx; a.vy -= fy; }
        if (b !== dragged) { b.vx += fx; b.vy += fy; }
      }
    }
  }

  nodes.forEach((node) => {
    if (node === dragged) return;
    node.vx *= 0.86;
    node.vy *= 0.86;
    node.x += node.vx;
    node.y += node.vy;
    const limitX = width / 2 - 44;
    const limitY = height / 2 - 44;
    node.x = Math.max(-limitX, Math.min(limitX, node.x));
    node.y = Math.max(-limitY, Math.min(limitY, node.y));
  });
}

function draw() {
  ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
  ctx.clearRect(0, 0, canvas.width, canvas.height);
  ctx.setTransform(dpr, 0, 0, dpr, width / 2, height / 2);

  const focus = selectedNode();
  const related = relatedIds(focus);

  links.forEach((link) => {
    const active = !focus || related.has(link.a.id) && related.has(link.b.id);
    ctx.save();
    ctx.globalAlpha = active ? (link.type === 'parent' ? 0.62 : 0.26) : 0.045;
    ctx.strokeStyle = link.type === 'parent' ? link.a.color : 'rgba(255,255,255,.45)';
    ctx.lineWidth = link.type === 'parent' ? 2.2 : 1;
    ctx.shadowColor = link.a.color;
    ctx.shadowBlur = active ? 12 : 0;
    ctx.beginPath();
    ctx.moveTo(link.a.x, link.a.y);
    ctx.lineTo(link.b.x, link.b.y);
    ctx.stroke();
    ctx.restore();
  });

  nodes.forEach((node) => {
    const active = !focus || related.has(node.id);
    const selected = focus && focus.id === node.id;
    const radius = node.r + (selected ? 8 : 0);
    ctx.save();
    ctx.globalAlpha = active ? 1 : 0.2;
    ctx.shadowColor = node.color;
    ctx.shadowBlur = node.type === 'section' ? 28 : 18;
    ctx.fillStyle = node.color;
    ctx.beginPath();
    ctx.arc(node.x, node.y, radius, 0, Math.PI * 2);
    ctx.fill();
    ctx.shadowBlur = 0;
    ctx.fillStyle = '#fff';
    ctx.font = `${node.type === 'section' ? 900 : 750} ${node.type === 'section' ? 16 : 13}px Inter, sans-serif`;
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    const labelY = node.y - radius - (node.type === 'section' ? 18 : 13);
    ctx.fillText(node.title, node.x, labelY);
    if (node.type === 'section') {
      const count = items.filter((item) => item.sectionId === node.id).length;
      ctx.fillStyle = 'rgba(255,255,255,.72)';
      ctx.font = '700 11px Inter, sans-serif';
      ctx.fillText(`${count} точек`, node.x, node.y + radius + 17);
    }
    if (selected) {
      ctx.strokeStyle = 'rgba(255,255,255,.85)';
      ctx.lineWidth = 1.6;
      ctx.beginPath();
      ctx.arc(node.x, node.y, radius + 10, 0, Math.PI * 2);
      ctx.stroke();
    }
    ctx.restore();
  });

  physics();
  requestAnimationFrame(draw);
}

function point(event) {
  const rect = canvas.getBoundingClientRect();
  const source = event.touches ? event.touches[0] : event;
  return { x: source.clientX - rect.left - rect.width / 2, y: source.clientY - rect.top - rect.height / 2 };
}

function hit(p) {
  return [...nodes].reverse().find((node) => Math.hypot(node.x - p.x, node.y - p.y) < node.r + 26) || null;
}

function renderInfo(node) {
  if (!node) {
    infoTitle.textContent = 'Выбери точку';
    infoText.textContent = 'Большие точки — разделы. Маленькие — конкретные записи внутри них. Можно добавлять новые точки через форму ниже.';
    infoMeta.textContent = '';
    relatedTags.textContent = '';
    return;
  }
  infoTitle.textContent = node.title;
  infoText.textContent = node.text || 'Пока без комментария.';
  infoMeta.textContent = '';
  const children = items.filter((item) => item.sectionId === node.id);
  const tags = node.type === 'item' ? node.tags : [];
  const meta = node.type === 'section' ? [[children.length, 'вложений']] : [[tags.length, 'тегов']];
  meta.push([relatedIds(node).size - 1, 'связей']);
  meta.forEach(([num, label]) => {
    const box = document.createElement('div');
    const strong = document.createElement('strong');
    const span = document.createElement('span');
    strong.textContent = num;
    span.textContent = label;
    box.append(strong, span);
    infoMeta.appendChild(box);
  });
  relatedTags.textContent = '';
  const list = node.type === 'section' ? children.map((item) => item.title) : tags.map((tag) => `#${tag}`);
  list.slice(0, 12).forEach((label) => {
    const chip = document.createElement('button');
    chip.type = 'button';
    chip.textContent = label;
    relatedTags.appendChild(chip);
  });
}

function visibleItems() {
  const selected = nodes.find((node) => node.id === state.selectedId);
  const q = normalize(state.query);
  return items.filter((item) => {
    const sectionOk = !selected || selected.type !== 'section' || item.sectionId === selected.id;
    const itemOk = !selected || selected.type !== 'item' || item.id === selected.id;
    const text = normalize([item.title, item.text, ...item.tags, sections.find((s) => s.id === item.sectionId)?.title].join(' '));
    return sectionOk && itemOk && (!q || text.includes(q));
  });
}

function renderStats(list) {
  miniStats.textContent = '';
  [[sections.length, 'разделов'], [items.length, 'точек'], [links.length, 'связей'], [list.length, 'показано']].forEach(([num, label]) => {
    const box = document.createElement('div');
    const strong = document.createElement('strong');
    const span = document.createElement('span');
    strong.textContent = num;
    span.textContent = label;
    box.append(strong, span);
    miniStats.appendChild(box);
  });
}

function renderCards() {
  const list = visibleItems();
  renderStats(list);
  notesGrid.textContent = '';
  list.forEach((item) => {
    const section = sections.find((s) => s.id === item.sectionId);
    const card = document.createElement('article');
    card.className = 'note-card';
    const top = document.createElement('div');
    top.className = 'note-top';
    const sec = document.createElement('span');
    sec.textContent = section?.title || 'Раздел';
    const small = document.createElement('small');
    small.textContent = item.tags.slice(0, 2).join(', ') || 'без тегов';
    top.append(sec, small);
    const h3 = document.createElement('h3');
    h3.textContent = item.title;
    const p = document.createElement('p');
    p.textContent = item.text || 'Без комментария.';
    const tagBox = document.createElement('div');
    tagBox.className = 'note-tags';
    item.tags.forEach((tag) => {
      const chip = document.createElement('button');
      chip.type = 'button';
      chip.textContent = `#${tag}`;
      tagBox.appendChild(chip);
    });
    card.append(top, h3, p, tagBox);
    notesGrid.appendChild(card);
  });
}

function fillSectionSelect() {
  sectionSelect.textContent = '';
  sections.forEach((section) => {
    const option = document.createElement('option');
    option.value = section.id;
    option.textContent = section.title;
    sectionSelect.appendChild(option);
  });
  const option = document.createElement('option');
  option.value = '__new';
  option.textContent = '+ новый раздел';
  sectionSelect.appendChild(option);
}

function refresh(spread = false) {
  buildGraph(spread);
  fillSectionSelect();
  renderInfo(nodes.find((node) => node.id === state.selectedId));
  renderCards();
}

canvas.addEventListener('mousemove', (event) => {
  const node = hit(point(event));
  state.hoveredId = node?.id || null;
  renderInfo(node || nodes.find((n) => n.id === state.selectedId));
  canvas.style.cursor = node ? 'pointer' : 'default';
});
canvas.addEventListener('mouseleave', () => {
  state.hoveredId = null;
  dragged = null;
  renderInfo(nodes.find((node) => node.id === state.selectedId));
});
canvas.addEventListener('mousedown', (event) => { dragged = hit(point(event)); });
window.addEventListener('mousemove', (event) => {
  if (!dragged) return;
  const p = point(event);
  dragged.x = p.x; dragged.y = p.y; dragged.vx = 0; dragged.vy = 0;
});
window.addEventListener('mouseup', () => { dragged = null; });
canvas.addEventListener('click', (event) => {
  const node = hit(point(event));
  state.selectedId = node ? (state.selectedId === node.id ? null : node.id) : null;
  state.hoveredId = null;
  renderInfo(nodes.find((n) => n.id === state.selectedId));
  renderCards();
});
canvas.addEventListener('touchstart', (event) => {
  const node = hit(point(event));
  if (!node) return;
  event.preventDefault();
  state.selectedId = state.selectedId === node.id ? null : node.id;
  renderInfo(nodes.find((n) => n.id === state.selectedId));
  renderCards();
}, { passive: false });

searchInput.addEventListener('input', (event) => { state.query = event.target.value; renderCards(); });
resetButton.addEventListener('click', () => { state.selectedId = null; state.hoveredId = null; state.query = ''; searchInput.value = ''; renderInfo(null); renderCards(); });
fitButton.addEventListener('click', () => refresh(true));
window.addEventListener('resize', () => { resize(); refresh(true); });

addForm.addEventListener('submit', (event) => {
  event.preventDefault();
  let sectionId = sectionSelect.value;
  if (sectionId === '__new') {
    const title = newSectionInput.value.trim();
    if (!title) return;
    sectionId = slug(title);
    sections.push({ id: sectionId, title, note: 'Новый раздел. Описание можно будет дописать позже.', color: ['#ff72c8','#ffd56c','#66ffd2','#7ad7ff','#a77dff','#ff8f70'][sections.length % 6] });
  }
  const title = itemTitle.value.trim();
  if (!title) return;
  items.push({
    id: `${sectionId}-${slug(title)}-${Date.now().toString(36)}`,
    sectionId,
    title,
    text: itemText.value.trim(),
    tags: itemTags.value.split(',').map((x) => x.trim()).filter(Boolean)
  });
  saveData();
  addForm.reset();
  refresh(true);
});

loadData();
resize();
refresh(true);
draw();
