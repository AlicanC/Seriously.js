module.exports = {
  output: {
    libraryTarget: 'commonjs2',
  },
  module: {
    loaders: [
      { test: /\.glsl$/, loader: 'raw' },
    ],
  },
};
