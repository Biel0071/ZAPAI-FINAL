const EventEmitter = require('events');

class CRMEventBus extends EventEmitter {
  publish(event, data) {
    this.emit(event, data);
  }
}

const eventBus = new CRMEventBus();

module.exports = eventBus;
