const canvas = document.querySelector('#mapCanvas');
const canvasBox = document.querySelector('#canvasBox');
const ctx = canvas.getContext('2d');

const modeLabel = document.querySelector('#modeLabel');
const mapTitle = document.querySelector('#mapTitle');
const mapHint = document.querySelector('#mapHint');
const backButton = document.querySelector('#backButton');
const resetButton = document.querySelector('#resetButton');
const detailsOverline = document.querySelector('#detailsOverline');
const detailsTitle = document.querySelector('#detailsTitle');
const detailsText = document.querySelector('#detailsText');
const detailStats = document.querySelector('#detailStats');
const detailChips = document.querySelector('#detailChips');
const searchInput = document.querySelector('#searchInput');
const statsRow = document.querySelector('#statsRow');
const sectionSelect = document.querySelector('#sectionSelect');
const newSectionLabel = document.querySelector('#newSectionLabel');
const newSectionInput = document.querySelector('#newSectionInput');
const itemTitle = document.querySelector('#itemTitle');
const itemText = document.querySelector('#itemText');
const itemTags = document.querySelector('#itemTags');
const addForm = document.querySelector('#addForm');
const notesTitle = document.querySelector('#notesTitle');
const notesList = document.querySelector('#notesList');
const copyDataButton = document.querySelector('#copyDataButton');
const exportBox = document.querySelector('#exportBox');

const STORAGE_KEY = 'memory-map-v01';
let sections = [];
let items = [];
let nodes = [];
let links = [];
let width = 0;
let height = 0;
let dpr = 1;
let dragged = null;
const state = { view: 'home', activeSectionId: null, selectedId: null, hoveredId: null, query: '' };

function clone(value) { return JSON.parse(JSON.stringify(value)); }
function normalize(value) { return String(value || '').toLowerCase().trim(); }
function makeId(value) { return normalize(value).replace(/[^a-zа-яё0-9]+/gi, '-').replace(/^-|-$/g, '') || `item-${Date.now()}`; }
function getSection(id) { return sections.find((section) => section.id === id); }
function getItem(id) { return items.find((item) => item.id === id); }
function focusId() { return state.hoveredId || state.selectedId; }

function loadData() {
  const saved = localStorage.getItem(STORAGE_KEY);
  if (saved) {
    try {
      const data = JSON.parse(saved);
      sections = data.sections || clone(DEFAULT_SECTIONS);
      items = data.items || clone(DEFAULT_ITEMS);
      return;
    } catch (error) {
      console.warn(error);
    }
  }
  sections = clone(DEFAULT_SECTIONS);
  items = clone(DEFAULT_ITEMS);
}

function saveData() {
  localStorage.setItem(STORAGE_KEY, JSON.stringify({ sections, items }));
}

function resize() {
  const rect = canvasBox.getBoundingClientRect();
  dpr = Math.min(window.devicePixelRatio || 1, 2);
  width = Math.max(320, rect.width);
  height = Math.max(460, rect.height);
  canvas.width = Math.floor(width * dpr);
  canvas.height = Math.floor(height * dpr);
  canvas.style.width = `${width}px`;
  canvas.style.height = `${height}px`;
}

function buildHomeGraph() {
  const count = sections.length || 1;
  const rx = Math.min(width * 0.34, 410);
  const ry = Math.min(height * 0.30, 260);
  nodes = sections.map((section, index) => {
    const angle = -Math.PI / 2 + (index / count) * Math.PI * 2;
    const x = Math.cos(angle) * rx;
    const y = Math.sin(angle) * ry;
    return {
      id: section.id,
      type: 'section',
      title: section.title,
      comment: section.description,
      color: section.color,
      icon: section.icon,
      x, y,
      homeX: x,
      homeY: y,
      vx: 0,
      vy: 0,
      r: 38,
      sectionId: section.id,
      tags: []
    };
  });

  links = [];
  for (let i = 0; i < nodes.length; i += 1) {
    links.push({ a: nodes[i], b: nodes[(i + 1) % nodes.length], type: 'soft', weight: 1 });
  }
}

function buildSectionGraph(sectionId) {
  const section = getSection(sectionId);
  const sectionItems = items.filter((item) => item.sectionId === sectionId);
  const center = {
    id: section.id,
    type: 'section-center',
    title: section.title,
    comment: section.description,
    color: section.color,
    icon: section.icon,
    x: 0,
    y: 0,
    homeX: 0,
    homeY: 0,
    vx: 0,
    vy: 0,
    r: 40,
    sectionId,
    tags: []
  };

  nodes = [center];
  const count = Math.max(1, sectionItems.length);
  const rx = Math.min(width * 0.38, 500);
  const ry = Math.min(height * 0.33, 310);

  sectionItems.forEach((item, index) => {
    const angle = -Math.PI / 2 + (index / count) * Math.PI * 2;
    const wobble = index % 2 ? 0.88 : 1.08;
    const x = Math.cos(angle) * rx * wobble;
    const y = Math.sin(angle) * ry * wobble;
    nodes.push({
      id: item.id,
      type: 'item',
      title: item.title,
      comment: item.comment,
      color: section.color,
      icon: '',
      x, y,
      homeX: x,
      homeY: y,
      vx: 0,
      vy: 0,
      r: 23,
      sectionId,
      tags: item.tags || []
    });
  });

  links = nodes.filter((node) => node.type === 'item').map((node) => ({ a: center, b: node, type: 'parent', weight: 2 }));

  for (let i = 1; i < nodes.length; i += 1) {
    for (let j = i + 1; j < nodes.length; j += 1) {
      const shared = nodes[i].tags.filter((tag) => nodes[j].tags.includes(tag));
      if (shared.length) links.push({ a: nodes[i], b: nodes[j], type: 'tag', weight: shared.length });
    }
  }
}

function rebuildGraph() {
  if (state.view === 'home') buildHomeGraph();
  else buildSectionGraph(state.activeSectionId);
  updateMapText();
}

function updateMapText() {
  if (state.view === 'home') {
    modeLabel.textContent = 'главная карта';
    mapTitle.textContent = 'Разделы';
    mapHint.textContent = 'Тут только крупные разделы. Нажми на раздел, чтобы открыть его внутреннюю карту.';
    backButton.classList.add('hidden');
  } else {
    const section = getSection(state.activeSectionId);
    modeLabel.textContent = 'раздел';
    mapTitle.textContent = section.title;
    mapHint.textContent = 'Внутри раздела каждая точка — универсальная запись: название, комментарий и теги.';
    backButton.classList.remove('hidden');
  }
}

function getRelatedIds(node) {
  if (!node) return new Set();
  const ids = new Set([node.id]);
  links.forEach((link) => {
    if (link.a.id === node.id) ids.add(link.b.id);
    if (link.b.id === node.id) ids.add(link.a.id);
  });
  return ids;
}

function physics() {
  const focus = nodes.find((node) => node.id === focusId());
  const related = getRelatedIds(focus);

  nodes.forEach((node) => {
    if (node === dragged) return;
    node.vx += (node.homeX - node.x) * 0.006;
    node.vy += (node.homeY - node.y) * 0.006;
    if (focus && !related.has(node.id)) {
      node.vx += (node.x > 0 ? 0.012 : -0.012);
      node.vy += (node.y > 0 ? 0.007 : -0.007);
    }
  });

  links.forEach((link) => {
    const dx = link.b.x - link.a.x;
    const dy = link.b.y - link.a.y;
    const dist = Math.hypot(dx, dy) || 1;
    const target = link.type === 'parent' ? 195 : link.type === 'tag' ? 260 : 330;
    const force = (dist - target) * 0.0008 * (link.weight || 1);
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
      const min = a.r + b.r + (a.type.includes('section') || b.type.includes('section') ? 72 : 46);
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
    node.x = Math.max(-width / 2 + 70, Math.min(width / 2 - 70, node.x));
    node.y = Math.max(-height / 2 + 70, Math.min(height / 2 - 70, node.y));
  });
}

function draw() {
  ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
  ctx.clearRect(0, 0, canvas.width, canvas.height);
  ctx.setTransform(dpr, 0, 0, dpr, width / 2, height / 2);

  const focus = nodes.find((node) => node.id === focusId());
  const related = getRelatedIds(focus);

  links.forEach((link) => {
    const active = !focus || (related.has(link.a.id) && related.has(link.b.id));
    ctx.save();
    ctx.globalAlpha = active ? (link.type === 'tag' ? 0.28 : 0.58) : 0.05;
    ctx.strokeStyle = link.type === 'tag' ? 'rgba(255,255,255,.55)' : link.a.color;
    ctx.lineWidth = link.type === 'tag' ? 1 : 2.2;
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
    ctx.shadowBlur = node.type === 'item' ? 18 : 32;
    ctx.fillStyle = node.color;
    ctx.beginPath();
    ctx.arc(node.x, node.y, radius, 0, Math.PI * 2);
    ctx.fill();

    ctx.shadowBlur = 0;
    ctx.fillStyle = '#fff';
    ctx.font = `${node.type === 'item' ? 800 : 900} ${node.type === 'item' ? 13 : 16}px Inter, sans-serif`;
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText(node.title, node.x, node.y - radius - 16);

    if (node.icon) {
      ctx.fillStyle = 'rgba(0,0,0,.45)';
      ctx.font = '900 20px Inter, sans-serif';
      ctx.fillText(node.icon, node.x, node.y + 1);
    }

    if (node.type !== 'item') {
      const count = items.filter((item) => item.sectionId === node.sectionId).length;
      ctx.fillStyle = 'rgba(255,255,255,.72)';
      ctx.font = '700 11px Inter, sans-serif';
      ctx.fillText(`${count} записей`, node.x, node.y + radius + 18);
    }

    if (selected) {
      ctx.strokeStyle = 'rgba(255,255,255,.85)';
      ctx.lineWidth = 1.6;
      ctx.beginPath();
      ctx.arc(node.x, node.y, radius + 11, 0, Math.PI * 2);
      ctx.stroke();
    }
    ctx.restore();
  });

  physics();
  requestAnimationFrame(draw);
}

function canvasPoint(event) {
  const rect = canvas.getBoundingClientRect();
  const source = event.touches ? event.touches[0] : event;
  return { x: source.clientX - rect.left - rect.width / 2, y: source.clientY - rect.top - rect.height / 2 };
}

function hitNode(point) {
  return [...nodes].reverse().find((node) => Math.hypot(node.x - point.x, node.y - point.y) < node.r + 28) || null;
}

function selectNode(node) {
  if (!node) {
    state.selectedId = null;
    renderDetails(null);
    renderNotes();
    return;
  }

  if (state.view === 'home' && node.type === 'section') {
    state.view = 'section';
    state.activeSectionId = node.sectionId;
    state.selectedId = node.sectionId;
    state.hoveredId = null;
    rebuildGraph();
    renderDetails(nodes.find((item) => item.id === node.sectionId));
    renderNotes();
    return;
  }

  state.selectedId = state.selectedId === node.id ? null : node.id;
  renderDetails(nodes.find((item) => item.id === state.selectedId));
  renderNotes();
}

function renderDetails(node) {
  if (!node) {
    detailsOverline.textContent = 'ничего не выбрано';
    detailsTitle.textContent = state.view === 'home' ? 'Выбери раздел' : 'Выбери запись';
    detailsText.textContent = state.view === 'home'
      ? 'На главной карте видны только большие разделы. Внутри раздела появятся конкретные заметки и связи.'
      : 'Каждая точка — это универсальная запись: название, комментарий и теги.';
    detailStats.textContent = '';
    detailChips.textContent = '';
    return;
  }

  detailsOverline.textContent = node.type === 'item' ? 'запись' : 'раздел';
  detailsTitle.textContent = node.title;
  detailsText.textContent = node.comment || 'Пока без комментария.';
  detailStats.textContent = '';
  detailChips.textContent = '';

  const sectionItems = items.filter((item) => item.sectionId === node.sectionId);
  const values = node.type === 'item'
    ? [[node.tags.length, 'тегов'], [getRelatedIds(node).size - 1, 'связей']]
    : [[sectionItems.length, 'записей'], [sections.length, 'разделов']];

  values.forEach(([num, label]) => {
    const box = document.createElement('div');
    const strong = document.createElement('strong');
    const span = document.createElement('span');
    strong.textContent = num;
    span.textContent = label;
    box.append(strong, span);
    detailStats.appendChild(box);
  });

  const chips = node.type === 'item' ? node.tags.map((tag) => `#${tag}`) : sectionItems.map((item) => item.title);
  chips.slice(0, 12).forEach((label) => {
    const chip = document.createElement('button');
    chip.type = 'button';
    chip.textContent = label;
    detailChips.appendChild(chip);
  });
}

function filteredItems() {
  const q = normalize(state.query);
  const selected = nodes.find((node) => node.id === state.selectedId);
  return items.filter((item) => {
    const byView = state.view === 'home' || item.sectionId === state.activeSectionId;
    const bySelection = !selected || selected.type !== 'item' || item.id === selected.id;
    const section = getSection(item.sectionId);
    const text = normalize([item.title, item.comment, ...item.tags, section?.title].join(' '));
    return byView && bySelection && (!q || text.includes(q));
  });
}

function renderStats(list) {
  statsRow.textContent = '';
  [[sections.length, 'разделов'], [items.length, 'записей'], [links.length, 'связей'], [list.length, 'показано']].forEach(([num, label]) => {
    const box = document.createElement('div');
    const strong = document.createElement('strong');
    const span = document.createElement('span');
    strong.textContent = num;
    span.textContent = label;
    box.append(strong, span);
    statsRow.appendChild(box);
  });
}

function renderNotes() {
  const list = filteredItems();
  renderStats(list);
  notesTitle.textContent = state.view === 'home' ? 'Все записи' : `Записи: ${getSection(state.activeSectionId)?.title}`;
  notesList.textContent = '';

  if (!list.length) {
    const empty = document.createElement('div');
    empty.className = 'empty';
    empty.textContent = 'Пока ничего нет. Можно добавить запись через форму.';
    notesList.appendChild(empty);
    return;
  }

  list.forEach((item) => {
    const section = getSection(item.sectionId);
    const card = document.createElement('article');
    card.className = 'note';
    const top = document.createElement('div');
    top.className = 'note-top';
    const sec = document.createElement('span');
    sec.textContent = section?.title || 'Раздел';
    const tagPreview = document.createElement('small');
    tagPreview.textContent = item.tags.slice(0, 2).join(', ') || 'без тегов';
    top.append(sec, tagPreview);
    const title = document.createElement('h3');
    title.textContent = item.title;
    const text = document.createElement('p');
    text.textContent = item.comment || 'Без комментария.';
    const tagBox = document.createElement('div');
    tagBox.className = 'note-tags';
    item.tags.forEach((tag) => {
      const chip = document.createElement('button');
      chip.type = 'button';
      chip.textContent = `#${tag}`;
      tagBox.appendChild(chip);
    });
    card.addEventListener('click', () => {
      if (state.view === 'home') {
        state.view = 'section';
        state.activeSectionId = item.sectionId;
        rebuildGraph();
      }
      state.selectedId = item.id;
      renderDetails(nodes.find((node) => node.id === item.id));
      renderNotes();
      window.scrollTo({ top: 0, behavior: 'smooth' });
    });
    card.append(top, title, text, tagBox);
    notesList.appendChild(card);
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
  const add = document.createElement('option');
  add.value = '__new';
  add.textContent = '+ новый раздел';
  sectionSelect.appendChild(add);
  if (state.activeSectionId) sectionSelect.value = state.activeSectionId;
  newSectionLabel.classList.toggle('visible', sectionSelect.value === '__new');
}

function refreshAll() {
  rebuildGraph();
  fillSectionSelect();
  renderDetails(nodes.find((node) => node.id === state.selectedId));
  renderNotes();
  exportBox.value = '';
}

canvas.addEventListener('mousemove', (event) => {
  const node = hitNode(canvasPoint(event));
  state.hoveredId = node?.id || null;
  renderDetails(node || nodes.find((item) => item.id === state.selectedId));
  canvas.style.cursor = node ? 'pointer' : 'default';
});
canvas.addEventListener('mouseleave', () => {
  state.hoveredId = null;
  dragged = null;
  renderDetails(nodes.find((node) => node.id === state.selectedId));
});
canvas.addEventListener('mousedown', (event) => { dragged = hitNode(canvasPoint(event)); });
window.addEventListener('mousemove', (event) => {
  if (!dragged) return;
  const p = canvasPoint(event);
  dragged.x = p.x;
  dragged.y = p.y;
  dragged.vx = 0;
  dragged.vy = 0;
});
window.addEventListener('mouseup', () => { dragged = null; });
canvas.addEventListener('click', (event) => selectNode(hitNode(canvasPoint(event))));
canvas.addEventListener('touchstart', (event) => {
  const node = hitNode(canvasPoint(event));
  if (!node) return;
  event.preventDefault();
  selectNode(node);
}, { passive: false });

backButton.addEventListener('click', () => {
  state.view = 'home';
  state.activeSectionId = null;
  state.selectedId = null;
  state.hoveredId = null;
  refreshAll();
});
resetButton.addEventListener('click', () => {
  state.selectedId = null;
  state.hoveredId = null;
  state.query = '';
  searchInput.value = '';
  renderDetails(null);
  renderNotes();
});
searchInput.addEventListener('input', (event) => { state.query = event.target.value; renderNotes(); });
sectionSelect.addEventListener('change', () => newSectionLabel.classList.toggle('visible', sectionSelect.value === '__new'));

addForm.addEventListener('submit', (event) => {
  event.preventDefault();
  let sectionId = sectionSelect.value;
  if (sectionId === '__new') {
    const title = newSectionInput.value.trim();
    if (!title) return;
    sectionId = `section-${makeId(title)}-${Date.now().toString(36)}`;
    sections.push({ id: sectionId, title, description: 'Новый раздел. Описание можно будет дописать позже.', color: ['#ff72c8', '#ffd56c', '#66ffd2', '#7ad7ff', '#a77dff', '#ff8f70'][sections.length % 6], icon: '✦' });
  }

  const title = itemTitle.value.trim();
  if (!title) return;
  items.push({
    id: `item-${makeId(title)}-${Date.now().toString(36)}`,
    sectionId,
    title,
    comment: itemText.value.trim(),
    tags: itemTags.value.split(',').map((tag) => tag.trim()).filter(Boolean)
  });

  saveData();
  addForm.reset();
  state.view = 'section';
  state.activeSectionId = sectionId;
  state.selectedId = null;
  refreshAll();
});

copyDataButton.addEventListener('click', async () => {
  const data = JSON.stringify({ sections, items }, null, 2);
  exportBox.value = data;
  try {
    await navigator.clipboard.writeText(data);
    copyDataButton.textContent = 'скопировано';
    setTimeout(() => { copyDataButton.textContent = 'скопировать данные'; }, 1200);
  } catch (error) {
    exportBox.select();
  }
});

window.addEventListener('resize', () => { resize(); refreshAll(); });

loadData();
resize();
refreshAll();
draw();
