import React, { forwardRef, useImperativeHandle, useState, useRef, useEffect, useCallback } from 'react';
import { AlertTriangle } from 'lucide-react';

/**
 * Imperative confirmation modal. Use via ref:
 *   const ok = await confirmRef.current.confirm({ title, message, confirmLabel, cancelLabel, variant });
 * Returns Promise<boolean> — true if confirmed, false on cancel/Esc/backdrop.
 */
const ConfirmModal = forwardRef((_props, ref) => {
  const [state, setState] = useState(null);
  const resolverRef = useRef(null);

  const close = useCallback((result) => {
    setState(null);
    if (resolverRef.current) {
      resolverRef.current(result);
      resolverRef.current = null;
    }
  }, []);

  useImperativeHandle(ref, () => ({
    confirm: (options = {}) => new Promise((resolve) => {
      // If a previous prompt is still open, resolve it as cancelled
      if (resolverRef.current) {
        resolverRef.current(false);
      }
      resolverRef.current = resolve;
      setState({
        title: options.title || 'Confirm',
        message: options.message || '',
        confirmLabel: options.confirmLabel || 'OK',
        cancelLabel: options.cancelLabel || 'Cancel',
        variant: options.variant || 'default',
      });
    }),
  }), []);

  useEffect(() => {
    if (!state) return;
    const onKey = (e) => {
      if (e.key === 'Escape') {
        e.preventDefault();
        close(false);
      } else if (e.key === 'Enter') {
        e.preventDefault();
        close(true);
      }
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [state, close]);

  if (!state) return null;

  const isDestructive = state.variant === 'destructive';

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/40"
      onClick={() => close(false)}
    >
      <div
        className="bg-white dark:bg-gray-800 rounded-lg shadow-xl max-w-md w-full mx-4 p-6 border border-gray-200 dark:border-gray-700"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-start gap-3 mb-4">
          {isDestructive && <AlertTriangle size={22} className="text-red-500 flex-shrink-0 mt-0.5" />}
          <h3 className="text-lg font-semibold text-gray-900 dark:text-gray-100">{state.title}</h3>
        </div>
        <p className="text-sm text-gray-700 dark:text-gray-300 mb-6 whitespace-pre-line">{state.message}</p>
        <div className="flex justify-end gap-2">
          <button
            type="button"
            onClick={() => close(false)}
            className="px-4 py-2 text-sm rounded border border-gray-300 hover:bg-gray-100 dark:border-gray-600 dark:hover:bg-gray-700 dark:text-gray-200"
          >
            {state.cancelLabel}
          </button>
          <button
            type="button"
            onClick={() => close(true)}
            autoFocus
            className={
              isDestructive
                ? 'px-4 py-2 text-sm rounded bg-red-600 text-white hover:bg-red-700'
                : 'px-4 py-2 text-sm rounded bg-blue-600 text-white hover:bg-blue-700'
            }
          >
            {state.confirmLabel}
          </button>
        </div>
      </div>
    </div>
  );
});

ConfirmModal.displayName = 'ConfirmModal';

export default ConfirmModal;
