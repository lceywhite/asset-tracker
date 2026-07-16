export default {
  content: ["./index.html", "./src/**/*.{vue,js}"],
  theme: {
    extend: {
      colors: {
        brand: {
          DEFAULT: "#0058A3",
          light: "#E8F1FA",
          hover: "#004A8C",
          50: "#F0F6FC",
          100: "#D9E8F7",
          200: "#B3D1EF",
          600: "#003D73",
          700: "#002D56",
        },
        bg: { DEFAULT: "#F5F5F0", warm: "#FAF9F6" },
        surface: "#FFFFFF",
        border: { DEFAULT: "#E0DED8", light: "#ECEAE4" },
        divider: "#F0EEE8",
        text: { primary: "#1A1A1A", secondary: "#6B6B6B", tertiary: "#9B9B9B" },
        success: { DEFAULT: "#1A8D5E", bg: "#E6F5EE" },
        warning: { DEFAULT: "#D4860A", bg: "#FFF6E6" },
        error: { DEFAULT: "#C43333", bg: "#FDECEC" },
      },
      fontFamily: { sans: ['"Noto Sans SC"', "system-ui", "sans-serif"] },
      borderRadius: { sm: "4px", DEFAULT: "8px", md: "8px", lg: "12px", xl: "16px" },
      boxShadow: {
        sm: "0 1px 2px rgba(0,0,0,0.04)",
        md: "0 2px 8px rgba(0,0,0,0.05)",
        lg: "0 4px 16px rgba(0,0,0,0.05)",
      },
      fontSize: {
        xs: ["10px", { lineHeight: "1.4" }],
        sm: ["12px", { lineHeight: "1.5" }],
        base: ["14px", { lineHeight: "1.6" }],
        lg: ["16px", { lineHeight: "1.5" }],
        xl: ["18px", { lineHeight: "1.4" }],
        "2xl": ["22px", { lineHeight: "1.3" }],
        "3xl": ["28px", { lineHeight: "1.25" }],
      },
    },
  },
  plugins: [],
}
