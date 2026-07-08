const canvas = document.querySelector('#tagCanvas');
const wrap = document.querySelector('#canvasWrap');
const ctx = canvas.getContext('2d');
const resetButton = document.querySelector('#resetView');
const infoTitle = document.querySelector('#infoTitle');
const infoText = document.querySelector('#infoText');
const infoMeta = document.querySelector('#infoMeta');
const relatedTags = document.querySelector('#relatedTags');
const searchInput = document.querySelector('#searchInput');
const miniStats = document.querySelector('#miniStats');
const notesGrid = document.querySelector('#notesGrid');

const pointer = { x: 0, y: 0, active: false };
const state = { selected: null, hovered: null, query: '' };
let dpr = 1;
let width = 0;
let height = 0;
let nodes = [];
let links = [];
let animationId = 0;
let dragged = null;

const palette = ['#ff72c8', '#a77dff', '#66ffd2', '#ffd56c', '#7ad7ff', '#ff8f70'];

function normalize(value) {
  return String(value || '').toLowerCase().trim();
}

function unique(items) {
  return [...new Set(items)];
}

function buildGraph() {
  const counts = new Map();
  NOTES.forEach((note) => note.tags.forEach((tag) => counts.set(tag, (counts.get(tag) || 0) + 1)));

  const tagList = [...counts.keys()].sort((a, b) => counts.get(b) - counts.get(a));
  nodes = tagList.map((tag, index) => {
    const angle = (index / tagList.length) * Math.PI * 2;
    const ring = index % 3;
    const radius = 95 + ring * 58 + counts.get(tag) * 5;
    return {
      tag,
      count: counts.get(tag),
      x: Math.cos(angle) * radius,
      y: Math.sin(angle) * radius,
      vx: 0,
      vy: 0,
      r: 9 + counts.get(tag) * 2.4,
      color: palette[index % palette.length],
      pulse: Math.random() * Math.PI * 2
    };
  });

  const linkMap = new Map();
  NOTES.forEach((note) => {
    for (let i = 0; i < note.tags.length; i += 1) {
      for (let j = i + 1; j < note.tags.length; j += 1) {
        const a = note.tags[i];
        const b = note.tags[j];
        const key = [a, b].sort().join('::');
        linkMap.set(key, (linkMap.get(key) || 0) + 1);
      }
    }
  });

  links = [...linkMap.entries()].map(([key, weight]) => {
    const [a, b] = key.split('::');
    return {
      a: nodes.find((node) => node.tag === a),
      b: nodes.find((node) => node.tag === b),
      weight
    };
  }).filter((link) => link.a && link.b);
}

function resize() {
  const rect = wrap.getBoundingClientRect();
  dpr = Math.min(window.devicePixelRatio || 1, 2);
  width = Math.max(320, rect.width);
  height = Math.max(420, rect.height);
  canvas.width = Math.floor(width * dpr);
  canvas.height = Math.floor(height * dpr);
  canvas.style.width = `${width}px`;
  canvas.style.height = `${height}px`;
  ctx.setTransform(dpr, 0, 0, dpr, width / 2 * dpr, height / 2 * dpr);
}

function getFocusTag() {
  return state.hovered || state.selected;
}

function getConnectedTags(tag) {
  if (!tag) return new Set();
  const connected = new Set([tag]);
  links.forEach((link) => {
    if (link.a.tag === tag) connected.add(link.b.tag);
    if (link.b.tag === tag) connected.add(link.a.tag);
  });
  return connected;
}

function isNodeActive(node, connected) {
  const focus = getFocusTag();
  return !focus || connected.has(node.tag);
}

function isLinkActive(link, focus) {
  return !focus || link.a.tag === focus || link.b.tag === focus;
}

function applyPhysics() {
  const focus = getFocusTag();
  const connected = getConnectedTags(focus);

  nodes.forEach((node, index) => {
    if (node === dragged) return;

    const baseAngle = (index / nodes.length) * Math.PI * 2;
    const targetRadius = 128 + (index % 4) * 42 + node.count * 10;
    const targetX = Math.cos(baseAngle) * targetRadius;
    const targetY = Math.sin(baseAngle) * targetRadius;

    node.vx += (targetX - node.x) * 0.0009;
    node.vy += (targetY - node.y) * 0.0009;

    if (focus) {
      const active = connected.has(node.tag);
      const focusNode = nodes.find((item) => item.tag === focus);
      if (focusNode && active && node !== focusNode) {
        node.vx += (focusNode.x - node.x) * 0.00045;
        node.vy += (focusNode.y - node.y) * 0.00045;
      }
      if (!active) {
        node.vx += (node.x > 0 ? 0.006 : -0.006);
        node.vy += (node.y > 0 ? 0.004 : -0.004);
      }
    }
  });

  links.forEach((link) => {
    const dx = link.b.x - link.a.x;
    const dy = link.b.y - link.a.y;
    const dist = Math.hypot(dx, dy) || 1;
    const target = 92 + link.weight * 17;
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
      const min = a.r + b.r + 20;
      if (dist < min) {
        const push = (min - dist) * 0.003;
        const fx = dx / dist * push;
        const fy = dy / dist * push;
        if (a !== dragged) { a.vx -= fx; a.vy -= fy; }
        if (b !== dragged) { b.vx += fx; b.vy += fy; }
      }
    }
  }

  nodes.forEach((node) => {
    if (node === dragged) return;
    node.vx *= 0.91;
    node.vy *= 0.91;
    node.x += node.vx;
    node.y += node.vy;

    const padX = width / 2 - 42;
    const padY = height / 2 - 42;
    node.x = Math.max(-padX, Math.min(padX, node.x));
    node.y = Math.max(-padY, Math.min(padY, node.y));
    node.pulse += 0.035;
  });
}

function draw() {
  ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
  ctx.clearRect(0, 0, canvas.width, canvas.height);
  ctx.setTransform(dpr, 0, 0, dpr, width / 2, height / 2);

  const focus = getFocusTag();
  const connected = getConnectedTags(focus);

  ctx.save();
  ctx.globalCompositeOperation = 'lighter';
  links.forEach((link) => {
    const active = isLinkActive(link, focus);
    const alpha = active ? 0.36 + link.weight * 0.1 : 0.045;
    const gradient = ctx.createLinearGradient(link.a.x, link.a.y, link.b.x, link.b.y);
    gradient.addColorStop(0, link.a.color);
    gradient.addColorStop(1, link.b.color);
    ctx.strokeStyle = gradient;
    ctx.globalAlpha = alpha;
    ctx.lineWidth = active ? 1.4 + link.weight * 0.55 : 0.8;
    ctx.beginPath();
    ctx.moveTo(link.a.x, link.a.y);
    const midX = (link.a.x + link.b.x) / 2;
    const midY = (link.a.y + link.b.y) / 2;
    ctx.quadraticCurveTo(midX * 1.03, midY * 1.03, link.b.x, link.b.y);
    ctx.stroke();
  });
  ctx.restore();

  nodes.forEach((node) => {
    const active = isNodeActive(node, connected);
    const selected = node.tag === focus;
    const glow = selected ? 34 : active ? 20 : 5;
    const alpha = active ? 1 : 0.22;
    const radius = node.r + Math.sin(node.pulse) * 1.2 + (selected ? 8 : 0);

    ctx.save();
    ctx.globalAlpha = alpha;
    ctx.shadowColor = node.color;
    ctx.shadowBlur = glow;
    ctx.fillStyle = node.color;
    ctx.beginPath();
    ctx.arc(node.x, node.y, radius, 0, Math.PI * 2);
    ctx.fill();

    ctx.shadowBlur = 0;
    ctx.fillStyle = selected ? '#fff' : 'rgba(255,255,255,.92)';
    ctx.font = `${selected ? 800 : 700} ${selected ? 15 : 13}px Inter, sans-serif`;
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText(node.tag, node.x, node.y - radius - 14);

    if (selected) {
      ctx.strokeStyle = 'rgba(255,255,255,.75)';
      ctx.lineWidth = 1.5;
      ctx.beginPath();
      ctx.arc(node.x, node.y, radius + 8, 0, Math.PI * 2);
      ctx.stroke();
    }
    ctx.restore();
  });

  applyPhysics();
  animationId = requestAnimationFrame(draw);
}

function canvasPoint(event) {
  const rect = canvas.getBoundingClientRect();
  const clientX = event.touches ? event.touches[0].clientX : event.clientX;
  const clientY = event.touches ? event.touches[0].clientY : event.clientY;
  return { x: clientX - rect.left - rect.width / 2, y: clientY - rect.top - rect.height / 2 };
}

function findNode(point) {
  return nodes.find((node) => Math.hypot(node.x - point.x, node.y - point.y) < node.r + 24) || null;
}

function notesForTag(tag) {
  if (!tag) return NOTES;
  return NOTES.filter((note) => note.tags.includes(tag));
}

function renderInfo(tag) {
  const focus = tag || state.selected;
  if (!focus) {
    infoTitle.textContent = 'Наведи на тег';
    infoText.textContent = 'Связанные точки подсветятся, остальные приглушатся. Здесь появится описание тега и связанные заметки.';
    infoMeta.textContent = '';
    relatedTags.textContent = '';
    return;
  }

  const related = [...getConnectedTags(focus)].filter((tagName) => tagName !== focus);
  const notes = notesForTag(focus);
  infoTitle.textContent = `#${focus}`;
  infoText.textContent = TAG_INFO[focus] || 'Пока это демо-тег. Позже сюда добавим реальное описание.';

  infoMeta.textContent = '';
  [[notes.length, 'заметок'], [related.length, 'связей']].forEach(([value, label]) => {
    const box = document.createElement('div');
    const strong = document.createElement('strong');
    const span = document.createElement('span');
    strong.textContent = value;
    span.textContent = label;
    box.append(strong, span);
    infoMeta.appendChild(box);
  });

  relatedTags.textContent = '';
  related.slice(0, 10).forEach((tagName) => {
    const chip = document.createElement('button');
    chip.type = 'button';
    chip.textContent = `#${tagName}`;
    chip.addEventListener('click', () => {
      state.selected = tagName;
      state.hovered = null;
      renderInfo(tagName);
      renderNotes();
    });
    relatedTags.appendChild(chip);
  });
}

function renderStats(items) {
  miniStats.textContent = '';
  const tagsCount = unique(NOTES.flatMap((note) => note.tags)).length;
  const values = [
    [NOTES.length, 'записей'],
    [tagsCount, 'тегов'],
    [links.length, 'связей'],
    [items.length, 'показано']
  ];
  values.forEach(([num, label]) => {
    const item = document.createElement('div');
    const strong = document.createElement('strong');
    const span = document.createElement('span');
    strong.textContent = num;
    span.textContent = label;
    item.append(strong, span);
    miniStats.appendChild(item);
  });
}

function renderNotes() {
  const focus = state.selected;
  const query = normalize(state.query);
  const items = NOTES.filter((note) => {
    const byTag = !focus || note.tags.includes(focus);
    const text = normalize([note.title, note.category, note.date, note.text, ...note.tags].join(' '));
    return byTag && (!query || text.includes(query));
  });

  renderStats(items);
  notesGrid.textContent = '';

  items.forEach((note) => {
    const card = document.createElement('article');
    card.className = 'note-card';

    const top = document.createElement('div');
    top.className = 'note-top';
    const category = document.createElement('span');
    category.textContent = note.category;
    const date = document.createElement('small');
    date.textContent = note.date;
    top.append(category, date);

    const title = document.createElement('h3');
    title.textContent = note.title;
    const text = document.createElement('p');
    text.textContent = note.text;

    const tags = document.createElement('div');
    tags.className = 'note-tags';
    note.tags.forEach((tag) => {
      const button = document.createElement('button');
      button.type = 'button';
      button.textContent = `#${tag}`;
      if (tag === focus) button.classList.add('active');
      button.addEventListener('click', () => {
        state.selected = tag;
        state.hovered = null;
        renderInfo(tag);
        renderNotes();
        window.scrollTo({ top: 0, behavior: 'smooth' });
      });
      tags.appendChild(button);
    });

    card.append(top, title, text, tags);
    notesGrid.appendChild(card);
  });
}

canvas.addEventListener('mousemove', (event) => {
  const point = canvasPoint(event);
  pointer.x = point.x;
  pointer.y = point.y;
  const node = findNode(point);
  state.hovered = node ? node.tag : null;
  renderInfo(state.hovered || state.selected);
  canvas.style.cursor = node ? 'pointer' : 'default';
});

canvas.addEventListener('mouseleave', () => {
  state.hovered = null;
  dragged = null;
  renderInfo(state.selected);
});

canvas.addEventListener('mousedown', (event) => {
  const node = findNode(canvasPoint(event));
  if (node) dragged = node;
});

window.addEventListener('mousemove', (event) => {
  if (!dragged) return;
  const point = canvasPoint(event);
  dragged.x = point.x;
  dragged.y = point.y;
  dragged.vx = 0;
  dragged.vy = 0;
});

window.addEventListener('mouseup', () => { dragged = null; });

canvas.addEventListener('click', (event) => {
  const node = findNode(canvasPoint(event));
  state.selected = node ? (state.selected === node.tag ? null : node.tag) : null;
  state.hovered = null;
  renderInfo(state.selected);
  renderNotes();
});

canvas.addEventListener('touchstart', (event) => {
  const node = findNode(canvasPoint(event));
  if (node) {
    event.preventDefault();
    state.selected = state.selected === node.tag ? null : node.tag;
    renderInfo(state.selected);
    renderNotes();
  }
}, { passive: false });

searchInput.addEventListener('input', (event) => {
  state.query = event.target.value;
  renderNotes();
});

resetButton.addEventListener('click', () => {
  state.selected = null;
  state.hovered = null;
  searchInput.value = '';
  state.query = '';
  renderInfo(null);
  renderNotes();
});

window.addEventListener('resize', resize);

buildGraph();
resize();
renderInfo(null);
renderNotes();
draw();
