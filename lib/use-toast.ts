"use client";

import { create } from "zustand";

export type ToastVariant = "default" | "success" | "error";

export interface ToastItem {
  id: string;
  title?: string;
  description?: string;
  variant: ToastVariant;
}

interface ToastState {
  toasts: ToastItem[];
  add: (t: Omit<ToastItem, "id" | "variant"> & { variant?: ToastVariant }) => void;
  remove: (id: string) => void;
}

let counter = 0;

export const useToastStore = create<ToastState>((set) => ({
  toasts: [],
  add: ({ variant = "default", ...rest }) => {
    counter += 1;
    const id = `toast-${counter}`;
    set((s) => ({ toasts: [...s.toasts, { id, variant, ...rest }] }));
    setTimeout(() => {
      set((s) => ({ toasts: s.toasts.filter((t) => t.id !== id) }));
    }, 4500);
  },
  remove: (id) => set((s) => ({ toasts: s.toasts.filter((t) => t.id !== id) })),
}));

/** Dispara um toast de qualquer Client Component. */
export function toast(input: {
  title?: string;
  description?: string;
  variant?: ToastVariant;
}) {
  useToastStore.getState().add(input);
}
