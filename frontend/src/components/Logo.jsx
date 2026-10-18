import { APP_NAME } from '../config'
import './Logo.css'

// The mark is a dark page with a coral "highlighted line", like a flagged clause.
// compact shows only the mark, for the collapsed menu.
function Logo({ as: Tag = 'div', compact = false }) {
  return (
    <Tag className="logo" title={compact ? APP_NAME : undefined}>
      <span className="logo-mark" aria-hidden="true" />
      {compact ? <span className="visually-hidden">{APP_NAME}</span> : APP_NAME}
    </Tag>
  )
}

export default Logo
