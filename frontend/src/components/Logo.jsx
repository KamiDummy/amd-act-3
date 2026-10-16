import { APP_NAME } from '../config'
import './Logo.css'

// The mark is a dark page with a coral "highlighted line", like a flagged clause.
function Logo({ as: Tag = 'div' }) {
  return (
    <Tag className="logo">
      <span className="logo-mark" aria-hidden="true" />
      {APP_NAME}
    </Tag>
  )
}

export default Logo
