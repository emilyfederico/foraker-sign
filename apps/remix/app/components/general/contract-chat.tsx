import { useEffect, useRef, useState } from 'react';

type Choice = { label: string; value: string };

type ChatMessage = {
  role: 'user' | 'assistant';
  text: string;
  url?: string;
  // Tap-to-answer options for a question (e.g. financing type, yes/no). Sending
  // a choice posts its `value` as the agent's reply.
  choices?: Choice[];
};

const GREETING: ChatMessage = {
  role: 'assistant',
  text: 'Hi! Tell me what contract to create — e.g. "Make a PA contract for 123 Memorial Drive, buyer Ronald Johnson". I\'ll set it up so you can fill it in and text it to the buyer.',
};

export function ContractChat() {
  const [open, setOpen] = useState(false);
  const [messages, setMessages] = useState<ChatMessage[]>([GREETING]);
  const [input, setInput] = useState('');
  const [sending, setSending] = useState(false);
  // Text handed in from the /home hero box, queued to auto-send once the panel
  // is open (see the effect below).
  const [pending, setPending] = useState<string | null>(null);
  const scrollRef = useRef<HTMLDivElement>(null);

  // Let other parts of the app (e.g. the /home chat box) open this panel by
  // dispatching a window event, optionally seeding the first message.
  useEffect(() => {
    const openChat = (e: Event) => {
      setOpen(true);
      const text = (e as CustomEvent<{ text?: string }>).detail?.text;
      if (typeof text === 'string' && text.trim()) setPending(text.trim());
    };
    window.addEventListener('foraker:open-contract-chat', openChat);
    return () => window.removeEventListener('foraker:open-contract-chat', openChat);
  }, []);

  function scrollToBottom() {
    requestAnimationFrame(() => {
      scrollRef.current?.scrollTo({ top: scrollRef.current.scrollHeight, behavior: 'smooth' });
    });
  }

  // `override` is set when the agent taps an answer choice instead of typing.
  async function send(override?: string) {
    const text = (override ?? input).trim();
    if (!text || sending) return;

    setMessages((prev) => [...prev, { role: 'user', text }]);
    if (override === undefined) setInput('');
    setSending(true);
    scrollToBottom();

    try {
      // Send the prior turns so the assistant remembers earlier answers and
      // doesn't re-ask for details already given.
      const history = messages
        .filter((m) => m.text)
        .map((m) => ({ role: m.role, content: m.text }));
      const res = await fetch('/api/chat-contract', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ message: text, history }),
      });
      const data = (await res.json()) as { reply?: string; url?: string; choices?: Choice[] };
      setMessages((prev) => [
        ...prev,
        {
          role: 'assistant',
          text: data.reply ?? 'Sorry, something went wrong.',
          url: data.url,
          choices: data.choices,
        },
      ]);
    } catch {
      setMessages((prev) => [
        ...prev,
        { role: 'assistant', text: 'Network error — please try again.' },
      ]);
    } finally {
      setSending(false);
      scrollToBottom();
    }
  }

  // Send the message seeded from the /home hero box once the panel is open.
  // Intentionally keyed on `pending` only — `send` reads the latest state via
  // closure on each render, and re-firing on `send`/`sending` would risk loops.
  useEffect(() => {
    if (pending && !sending) {
      void send(pending);
      setPending(null);
    }
  }, [pending]);

  function handleKeyDown(e: React.KeyboardEvent<HTMLInputElement>) {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      void send();
    }
  }

  return (
    <>
      {/* Floating toggle button */}
      <button
        onClick={() => setOpen((o) => !o)}
        className="fixed bottom-6 right-6 z-50 flex h-14 w-14 items-center justify-center rounded-full bg-[#262626] text-white shadow-lg transition-transform hover:scale-105"
        aria-label="Open Foraker Assistant"
      >
        {open ? (
          <span className="text-2xl leading-none">&times;</span>
        ) : (
          <svg className="h-6 w-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              strokeWidth={1.8}
              d="M8 10h8M8 14h5m-9 6l3.5-2H18a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12z"
            />
          </svg>
        )}
      </button>

      {/* Chat panel */}
      {open && (
        <div className="fixed bottom-24 right-6 z-50 flex h-[28rem] w-[22rem] flex-col overflow-hidden rounded-2xl border border-gray-200 bg-white shadow-2xl">
          <div className="bg-[#262626] px-4 py-3">
            <p className="text-sm font-semibold text-white">Foraker Assistant</p>
            <p className="text-xs text-green-100">Describe the contract you need</p>
          </div>

          <div ref={scrollRef} className="flex-1 space-y-3 overflow-y-auto px-4 py-3">
            {messages.map((m, i) => (
              <div
                key={i}
                className={`flex ${m.role === 'user' ? 'justify-end' : 'justify-start'}`}
              >
                <div
                  className={`max-w-[85%] rounded-2xl px-3 py-2 text-sm ${
                    m.role === 'user' ? 'bg-[#262626] text-white' : 'bg-gray-100 text-gray-800'
                  }`}
                >
                  {m.text}
                  {m.url && (
                    <a
                      href={m.url}
                      target="_blank"
                      rel="noreferrer"
                      className="mt-2 block rounded-lg bg-white px-3 py-1.5 text-center text-xs font-semibold text-[#262626] hover:bg-green-50"
                    >
                      Open &amp; fill contract →
                    </a>
                  )}
                  {/* Tap-to-answer choices — only on the latest message so old
                      questions don't keep stale buttons. */}
                  {m.choices && i === messages.length - 1 && (
                    <div className="mt-2 flex flex-wrap gap-1.5">
                      {m.choices.map((c) => (
                        <button
                          key={c.value}
                          onClick={() => void send(c.value)}
                          disabled={sending}
                          className="rounded-full border border-[#262626] bg-white px-3 py-1 text-xs font-semibold text-[#262626] transition-colors hover:bg-[#262626] hover:text-white disabled:opacity-50"
                        >
                          {c.label}
                        </button>
                      ))}
                    </div>
                  )}
                </div>
              </div>
            ))}
            {sending && (
              <div className="flex justify-start">
                <div className="rounded-2xl bg-gray-100 px-3 py-2 text-sm text-gray-400">
                  Working on it…
                </div>
              </div>
            )}
          </div>

          <div className="border-t border-gray-100 p-3">
            <div className="flex items-center gap-2">
              <input
                type="text"
                value={input}
                onChange={(e) => setInput(e.target.value)}
                onKeyDown={handleKeyDown}
                placeholder="Make a PA contract for…"
                className="flex-1 rounded-lg border border-gray-200 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-[#262626]"
              />
              <button
                onClick={() => void send()}
                disabled={sending || !input.trim()}
                className="rounded-lg bg-[#262626] px-3 py-2 text-sm font-semibold text-white transition-colors hover:bg-[#3d3d3d] disabled:cursor-not-allowed disabled:opacity-50"
              >
                Send
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  );
}
