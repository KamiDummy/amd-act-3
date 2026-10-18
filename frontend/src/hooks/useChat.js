import { useEffect, useRef, useState } from 'react'
import { askChat } from '../api/analysis'
import { documentKey } from '../utils/documentData'
import { loadJSON, saveJSON } from '../utils/storage'

const chatKey = (documentId) => documentKey('chat', documentId)

function appendSaved(documentId, message) {
  saveJSON(chatKey(documentId), [...(loadJSON(chatKey(documentId)) ?? []), message])
}

// What the backend sees of a message. An attached passage is folded into the question,
// so later questions can still refer to it.
function toHistory(message) {
  const content = message.selection
    ? `About this passage: "${message.selection.text}"\n\n${message.content}`
    : message.content
  return { role: message.role, content }
}

// The document's chat, saved on this device. Messages, oldest first:
//   { id, role: 'user', content, selection: { text, pageNumber } | null, createdAt }
//   { id, role: 'assistant', content, references, citations, mentions, actions, replyTo, createdAt }
// mentions are the keys of the user's items the answer is about; actions are the changes
// the chat made to them (see askChat). pending: the question waiting for an answer,
// { id, status: 'loading' | 'error', error }.
// getItems() returns the user's items to send with each question (see askChat).
// onAnswer(answer) is called when an answer arrives while the workspace is open, to
// apply its actions. Remount for another document.
export function useChat(documentId, { getItems, onAnswer }) {
  const mounted = useRef(true)
  const callbacks = useRef({ getItems, onAnswer })
  const [messages, setMessages] = useState(() => loadJSON(chatKey(documentId)) ?? [])
  const [pending, setPending] = useState(null)

  useEffect(() => {
    callbacks.current = { getItems, onAnswer }
  })

  useEffect(() => {
    mounted.current = true
    return () => {
      mounted.current = false
    }
  }, [])

  async function request(question, history) {
    setPending({ id: question.id, status: 'loading' })
    try {
      const response = await askChat(
        documentId,
        question.content,
        history,
        question.selection,
        callbacks.current.getItems(),
      )
      const answer = {
        id: crypto.randomUUID(),
        role: 'assistant',
        content: response.answer,
        references: response.references,
        citations: response.citations,
        mentions: response.mentions ?? [],
        actions: response.actions ?? [],
        replyTo: question.id,
        createdAt: new Date().toISOString(),
      }
      // Saved even if the user has opened another document meanwhile.
      appendSaved(documentId, answer)
      if (!mounted.current) return
      setMessages((current) => [...current, answer])
      setPending(null)
      callbacks.current.onAnswer?.(answer)
    } catch (err) {
      if (mounted.current && err.status !== 401) {
        setPending({ id: question.id, status: 'error', error: { message: err.message, status: err.status } })
      }
    }
  }

  function send(content, selection) {
    // A question that failed is replaced by the new one, so every question in the
    // history has its answer.
    const failedId = pending?.status === 'error' ? pending.id : null
    const earlier = messages.filter((m) => m.id !== failedId)
    if (failedId) saveJSON(chatKey(documentId), earlier)
    const question = {
      id: crypto.randomUUID(),
      role: 'user',
      content,
      selection: selection ? { text: selection.text, pageNumber: selection.pageNumber } : null,
      createdAt: new Date().toISOString(),
    }
    appendSaved(documentId, question)
    setMessages([...earlier, question])
    request(question, earlier.map(toHistory))
  }

  function retry() {
    const index = messages.findIndex((m) => m.id === pending?.id)
    if (index === -1) return
    request(messages[index], messages.slice(0, index).map(toHistory))
  }

  // Deletes a question and its answer.
  function remove(questionId) {
    const keep = (m) => m.id !== questionId && m.replyTo !== questionId
    setMessages((current) => current.filter(keep))
    saveJSON(chatKey(documentId), (loadJSON(chatKey(documentId)) ?? []).filter(keep))
    if (pending?.id === questionId) setPending(null)
  }

  function clear() {
    setMessages([])
    setPending(null)
    saveJSON(chatKey(documentId), [])
  }

  return { messages, pending, send, retry, remove, clear }
}
