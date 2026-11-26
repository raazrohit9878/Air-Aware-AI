import React, { useEffect, useRef, useState } from 'react';
import { ArrowRight, Bot, MessageCircle, Send, Sparkles, X } from 'lucide-react';

const CHAT_SUGGESTIONS = [
  'Is it okay to exercise outside today?',
  'How can I improve indoor air without buying equipment?',
  'What should I keep in mind for my child’s school commute?',
];

/**
 * Floating AirAware chat assistant with keyboard Escape handling and focus restoration.
 */
export default function ChatAssistant({ accessToken, context }) {
  const [open, setOpen] = useState(false);
  const [draft, setDraft] = useState('');
  const [sending, setSending] = useState(false);
  const [messages, setMessages] = useState([
    {
      role: 'assistant',
      content:
        'Hi! I can help you make sense of today’s air estimate, plan outdoor activity, improve indoor air, or find a commute option that fits. What would you like help with?',
      mode: 'guide',
    },
  ]);
  const [chatError, setChatError] = useState('');
  const bottomRef = useRef(null);
  const inputRef = useRef(null);
  const launcherRef = useRef(null);
  const wasOpen = useRef(false);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth', block: 'end' });
  }, [messages, open]);

  useEffect(() => {
    if (open) {
      wasOpen.current = true;
      inputRef.current?.focus();
      const onKeyDown = (event) => {
        if (event.key === 'Escape') setOpen(false);
      };
      window.addEventListener('keydown', onKeyDown);
      return () => window.removeEventListener('keydown', onKeyDown);
    }
    if (wasOpen.current) {
      wasOpen.current = false;
      launcherRef.current?.focus();
    }
    return undefined;
  }, [open]);

  async function sendMessage(question = draft) {
    const text = question.trim();
    if (!text || sending) return;
    setDraft('');
    setChatError('');
    setSending(true);
    setMessages((prev) => [...prev, { role: 'user', content: text }]);
    try {
      const response = await fetch('/api/ai/chat', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          ...(accessToken ? { Authorization: `Bearer ${accessToken}` } : {}),
        },
        body: JSON.stringify({
          question: text,
          history: messages.slice(-6).map(({ role, content }) => ({ role, content })),
          context,
        }),
      });
      const result = await response.json();
      if (!response.ok) throw new Error(result.error || 'The assistant could not reply. Please try again.');
      setMessages((items) => [
        ...items,
        { role: 'assistant', content: result.answer, mode: result.mode, notice: result.notice },
      ]);
    } catch (err) {
      setChatError(err.message || 'Could not reach the chat service. Please try again.');
    } finally {
      setSending(false);
    }
  }

  return (
    <div className="air-chat-widget">
      {open && (
        <section className="air-chat-panel" role="dialog" aria-label="AirAware chat assistant">
          <header className="air-chat-header">
            <div className="air-chat-avatar" aria-hidden="true">
              <Bot size={19} />
            </div>
            <div>
              <strong>Ask AirAware</strong>
              <span>Practical help for your air and routine</span>
            </div>
            <button type="button" onClick={() => setOpen(false)} aria-label="Close chat">
              <X size={18} aria-hidden="true" />
            </button>
          </header>
          <div className="air-chat-data">
            <span className="chat-live-dot" aria-hidden="true" /> Context: {context.city || 'location not set'} ·{' '}
            {context.aqi == null ? 'air estimate unavailable' : `US AQI model estimate ${Math.round(Number(context.aqi))}`}
          </div>
          <div className="air-chat-messages" aria-live="polite">
            {messages.map((message, index) => (
              <article key={`${index}-${message.role}`} className={`chat-message ${message.role}`}>
                {message.role === 'assistant' && (
                  <span className="chat-message-icon" aria-hidden="true">
                    <Sparkles size={13} />
                  </span>
                )}
                <div>
                  <p>{message.content}</p>
                  {message.role === 'assistant' && (
                    <small>
                      {message.mode === 'nim' ? 'NVIDIA AI · contextual answer' : 'Reviewed AirAware guidance'}
                      {message.notice ? ` · ${message.notice}` : ''}
                    </small>
                  )}
                </div>
              </article>
            ))}
            {messages.length === 1 && (
              <div className="chat-suggestions">
                {CHAT_SUGGESTIONS.map((text) => (
                  <button key={text} type="button" disabled={sending} onClick={() => sendMessage(text)}>
                    {text}
                    <ArrowRight size={13} aria-hidden="true" />
                  </button>
                ))}
              </div>
            )}
            {sending && (
              <div className="chat-typing" role="status">
                <span aria-hidden="true" />
                <span aria-hidden="true" />
                <span aria-hidden="true" /> AirAware is thinking…
              </div>
            )}
            {chatError && (
              <div className="chat-error" role="alert">
                {chatError}
              </div>
            )}
            <div ref={bottomRef} />
          </div>
          <form
            className="air-chat-compose"
            onSubmit={(event) => {
              event.preventDefault();
              sendMessage();
            }}
          >
            <input
              ref={inputRef}
              value={draft}
              onChange={(event) => setDraft(event.target.value)}
              placeholder="Ask about today’s air…"
              aria-label="Your question"
              maxLength={1000}
              disabled={sending}
            />
            <button type="submit" disabled={sending || !draft.trim()} aria-label="Send message">
              <Send size={17} aria-hidden="true" />
            </button>
          </form>
          <p className="air-chat-privacy">
            General guidance, not medical advice. If AI is enabled, your message and limited air/profile context are
            sent to NVIDIA. Don’t include names or private medical details.
          </p>
        </section>
      )}
      <button
        ref={launcherRef}
        className={`air-chat-launcher ${open ? 'is-open' : ''}`}
        type="button"
        onClick={() => setOpen((value) => !value)}
        aria-expanded={open}
        aria-label={open ? 'Close AirAware assistant' : 'Open AirAware assistant'}
      >
        {open ? <X size={19} aria-hidden="true" /> : <MessageCircle size={19} aria-hidden="true" />}
        <span>{open ? 'Close' : 'Ask AirAware'}</span>
      </button>
    </div>
  );
}
