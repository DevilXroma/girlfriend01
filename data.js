const DEFAULT_SECTIONS = [
  { id: 'family', title: 'Родные', description: 'Люди, имена, связи и короткие комментарии.', color: '#ff72c8', icon: '♥' },
  { id: 'gifts', title: 'Подарки', description: 'Идеи предметов, сюрпризов и впечатлений.', color: '#ffd56c', icon: '✦' },
  { id: 'trips', title: 'Поездки', description: 'Локации, гестхаусы, маршруты и планы.', color: '#66ffd2', icon: '⌁' },
  { id: 'places', title: 'Места', description: 'Кафе, районы, прогулки и красивые точки.', color: '#7ad7ff', icon: '⌖' },
  { id: 'dates', title: 'Даты', description: 'События, праздники и важные дни.', color: '#a77dff', icon: '○' },
  { id: 'important', title: 'Важное', description: 'Привычки, границы, предпочтения и детали.', color: '#ff8f70', icon: '!' }
];

const DEFAULT_ITEMS = [
  { id: 'family-mom', sectionId: 'family', title: 'Мама', comment: 'Пример записи о человеке: кто это, как зовут, что важно помнить.', tags: ['родные', 'человек'] },
  { id: 'gift-flowers', sectionId: 'gifts', title: 'Цветы', comment: 'Пример идеи подарка. Тут позже можно записать любимые цветы и что лучше не брать.', tags: ['подарок', 'милота'] },
  { id: 'gift-impression', sectionId: 'gifts', title: 'Впечатление', comment: 'Пример подарка не вещью: вечер, выезд, прогулка или маленький сюрприз.', tags: ['подарок', 'эмоция'] },
  { id: 'trip-dilijan', sectionId: 'trips', title: 'Дилижан', comment: 'Пример точки для поездки: локация, гестхаус, маршрут, заметки.', tags: ['поездка', 'горы'] },
  { id: 'trip-mountains', sectionId: 'trips', title: 'Горы', comment: 'Пример настроения: домик, красивый вид, тишина, воздух.', tags: ['поездка', 'уют', 'вид'] },
  { id: 'place-cafe', sectionId: 'places', title: 'Уютное кафе', comment: 'Пример места, куда можно вернуться.', tags: ['место', 'уют'] },
  { id: 'date-event', sectionId: 'dates', title: 'Важная дата', comment: 'Пример события, которое нужно не забыть.', tags: ['дата', 'память'] },
  { id: 'important-note', sectionId: 'important', title: 'Не забыть', comment: 'Пример важной заметки: привычка, граница или предпочтение.', tags: ['важное', 'забота'] }
];
