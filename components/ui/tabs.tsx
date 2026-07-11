"use client";

import { cn } from "@/lib/utils";
import * as React from "react";

/**
 * Tabs acessível — segmented control sem dependência extra (padrão do Select nativo).
 * Implementa roles ARIA (tablist/tab/tabpanel), roving tabindex e navegação por setas.
 */

type TabsContextValue = {
  value: string;
  setValue: (v: string) => void;
  idBase: string;
};

const TabsContext = React.createContext<TabsContextValue | null>(null);

function useTabs() {
  const ctx = React.useContext(TabsContext);
  if (!ctx) throw new Error("Os componentes de Tabs devem estar dentro de <Tabs>.");
  return ctx;
}

type TabsProps = {
  defaultValue?: string;
  value?: string;
  onValueChange?: (v: string) => void;
} & Omit<React.ComponentProps<"div">, "onChange">;

function Tabs({ defaultValue, value: valueProp, onValueChange, className, children, ...props }: TabsProps) {
  const [internal, setInternal] = React.useState(defaultValue ?? "");
  const value = valueProp ?? internal;
  const idBase = React.useId();

  const setValue = React.useCallback(
    (v: string) => {
      if (valueProp === undefined) setInternal(v);
      onValueChange?.(v);
    },
    [valueProp, onValueChange],
  );

  const ctx = React.useMemo(() => ({ value, setValue, idBase }), [value, setValue, idBase]);

  return (
    <TabsContext.Provider value={ctx}>
      <div className={cn("flex flex-col gap-6", className)} {...props}>
        {children}
      </div>
    </TabsContext.Provider>
  );
}

const TabsList = React.forwardRef<HTMLDivElement, React.ComponentProps<"div">>(
  ({ className, ...props }, ref) => (
    <div
      ref={ref}
      role="tablist"
      className={cn(
        "inline-flex w-full items-center gap-1 rounded-lg border border-border bg-muted p-1 sm:w-fit",
        className,
      )}
      {...props}
    />
  ),
);
TabsList.displayName = "TabsList";

const TabsTrigger = React.forwardRef<
  HTMLButtonElement,
  React.ComponentProps<"button"> & { value: string }
>(({ className, value, onKeyDown, ...props }, ref) => {
  const { value: active, setValue, idBase } = useTabs();
  const selected = active === value;

  function handleKeyDown(e: React.KeyboardEvent<HTMLButtonElement>) {
    onKeyDown?.(e);
    if (!["ArrowRight", "ArrowLeft", "Home", "End"].includes(e.key)) return;

    const list = e.currentTarget.closest('[role="tablist"]');
    if (!list) return;
    const tabs = Array.from(
      list.querySelectorAll<HTMLButtonElement>('[role="tab"]:not(:disabled)'),
    );
    const idx = tabs.indexOf(e.currentTarget);
    if (idx === -1) return;

    e.preventDefault();
    const next =
      e.key === "ArrowRight"
        ? (idx + 1) % tabs.length
        : e.key === "ArrowLeft"
          ? (idx - 1 + tabs.length) % tabs.length
          : e.key === "Home"
            ? 0
            : tabs.length - 1;
    const target = tabs[next];
    target?.focus();
    target?.click();
  }

  return (
    <button
      ref={ref}
      type="button"
      role="tab"
      id={`${idBase}-trigger-${value}`}
      aria-selected={selected}
      aria-controls={`${idBase}-content-${value}`}
      tabIndex={selected ? 0 : -1}
      onClick={() => setValue(value)}
      onKeyDown={handleKeyDown}
      className={cn(
        "inline-flex flex-1 items-center justify-center gap-2 whitespace-nowrap rounded-md px-3 py-2 text-sm font-medium transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-background sm:flex-initial",
        selected
          ? "bg-background text-foreground shadow-sm"
          : "text-muted-foreground hover:text-foreground",
        className,
      )}
      {...props}
    />
  );
});
TabsTrigger.displayName = "TabsTrigger";

const TabsContent = React.forwardRef<
  HTMLDivElement,
  React.ComponentProps<"div"> & { value: string }
>(({ className, value, ...props }, ref) => {
  const { value: active, idBase } = useTabs();
  if (active !== value) return null;
  return (
    <div
      ref={ref}
      role="tabpanel"
      id={`${idBase}-content-${value}`}
      aria-labelledby={`${idBase}-trigger-${value}`}
      tabIndex={0}
      className={cn("focus-visible:outline-none", className)}
      {...props}
    />
  );
});
TabsContent.displayName = "TabsContent";

export { Tabs, TabsList, TabsTrigger, TabsContent };
