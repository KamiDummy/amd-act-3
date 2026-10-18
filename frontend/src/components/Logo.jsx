import { APP_NAME } from '../config'
import './Logo.css'

// The mark from docs/logo/notalawyer-mark.svg: a page whose last line is highlighted,
// like a flagged clause. Inline, so its colours follow the theme (Logo.css). size is
// its width in pixels.
export function LogoMark({ size = 22 }) {
  return (
    <svg className="logo-mark" width={size} height={size} viewBox="0 0 512 512" aria-hidden="true">
      <rect className="logo-page" width="512" height="512" rx="116" />
      <rect className="logo-line" x="112" y="124" width="288" height="40" rx="20" />
      <rect className="logo-line" x="112" y="220" width="208" height="40" rx="20" />
      <rect className="logo-highlight" x="84" y="284" width="344" height="104" rx="24" />
      <rect className="logo-flagged" x="112" y="316" width="288" height="40" rx="20" />
    </svg>
  )
}

// compact shows only the mark, for the collapsed menu.
function Logo({ as: Tag = 'div', compact = false }) {
  return (
    <Tag className="logo" title={compact ? APP_NAME : undefined}>
      <LogoMark />
      {compact ? <span className="visually-hidden">{APP_NAME}</span> : APP_NAME}
    </Tag>
  )
}

export default Logo
