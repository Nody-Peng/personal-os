// Shared by the server layout (inline script) and lib/theme.ts.

export const THEME_KEY = 'personal-os:theme'
export const DARK_QUERY = '(prefers-color-scheme: dark)'

/** Runs in <head> before anything paints, so a dark page never flashes light first. */
export const THEME_SCRIPT = `(function(){try{var p=localStorage.getItem('${THEME_KEY}');var d=p==='dark'||(p!=='light'&&matchMedia('${DARK_QUERY}').matches);var r=document.documentElement;r.dataset.theme=d?'dark':'light';r.style.colorScheme=d?'dark':'light'}catch(e){}})()`
