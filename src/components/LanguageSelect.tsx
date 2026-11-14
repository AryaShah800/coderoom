"use client";

import { useId } from "react";
import { LANGUAGES, isLanguageKey, type LanguageKey } from "@/lib/languages";

interface LanguageSelectProps {
  value: LanguageKey;
  onChange: (language: LanguageKey) => void;
  disabled?: boolean;
}

export function LanguageSelect({ value, onChange, disabled }: LanguageSelectProps) {
  const id = useId();
  return (
    <div className="flex items-center gap-2">
      <label htmlFor={id} className="text-xs font-medium text-muted">
        Language
      </label>
      <select
        id={id}
        value={value}
        disabled={disabled}
        onChange={(e) => {
          if (isLanguageKey(e.target.value)) onChange(e.target.value);
        }}
        className="h-8 rounded-md border border-line-strong bg-panel-2 px-2 text-sm text-fg disabled:opacity-60"
      >
        {LANGUAGES.map((language) => (
          <option key={language.key} value={language.key}>
            {language.label}
          </option>
        ))}
      </select>
    </div>
  );
}
