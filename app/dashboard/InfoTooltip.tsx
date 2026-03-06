"use client";

import { Info } from "lucide-react";
import { useRef, useState } from "react";
import { createPortal } from "react-dom";

type Props = {
  children: React.ReactNode;
  side?: "center" | "right";
};

export function InfoTooltip({ children, side = "center" }: Props) {
  const [visible, setVisible] = useState(false);
  const [coords, setCoords] = useState({ top: 0, left: 0 });
  const triggerRef = useRef<HTMLSpanElement>(null);

  function show() {
    if (!triggerRef.current) return;
    const rect = triggerRef.current.getBoundingClientRect();
    setCoords({
      top: rect.top,
      left: side === "right" ? rect.right : rect.left + rect.width / 2,
    });
    setVisible(true);
  }

  const tooltip =
    visible && typeof document !== "undefined"
      ? createPortal(
          <div
            style={{
              position: "fixed",
              top: coords.top,
              left: coords.left,
              transform:
                side === "right"
                  ? "translate(-100%, calc(-100% - 10px))"
                  : "translate(-50%, calc(-100% - 10px))",
              zIndex: 9999,
            }}
            className="pointer-events-none w-72 rounded-md bg-slate-900 p-3 text-xs leading-relaxed text-slate-100 shadow-xl"
          >
            {children}
            <span
              className={`absolute top-full border-4 border-transparent border-t-slate-900 ${
                side === "right" ? "right-3" : "left-1/2 -translate-x-1/2"
              }`}
            />
          </div>,
          document.body,
        )
      : null;

  return (
    <>
      <span
        ref={triggerRef}
        className="inline-flex cursor-help align-middle"
        onMouseEnter={show}
        onMouseLeave={() => setVisible(false)}
      >
        <Info size={13} className="text-slate-400 transition-colors hover:text-slate-600" />
      </span>
      {tooltip}
    </>
  );
}
