import React, { useEffect, useState, type ComponentType } from 'react';
import { createPortal } from 'react-dom';
import { STierBWorkbench } from './STierBWorkbench';

interface Props {
  toolId: string;
  Base: ComponentType<{ initialText?: string }>;
  initialText?: string;
}

export const STierBRouteWrapper: React.FC<Props> = ({ toolId, Base, initialText }) => {
  const [target, setTarget] = useState<HTMLElement | null>(null);

  useEffect(() => {
    let cancelled = false;
    let observer: MutationObserver | null = null;

    const findTarget = () => {
      if (cancelled) return true;
      const shell = document.querySelector<HTMLElement>(`[data-tool-id="${CSS.escape(toolId)}"]`);
      const next = shell?.querySelector<HTMLElement>('.tt-tool-content') ?? null;
      if (!next) return false;
      setTarget(next);
      return true;
    };

    if (!findTarget()) {
      observer = new MutationObserver(() => {
        if (findTarget()) observer?.disconnect();
      });
      observer.observe(document.body, { childList: true, subtree: true });
    }

    return () => {
      cancelled = true;
      observer?.disconnect();
      setTarget(null);
    };
  }, [toolId]);

  return <>
    <Base initialText={initialText} />
    {target ? createPortal(<STierBWorkbench toolId={toolId} />, target) : null}
  </>;
};
