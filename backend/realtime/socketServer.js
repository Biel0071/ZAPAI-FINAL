const { Server } = require('socket.io');

function createSocketServer(httpServer, options = {}) {
  return new Server(httpServer, options);
}

function bindSocketCompatibility(app, io) {
  if (!app || !io) {
    return;
  }

  app.set('io', io);
  if (!app.locals.store) {
    app.locals.store = {};
  }

  app.locals.store.io = io;
  global.io = io;
}

module.exports = {
  createSocketServer,
  bindSocketCompatibility,
};
