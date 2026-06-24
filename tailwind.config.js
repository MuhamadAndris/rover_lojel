/** @type {import('tailwindcss').Config} */
module.exports = {
  content: [
    './src/pages/**/*.{js,ts,jsx,tsx,mdx}',
    './src/components/**/*.{js,ts,jsx,tsx,mdx}',
    './src/app/**/*.{js,ts,jsx,tsx,mdx}',
  ],
  theme: {
    extend: {
      colors: {
        ink: {
          950: '#0B0E14',
          900: '#11151F',
          800: '#161B27',
          700: '#1F2533',
          600: '#2A3142',
          500: '#3A4256',
          400: '#5B6478',
          300: '#8891A3',
          200: '#C2C8D4',
          100: '#E6E9EF',
          50: '#F5F6F8',
        },
        brand: {
          900: '#0F3D3E',
          800: '#13524F',
          700: '#176760',
          600: '#1C7C71',
          500: '#249688',
          400: '#4DB3A2',
          300: '#82CFC0',
          200: '#B8E5DA',
          100: '#E1F4EE',
          50: '#F1FAF7',
        },
        amber: {
          600: '#B5760B',
          500: '#D6900F',
          400: '#E8A93C',
          100: '#FBEBCC',
        },
        rose: {
          600: '#B23A48',
          500: '#CC4757',
          100: '#F8DEE1',
        },
      },
      fontFamily: {
        sans: ['var(--font-inter)', 'system-ui', 'sans-serif'],
        display: ['var(--font-lexend)', 'system-ui', 'sans-serif'],
        mono: ['var(--font-jetbrains)', 'ui-monospace', 'monospace'],
      },
      boxShadow: {
        card: '0 1px 2px 0 rgba(11,14,20,0.04), 0 1px 1px 0 rgba(11,14,20,0.03)',
        panel: '0 4px 24px -4px rgba(11,14,20,0.08)',
      },
      borderRadius: {
        xl2: '14px',
      },
    },
  },
  plugins: [],
};
