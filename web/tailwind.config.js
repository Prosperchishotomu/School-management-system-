/** @type {import('tailwindcss').Config} */
export default {
  content: [
    "./index.html",
    "./src/**/*.{js,ts,jsx,tsx}",
  ],
  theme: {
    extend: {
      colors: {
        ink: "#1C2530",
        paper: "#FAF8F4",
        sage: "#E4EBE6",
        "teal-primary": "#2F6B5E",
        "teal-dark": "#1E4A41",
        "amber-warning": "#C98A2C",
        "brick-critical": "#B3492F",
        "line-border": "#DAD4C8"
      },
      fontFamily: {
        display: ["Fraunces", "Georgia", "serif"],
        sans: ["Inter", "system-ui", "sans-serif"],
        mono: ["IBM Plex Mono", "Courier New", "monospace"]
      },
      animation: {
        fadeIn: "fadeIn 0.4s ease-out both",
        slideUp: "slideUp 0.4s cubic-bezier(0.4, 0, 0.2, 1) both",
        shake: "shake 0.4s cubic-bezier(0.36, 0.07, 0.19, 0.97) both"
      },
      keyframes: {
        fadeIn: {
          "0%": { opacity: "0", transform: "translateY(6px)" },
          "100%": { opacity: "1", transform: "translateY(0)" }
        },
        slideUp: {
          "0%": { opacity: "0", transform: "translateY(16px)" },
          "100%": { opacity: "1", transform: "translateY(0)" }
        },
        shake: {
          "0%, 100%": { transform: "translateX(0)" },
          "10%, 50%, 90%": { transform: "translateX(-4px)" },
          "30%, 70%": { transform: "translateX(4px)" }
        }
      }
    },
  },
  plugins: [],
}
