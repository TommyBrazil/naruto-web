import { THEMES, type ThemeId } from './themes'

const STORAGE_KEY = 'naruto-theme'

const ALL_THEME_CLASSES = ['theme-leaf', 'theme-shippuden', 'theme-akatsuki', 'theme-sasuke', 'theme-sakura']

export function applyTheme(id: ThemeId) {
  const theme = THEMES.find(t => t.id === id) ?? THEMES[0]
  const root  = document.documentElement

  // Remove all theme classes so CSS class variables don't leak
  root.classList.remove(...ALL_THEME_CLASSES)

  // Set every CSS variable as an inline style so they always win
  Object.entries(theme.css).forEach(([key, value]) => {
    root.style.setProperty(key, value)
  })

  root.setAttribute('data-theme', id)
  try { localStorage.setItem(STORAGE_KEY, id) } catch {}
}

export function loadSavedTheme(): ThemeId {
  try {
    const saved = localStorage.getItem(STORAGE_KEY) as ThemeId | null
    if (saved) return saved
  } catch {}
  return 'leaf'
}
