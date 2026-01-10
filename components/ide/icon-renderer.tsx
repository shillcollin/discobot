"use client"

import * as React from "react"
import { useTheme } from "next-themes"
import { Bot } from "lucide-react"
import type { Icon } from "@/lib/api-types"

interface IconRendererProps {
  icons?: Icon[]
  className?: string
  fallback?: React.ReactNode
}

export function IconRenderer({ icons, className, fallback }: IconRendererProps) {
  const { resolvedTheme } = useTheme()
  const [mounted, setMounted] = React.useState(false)

  // Avoid hydration mismatch
  React.useEffect(() => {
    setMounted(true)
  }, [])

  const icon = React.useMemo(() => {
    if (!icons || icons.length === 0) return null

    const currentTheme = mounted ? resolvedTheme : "light"

    // Filter icons by current theme or no theme specified (universal)
    const themeFilteredIcons = icons.filter((i) => !i.theme || i.theme === currentTheme)

    // If no icons match the theme, fall back to all icons
    const availableIcons = themeFilteredIcons.length > 0 ? themeFilteredIcons : icons

    // Prefer SVG icons as they scale well
    const svgIcon = availableIcons.find((i) => i.mimeType === "image/svg+xml")
    if (svgIcon) return svgIcon

    // Fall back to first available icon
    return availableIcons[0]
  }, [icons, resolvedTheme, mounted])

  if (!icon) {
    return fallback ? <>{fallback}</> : <Bot className={className} />
  }

  if (icon.mimeType === "image/svg+xml" && icon.src.startsWith("data:image/svg+xml,")) {
    try {
      // Decode the SVG from the data URI
      const svgContent = decodeURIComponent(icon.src.replace("data:image/svg+xml,", ""))
      return (
        <span
          className={className}
          style={{ display: "inline-flex", width: "1em", height: "1em" }}
          dangerouslySetInnerHTML={{
            __html: svgContent.replace(/<svg/, '<svg style="width:100%;height:100%"'),
          }}
        />
      )
    } catch {
      // Fall back to img if decoding fails
    }
  }

  // For base64 SVGs or other image types, use img tag
  return (
    <img
      src={icon.src || "/placeholder.svg"}
      alt=""
      className={className}
      style={{ width: "1em", height: "1em", objectFit: "contain" }}
    />
  )
}
