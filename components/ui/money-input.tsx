"use client";

import { useMemo, useState } from "react";

type MoneyInputProps = {
  name?: string;
  value: string;
  onValueChange: (value: string) => void;
  required?: boolean;
  disabled?: boolean;
  placeholder?: string;
  className?: string;
};

const moneyFormatter = new Intl.NumberFormat("en-US", {
  minimumFractionDigits: 2,
  maximumFractionDigits: 2,
});

export function MoneyInput({
  name,
  value,
  onValueChange,
  required,
  disabled,
  placeholder,
  className,
}: MoneyInputProps) {
  const [focused, setFocused] = useState(false);

  const displayValue = useMemo(() => {
    if (focused) return value;
    const n = Number(value);
    if (!Number.isFinite(n)) return value;
    if (value === "") return "";
    return moneyFormatter.format(n);
  }, [focused, value]);

  return (
    <input
      type="text"
      name={name}
      required={required}
      disabled={disabled}
      placeholder={placeholder}
      className={className}
      inputMode="decimal"
      value={displayValue}
      onFocus={() => setFocused(true)}
      onBlur={() => {
        setFocused(false);
        if (!value) return;
        const n = Number(value);
        if (Number.isFinite(n)) onValueChange(n.toFixed(2));
      }}
      onChange={(e) => {
        const normalized = normalizeMoneyText(e.target.value);
        if (normalized == null) return;
        onValueChange(normalized);
      }}
    />
  );
}

function normalizeMoneyText(text: string) {
  const raw = text.replace(/,/g, "").replace(/[^\d.-]/g, "");
  if (raw === "") return "";
  if (!/^-?\d*\.?\d{0,2}$/.test(raw)) return null;
  const n = Number(raw);
  if (!Number.isFinite(n)) return null;
  return raw;
}
