import { PEN_COLORS, PEN_STYLES } from '../utils/pens'
import './Pens.css'

// Picks how a passage is marked on the page: its colour and style.
// onChange({ color }) or onChange({ style }).
function PenPicker({ color, style, onChange }) {
  return (
    <div className="pen-picker">
      <div className="pen-row" role="radiogroup" aria-label="Colour">
        {PEN_COLORS.map((pen) => (
          <button
            key={pen.id}
            type="button"
            role="radio"
            aria-checked={pen.id === color}
            className={`pen-swatch pen-${pen.id}`}
            onClick={() => onChange({ color: pen.id })}
            aria-label={pen.label}
            title={pen.label}
          />
        ))}
      </div>
      <div className={`pen-row pen-${color}`} role="radiogroup" aria-label="Style">
        {PEN_STYLES.map((s) => (
          <button
            key={s.id}
            type="button"
            role="radio"
            aria-checked={s.id === style}
            className="pen-style"
            onClick={() => onChange({ style: s.id })}
            title={s.label}
          >
            <span className={`pen-style-sample pen-style-${s.id}`} aria-hidden="true">
              Ab
            </span>
            <span className="visually-hidden">{s.label}</span>
          </button>
        ))}
      </div>
    </div>
  )
}

export default PenPicker
