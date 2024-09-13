const Service = require('node-windows').Service;
const path = require('path');

// Cria um novo objeto de serviço
const svc = new Service({
  name: 'Etqietando_service',
  description: 'Etiquetando Micro serviço',
  script: path.join(__dirname, 'main.js'), // Caminho para o seu script principal
  nodeOptions: [
    '--harmony',
    '--max_old_space_size=4096'
  ]
});

// Evento que ocorre quando o serviço está instalado
svc.on('install', function () {
  svc.start();
  console.log('Serviço instalado e iniciado com sucesso.');
});

// Instalar o serviço
svc.install();
