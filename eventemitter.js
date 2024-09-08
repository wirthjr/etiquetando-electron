const EventEmitter = require('events');
const mainEventEmitter = new EventEmitter();

//mainEventEmitter.on('config', (message) => {
    //console.log('Evento recebido em Eventemitter:', message);
  //});

module.exports = mainEventEmitter;
