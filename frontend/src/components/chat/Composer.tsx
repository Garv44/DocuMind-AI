import { useEffect, useRef, useState } from 'react';
import { FilePlus2, Send, Square } from 'lucide-react';

import { useAppStore } from '../../store/useAppStore';

export function Composer() {
  const [value, setValue] = useState('');
  const [docMode, setDocMode] = useState(false);
  const isStreaming = useAppStore((state) => state.isStreaming);
  const sendMessage = useAppStore((state) => state.sendMessage);
  const stopStreaming = useAppStore((state) => state.stopStreaming);
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  // Grow with the text, but let CSS own the single-line height when empty.
  useEffect(() => {
    const node = textareaRef.current;
    if (!node) return;
    if (!value) {
      node.style.height = '';
      return;
    }
    node.style.height = 'auto';
    node.style.height = `${Math.min(node.scrollHeight, 200)}px`;
  }, [value]);

  const submit = () => {
    const text = value.trim();
    if (!text || isStreaming) return;
    setValue('');
    void sendMessage(text, docMode);
    setDocMode(false);
  };

  return (
    <div className="composer">
      <div className="composer-row">
        <button
          type="button"
          className={`composer-mode${docMode ? ' is-active' : ''}`}
          title="Force the next answer to be a document"
          onClick={() => setDocMode((mode) => !mode)}
        >
          <FilePlus2 size={15} />
          {docMode ? 'Document mode on' : 'Create document'}
        </button>
        {docMode && <span className="composer-hint">The next message will be written straight into the editor.</span>}
      </div>

      <div className="composer-input">
        <textarea
          ref={textareaRef}
          value={value}
          rows={1}
          placeholder="Ask anything — or say “create a document about …”"
          onChange={(event) => setValue(event.target.value)}
          onKeyDown={(event) => {
            if (event.key === 'Enter' && !event.shiftKey) {
              event.preventDefault();
              submit();
            }
          }}
        />
        {isStreaming ? (
          <button type="button" className="send-btn is-stop" onClick={stopStreaming} aria-label="Stop">
            <Square size={16} />
          </button>
        ) : (
          <button
            type="button"
            className="send-btn"
            onClick={submit}
            disabled={!value.trim()}
            aria-label="Send message"
          >
            <Send size={16} />
          </button>
        )}
      </div>
      <p className="composer-foot">Enter to send · Shift + Enter for a new line</p>
    </div>
  );
}
