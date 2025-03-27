export function formatHertz(freq: number, decimals = 2) {
  if (freq === 0) return 'MHz';

  const k = 1000;
  const dm = decimals < 0 ? 0 : decimals;
  const sizes = ['Hz', 'KHz', 'MHz', 'GHz'];

  const i = Math.floor(Math.log(freq) / Math.log(k));

  return parseFloat((freq / Math.pow(k, i)).toFixed(dm)) + ' ' + sizes[i];
}
