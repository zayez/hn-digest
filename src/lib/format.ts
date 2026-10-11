const dateFormat = new Intl.DateTimeFormat('en', {
  year: 'numeric',
  month: 'short',
  day: 'numeric',
  timeZone: 'UTC',
});

export const formatDate = (date: Date) => dateFormat.format(date);

export const isoDate = (date: Date) => date.toISOString().slice(0, 10);

export const formatCount = (n: number, one: string, many = `${one}s`) =>
  `${n.toLocaleString('en')} ${n === 1 ? one : many}`;
