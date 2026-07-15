export function formatBytes(bytes) {
  if (bytes == null || Number.isNaN(bytes)) return '—';
  const units = ['B', 'KB', 'MB', 'GB', 'TB'];
  let value = bytes;
  let unitIndex = 0;
  while (value >= 1024 && unitIndex < units.length - 1) {
    value /= 1024;
    unitIndex += 1;
  }
  return `${value.toFixed(unitIndex === 0 ? 0 : 1)} ${units[unitIndex]}`;
}

export function formatThroughput(bytesPerSec) {
  return `${formatBytes(bytesPerSec)}/s`;
}

export function formatPercent(value) {
  if (value == null || Number.isNaN(value)) return '—';
  return `%${value.toFixed(0)}`;
}

export function formatTime(timestamp) {
  const d = new Date(timestamp);
  return d.toLocaleTimeString('tr-TR', { hour: '2-digit', minute: '2-digit', second: '2-digit' });
}
