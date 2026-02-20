"use client";

import { useEffect, useRef, useState } from "react";

interface Props {
  value: number;
  format?: (v: number) => string;
  className?: string;
}

export function FlashNumber({
  value,
  format = (v) => v.toString(),
  className = "",
}: Props) {
  const prevRef = useRef(value);
  const [flashClass, setFlashClass] = useState("");

  useEffect(() => {
    if (value === prevRef.current) return;
    const cls = value > prevRef.current ? "flash-up" : "flash-down";
    setFlashClass(cls);
    prevRef.current = value;
    const t = setTimeout(() => setFlashClass(""), 800);
    return () => clearTimeout(t);
  }, [value]);

  return (
    <span
      className={`${className} ${flashClass} rounded px-0.5 transition-colors`}
    >
      {format(value)}
    </span>
  );
}
