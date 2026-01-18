import { createContext, useContext, useEffect, useMemo, useState } from "react";

const ThemeContext = createContext({
  theme: "system",
  setTheme: () => {},
});

const applyTheme = (mode) => {
  document.documentElement.setAttribute("data-theme", mode);
};

export function ThemeProvider({ children }) {
  const [theme, setTheme] = useState(() => {
    const stored = localStorage.getItem("theme");
    return stored || "system";
  });

  useEffect(() => {
    localStorage.setItem("theme", theme);
  }, [theme]);

  useEffect(() => {
    if (theme !== "system") {
      applyTheme(theme);
      return undefined;
    }

    const mql = window.matchMedia ? window.matchMedia("(prefers-color-scheme: dark)") : null;
    const resolve = () => {
      const isDark = mql ? mql.matches : false;
      applyTheme(isDark ? "dark" : "light");
    };

    resolve();

    if (!mql) return undefined;
    if (mql.addEventListener) {
      mql.addEventListener("change", resolve);
      return () => mql.removeEventListener("change", resolve);
    }
    mql.addListener(resolve);
    return () => mql.removeListener(resolve);
  }, [theme]);

  const value = useMemo(() => ({ theme, setTheme }), [theme]);

  return <ThemeContext.Provider value={value}>{children}</ThemeContext.Provider>;
}

export function useTheme() {
  return useContext(ThemeContext);
}
