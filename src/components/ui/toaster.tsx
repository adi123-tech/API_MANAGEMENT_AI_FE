'use client';

import { useEffect, useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { CheckCircle, XCircle, X } from 'lucide-react';
import { type Toast } from '@/hooks/use-toast';

let globalToasts: Toast[] = [];
let listeners: Array<(t: Toast[]) => void> = [];

export const addToast = (t: Omit<Toast, 'id'>) => {
  const id = Math.random().toString(36).slice(2);
  globalToasts = [{ ...t, id }, ...globalToasts].slice(0, 5);
  listeners.forEach((l) => l([...globalToasts]));
  setTimeout(() => {
    globalToasts = globalToasts.filter((x) => x.id !== id);
    listeners.forEach((l) => l([...globalToasts]));
  }, 4000);
};

// Override the hook's toast to use this
if (typeof window !== 'undefined') {
  (window as unknown as Record<string, unknown>).__addToast = addToast;
}

export function Toaster() {
  const [toasts, setToasts] = useState<Toast[]>([]);

  useEffect(() => {
    const listener = (t: Toast[]) => setToasts(t);
    listeners.push(listener);
    return () => { listeners = listeners.filter((l) => l !== listener); };
  }, []);

  const dismiss = (id: string) => {
    globalToasts = globalToasts.filter((t) => t.id !== id);
    listeners.forEach((l) => l([...globalToasts]));
  };

  return (
    <div className="fixed bottom-4 right-4 z-50 flex flex-col gap-2 pointer-events-none">
      <AnimatePresence>
        {toasts.map((t) => (
          <motion.div
            key={t.id}
            initial={{ opacity: 0, y: 20, scale: 0.95 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, scale: 0.95 }}
            className="pointer-events-auto flex items-start gap-3 bg-card border border-border rounded-xl p-4 shadow-xl min-w-72 max-w-sm"
          >
            {t.variant === 'destructive'
              ? <XCircle className="w-4 h-4 text-red-400 flex-shrink-0 mt-0.5" />
              : <CheckCircle className="w-4 h-4 text-emerald-400 flex-shrink-0 mt-0.5" />
            }
            <div className="flex-1">
              <p className="text-sm font-medium">{t.title}</p>
              {t.description && <p className="text-xs text-muted-foreground mt-0.5">{t.description}</p>}
            </div>
            <button onClick={() => t.id && dismiss(t.id)} className="text-muted-foreground hover:text-foreground">
              <X className="w-3.5 h-3.5" />
            </button>
          </motion.div>
        ))}
      </AnimatePresence>
    </div>
  );
}
