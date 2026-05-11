'use client'

import { useEffect } from 'react'
import { applyTheme, loadSavedTheme } from '@/lib/theme'

export default function ThemeLoader() {
  useEffect(() => {
    applyTheme(loadSavedTheme())
  }, [])
  return null
}
