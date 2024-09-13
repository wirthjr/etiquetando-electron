const { app, dialog } = require('electron');

let lastConnectionTime = Date.now(); // Armazena o tempo atual em milissegundos
const CHECK_INTERVAL = 1000 * 60; // Intervalo de verificação de 1 minuto (1000ms)
const TIMEOUT_LIMIT = 5 * 60 * 1000; // Limite de 5 minutos em milissegundos (300000ms)

try {
  const WebSocket = require('ws');
  const os = require('os');
  const fs = require('fs');
  const { EventEmitter } = require('events');
  const socketEventEmitter = new EventEmitter();
  const path = require('path');
  const mainEventEmitter = require('./eventemitter');

  // Obter o caminho absoluto 
  const funcoes = path.join(__dirname, 'funcoes.js');
  const {
    loginpeloromaneiosocket,
    loginpelosocket,
    buscaColetaspeloRomaneioSocket,
    buscaNotapelaChaveSocket,
    buscaNotapeloNumeroSocket,
    buscaDadosNotaManual,
    buscaDescargaColetasSocket,
    buscaCepSocket,
    buscaNotasVeiculoSocket,
    capacidadeVeiculoSocket,
    cds,
    cdPorCep,
    cdPorSigla,
    cdPorCidade
  } = require(funcoes);


  const { readConfig, writeConfig } = require('./config.js');

  var config = {};

  async function callConfigGet() {
    try {
      config = await readConfig();
      return config;
    } catch (error) {
      console.error('Erro ao obter a configuração:', error);
    }
  }

  callConfigGet();

  // Obtém o nome do PC
  const hostname = os.hostname();
  const username = os.userInfo().username;

  let socket;
  let winX;
  let serverAddressX;
  let empresaX;
  let idX;
  let senhaX;


  function socketFuncoes(ws, dieison) {
    var keys = Object.keys(dieison);
    console.log(`<< Solicitado: ${keys[0]}`);
    socketEventEmitter.emit('socket-connected', 'keys: ' + keys);

    //primeira chave do JSON define a busca
    switch (keys[0]) {
      case 'logon':
        let dados = dieison.logon;
        callConfigGet()
          .then(configura => {
            configura.MICRO_SERVICO_DESCRICAO = dados.nome;
            configura.MICRO_SERVICO_USER = dados.user;

            if (dados.db_cliente_string) {
              try {
                configura.BD_CLIENTE_STRING = JSON.parse(dados.db_cliente_string);
                mainEventEmitter.emit('BD_CLIENTE_STRING', configura.BD_CLIENTE_STRING);
              } catch (error) {

                dialog.showErrorBox({
                  type: 'error',
                  buttons: ['OK'],
                  title: 'ConnectionString com erro',
                  message: String(error)
                })
                configura.BD_CLIENTE_STRING = ''
              }
            } else {

              configura.BD_CLIENTE_STRING = ''
            }

            configura.MICRO_SERVICO_FILIAIS = dados.filiais;
            configura.SERVER = dados.server;

            writeConfig(configura);
            mainEventEmitter.emit('config-save', configura);
          });

        return;

      case 'file':
        try {
          let nome = dieison.nome;
          let dados = dieison.arquivo;
          let userDataPath = app.getPath('userData');
          let filePath = path.join(userDataPath, nome);

          // Salvar o arquivo no disco
          fs.writeFile(filePath, dados, function (err) {
            if (err) {
              console.error('Erro ao salvar o arquivo:', err);
              ws.send('Erro ao salvar o arquivo no servidor.');
            } else {
              console.log('Arquivo salvo com sucesso.');
              // Se necessário, você pode enviar uma confirmação ao cliente
              ws.send('Arquivo recebido com sucesso.');
            }
          });
        } catch (e) {
          console.error('Erro ao processar o arquivo:', e);
        }
        return;

      case 'uuid':
        headers.uuid = dieison.uuid;
        ws.uuid = dieison.uuid;
        ws.send(JSON.stringify(headers));
        return;

      case 'login':
        loginpelosocket(ws, dieison);
        return;

      case 'loginpeloromaneio':
        console.log('loginpeloromaneio')
        loginpeloromaneiosocket(ws, dieison);
        return;

      case 'veiculo/capacidade':
        capacidadeVeiculoSocket(ws, dieison);
        return;

      case 'coletas':
        buscaColetaspeloRomaneioSocket(ws, dieison);
        return;

      case 'nota/chave':
        buscaNotapelaChaveSocket(ws, dieison);
        return;

      case 'nota/numero':
        buscaNotapeloNumeroSocket(ws, dieison);
        return;

      case 'nota/manual':
        buscaDadosNotaManual(ws, dieison);
        return;

      case 'descargas/coletas':
        buscaDescargaColetasSocket(ws, dieison);
        return;

      case 'notas/veiculo':
        buscaNotasVeiculoSocket(ws, dieison);
        return;

      case 'notas/lote':
        buscadadosLoteSocket(ws, dieison);
        return;

      case 'buscacep':
        buscaCepSocket(ws, dieison);
        return;

      case 'cds':
        cds(ws, dieison);
        return;

      case 'cd-por-cep':
        cdPorCep(ws, dieison);
        return;

      case 'cd-por-sigla':
        cdPorSigla(ws, dieison);
        return;

      case 'cd-por-cidade':
        cdPorCidade(ws, dieison);
        return;

      default:
        console.log(`Cabecário não encontrado: ` + keys[0]);
    }
  }

  function connectSocket(win, serverAddress, empresa, id, senha) {
    console.log("Server address: " + serverAddress);
    winX = win;
    serverAddressX = serverAddress;
    empresaX = empresa;
    idX = id;
    senhaX = senha;

    const headers = {
      'empresa': empresaX,
      'id': idX,
      'authorization': senhaX,
      'server': true,
      'computer': hostname,
      'lote': 'NÃO SE APLICA',
      'emparelhar': false
    };

    const wsOptions = {
      headers: {
        'cookie': JSON.stringify(headers)
      }
    };

    if (serverAddress) {
      socket = new WebSocket(serverAddress, [], wsOptions);

      socket.on('open', () => {
        console.log("🚪 socket open")
        lastConnectionTime = Date.now(); // Zera a contagem do tempo ao reconectar

        callConfigGet()
          .then(configura => {
            configura.SERVER_WEBSOCKET = serverAddress;
            configura.SERVER_EMPRESA = empresa;
            configura.MICRO_SERVICO_ID = id;
            configura.MICRO_SERVICO_SENHA = senha;
            writeConfig(configura);
          });
        socketEventEmitter.emit('socket-connected', 'connected');
      });

      socket.on('close', (code, reason) => {
        socketEventEmitter.emit('socket-disconnected', code);
        lastConnectionTime = Date.now(); // Armazena o tempo da desconexão

        if (code != 1008) {
          setTimeout(() => {
            console.log('Tentando reconectar ao servidor WebSocket em 5 segundos...');
            connectSocket(winX, serverAddressX, empresaX, idX, senhaX);
          }, 5000);
        } else {
          console.log(`<b class="red">Desconectado do servidor WebSocket.</b> Código: ${code}.<span class="yellow"> Motivo: ${reason}</span>`);
          socketEventEmitter.emit('socket-disconnected', code);
          setTimeout(() => {
            console.log('Tentando reconectar ao servidor WebSocket em 5 segundos...');
            connectSocket(winX, serverAddressX, empresaX, idX, senhaX);
          }, 5000);
        }
      });

      socket.on('message', function message(data, isBinary) {
        const texto = isBinary ? data : data.toString();
        
        if (texto.includes("{") && texto.includes(":") && texto.includes("}")) {
          try {
            let dieison = JSON.parse(texto);
            socketFuncoes(socket, dieison);
          } catch (e) {
            console.error(">> Erro ao parsear JSON recebido no WebSocket", e);
            socket.send("Erro ao parsear JSON recebido no WebSocket");
          }
        } else {
          console.log(`<< ${data}`);
        }
      });

      socket.on('error', (err) => {
        console.error('Erro no WebSocket:', err.message);
        socketEventEmitter.emit('socket-error', err.message);
      });
    } else {
      console.error('Endereço do servidor não encontrado');
      socketEventEmitter.emit('socket-disconnected', 'disconnected');
    }
  }


// Função para verificar o tempo sem conexão
function checkConnectionTimeout() {
  const currentTime = Date.now();
  const timeElapsed = currentTime - lastConnectionTime;
  if (timeElapsed >= TIMEOUT_LIMIT) {
    console.log((TIMEOUT_LIMIT / 1000) + ' minutos sem atividade.')
    connectSocket();
  }
}

// Configura o intervalo de verificação
setInterval(checkConnectionTimeout, CHECK_INTERVAL);

module.exports = { connectSocket, socketEventEmitter };

} catch (e) {
  console.log("Erro ao carregar socketHandler");
  console.log(e);
  const options = {
    type: 'info',
    buttons: ['OK'],
    title: 'Atenção!!!',
    message: e,
    detail: 'socketHandler.js'
  };
  dialog.showErrorBox(options);
}
