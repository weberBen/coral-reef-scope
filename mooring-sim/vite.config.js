export default {
  root: '.',
  server: { open: true, host: true },
  build: { outDir: 'dist' },
  optimizeDeps: {
    exclude: ['social-links-panel'],
  },
}
