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

      // snipe the top-level source-map-loader rule and exclude node_modules
      const sml = webpackConfig.module.rules.find(
        r => typeof r.loader === 'string' && r.loader.includes('source-map-loader')
      );
      if (sml) {
        const excludeRE = /node_modules/;
        sml.exclude = Array.isArray(sml.exclude)
          ? [...sml.exclude, excludeRE]
          : sml.exclude
            ? [sml.exclude, excludeRE]
            : [excludeRE];
      }

      // optional: also silence the warning text itself
      webpackConfig.ignoreWarnings = [
        ...(webpackConfig.ignoreWarnings || []),
        /Failed to parse source map/,
      ];

      return webpackConfig;
    },
  }
};
