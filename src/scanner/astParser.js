const parser = require('@babel/parser');

function parseSource(code, filename = 'source.js') {
  const isTypeScript = /\.(ts|tsx)$/i.test(filename);
  const isJsx = /\.(jsx|tsx)$/i.test(filename);

  const plugins = [
    'asyncGenerators',
    'classProperties',
    'classPrivateProperties',
    'classPrivateMethods',
    'dynamicImport',
    'exportDefaultFrom',
    'exportNamespaceFrom',
    'nullishCoalescingOperator',
    'optionalChaining',
    'objectRestSpread',
    'topLevelAwait'
  ];

  if (isTypeScript) plugins.push('typescript');
  if (isJsx) plugins.push('jsx');

  try {
    const ast = parser.parse(code, {
      sourceType: 'unambiguous',
      allowReturnOutsideFunction: true,
      allowAwaitOutsideFunction: true,
      plugins
    });
    return { ast, error: null };
  } catch (err) {
    return { ast: null, error: err };
  }
}

function traverse(node, visitor, parent = null) {
  if (!node || typeof node !== 'object') return;

  if (typeof visitor[node.type] === 'function') {
    visitor[node.type](node, parent);
  }

  for (const key of Object.keys(node)) {
    if (key === 'parent' || key === 'loc') continue;
    const child = node[key];
    if (Array.isArray(child)) {
      for (const item of child) {
        traverse(item, visitor, node);
      }
    } else if (child && typeof child === 'object') {
      traverse(child, visitor, node);
    }
  }
}

module.exports = {
  parseSource,
  traverse
};
