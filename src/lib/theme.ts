// Shared by the server layout and the client toggle, so it must not live in a "use client" module.
export const themeStorageKey = "agent-glorria:theme";

// Runs in <head> before first paint so a saved light theme never flashes dark.
export const themeScript = `try{if(localStorage.getItem("${themeStorageKey}")==="light")document.documentElement.dataset.theme="light"}catch(e){}`;
