export function formatNumber(value: number | null | undefined, maximumFractionDigits = 2): string {
  if (typeof value !== "number" || !Number.isFinite(value)) return "0";
  return new Intl.NumberFormat(undefined, {
    maximumFractionDigits,
    minimumFractionDigits: 0,
  }).format(value);
}

export function formatWatts(value: number | null | undefined): string {
  return `${formatNumber(value)}W`;
}

export function formatKwh(value: number | null | undefined): string {
  return `${formatNumber(value)} kWh`;
}

export function formatHours(value: number | null | undefined): string {
  return formatNumber(value);
}
