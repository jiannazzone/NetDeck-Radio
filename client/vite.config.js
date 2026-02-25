export default {
  root: '.',
  build: { outDir: 'dist' },
  server: {
    proxy: {
      '/api': 'http://localhost:3000',
    },
  },
};
