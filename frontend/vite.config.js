import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import tailwindcssPostcss from '@tailwindcss/postcss' // 👈 🟢 최신 V4 전용 번역기 패키지로 임포트 변경!
import autoprefixer from 'autoprefixer'

// https://vite.dev/config/
export default defineConfig({
  plugins: [react()],
  css: {
    postcss: {
      plugins: [
        tailwindcssPostcss(), // 👈 🟢 바뀐 번역기 엔진 장착!
        autoprefixer(),
      ],
    },
  },
})