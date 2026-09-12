const fs = require('fs');
const path = require('path');

try {
  const jsxRuntimePkgPath = path.resolve(__dirname, '../node_modules/react-native-css-interop/jsx-runtime/package.json');
  if (fs.existsSync(jsxRuntimePkgPath)) {
    const pkg = JSON.parse(fs.readFileSync(jsxRuntimePkgPath, 'utf8'));
    if (pkg.main && !pkg.main.endsWith('.js')) {
      pkg.main = pkg.main + '.js';
      fs.writeFileSync(jsxRuntimePkgPath, JSON.stringify(pkg, null, 2));
      console.log('[postinstall] Patched react-native-css-interop/jsx-runtime/package.json');
    }
  }

  const jsxDevRuntimePkgPath = path.resolve(__dirname, '../node_modules/react-native-css-interop/jsx-dev-runtime/package.json');
  if (fs.existsSync(jsxDevRuntimePkgPath)) {
    const pkg = JSON.parse(fs.readFileSync(jsxDevRuntimePkgPath, 'utf8'));
    if (pkg.main && !pkg.main.endsWith('.js')) {
      pkg.main = pkg.main + '.js';
      fs.writeFileSync(jsxDevRuntimePkgPath, JSON.stringify(pkg, null, 2));
      console.log('[postinstall] Patched react-native-css-interop/jsx-dev-runtime/package.json');
    }
  }
} catch (err) {
  console.warn('[postinstall] Warning patching css-interop package.json:', err.message);
}
