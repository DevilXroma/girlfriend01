const state = { category: 'все', tag: null, query: '' };

const stats = document.querySelector('#stats');
const search = document.querySelector('#search');
const filters = document.querySelector('#filters');
const cloud = document.querySelector('#cloud');
const cards = document.querySelector('#cards');
const reset = document.querySelector('#reset');

function norm(value) {
  return String(value || '').toLowerCase().trim();
}

function getCategories() {
  return ['все', ...new Set(NOTES.map((item) => item.category))];
}

function getTags() {
  const result = new Map();
  NOTES.forEach((item) => {
    item.tags.forEach((tag) => result.set(tag, (result.get(tag) || 0) + 1));
  });
  return [...result.entries()].sort((a, b) => b[1] - a[1]);
}

function checkItem(item) {
  const searchable = norm([item.title, item.category, item.date, item.text, ...item.tags].join(' '));
  const categoryOk = state.category === 'все' || item.category === state.category;
  const tagOk = !state.tag || item.tags.includes(state.tag);
  const queryOk = !state.query || searchable.includes(norm(state.query));
  return categoryOk && tagOk && queryOk;
}

function makeButton(label, active, onClick) {
  const button = document.createElement('button');
  button.textContent = label;
  if (active) button.classList.add('active');
  button.addEventListener('click', onClick);
  return button;
}

function renderStats(items) {
  stats.textContent = '';
  const values = [
    [NOTES.length, 'карточек'],
    [new Set(NOTES.flatMap((item) => item.tags)).size, 'тегов'],
    [items.length, 'найдено']
  ];
  values.forEach(([number, label]) => {
    const box = document.createElement('div');
    const strong = document.createElement('b');
    const span = document.createElement('span');
    strong.textContent = number;
    span.textContent = label;
    box.append(strong, span);
    stats.appendChild(box);
  });
}

function renderFilters() {
  filters.textContent = '';
  getCategories().forEach((category) => {
    const icon = CATEGORY_ICONS[category] || '•';
    filters.appendChild(makeButton(`${icon} ${category}`, state.category === category, () => {
      state.category = category;
      render();
    }));
  });
}

function renderCloud() {
  cloud.textContent = '';
  getTags().forEach(([tag, count], index) => {
    const button = makeButton(`#${tag}`, state.tag === tag, () => {
      state.tag = state.tag === tag ? null : tag;
      render();
    });
    button.style.setProperty('--size', Math.min(2, 0.95 + count * 0.16 + (index % 4) * 0.08));
    cloud.appendChild(button);
  });
}

function renderCards(items) {
  cards.textContent = '';
  if (!items.length) {
    const empty = document.createElement('div');
    empty.className = 'glass empty';
    empty.textContent = 'Ничего не найдено. Попробуй другой поиск или сбрось фильтры.';
    cards.appendChild(empty);
    return;
  }

  items.forEach((item, index) => {
    const card = document.createElement('article');
    card.className = 'card glass';
    card.style.setProperty('--delay', `${index * 40}ms`);

    const top = document.createElement('div');
    top.className = 'card-top';
    const category = document.createElement('span');
    category.textContent = `${CATEGORY_ICONS[item.category] || '•'} ${item.category}`;
    const date = document.createElement('small');
    date.textContent = item.date;
    top.append(category, date);

    const title = document.createElement('h3');
    title.textContent = item.title;
    const text = document.createElement('p');
    text.textContent = item.text;

    const tags = document.createElement('div');
    tags.className = 'card-tags';
    item.tags.forEach((tag) => {
      tags.appendChild(makeButton(`#${tag}`, state.tag === tag, () => {
        state.tag = tag;
        render();
        window.scrollTo({ top: 0, behavior: 'smooth' });
      }));
    });

    card.append(top, title, text, tags);
    cards.appendChild(card);
  });
}

function render() {
  const items = NOTES.filter(checkItem);
  renderStats(items);
  renderFilters();
  renderCloud();
  renderCards(items);
}

search.addEventListener('input', (event) => {
  state.query = event.target.value;
  render();
});

reset.addEventListener('click', () => {
  state.category = 'все';
  state.tag = null;
  state.query = '';
  search.value = '';
  render();
});

render();
