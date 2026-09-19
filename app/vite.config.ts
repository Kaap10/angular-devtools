import { defineConfig } from 'vite'
import angular from '@analogjs/vite-plugin-angular'
import { devframeViteBridge } from '@devframes/vite/single'
import ngDevtools from '../src/node/devframe.js'

export default defineConfig({
  base: './',
  root: import.meta.dirname,
  build: { outDir: '../dist/devtools-ui', emptyOutDir: true },
  plugins: [
    angular({ tsconfig: './app/tsconfig.json' }),
    devframeViteBridge(ngDevtools, { base: '/__ng-devtools/', auth: false }),
  ],
})
