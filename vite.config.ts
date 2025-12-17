import { defineConfig } from 'vite'
import { copyFileSync, existsSync, mkdirSync, readdirSync } from 'fs'
import { resolve, join } from 'path'

export default defineConfig({
  publicDir: 'public',
  build: {
    rollupOptions: {
      plugins: [
        {
          name: 'copy-themes-and-config',
          generateBundle(options, bundle) {
            const outputDir = options.dir || 'dist'

            // Copy config.json
            const configPath = resolve(__dirname, 'config.json')
            const configDest = resolve(outputDir, 'config.json')
            if (existsSync(configPath)) {
              copyFileSync(configPath, configDest)
            }

            // Copy themes folder
            const themesPath = resolve(__dirname, 'themes')
            const themesDest = resolve(outputDir, 'themes')

            function copyDir(src: string, dest: string) {
              if (!existsSync(dest)) {
                mkdirSync(dest, { recursive: true })
              }
              const entries = readdirSync(src, { withFileTypes: true })
              for (const entry of entries) {
                const srcPath = join(src, entry.name)
                const destPath = join(dest, entry.name)
                if (entry.isDirectory()) {
                  copyDir(srcPath, destPath)
                } else {
                  copyFileSync(srcPath, destPath)
                }
              }
            }

            if (existsSync(themesPath)) {
              copyDir(themesPath, themesDest)
            }


            // Copy translations folder
            const translationsPath = resolve(__dirname, 'translations')
            const translationsDest = resolve(outputDir, 'translations')
            if (existsSync(translationsPath)) {
              copyDir(translationsPath, translationsDest)
            }
          }
        }
      ]
    }
  }
})
