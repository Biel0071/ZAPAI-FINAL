export function formatCount(value: number | undefined) {
  return new Intl.NumberFormat('pt-BR').format(Number(value) || 0);
}

export function formatPercent(value: number | undefined) {
  return `${Number(value || 0).toFixed(1)}%`;
}

export function formatDurationSeconds(value: number | undefined) {
  const totalSeconds = Math.max(0, Number(value) || 0);

  if (totalSeconds < 60) {
    return `${totalSeconds.toFixed(0)}s`;
  }

  const minutes = Math.floor(totalSeconds / 60);
  const seconds = Math.floor(totalSeconds % 60);

  return `${minutes}m ${seconds}s`;
}
