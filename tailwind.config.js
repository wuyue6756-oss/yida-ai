/** @type {import('tailwindcss').Config} */
export default {
  content: ['./index.html', './src/**/*.{js,ts,jsx,tsx}'],
  theme: {
    extend: {
      colors: {
        mint: '#5FD0A6',
        'mint-light': '#CFF3E6',
        cream: '#FFD98A',
        'cream-light': '#FFF1CF',
        sky: '#7CC8F0',
        'sky-light': '#D6EEFB',
        'sky-deep': '#2C6480',
        coral: '#FF9B7A',
        'coral-light': '#FFDCCF',
        'coral-deep': '#9C432A',
        bg: '#FBF7F0',
        ink: '#353542',
        'ink-soft': '#9A9AA8',
      },
      borderRadius: {
        card: '22px',
        control: '14px',
      },
      boxShadow: {
        card: '0 10px 30px rgba(120, 110, 90, 0.10)',
      },
      fontFamily: {
        sans: [
          '-apple-system',
          'BlinkMacSystemFont',
          '"Segoe UI"',
          '"PingFang SC"',
          '"Microsoft YaHei"',
          'sans-serif',
        ],
      },
    },
  },
  plugins: [],
}
