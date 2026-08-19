import { useCallback, useEffect, useRef, useState } from 'react';
import { AlertTriangle, PanelRightOpen, X } from 'lucide-react';

import { ChatPanel } from './components/chat/ChatPanel';
import { DocumentPanel } from './components/editor/DocumentPanel';
import { Sidebar } from './components/layout/Sidebar';
import { useAppStore } from './store/useAppStore';

export default function App() {
  const bootstrap = useAppStore((state) => state.bootstrap);
  const error = useAppStore((state) => state.error);
  const dismissError = useAppStore((state) => state.dismissError);
  const panelOpen = useAppStore((state) => state.panelOpen);
  const activeDocument = useAppStore((state) => state.activeDocument);
  const setPanelOpen = useAppStore((state) => state.setPanelOpen);

  const [chatWidth, setChatWidth] = useState(50);
  const workspaceRef = useRef<HTMLElement>(null);
  const dragging = useRef(false);

  useEffect(() => {
    void bootstrap();
  }, [bootstrap]);

  const onMouseMove = useCallback((event: MouseEvent) => {
    if (!dragging.current || !workspaceRef.current) return;
    const bounds = workspaceRef.current.getBoundingClientRect();
    const percent = ((event.clientX - bounds.left) / bounds.width) * 100;
    setChatWidth(Math.min(72, Math.max(24, percent)));
  }, []);

  useEffect(() => {
    const stop = () => {
      dragging.current = false;
      document.body.classList.remove('is-resizing');
    };
    window.addEventListener('mousemove', onMouseMove);
    window.addEventListener('mouseup', stop);
    return () => {
      window.removeEventListener('mousemove', onMouseMove);
      window.removeEventListener('mouseup', stop);
    };
  }, [onMouseMove]);

  return (
    <div className="app">
      <Sidebar />

      <main
        ref={workspaceRef}
        className={`workspace${panelOpen ? ' has-panel' : ''}`}
        style={panelOpen ? { gridTemplateColumns: `${chatWidth}% 8px 1fr` } : undefined}
      >
        <ChatPanel />

        {panelOpen && (
          <>
            <div
              className="splitter"
              role="separator"
              aria-orientation="vertical"
              aria-label="Resize panels"
              onMouseDown={() => {
                dragging.current = true;
                document.body.classList.add('is-resizing');
              }}
            />
            <DocumentPanel />
          </>
        )}
      </main>

      {!panelOpen && activeDocument && (
        <button type="button" className="reopen-panel" onClick={() => setPanelOpen(true)}>
          <PanelRightOpen size={15} /> {activeDocument.title}
        </button>
      )}

      {error && (
        <div className="toast" role="alert">
          <AlertTriangle size={16} />
          <span>{error}</span>
          <button type="button" onClick={dismissError} aria-label="Dismiss">
            <X size={14} />
          </button>
        </div>
      )}
    </div>
  );
}
