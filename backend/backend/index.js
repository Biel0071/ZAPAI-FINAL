module.exports = {
  modules: require('./modules'),
  infrastructure: {
    database: require('./infrastructure/database'),
    realtime: require('./infrastructure/realtime'),
    queue: require('./infrastructure/queue'),
  },
  controllers: require('./controllers'),
  services: require('./services'),
  repositories: require('./repositories'),
  routes: require('./routes'),
  shared: require('./shared'),
};
