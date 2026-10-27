type BrandMarkProps = { className?: string; width?: number; height?: number };

export function BrandMark({ className, width = 240, height = 48 }: BrandMarkProps) {
  return <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 240 48" role="img" aria-label="OfficePulse" width={width} height={width / 5} className={className ?? 'h-8 w-auto select-none'}>
    <rect x="1" y="1" width="46" height="46" rx="13" fill="#ff9d63" />
    <path d="M9 25h8l4-12 7 23 4-11h8" fill="none" stroke="#101010" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round" />
    <text x="59" y="32" fill="white" fontFamily="Inter,system-ui,sans-serif" fontWeight="700" fontSize="25" letterSpacing="-1">OfficePulse</text>
  </svg>;
}
export default BrandMark;