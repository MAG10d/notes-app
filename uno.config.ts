import { defineConfig } from 'unocss'
import presetWind4 from '@unocss/preset-wind4'
import presetIcons from '@unocss/preset-icons'

export default defineConfig({
  presets: [
    presetWind4({
      preflights: {
        reset: true, // Enable built-in reset styles
        theme: 'on-demand', // Generate theme variables on demand
      },
    }),
    presetIcons({
      // You can configure icon options here
    }),
  ],
})