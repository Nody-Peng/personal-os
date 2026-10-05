import { BRAND_GOLD, BRAND_NAVY, logoParts } from './mark'

/** The app mark as an inline tile. Decorative unless given a label. */
export function Logo({ size = 28, className, label }: { size?: number; className?: string; label?: string }) {
  const p = logoParts({ bold: size < 40 })
  return (
    <svg
      viewBox="0 0 512 512"
      width={size}
      height={size}
      className={className}
      role={label ? 'img' : undefined}
      aria-label={label}
      aria-hidden={label ? undefined : true}
    >
      <rect width="512" height="512" rx="112" fill={BRAND_NAVY} />
      <g transform={p.transform}>
        <circle cx={p.sun.cx} cy={p.sun.cy} r={p.sun.r} fill={BRAND_GOLD} />
        {p.pages.map((d) => (
          <path key={d} d={d} fill={BRAND_GOLD} stroke={BRAND_NAVY} strokeWidth={p.gap} strokeLinejoin="round" />
        ))}
      </g>
    </svg>
  )
}
