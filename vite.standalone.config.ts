import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import { resolve } from 'path'

/**
 * Builds the standalone bundle that includes React.
 * Produces a single IIFE file: dist/modern-boxplot.standalone.js
 * Consumer usage: <script src="modern-boxplot.standalone.js"></script>
 */
export default defineConfig({
  plugins: [react()],
  build: {
    lib: {
      entry: resolve(__dirname, 'src/standalone.ts'),
      name: 'ModernBoxPlot',
      formats: ['iife'],
      fileName: () => 'modern-boxplot.standalone.js',
    },
    outDir: 'dist',
    emptyOutDir: false, // don't wipe the library build output
    rollupOptions: {
      // Do NOT externalize React — we bundle it in
      output: {
        // Ensure it's a single file
        inlineDynamicImports: true,
      },
    },
  },
  define: {
    'process.env.NODE_ENV': JSON.stringify('production'),
  },
})
