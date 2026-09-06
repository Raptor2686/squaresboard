/** @type {import('tailwindcss').Config} */
export default {
  content: ["./index.html", "./src/**/*.{js,ts,jsx,tsx}"],
  theme: {
    extend: {
      fontFamily: {
        sans: ["Inter", "system-ui", "-apple-system", "sans-serif"],
        mono: ["JetBrains Mono", "Fira Code", "monospace"],
      },
      colors: {
        // Brand blues — slightly richer than stock Tailwind
        brand: {
          50: "#eef4ff",
          100: "#d9e5ff",
          200: "#bcd2ff",
          300: "#8eb8ff",
          400: "#5990ff",
          500: "#3b6cf7",
          600: "#2450e6",
          700: "#1c3dd4",
          800: "#1d34ab",
          900: "#1e3087",
          950: "#0d1a4a",
        },
        // Gold coins palette
        coin: {
          50: "#fffbeb",
          100: "#fff3c4",
          200: "#ffe588",
          300: "#ffd149",
          400: "#ffbf20",
          500: "#f59e07",
          600: "#d97b02",
          700: "#b45706",
          800: "#92430c",
          900: "#78370d",
          950: "#451c02",
        },
        // Sweep coins (purple)
        sweep: {
          50: "#faf5ff",
          100: "#f3e8ff",
          200: "#e9d5ff",
          300: "#d8b4fe",
          400: "#c084fc",
          500: "#a855f7",
          600: "#9333ea",
          700: "#7e22ce",
          800: "#6b21a8",
          900: "#581c87",
          950: "#3b0764",
        },
        // Surface colors — deeper than zinc for richer dark mode
        surface: {
          50: "#f8f9fa",
          100: "#f1f3f5",
          200: "#e9ecef",
          300: "#dee2e6",
          400: "#adb5bd",
          500: "#6c757d",
          600: "#495057",
          700: "#1a1b23",
          800: "#13141b",
          900: "#0d0e14",
          950: "#08090d",
        },
      },
      boxShadow: {
        "glow-blue": "0 0 20px rgba(59, 108, 247, 0.15), 0 0 60px rgba(59, 108, 247, 0.05)",
        "glow-gold": "0 0 20px rgba(255, 191, 32, 0.15), 0 0 60px rgba(255, 191, 32, 0.05)",
        "glow-purple": "0 0 20px rgba(168, 85, 247, 0.15), 0 0 60px rgba(168, 85, 247, 0.05)",
        "glow-green": "0 0 20px rgba(34, 197, 94, 0.15), 0 0 60px rgba(34, 197, 94, 0.05)",
        "card": "0 1px 3px rgba(0,0,0,0.3), 0 8px 24px rgba(0,0,0,0.2)",
        "card-hover": "0 4px 12px rgba(0,0,0,0.4), 0 16px 48px rgba(0,0,0,0.3)",
        "inner-glow": "inset 0 1px 0 rgba(255,255,255,0.05)",
      },
      keyframes: {
        fadeIn: {
          "0%": { opacity: "0", transform: "translateY(8px)" },
          "100%": { opacity: "1", transform: "translateY(0)" },
        },
        fadeInUp: {
          "0%": { opacity: "0", transform: "translateY(16px)" },
          "100%": { opacity: "1", transform: "translateY(0)" },
        },
        scaleIn: {
          "0%": { opacity: "0", transform: "scale(0.95)" },
          "100%": { opacity: "1", transform: "scale(1)" },
        },
        slideInRight: {
          "0%": { opacity: "0", transform: "translateX(100%) scale(0.95)" },
          "100%": { opacity: "1", transform: "translateX(0) scale(1)" },
        },
        slideDown: {
          "0%": { opacity: "0", transform: "translateY(-8px)" },
          "100%": { opacity: "1", transform: "translateY(0)" },
        },
        shimmer: {
          "0%": { backgroundPosition: "-200% 0" },
          "100%": { backgroundPosition: "200% 0" },
        },
        glow: {
          "0%, 100%": { opacity: "0.4" },
          "50%": { opacity: "0.8" },
        },
        float: {
          "0%, 100%": { transform: "translateY(0)" },
          "50%": { transform: "translateY(-4px)" },
        },
        "pulse-glow": {
          "0%, 100%": { boxShadow: "0 0 8px rgba(59, 108, 247, 0.2)" },
          "50%": { boxShadow: "0 0 20px rgba(59, 108, 247, 0.4)" },
        },
        "spin-slow": {
          "0%": { transform: "rotate(0deg)" },
          "100%": { transform: "rotate(360deg)" },
        },
        "count-up": {
          "0%": { opacity: "0", transform: "translateY(10px)" },
          "100%": { opacity: "1", transform: "translateY(0)" },
        },
      },
      animation: {
        fadeIn: "fadeIn 0.3s ease-out",
        fadeInUp: "fadeInUp 0.4s ease-out",
        scaleIn: "scaleIn 0.2s ease-out",
        slideInRight: "slideInRight 0.25s ease-out",
        slideDown: "slideDown 0.2s ease-out",
        shimmer: "shimmer 2s linear infinite",
        glow: "glow 2s ease-in-out infinite",
        float: "float 3s ease-in-out infinite",
        "pulse-glow": "pulse-glow 2s ease-in-out infinite",
        "spin-slow": "spin-slow 8s linear infinite",
        "count-up": "count-up 0.5s ease-out",
      },
      backgroundImage: {
        "gradient-radial": "radial-gradient(var(--tw-gradient-stops))",
        "shimmer-gradient":
          "linear-gradient(90deg, transparent 0%, rgba(255,255,255,0.03) 50%, transparent 100%)",
      },
    },
  },
  plugins: [],
};
