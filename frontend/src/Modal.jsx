import React, { useEffect, useRef } from "react";
import { X } from "lucide-react";

export default function Modal({ title, onClose, children, busy = false }) {
  const panel = useRef(null);
  const close = useRef(onClose);
  close.current = onClose;
  useEffect(() => {
    const previous = document.activeElement;
    const overflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    const focusable = () => [
      ...panel.current.querySelectorAll(
        'button:not(:disabled), input:not(:disabled), select:not(:disabled), [tabindex="0"]',
      ),
    ];
    (focusable()[0] || panel.current).focus();
    const handleKey = (event) => {
      if (event.key === "Escape") close.current();
      if (event.key === "Tab") {
        const elements = focusable();
        const first = elements[0];
        const last = elements.at(-1);
        if (!first) {
          event.preventDefault();
          panel.current.focus();
        } else if (
          event.shiftKey &&
          (document.activeElement === first ||
            document.activeElement === panel.current)
        ) {
          event.preventDefault();
          last.focus();
        } else if (
          !event.shiftKey &&
          (document.activeElement === last ||
            !panel.current.contains(document.activeElement))
        ) {
          event.preventDefault();
          first.focus();
        }
      }
    };
    document.addEventListener("keydown", handleKey);
    return () => {
      document.body.style.overflow = overflow;
      document.removeEventListener("keydown", handleKey);
      previous?.focus();
    };
  }, []);
  return (
    <div
      className="fixed inset-0 z-50 bg-black/75 backdrop-blur-sm flex items-center justify-center p-4"
      onClick={(e) => {
        if (e.target === e.currentTarget) onClose();
      }}
    >
      <section
        ref={panel}
        role="dialog"
        aria-modal="true"
        aria-label={title}
        aria-busy={busy}
        tabIndex={-1}
        className="w-full max-w-2xl max-h-[90dvh] overflow-y-auto rounded-2xl border border-slate-700 bg-dark-900 shadow-2xl p-5 sm:p-7"
      >
        <div className="flex items-center justify-between gap-4 mb-5">
          <h2 className="text-xl font-bold">{title}</h2>
          <button
            aria-label={`Close ${title}`}
            onClick={onClose}
            disabled={busy}
            className="btn-secondary p-2"
          >
            <X size={18} />
          </button>
        </div>
        {children}
      </section>
    </div>
  );
}
