import { useEffect, useRef } from 'react';
import { Bot } from 'lucide-react';

import { renderMarkdown } from '../../lib/markdown';
import { useAppStore } from '../../store/useAppStore';
import { Composer } from './Composer';
import { MessageItem } from './MessageItem';

const SUGGESTIONS = [
  'Explain how vector databases work',
  'Create a document about renewable energy in India',
  'Create a spreadsheet comparing AWS, Azure and GCP pricing',
  'Create a presentation from our chat history',
];

export function ChatPanel() {
  const messages = useAppStore((state) => state.messages);
  const streamingReply = useAppStore((state) => state.streamingReply);
  const isStreaming = useAppStore((state) => state.isStreaming);
  const docStreaming = useAppStore((state) => state.docStreaming);
  const sendMessage = useAppStore((state) => state.sendMessage);
  const bottomRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth', block: 'end' });
  }, [messages.length, streamingReply]);

  const empty = messages.length === 0 && !isStreaming;

  return (
    <section className="chat-panel">
      <div className="chat-scroll">
        {empty ? (
          <div className="chat-empty">
            <div className="chat-empty-badge"><Bot size={22} /></div>
            <h1>What are we working on?</h1>
            <p>
              Ask questions like a normal chat. When you want the answer as a file, say
              <strong> “create a document …”</strong> and it opens in an editor on the right —
              ready to format and export as Word, Excel, PowerPoint or Markdown.
            </p>
            <div className="suggestions">
              {SUGGESTIONS.map((suggestion) => (
                <button key={suggestion} type="button" onClick={() => void sendMessage(suggestion)}>
                  {suggestion}
                </button>
              ))}
            </div>
          </div>
        ) : (
          <div className="messages">
            {messages.map((message) => (
              <MessageItem key={message.id} message={message} />
            ))}

            {isStreaming && (streamingReply || !docStreaming) && (
              <article className="msg msg-assistant">
                <div className="msg-avatar"><Bot size={15} /></div>
                <div className="msg-body">
                  {streamingReply ? (
                    <div
                      className="msg-text markdown"
                      dangerouslySetInnerHTML={{ __html: renderMarkdown(streamingReply) }}
                    />
                  ) : (
                    <span className="typing"><i /><i /><i /></span>
                  )}
                </div>
              </article>
            )}

            {docStreaming && (
              <article className="msg msg-assistant">
                <div className="msg-avatar"><Bot size={15} /></div>
                <div className="msg-body">
                  <p className="msg-text muted">Writing the document in the editor…</p>
                </div>
              </article>
            )}
            <div ref={bottomRef} />
          </div>
        )}
      </div>
      <Composer />
    </section>
  );
}
