import type { SVGProps } from 'react'

type IconProps = SVGProps<SVGSVGElement> & { size?: number }

function Stroke({ size = 24, children, ...props }: IconProps) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2}
      strokeLinecap="round" strokeLinejoin="round" aria-hidden="true" {...props}>
      {children}
    </svg>
  )
}

export function ShoeMark({ size = 22 }: { size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="currentColor" aria-hidden="true">
      <path d="M2 17c0-3.6.8-8 1.8-10h4.8c0 1.8 1 3.4 2.8 4.1l5.6 2c1.8.6 5 1.9 5 3.8V19H2z" />
    </svg>
  )
}

export const ListIcon = (p: IconProps) => <Stroke {...p}><path d="M4 7h16M4 12h16M4 17h16" /></Stroke>
export const PlusIcon = (p: IconProps) => <Stroke {...p}><path d="M12 5v14M5 12h14" /></Stroke>
export const ScanIcon = (p: IconProps) => (
  <Stroke {...p}><path d="M4 8V5h3M17 5h3v3M20 16v3h-3M7 19H4v-3M8 9v6M11 9v6M14 9v6M17 9v6" /></Stroke>
)
export const TagIcon = (p: IconProps) => (
  <Stroke {...p}><path d="M20.6 13.4 13.4 20.6a2 2 0 0 1-2.8 0L3 13V3h10l7.6 7.6a2 2 0 0 1 0 2.8z" /><circle cx="8" cy="8" r="1.5" /></Stroke>
)
export const ChartIcon = (p: IconProps) => <Stroke {...p}><path d="M5 20V11M12 20V4M19 20v-6" /></Stroke>
export const LogoutIcon = (p: IconProps) => (
  <Stroke {...p}><path d="M15 4h3a2 2 0 0 1 2 2v12a2 2 0 0 1-2 2h-3M10 17l5-5-5-5M15 12H3" /></Stroke>
)
export const FilterIcon = (p: IconProps) => <Stroke {...p}><path d="M4 6h16M7 12h10M10 18h4" /></Stroke>
export const BackIcon = (p: IconProps) => <Stroke {...p}><path d="m15 18-6-6 6-6" /></Stroke>
export const CloseIcon = (p: IconProps) => <Stroke {...p}><path d="M6 6l12 12M18 6 6 18" /></Stroke>
export const CameraIcon = (p: IconProps) => (
  <Stroke {...p}><path d="M4 8h3l2-3h6l2 3h3v11H4z" /><circle cx="12" cy="13" r="3.5" /></Stroke>
)
