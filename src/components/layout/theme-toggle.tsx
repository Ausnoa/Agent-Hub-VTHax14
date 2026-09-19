"use client";

import { useLayoutEffect, useState } from "react";
import { Moon, Sun } from "lucide-react";
import { themeStorageKey } from "../../lib/theme";

type Theme = "dark" | "light";

export default function ThemeToggle() {
  // Starts as dark to match the server render. Before paint, re-apply the saved theme: in development
  // React's Strict Mode remount resets <html> attributes, clearing what the head script set.
  const [theme, setTheme] = useState<Theme>("dark");
  useLayoutEffect(() => {
    let saved: string | null = null;
    try { saved = localStorage.getItem(themeStorageKey); } catch { /* best-effort only */ }
    if (saved === "light") { document.documentElement.dataset.theme = "light"; setTheme("light"); }
  }, []);

  function toggle() {
    const next: Theme = theme === "dark" ? "light" : "dark";
    if (next === "light") document.documentElement.dataset.theme = "light";
    else delete document.documentElement.dataset.theme;
    try { localStorage.setItem(themeStorageKey, next); } catch { /* best-effort only */ }
    setTheme(next);
  }

  const label = theme === "dark" ? "Switch to light mode" : "Switch to dark mode";
  return <button type="button" className="theme-toggle" onClick={toggle} aria-label={label} title={label}>
    {theme === "dark" ? <Sun size={15} /> : <Moon size={15} />}
  </button>;
}
