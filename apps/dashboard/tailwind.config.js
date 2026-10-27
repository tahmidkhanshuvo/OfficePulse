import forms from '@tailwindcss/forms';
import containerQueries from '@tailwindcss/container-queries';
export default {
        content: ["./index.html", "./src/**/*.{ts,tsx}"],
plugins: [forms, containerQueries],
darkMode: "class",
        theme: {
          extend: {
            colors: {
              "on-primary": "#2f3131",
              "background": "#131313",
              "on-secondary-fixed-variant": "#920021",
              "surface-container-highest": "#353534",
              "tertiary": "#ffffff",
              "secondary-fixed-dim": "#ffb3b3",
              "secondary-container": "#a80228",
              "surface-container-high": "#2a2a2a",
              "surface-container-low": "#1c1b1b",
              "secondary": "#ffb3b3",
              "inverse-surface": "#e5e2e1",
              "outline": "#8e9192",
              "tertiary-fixed-dim": "#ffb77f",
              "accent-purple": "#A855F7",
              "surface-bright": "#3a3939",
              "on-tertiary-container": "#9a5100",
              "text-secondary": "#888888",
              "tertiary-fixed": "#ffdcc4",
              "primary-fixed-dim": "#c6c6c7",
              "surface-tint": "#c6c6c7",
              "on-secondary-container": "#ffb2b2",
              "primary-fixed": "#e2e2e2",
              "outline-variant": "#444748",
              "error-container": "#93000a",
              "on-secondary-fixed": "#400009",
              "on-tertiary-fixed": "#2f1500",
              "surface": "#131313",
              "primary": "#ffffff",
              "surface-container": "#201f1f",
              "inverse-primary": "#5d5f5f",
              "primary-container": "#e2e2e2",
              "bg-deep": "#0A0A0A",
              "border-subtle": "rgba(255, 255, 255, 0.1)",
              "surface-container-lowest": "#0e0e0e",
              "on-error-container": "#ffdad6",
              "on-primary-fixed-variant": "#454747",
              "surface-panel": "rgba(255, 255, 255, 0.03)",
              "on-primary-fixed": "#1a1c1c",
              "surface-dim": "#131313",
              "tertiary-container": "#ffdcc4",
              "on-error": "#690005",
              "on-tertiary-fixed-variant": "#6f3900",
              "on-background": "#e5e2e1",
              "secondary-fixed": "#ffdad9",
              "on-surface-variant": "#c4c7c8",
              "on-secondary": "#680015",
              "inverse-on-surface": "#313030",
              "text-primary": "#FFFFFF",
              "surface-variant": "#353534",
              "on-surface": "#e5e2e1",
              "error": "#ffb4ab",
              "on-tertiary": "#4e2600",
              "on-primary-container": "#636565",
              "panel-bg": "rgba(255, 255, 255, 0.03)",
              "accent-orange": "#FF9D63"
            },
            borderRadius: {
              DEFAULT: "0.25rem",
              lg: "0.5rem",
              xl: "0.75rem",
              full: "9999px"
            },
            spacing: {
              unit: "4px",
              "container-max": "1200px",
              gutter: "16px",
              "margin-desktop": "32px",
              "margin-mobile": "16px"
            },
            fontFamily: {
              "headline-md": ["Inter"],
              "metric-lg": ["Geist Mono"],
              "display-lg": ["Inter"],
              "body-base": ["Inter"],
              "body-sm": ["Inter"],
              "label-caps": ["Geist Mono"]
            },
            fontSize: {
              "headline-md": ["24px", { lineHeight: "32px", letterSpacing: "-0.01em", fontWeight: "600" }],
              "metric-lg": ["18px", { lineHeight: "24px", letterSpacing: "0.02em", fontWeight: "500" }],
              "display-lg": ["48px", { lineHeight: "56px", letterSpacing: "-0.02em", fontWeight: "700" }],
              "body-base": ["14px", { lineHeight: "20px", fontWeight: "400" }],
              "body-sm": ["12px", { lineHeight: "16px", fontWeight: "400" }],
              "label-caps": ["10px", { lineHeight: "12px", letterSpacing: "0.05em", fontWeight: "600" }]
            }
          }
        }
      };