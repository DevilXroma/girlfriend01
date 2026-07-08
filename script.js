const canvas = document.querySelector('#mapCanvas');
const box = document.querySelector('#canvasBox');
const ctx = canvas.getContext('2d');

const modeLabel = document.querySelector('#modeLabel');
const mapTitle = document.querySelector('#mapTitle');
const mapHint = document.querySelector('#mapHint');
const mapStats = document.querySelector('#mapStats');
const homeButton = document.querySelector('#homeButton');
const addSectionButton = document.querySelector('#addSectionButton');
const searchInput = document.querySelector('#searchInput');
const sidePanel = document.querySelector('#sidePanel');
const detailsOverline = document.querySelector('#detailsOverline');
const detailsTitle = document.querySelector('#detailsTitle');
const detailsText = document.querySelector('#detailsText');
const detailStats = document.querySelector('#detailStats');
const insideList = document.querySelector('#insideList');
const addItemButton = document.querySelector('#addItemButton');
const editButton = document.querySelector('#editButton');
const editorBlock = document.querySelector('#editorBlock');
const editorMode = document.querySelector('#editorMode');
const editorTitle = document.querySelector('#editorTitle');
const closeEditorButton = document.querySelector('#closeEditorButton');
const editForm = document.querySelector('#editForm');
const sectionPickLabel = document.querySelector('#sectionPickLabel');
const sectionSelect = document.querySelector('#sectionSelect');
const titleInput = document.querySelector('#titleInput');
const commentInput = document.querySelector('#commentInput');
const tagsLabel = document.querySelector('#tagsLabel');
const tagsInput = document.querySelector('#tagsInput');
const saveButton = document.querySelector('#saveButton');

const STORAGE_KEY = 'memory-map-v03';
let sections = [];
let items = [];
let nodes = [];
let links = [];
let width = 0;
let height = 0;
let dpr = 1;
let dragged = null;
const state = { view: 'home', activeSectionId: null, selectedId: null, hoveredId: null, query: '', editor: null };

function clone(value) { return JSON.parse(JSON.stringify(value)); }
function norm(value) { return String(value || '').toLowerCase().trim(); }
function makeId(value) { return norm(value).replace(/[^a-zа-яё0-9]+/gi, '-').replace(/^-|-$/g, '') || `node-${Date.now()}`; }
function sectionOf(id) { return sections.find((section) => section.id === id); }
function itemOf(id) { return items.find((item) => item.id === id); }
function focusId() { return state.hoveredId || state.selectedId; }
function activeSection() { return sectionOf(state.activeSectionId); }

function loadData() {
  const saved = localStorage.getItem(STORAGE_KEY);
  if (saved) {
    try {
      const parsed = JSON.parse(saved);
      sections = parsed.sections || clone(DEFAULT_SECTIONS);
      items = parsed.items || clone(DEFAULT_ITEMS);
      return;
    } catch (error) { console.warn(error); }
  }
  sections = clone(DEFAULT_SECTIONS);
  items = clone(DEFAULT_ITEMS);
}
function saveData() { localStorage.setItem(STORAGE_KEY, JSON.stringify({ sections, items })); }

function resize() {
  const rect = box.getBoundingClientRect();
  dpr = Math.min(window.devicePixelRatio || 1, 2);
  width = Math.max(320, rect.width);
  height = Math.max(420, rect.height);
  canvas.width = Math.floor(width * dpr);
  canvas.height = Math.floor(height * dpr);
  canvas.style.width = `${width}px`;
  canvas.style.height = `${height}px`;
}

function buildHome() {
  const count = sections.length || 1;
  const rx = Math.min(width * 0.34, 430);
  const ry = Math.min(height * 0.31, 300);
  nodes = sections.map((section, index) => {
    const angle = -Math.PI / 2 + (index / count) * Math.PI * 2;
    const x = Math.cos(angle) * rx;
    const y = Math.sin(angle) * ry;
    return { id: section.id, type: 'section', title: section.title, comment: section.description, color: section.color, icon: section.icon, x, y, homeX: x, homeY: y, vx: 0, vy: 0, r: 38, sectionId: section.id, tags: [] };
  });
  links = nodes.map((node, index) => ({ a: node, b: nodes[(index + 1) % nodes.length], type: 'soft', weight: 1 }));
}

function buildSection(sectionId) {
  const section = sectionOf(sectionId) || sections[0];
  const list = items.filter((item) => item.sectionId === section.id);
  const center = { id: section.id, type: 'section-center', title: section.title, comment: section.description, color: section.color, icon: section.icon, x: 0, y: 0, homeX: 0, homeY: 0, vx: 0, vy: 0, r: 42, sectionId: section.id, tags: [] };
  nodes = [center];

  const count = Math.max(1, list.length);
  const rx = Math.min(width * 0.42, 560);
  const ry = Math.min(height * 0.36, 350);
  list.forEach((item, index) => {
    const angle = -Math.PI / 2 + (index / count) * Math.PI * 2;
    const lane = 0.78 + (index % 4) * 0.11;
    const x = Math.cos(angle) * rx * lane;
    const y = Math.sin(angle) * ry * lane;
    nodes.push({ id: item.id, type: 'item', title: item.title, comment: item.comment, color: section.color, icon: '', x, y, homeX: x, homeY: y, vx: 0, vy: 0, r: 18 + Math.min((item.tags || []).length, 4), sectionId: section.id, tags: item.tags || [] });
  });

  links = nodes.filter((node) => node.type === 'item').map((node) => ({ a: center, b: node, type: 'parent', weight: 2 }));
  for (let i = 1; i < nodes.length; i += 1) {
    for (let j = i + 1; j < nodes.length; j += 1) {
      const shared = nodes[i].tags.filter((tag) => nodes[j].tags.includes(tag));
      if (shared.length) links.push({ a: nodes[i], b: nodes[j], type: 'tag', weight: Math.min(shared.length, 3) });
    }
  }
}

function rebuild() {
  if (state.view === 'home') buildHome();
  else buildSection(state.activeSectionId);
  renderHeader();
  renderPanel();
}

function renderHeader() {
  if (state.view === 'home') {
    modeLabel.textContent = 'главная карта';
    mapTitle.textContent = 'Разделы';
    mapHint.textContent = 'Нажми на раздел. Внутри будут записи, которые можно дополнять и редактировать.';
  } else {
    const section = activeSection();
    modeLabel.textContent = 'раздел';
    mapTitle.textContent = section.title;
    mapHint.textContent = 'Каждая точка — запись: название, комментарий и теги. Неполная информация тоже нормальна.';
  }

  mapStats.textContent = '';
  [[sections.length, 'разделов'], [items.length, 'записей'], [shownItems().length, 'видно']].forEach(([num, label]) => {
    const box = document.createElement('div');
    const strong = document.createElement('strong');
    const span = document.createElement('span');
    strong.textContent = num;
    span.textContent = label;
    box.append(strong, span);
    mapStats.appendChild(box);
  });
}

function nodeById(id) { return nodes.find((node) => node.id === id); }
function getSelectedNode() { return nodeById(state.selectedId); }
function relatedIds(node) {
  if (!node) return new Set();
  const ids = new Set([node.id]);
  links.forEach((link) => {
    if (link.a.id === node.id) ids.add(link.b.id);
    if (link.b.id === node.id) ids.add(link.a.id);
  });
  return ids;
}

function nodeMatchesQuery(node) {
  const q = norm(state.query);
  if (!q) return true;
  if (node.type === 'section' || node.type === 'section-center') {
    const sectionItems = items.filter((item) => item.sectionId === node.sectionId);
    return norm([node.title, node.comment, ...sectionItems.map((item) => `${item.title} ${item.comment} ${(item.tags || []).join(' ')}`)].join(' ')).includes(q);
  }
  return norm([node.title, node.comment, ...(node.tags || [])].join(' ')).includes(q);
}

function physics() {
  const focus = nodeById(focusId());
  const related = relatedIds(focus);

  nodes.forEach((node) => {
    if (node === dragged) return;
    node.vx += (node.homeX - node.x) * 0.006;
    node.vy += (node.homeY - node.y) * 0.006;
    if (focus && !related.has(node.id)) {
      node.vx += (node.x > 0 ? 0.01 : -0.01);
      node.vy += (node.y > 0 ? 0.006 : -0.006);
    }
  });

  links.forEach((link) => {
    const dx = link.b.x - link.a.x;
    const dy = link.b.y - link.a.y;
    const dist = Math.hypot(dx, dy) || 1;
    const target = link.type === 'parent' ? 190 : link.type === 'tag' ? 250 : 330;
    const force = (dist - target) * 0.00075 * (link.weight || 1);
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
      const min = a.r + b.r + (a.type.includes('section') || b.type.includes('section') ? 74 : 42);
      if (dist < min) {
        const push = (min - dist) * 0.011;
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
    node.x = Math.max(-width / 2 + 64, Math.min(width / 2 - 64, node.x));
    node.y = Math.max(-height / 2 + 64, Math.min(height / 2 - 64, node.y));
  });
}

function draw() {
  ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
  ctx.clearRect(0, 0, canvas.width, canvas.height);
  ctx.setTransform(dpr, 0, 0, dpr, width / 2, height / 2);

  const focus = nodeById(focusId());
  const related = relatedIds(focus);
  const hasQuery = Boolean(norm(state.query));

  links.forEach((link) => {
    const inFocus = !focus || (related.has(link.a.id) && related.has(link.b.id));
    const queryOk = !hasQuery || nodeMatchesQuery(link.a) || nodeMatchesQuery(link.b);
    const active = inFocus && queryOk;
    ctx.save();
    ctx.globalAlpha = active ? (link.type === 'tag' ? 0.25 : 0.55) : 0.035;
    ctx.strokeStyle = link.type === 'tag' ? 'rgba(255,255,255,.52)' : link.a.color;
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
    const inFocus = !focus || related.has(node.id);
    const queryOk = !hasQuery || nodeMatchesQuery(node);
    const active = inFocus && queryOk;
    const selected = focus && focus.id === node.id;
    const radius = node.r + (selected ? 7 : 0);

    ctx.save();
    ctx.globalAlpha = active ? 1 : 0.17;
    ctx.shadowColor = node.color;
    ctx.shadowBlur = node.type === 'item' ? 16 : 32;
    ctx.fillStyle = node.color;
    ctx.beginPath();
    ctx.arc(node.x, node.y, radius, 0, Math.PI * 2);
    ctx.fill();
    ctx.shadowBlur = 0;
    ctx.fillStyle = '#fff';
    ctx.font = `${node.type === 'item' ? 800 : 900} ${node.type === 'item' ? 12 : 16}px Inter, sans-serif`;
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText(node.title, node.x, node.y - radius - 15);
    if (node.icon) {
      ctx.fillStyle = 'rgba(0,0,0,.45)';
      ctx.font = '900 20px Inter, sans-serif';
      ctx.fillText(node.icon, node.x, node.y + 1);
    }
    if (node.type !== 'item') {
      const count = items.filter((item) => item.sectionId === node.sectionId).length;
      ctx.fillStyle = 'rgba(255,255,255,.72)';
      ctx.font = '700 11px Inter, sans-serif';
      ctx.fillText(`${count} записей`, node.x, node.y + radius + 17);
    }
    if (selected) {
      ctx.strokeStyle = 'rgba(255,255,255,.9)';
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

function canvasPoint(event) {
  const rect = canvas.getBoundingClientRect();
  const source = event.touches ? event.touches[0] : event;
  return { x: source.clientX - rect.left - rect.width / 2, y: source.clientY - rect.top - rect.height / 2 };
}
function hitNode(point) { return [...nodes].reverse().find((node) => Math.hypot(node.x - point.x, node.y - point.y) < node.r + 28) || null; }

function selectNode(node) {
  if (!node) { state.selectedId = null; renderPanel(); return; }
  if (state.view === 'home' && node.type === 'section') {
    state.view = 'section';
    state.activeSectionId = node.sectionId;
    state.selectedId = node.sectionId;
    state.hoveredId = null;
    closeEditor();
    rebuild();
    fillSectionSelect();
    return;
  }
  state.selectedId = state.selectedId === node.id ? null : node.id;
  renderPanel();
}

function shownItems() {
  const q = norm(state.query);
  return items.filter((item) => {
    const inView = state.view === 'home' || item.sectionId === state.activeSectionId;
    const section = sectionOf(item.sectionId);
    const text = norm([item.title, item.comment, ...(item.tags || []), section?.title].join(' '));
    return inView && (!q || text.includes(q));
  });
}

function renderPanel() {
  const selected = getSelectedNode();
  const section = state.view === 'section' ? activeSection() : null;
  const target = selected || (section ? nodeById(section.id) : null);

  if (!target) {
    detailsOverline.textContent = 'главная';
    detailsTitle.textContent = 'Выбери раздел';
    detailsText.textContent = 'Справа будет информация, список вложений и кнопки для добавления/редактирования.';
    detailStats.textContent = '';
    insideList.textContent = '';
    addItemButton.disabled = true;
    editButton.disabled = true;
  } else {
    const isItem = target.type === 'item';
    detailsOverline.textContent = isItem ? 'запись' : 'раздел';
    detailsTitle.textContent = target.title;
    detailsText.textContent = target.comment || 'Пока без комментария. Можно дописать позже.';
    addItemButton.disabled = isItem && !state.activeSectionId;
    editButton.disabled = false;
    renderDetailStats(target);
    renderInside(target);
  }
  renderHeader();
}

function renderDetailStats(target) {
  detailStats.textContent = '';
  const sectionItems = items.filter((item) => item.sectionId === target.sectionId);
  const values = target.type === 'item'
    ? [[(target.tags || []).length, 'тегов'], [relatedIds(target).size - 1, 'связей']]
    : [[sectionItems.length, 'внутри'], [items.length, 'всего']];
  values.forEach(([num, label]) => {
    const box = document.createElement('div');
    const strong = document.createElement('strong');
    const span = document.createElement('span');
    strong.textContent = num;
    span.textContent = label;
    box.append(strong, span);
    detailStats.appendChild(box);
  });
}

function renderInside(target) {
  insideList.textContent = '';
  const q = norm(state.query);
  if (target.type === 'item') {
    (target.tags || []).forEach((tag) => addChip(`#${tag}`));
    return;
  }
  items
    .filter((item) => item.sectionId === target.sectionId)
    .filter((item) => !q || norm([item.title, item.comment, ...(item.tags || [])].join(' ')).includes(q))
    .forEach((item) => {
      const chip = addChip(item.title, () => {
        if (state.view === 'home') {
          state.view = 'section';
          state.activeSectionId = item.sectionId;
          rebuild();
        }
        state.selectedId = item.id;
        renderPanel();
      });
      if (state.selectedId === item.id) chip.classList.add('active');
    });
}

function addChip(label, action) {
  const chip = document.createElement('button');
  chip.type = 'button';
  chip.textContent = label;
  if (action) chip.addEventListener('click', action);
  insideList.appendChild(chip);
  return chip;
}

function fillSectionSelect() {
  sectionSelect.textContent = '';
  sections.forEach((section) => {
    const option = document.createElement('option');
    option.value = section.id;
    option.textContent = section.title;
    sectionSelect.appendChild(option);
  });
}

function openEditor(mode, targetId = null) {
  state.editor = { mode, id: targetId };
  editorBlock.classList.add('open');
  sidePanel.classList.add('editing');
  fillSectionSelect();

  const isSection = mode.includes('section');
  const isEdit = mode.includes('edit');
  const targetSection = isSection ? sectionOf(targetId) : null;
  const targetItem = !isSection && targetId ? itemOf(targetId) : null;

  editorMode.textContent = isEdit ? 'редактирование' : 'добавление';
  editorTitle.textContent = isSection ? (isEdit ? 'Раздел' : 'Новый раздел') : (isEdit ? 'Запись' : 'Новая запись');
  sectionPickLabel.classList.toggle('hidden', isSection);
  tagsLabel.classList.toggle('hidden', isSection);

  titleInput.value = targetSection?.title || targetItem?.title || '';
  commentInput.value = targetSection?.description || targetItem?.comment || '';
  tagsInput.value = targetItem ? (targetItem.tags || []).join(', ') : '';
  sectionSelect.value = targetItem?.sectionId || state.activeSectionId || sections[0]?.id || '';
  saveButton.textContent = isEdit ? 'сохранить правки' : 'добавить';
  setTimeout(() => titleInput.focus(), 50);
}

function closeEditor() {
  state.editor = null;
  editorBlock.classList.remove('open');
  sidePanel.classList.remove('editing');
  editForm.reset();
}

function currentTargetForEdit() {
  const selected = getSelectedNode();
  if (selected) return selected;
  if (state.view === 'section') return nodeById(state.activeSectionId);
  return null;
}

homeButton.addEventListener('click', () => {
  state.view = 'home';
  state.activeSectionId = null;
  state.selectedId = null;
  state.hoveredId = null;
  closeEditor();
  rebuild();
});
addSectionButton.addEventListener('click', () => openEditor('add-section'));
addItemButton.addEventListener('click', () => openEditor('add-item'));
editButton.addEventListener('click', () => {
  const target = currentTargetForEdit();
  if (!target) return;
  openEditor(target.type === 'item' ? 'edit-item' : 'edit-section', target.id);
});
closeEditorButton.addEventListener('click', closeEditor);

editForm.addEventListener('submit', (event) => {
  event.preventDefault();
  const title = titleInput.value.trim();
  if (!title || !state.editor) return;
  const comment = commentInput.value.trim();
  const mode = state.editor.mode;

  if (mode === 'add-section') {
    const id = `section-${makeId(title)}-${Date.now().toString(36)}`;
    const colors = ['#ff72c8', '#ff9df2', '#ffd56c', '#66ffd2', '#7ad7ff', '#a77dff', '#ff8f70', '#8cff9f', '#8fb3ff', '#d69cff'];
    sections.push({ id, title, description: comment || 'Новый раздел. Описание можно дописать позже.', color: colors[sections.length % colors.length], icon: '✦' });
    state.view = 'section';
    state.activeSectionId = id;
    state.selectedId = id;
  }

  if (mode === 'edit-section') {
    const section = sectionOf(state.editor.id);
    if (section) {
      section.title = title;
      section.description = comment;
    }
  }

  if (mode === 'add-item') {
    const sectionId = sectionSelect.value || state.activeSectionId || sections[0]?.id;
    const item = {
      id: `item-${makeId(title)}-${Date.now().toString(36)}`,
      sectionId,
      title,
      comment,
      tags: tagsInput.value.split(',').map((tag) => tag.trim()).filter(Boolean)
    };
    items.push(item);
    state.view = 'section';
    state.activeSectionId = sectionId;
    state.selectedId = item.id;
  }

  if (mode === 'edit-item') {
    const item = itemOf(state.editor.id);
    if (item) {
      item.sectionId = sectionSelect.value || item.sectionId;
      item.title = title;
      item.comment = comment;
      item.tags = tagsInput.value.split(',').map((tag) => tag.trim()).filter(Boolean);
      state.activeSectionId = item.sectionId;
      state.selectedId = item.id;
    }
  }

  saveData();
  closeEditor();
  rebuild();
});

searchInput.addEventListener('input', (event) => { state.query = event.target.value; renderPanel(); });

canvas.addEventListener('mousemove', (event) => {
  const node = hitNode(canvasPoint(event));
  state.hoveredId = node?.id || null;
  if (node) renderPanel();
  else renderPanel();
  canvas.style.cursor = node ? 'pointer' : 'default';
});
canvas.addEventListener('mouseleave', () => { state.hoveredId = null; dragged = null; renderPanel(); });
canvas.addEventListener('mousedown', (event) => { dragged = hitNode(canvasPoint(event)); });
window.addEventListener('mousemove', (event) => {
  if (!dragged) return;
  const point = canvasPoint(event);
  dragged.x = point.x;
  dragged.y = point.y;
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
window.addEventListener('resize', () => { resize(); rebuild(); });

loadData();
resize();
rebuild();
draw();
