module.exports = {
  webpack: {
    configure: (webpackConfig) => {
      webpackConfig.resolve.fallback = {
        crypto: false
      };

      const rule = webpackConfig.module.rules.find(rule => 'oneOf' in rule);
      rule.oneOf.unshift({
        test: [/\/assets\/.+\.js$/], // Load .js files in the assets folder as string
        type: 'asset/source'
      });

      return webpackConfig;
    },
  }
};
