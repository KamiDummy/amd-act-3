import { useEffect, useRef, useState } from 'react'
import { MAX_QUESTION_CHARS } from '../api/analysis'
import CitationList from './CitationList'
import './ChatPanel.css'
import './Pens.css'

const SUGGESTIONS = [
  'What are the biggest risks for me?',
  'Can they end this contract early?',
  'List my highlights and what they mean',
]

// **bold** inside a line, as React elements (never as HTML).
function inline(text) {
  return text.split(/(\*\*[^*]+\*\*)/g).map((part, i) =>
    part.startsWith('**') && part.endsWith('**') ? <strong key={i}>{part.slice(2, -2)}</strong> : part,
  )
}

// The model writes plain paragraphs, sometimes with "- " lists and **bold**.
function AnswerText({ text }) {
  const blocks = text.trim().split(/\n\s*\n/)
  return blocks.map((block, i) => {
    const lines = block.split('\n').filter((line) => line.trim())
    const bullet = /^\s*(?:[-*•]|\d+[.)])\s+/
    if (lines.length > 0 && lines.every((line) => bullet.test(line))) {
      return (
        <ul key={i}>
          {lines.map((line, j) => (
            <li key={j}>{inline(line.replace(bullet, ''))}</li>
          ))}
        </ul>
      )
    }
    return <p key={i}>{inline(block.trim())}</p>
  })
}

// One of the user's items, shown in an answer that mentions or changed it.
function ItemChip({ item, prefix, onShowItem }) {
  return (
    <button
      type="button"
      className={`chat-item pen-${item.color}`}
      onClick={() => onShowItem(item.key)}
      title={item.text}
    >
      {prefix && <span className="chat-item-prefix">{prefix}</span>}
      <span className="chat-item-name">{item.name}</span>
      {item.located && <span className="chat-item-page">p. {item.pageNumber}</span>}
    </button>
  )
}

const ACTION_PREFIX = { create_highlight: 'Created', update_item: 'Updated' }

function Answer({ message, items, onShowReference, onSaveReference, savedQuotes, onShowItem }) {
  const [showLaw, setShowLaw] = useState(false)
  const { references = [], citations = [], mentions = [], actions = [] } = message
  const byKey = new Map(items.map((item) => [item.key, item]))
  // The items the answer changed, then the others it is about.
  const changed = actions
    .map((action) => ({
      action,
      item:
        action.type === 'update_item'
          ? byKey.get(action.id)
          : items.find((i) => i.source === 'mine' && i.text === action.quote),
    }))
    .filter(({ item }) => item)
  const changedKeys = new Set(changed.map(({ item }) => item.key))
  const mentioned = mentions.map((key) => byKey.get(key)).filter((item) => item && !changedKeys.has(item.key))

  return (
    <div className="chat-msg is-assistant">
      <div className="chat-text">
        <AnswerText text={message.content} />
      </div>
      {(changed.length > 0 || mentioned.length > 0) && (
        <div className="chat-items">
          {changed.map(({ action, item }, i) => (
            <ItemChip
              key={`a${i}`}
              item={item}
              prefix={ACTION_PREFIX[action.type]}
              onShowItem={onShowItem}
            />
          ))}
          {mentioned.map((item) => (
            <ItemChip key={item.key} item={item} onShowItem={onShowItem} />
          ))}
        </div>
      )}
      {(references.length > 0 || citations.length > 0) && (
        <div className="chat-sources">
          {references.map((ref, i) => {
            const saved = savedQuotes.has(ref.quote)
            return (
              <span key={i} className="chat-ref-group">
                <button
                  type="button"
                  className="chat-ref"
                  onClick={() => onShowReference(ref)}
                  title={`“${ref.quote}”`}
                >
                  <span className="chat-ref-page">p. {ref.page_number}</span>
                  <span className="chat-ref-quote">{ref.quote}</span>
                </button>
                <button
                  type="button"
                  className="chat-ref-save"
                  onClick={() => onSaveReference(ref)}
                  disabled={saved}
                  aria-label={saved ? 'Saved as a highlight' : 'Save as a highlight'}
                  title={saved ? 'Saved as a highlight' : 'Save as a highlight'}
                >
                  {saved ? '✓' : '+'}
                </button>
              </span>
            )
          })}
          {citations.length > 0 && (
            <button
              type="button"
              className="chat-ref chat-law-toggle"
              onClick={() => setShowLaw((v) => !v)}
              aria-expanded={showLaw}
            >
              {citations.length} {citations.length === 1 ? 'law' : 'laws'} {showLaw ? '▴' : '▾'}
            </button>
          )}
        </div>
      )}
      {showLaw && (
        <div className="chat-law">
          <CitationList citations={citations} hideEmpty />
        </div>
      )}
    </div>
  )
}

// The Chat tab: questions and answers about the document and the user's items. Answers
// link to the passages they rely on (onShowReference scrolls the PDF there; the + saves
// one as a highlight) and show the items they mention or changed (onShowItem shows one).
// items: the workspace's items, to show those by key. savedQuotes: the texts of the
// user's highlights, so a saved reference shows as saved. attachment is a passage the
// user sent here from the page or the Review list, asked about with the next question.
// focusSignal: change it to focus the question box.
function ChatPanel({
  chat,
  items,
  savedQuotes,
  attachment,
  onClearAttachment,
  onShowReference,
  onSaveReference,
  onShowItem,
  focusSignal,
}) {
  const [draft, setDraft] = useState('')
  const inputRef = useRef(null)
  const endRef = useRef(null)
  const { messages, pending } = chat
  const busy = pending?.status === 'loading'

  useEffect(() => {
    endRef.current?.scrollIntoView({ block: 'end' })
  }, [messages.length, pending?.status])

  useEffect(() => {
    if (focusSignal) inputRef.current?.focus()
  }, [focusSignal])

  function send(text) {
    const question = text.trim()
    if (!question || busy || question.length > MAX_QUESTION_CHARS) return
    chat.send(question, attachment)
    setDraft('')
    onClearAttachment()
  }

  function handleKeyDown(event) {
    if (event.key === 'Enter' && !event.shiftKey) {
      event.preventDefault()
      send(draft)
    }
  }

  function handleClear() {
    if (window.confirm('Delete this whole conversation?')) chat.clear()
  }

  const answers = new Map(messages.filter((m) => m.role === 'assistant').map((m) => [m.replyTo, m]))
  const questions = messages.filter((m) => m.role === 'user')
  const tooLong = draft.length > MAX_QUESTION_CHARS

  return (
    <div className="chat">
      {questions.length > 0 && (
        <div className="chat-head">
          <button type="button" className="rv-link" onClick={handleClear}>
            Clear chat
          </button>
        </div>
      )}

      <div className="chat-log">
        {questions.length === 0 && !pending && (
          <div className="chat-empty">
            <p>Ask anything about this document.</p>
            <div className="chat-suggestions">
              {SUGGESTIONS.map((s) => (
                <button key={s} type="button" className="chat-suggestion" onClick={() => send(s)}>
                  {s}
                </button>
              ))}
            </div>
          </div>
        )}

        {questions.map((question) => {
          const answer = answers.get(question.id)
          const isPending = pending?.id === question.id
          return (
            <div key={question.id} className="chat-turn">
              <div className="chat-msg is-user">
                {question.selection && (
                  <blockquote className="chat-attached rv-clamp">“{question.selection.text}”</blockquote>
                )}
                <p>{question.content}</p>
                <button
                  type="button"
                  className="chat-delete"
                  onClick={() => chat.remove(question.id)}
                  aria-label="Delete this question and its answer"
                  title="Delete"
                >
                  ×
                </button>
              </div>
              {answer && (
                <Answer
                  message={answer}
                  items={items}
                  onShowReference={onShowReference}
                  onSaveReference={onSaveReference}
                  savedQuotes={savedQuotes}
                  onShowItem={onShowItem}
                />
              )}
              {isPending && pending.status === 'loading' && (
                <div className="chat-msg is-assistant" aria-busy="true">
                  <span className="chat-typing" aria-label="Answering">
                    <span />
                    <span />
                    <span />
                  </span>
                </div>
              )}
              {isPending && pending.status === 'error' && (
                <div className="chat-msg is-assistant rv-error-text" role="alert">
                  <p>{pending.error.message}</p>
                  {pending.error.status !== 503 && pending.error.status !== 422 && (
                    <button type="button" className="secondary small" onClick={chat.retry}>
                      Try again
                    </button>
                  )}
                </div>
              )}
            </div>
          )
        })}
        <div ref={endRef} />
      </div>

      <form
        className="chat-compose"
        onSubmit={(event) => {
          event.preventDefault()
          send(draft)
        }}
      >
        {attachment && (
          <div className="chat-attachment">
            <span className="chat-attachment-text rv-clamp">
              <b>p. {attachment.pageNumber}</b> “{attachment.text}”
            </span>
            <button
              type="button"
              className="chat-delete"
              onClick={onClearAttachment}
              aria-label="Remove the attached passage"
              title="Remove"
            >
              ×
            </button>
          </div>
        )}
        <div className="chat-input-row">
          <textarea
            ref={inputRef}
            value={draft}
            onChange={(event) => setDraft(event.target.value)}
            onKeyDown={handleKeyDown}
            placeholder={attachment ? 'Ask about this passage…' : 'Ask about this document…'}
            aria-label="Question"
            rows={2}
          />
          <button type="submit" disabled={!draft.trim() || busy || tooLong}>
            Send
          </button>
        </div>
        {tooLong && (
          <p className="chat-limit" role="alert">
            Keep it under {MAX_QUESTION_CHARS.toLocaleString()} characters.
          </p>
        )}
      </form>
    </div>
  )
}

export default ChatPanel
