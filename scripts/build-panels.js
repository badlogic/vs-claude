const esbuild = require('esbuild');
const path = require('path');
const fs = require('fs');
const postcss = require('postcss');
const tailwindcss = require('tailwindcss');
const autoprefixer = require('autoprefixer');

async function buildPanels() {
  const panelsDir = path.join(__dirname, '../src/panels');
  const buildDir = path.join(__dirname, '../build/panels');
  
  // Create build directory
  fs.mkdirSync(buildDir, { recursive: true });
  
  // Find all panel directories
  const panelDirs = fs.readdirSync(panelsDir)
    .filter(dir => {
      const dirPath = path.join(panelsDir, dir);
      return fs.statSync(dirPath).isDirectory() && 
        fs.existsSync(path.join(dirPath, 'webview.ts'));
    });
  
  // Build each panel
  for (const panelName of panelDirs) {
    const entryPoint = path.join(panelsDir, panelName, 'webview.ts');
    const outDir = path.join(buildDir, panelName);
    
    fs.mkdirSync(outDir, { recursive: true });
    
    console.log(`Building panel: ${panelName}`);
    
    await esbuild.build({
      entryPoints: [entryPoint],
      bundle: true,
      outfile: path.join(outDir, `${panelName}.js`),
      platform: 'browser',
      format: 'iife',
      target: 'es2020',
      sourcemap: true,
      external: [],
      loader: {
        '.ts': 'ts',
        '.tsx': 'tsx'
      },
      define: {
        'process.env.NODE_ENV': '"production"'
      }
    });
  }
  
  // Build shared CSS with Tailwind
  console.log('Building shared panel styles...');
  
  const cssPath = path.join(panelsDir, 'styles.css');
  const css = fs.readFileSync(cssPath, 'utf8');
  
  const result = await postcss([
    tailwindcss,
    autoprefixer
  ]).process(css, {
    from: cssPath,
    to: path.join(buildDir, 'panel-styles.css')
  });
  
  fs.writeFileSync(
    path.join(buildDir, 'panel-styles.css'),
    result.css
  );
  
  if (result.map) {
    fs.writeFileSync(
      path.join(buildDir, 'panel-styles.css.map'),
      result.map.toString()
    );
  }
  
  console.log('Panel build complete!');
}

// Run build
buildPanels().catch(err => {
  console.error('Panel build failed:', err);
  process.exit(1);
});