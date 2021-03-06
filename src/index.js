import webpack from 'webpack';
import WebpackDevServer from 'webpack-dev-server';
import clearRequireCache from './clearRequireCache';
import getDevServerPort from './getDevServerPort';
import initHttpServer from './initHttpServer';

/**
 * Watches server for changes, recompile and restart express
 */
const watchServerChanges = (serverConfig) => {
  let initialLoad = true;
  let httpServerInitObject; // contains the httpServer itself and socket references

  const bundlePath = `${serverConfig.output.path}/${serverConfig.output.filename}`;
  const serverCompiler = webpack(serverConfig);
  const compilerOptions = {
    aggregateTimeout: 300, // wait so long for more changes
    poll: true, // use polling instead of native watchers
  };

  // compile server side code
  serverCompiler.watch(compilerOptions, err => {
    if (err) {
      console.log(`Server bundling error: ${JSON.stringify(err)}`);
      return;
    }

    clearRequireCache(bundlePath);

    if (!initialLoad) {
      httpServerInitObject.httpServer.close(() => {
        httpServerInitObject = initHttpServer(bundlePath);

        if(httpServerInitObject) {
          initialLoad = false;
          console.log(`Server bundled & restarted ${new Date()}`);
        } else {
          // server bundling error has occurred
          initialLoad = true;
        }
      });

      // Destroy all open sockets
      for (const socket of httpServerInitObject.sockets.values()) {
        socket.destroy();
      }
    } else {
      httpServerInitObject = initHttpServer(bundlePath);

      if(httpServerInitObject) {
        initialLoad = false;
        console.log('Server bundled successfully');
      } else {
        // server bundling error has occurred
        initialLoad = true;
      }
    }
  });
};

/**
 * Start webpack dev server for hmr
 */
const watchClientChanges = (clientConfig) => {
  const devServerPort = getDevServerPort(clientConfig);
  const basePath = clientConfig.output.publicPath;

  const serverOptions = {
    quiet: false, // don’t output anything to the console.
    noInfo: true, // suppress boring information
    hot: true, // switch the server to hot mode.
    inline: true, // embed the webpack-dev-server runtime into the bundle.
    lazy: false, // no watching, compiles on request
    contentBase: basePath, // base path for the content
    publicPath: basePath,
    stats: true,
  };
  const devCompiler = webpack(clientConfig);
  const devServer = new WebpackDevServer(devCompiler, serverOptions);
  devServer.listen(devServerPort, 'localhost', console.log(`weback-dev-server listening at ${devServerPort}`));
};

const main = (serverConfig, clientConfig) => {
  // Watch changes on the server side, re-compile and restart.
  watchServerChanges(serverConfig);

  // Start webpack dev server separately on a different port to avoid issues with httpServer restarts
  watchClientChanges(clientConfig);
};

export default main;
