const path = require('path');
const fs = require('fs');
const { app } = require('electron');

const caminho = app.getPath('userData');
const configFileName = 'config.dll';
const configFilePath = path.join(caminho, configFileName);

function createConfigFile() {
  const defaultConfig = {
    "SERVER_WEBSOCKET": "",
    "SERVER_EMPRESA": "",
    "MICRO_SERVICO_ID": "",
    "MICRO_SERVICO_SENHA": "",
    "MICRO_SERVICO_DESCRICAO": "",
    "MICRO_SERVICO_USER": "etiquetando_micro_serviço",
    "BD_CLIENTE_STRING": "",
    "MICRO_SERVICO_FILIAIS": "",
    "SERVER": ""
  };

  if (!fs.existsSync(configFilePath)) {
    fs.writeFileSync(configFilePath, JSON.stringify(defaultConfig, null, 2), 'utf-8');
    console.log(`Arquivo ${configFileName} criado com o conteúdo inicial.`);
  } else {
    //console.log(`Arquivo ${configFileName} já existe.`);
  }
}

function writeConfig(data) {
  fs.writeFileSync(configFilePath, JSON.stringify(data, null, 2), 'utf-8');
}

function readConfig() {
  if (fs.existsSync(configFilePath)) {
    const data = fs.readFileSync(configFilePath, 'utf-8');
    return JSON.parse(data);
  } else {
    console.error(`Arquivo ${configFileName} não encontrado.`);
    return null;
  }
}

createConfigFile(); 

module.exports = {readConfig, writeConfig}