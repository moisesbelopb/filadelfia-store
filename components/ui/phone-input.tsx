"use client";

import { Input } from "@/components/ui/input";
import { maskPhone } from "@/lib/utils";
import * as React from "react";

/**
 * Campo de telefone com máscara automática: (DD) XXXXX-XXXX.
 *
 * Reescreve o valor no próprio evento (antes de repassar o onChange), então
 * funciona tanto em formulários não-controlados (FormData) quanto com o
 * react-hook-form. Como a máscara descarta tudo que não é dígito, é impossível
 * digitar letras.
 */
export const PhoneInput = React.forwardRef<HTMLInputElement, React.ComponentProps<typeof Input>>(
  ({ onChange, ...props }, ref) => {
    function handleChange(e: React.ChangeEvent<HTMLInputElement>) {
      e.target.value = maskPhone(e.target.value);
      onChange?.(e);
    }

    return (
      <Input
        ref={ref}
        type="tel"
        inputMode="numeric"
        autoComplete="tel"
        maxLength={15}
        placeholder="(83) 99999-9999"
        {...props}
        onChange={handleChange}
      />
    );
  },
);
PhoneInput.displayName = "PhoneInput";
