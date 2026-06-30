import type { Config } from "tailwindcss";

/**
 * Forge AI IDE — Tailwind 设计系统
 * 所有颜色/字体/圆角都映射自 globals.css 的 CSS 变量。
 * 组件里用语义类名：bg-surface / text-secondary / accent / border-subtle ...
 */
const config: Config = {
  darkMode: ["class", '[data-theme="dark"]'],
  content: [
    "./app/**/*.{ts,tsx}",
    "./components/**/*.{ts,tsx}",
    "./src/**/*.{ts,tsx}",
  ],
  theme: {
    extend: {
      colors: {
        base: "var(--bg-base)",
        surface: "var(--bg-surface)",
        elevated: "var(--bg-elevated)",
        hover: "var(--bg-hover)",
        active: "var(--bg-active)",
        border: {
          subtle: "var(--border-subtle)",
          DEFAULT: "var(--border-default)",
          strong: "var(--border-strong)",
        },
        text: {
          DEFAULT: "var(--text-primary)",
          secondary: "var(--text-secondary)",
          muted: "var(--text-muted)",
        },
        accent: {
          DEFAULT: "var(--accent)",
          hover: "var(--accent-hover)",
          subtle: "var(--accent-subtle)",
        },
        success: "var(--success)",
        warning: "var(--warning)",
        danger: "var(--danger)",
        diff: {
          "add-bg": "var(--diff-add-bg)",
          "add-text": "var(--diff-add-text)",
          "del-bg": "var(--diff-del-bg)",
          "del-text": "var(--diff-del-text)",
        },
      },
      fontFamily: {
        sans: "var(--font-sans)",
        mono: "var(--font-mono)",
      },
      fontSize: {
        xs:   ["var(--text-xs)",   { lineHeight: "var(--lh-xs)" }],
        sm:   ["var(--text-sm)",   { lineHeight: "var(--lh-sm)" }],
        base: ["var(--text-base)", { lineHeight: "var(--lh-base)" }],
        md:   ["var(--text-md)",   { lineHeight: "var(--lh-md)" }],
        lg:   ["var(--text-lg)",   { lineHeight: "var(--lh-lg)" }],
        xl:   ["var(--text-xl)",   { lineHeight: "var(--lh-xl)" }],
      },
      fontWeight: {
        normal: "400",
        medium: "500",
        semibold: "600",
      },
      borderRadius: {
        sm: "var(--radius-sm)",
        md: "var(--radius-md)",
        lg: "var(--radius-lg)",
        full: "var(--radius-full)",
      },
      boxShadow: {
        sm: "var(--shadow-sm)",
        md: "var(--shadow-md)",
        lg: "var(--shadow-lg)",
      },
      spacing: {
        1: "var(--space-1)",
        2: "var(--space-2)",
        3: "var(--space-3)",
        4: "var(--space-4)",
        5: "var(--space-5)",
        6: "var(--space-6)",
        8: "var(--space-8)",
      },
      transitionTimingFunction: {
        smooth: "var(--ease)",
      },
      transitionDuration: {
        fast: "var(--dur-fast)",
        base: "var(--dur-base)",
        slow: "var(--dur-slow)",
      },
      keyframes: {
        fadeIn: { from: { opacity: "0" }, to: { opacity: "1" } },
        slideDown: {
          from: { opacity: "0", transform: "translateY(-4px)" },
          to: { opacity: "1", transform: "translateY(0)" },
        },
      },
      animation: {
        "fade-in": "fadeIn var(--dur-base) var(--ease)",
        "slide-down": "slideDown var(--dur-base) var(--ease)",
      },
    },
  },
  plugins: [],
};

export default config;
