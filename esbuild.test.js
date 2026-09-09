const esbuild = require('esbuild');

esbuild.build({
  entryPoints: ['test/core.test.ts'],
  bundle: true,
  format: 'cjs',
  platform: 'node',
  outfile: '.test-dist/tests.cjs',
  logLevel: 'warning',
}).catch((error) => {
  console.error(error);
  process.exit(1);
});
