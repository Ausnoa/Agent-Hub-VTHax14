"use client";

import { useEffect, useState } from "react";
import { Moon, Sun } from "lucide-react";
import { themeStorageKey } from "../../lib/theme";

type Theme = "dark" | "light";

export default function ThemeToggle() {
  // Starts as dark on the server; the effect reads what the head script already applied.
  const [theme, setTheme] = useState<Theme>("dark");
  useEffect(() => { setTheme(document.documentElement.dataset.theme === "light" ? "light" : "dark"); }, []);

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
