import * as React from "react";

type Theme = "dark" | "light" | "system";

interface ThemeProviderProps {
  children: React.ReactNode;
  defaultTheme?: Theme;
  storageKey?: string;
}

interface ThemeProviderState {
  theme: Theme;
  setTheme: (theme: Theme) => void;
}

const initialState: ThemeProviderState = {
  theme: "system",
  setTheme: () => null,
};

const ThemeProviderContext = React.createContext<ThemeProviderState>(initialState);

export const ThemeProvider = ({
  children,
  defaultTheme = "system",
  storageKey = "vite-ui-theme",
  ...props
}: ThemeProviderProps) => {
  // Initialize theme from localStorage synchronously to avoid flash
  const [theme, setTheme] = React.useState<Theme>(() => {
    if (typeof window !== "undefined") {
      const savedTheme = localStorage.getItem(storageKey) as Theme | null;
      if (savedTheme) return savedTheme;
    }
    return defaultTheme;
  });

  React.useEffect(() => {
    const root = window.document.documentElement;

    const applyTheme = (resolved: "light" | "dark") => {
      // Disable all transitions during theme switch so everything flips instantly
      const style = document.createElement("style");
      style.textContent = "*, *::before, *::after { transition: none !important; }";
      document.head.appendChild(style);

      root.classList.remove("light", "dark");
      root.classList.add(resolved);
      root.style.colorScheme = resolved;

      // Force a reflow so the browser applies all new styles without transitions
      void root.offsetHeight;

      // Re-enable transitions on the next frame
      requestAnimationFrame(() => {
        if (style.parentNode) document.head.removeChild(style);
      });
    };

    const resolve = () =>
      theme === "system"
        ? window.matchMedia("(prefers-color-scheme: dark)").matches
          ? "dark"
          : "light"
        : theme;

    applyTheme(resolve());

    // Listen for OS theme changes when in "system" mode
    if (theme === "system") {
      const mediaQuery = window.matchMedia("(prefers-color-scheme: dark)");
      const handleChange = () => applyTheme(resolve());
      mediaQuery.addEventListener("change", handleChange);
      return () => mediaQuery.removeEventListener("change", handleChange);
    }
  }, [theme]);

  const handleSetTheme = React.useCallback(
    (newTheme: Theme) => {
      if (typeof window !== "undefined") {
        localStorage.setItem(storageKey, newTheme);
      }
      setTheme(newTheme);
    },
    [storageKey],
  );

  const value = React.useMemo(() => ({ theme, setTheme: handleSetTheme }), [theme, handleSetTheme]);

  return (
    <ThemeProviderContext.Provider {...props} value={value}>
      {children}
    </ThemeProviderContext.Provider>
  );
};

export const useTheme = () => {
  const context = React.use(ThemeProviderContext);

  if (context === undefined) throw new Error("useTheme must be used within a ThemeProvider");

  return context;
};

// External store over `prefers-color-scheme` so useResolvedTheme re-renders on OS
// theme changes (in "system" mode the `theme` value never changes, so reading
// matchMedia at render-time alone would go stale until a reload).
const subscribeSystemTheme = (onChange: () => void) => {
  if (typeof window === "undefined") return () => {};
  const mq = window.matchMedia("(prefers-color-scheme: dark)");
  mq.addEventListener("change", onChange);
  return () => mq.removeEventListener("change", onChange);
};
const getSystemThemeSnapshot = (): "dark" | "light" =>
  typeof window !== "undefined" && window.matchMedia("(prefers-color-scheme: dark)").matches
    ? "dark"
    : "light";
const getSystemThemeServerSnapshot = (): "dark" | "light" => "light";

/** Resolves "system" to the actual "dark" | "light" preference, reactively. */
export const useResolvedTheme = (): "dark" | "light" => {
  const { theme } = useTheme();
  const systemTheme = React.useSyncExternalStore(
    subscribeSystemTheme,
    getSystemThemeSnapshot,
    getSystemThemeServerSnapshot,
  );
  return theme === "system" ? systemTheme : theme;
};
