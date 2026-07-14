"use client";

import { Input } from "@/components/ui/input";
import { titleCaseName } from "@/lib/utils";
import * as React from "react";

/**
 * Campo de nome próprio: coloca automaticamente a primeira letra de cada
 * palavra em maiúscula ("moises da silva belo" → "Moises Da Silva Belo").
 *
 * Como o title-case preserva o comprimento do texto, conseguimos devolver o
 * cursor para a mesma posição — dá pra editar no meio do nome sem o cursor
 * pular para o fim.
 */
export const NameInput = React.forwardRef<HTMLInputElement, React.ComponentProps<typeof Input>>(
  ({ onChange, ...props }, ref) => {
    function handleChange(e: React.ChangeEvent<HTMLInputElement>) {
      const caret = e.target.selectionStart;
      e.target.value = titleCaseName(e.target.value);
      if (caret !== null) e.target.setSelectionRange(caret, caret);
      onChange?.(e);
    }

    return (
      <Input
        ref={ref}
        type="text"
        autoComplete="name"
        autoCapitalize="words"
        {...props}
        onChange={handleChange}
      />
    );
  },
);
NameInput.displayName = "NameInput";
