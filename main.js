try {
  const { app, BrowserWindow, ipcMain, nativeTheme, dialog, Tray, Menu, autoUpdater } = require('electron');
  const path = require('node:path');
  const fs = require('node:fs');


  const mainEventEmitter = require('./eventemitter');

  const { createLogs, lerArquivoLog, logEventEmitter, dirLogs } = require('./log');
  const { connectSocket, socketEventEmitter } = require('./sockethandler');
  const {readConfig, writeConfig} = require('./config.js')

  let config ;
  let win;
  let passWin;
  let tray;
  //process.on('uncaughtException', (error) => {
    //console.error('Uncaught Exception:', error);
  //});
  
  //process.on('unhandledRejection', (reason, promise) => {
    //console.error('Unhandled Rejection:', reason);
  //});
  
  
  async function initializeConfig() {
    config  = readConfig();
  }

  initializeConfig()


  
  async function createWindow() {
    await initializeConfig();
  
    win = new BrowserWindow({
      width: 900,
      height: 600,
      icon: 'imagem.png',
      webPreferences: {
        preload: path.join(__dirname, 'preload.js'),
        contextIsolation: true,
        enableRemoteModule: false,
        nodeIntegration: false,
        sandbox: true,
      }
    });
  
    win.setMenuBarVisibility(false);
    win.loadFile('index.html').catch(error => console.error('Error loading file:', error));
  
    win.webContents.on('before-input-event', (event, input) => {
      if (input.control && input.shift && input.key.toLowerCase() === 'i') {
        //event.preventDefault();
        //createPasswordWindow();
      }
    });
  
    win.webContents.on('did-finish-load', () => {
      let data = { key: 'app-start', value: Date() };
      sendData('data:load', data);
      data = { key: 'app-version', value:  app.getVersion() };
      sendData('data:load', data);
      data = { key: 'node-version', value:  process.versions.node };
      sendData('data:load', data);
      data = { key: 'electron-version', value: process.versions.electron };
      sendData('data:load', data);
      data = { key: 'chromium-version', value: process.versions.chrome };
      sendData('data:load', data);
  
      let serverAddress = config.SERVER_WEBSOCKET;
      let serverEmpresa = config.SERVER_EMPRESA;
      let serverID = config.MICRO_SERVICO_ID;
      let serverToken = config.MICRO_SERVICO_SENHA;
  
      data = { key: 'server-address', value: serverAddress };
      sendData('data:load', data);
      sendData('token', serverToken);
  
      try {
        //let data = { key: 'createWindows', value: "OK" };
        createLogs();
        //sendData('data:log', dirLogs);
      } catch (e) {
        dialog.showErrorBox('Atenção', e);
      }
  
      try {
        lerLog();
        startLog();
      } catch (error) {
        data = { key: 'error', value: error };
        sendData('data:load', data);
      }
  
      try {
        sendData('data:load', { 'key': "update", 'value': config.SERVER + '/updates' });
  
        autoUpdater.setFeedURL({
          provider: 'generic',
          url: config.SERVER + '/updates/win32',
        });
  
        autoUpdater.checkForUpdates();
      } catch (error) {
        console.warn('autoUpdater.checkForUpdates');
        console.warn(error);
      }
  
      socketEventEmitter.on('socket-connected', () => {
        sendData('socket:status', 'connected');
      });
  
      socketEventEmitter.on('socket-disconnected', () => {
        sendData('socket:status', 'disconnected');
      });
  
      socketEventEmitter.on('config-save', (dados) => {
        writeConfig(dados); 
      });
  
      logEventEmitter.on('log', (message) => {
        sendData('data:log', message);
      });
  
      connectSocket(win, serverAddress, serverEmpresa, serverID, serverToken);
    });
  
    ipcMain.handle('dark-mode:toggle', () => {
      if (nativeTheme.shouldUseDarkColors) {
        nativeTheme.themeSource = 'light';
      } else {
        nativeTheme.themeSource = 'dark';
      }
      return nativeTheme.shouldUseDarkColors;
    });
  
    ipcMain.handle('dark-mode:system', () => {
      nativeTheme.themeSource = 'system';
    });
  
    ipcMain.handle('connect', (event, ...args) => {
      const [address, empresa, id, senha] = args;
      connectSocket(win, address, empresa, id, senha);
    });
  
    ipcMain.handle('config:get', async () => {
      return await config;
    });
  
    ipcMain.handle('login-server:server', async () => {
      return config.SERVER_WEBSOCKET;
    });
  
    ipcMain.handle('login-server:empresa', async () => {
      return config.SERVER_EMPRESA;
    });
  
    ipcMain.handle('login-server:id', async () => {
      return config.MICRO_SERVICO_ID;
    });
  
    ipcMain.handle('login-server:token', async () => {
      return config.MICRO_SERVICO_SENHA;
    });
  
    ipcMain.handle('log-start:start', () => {
      lerArquivoLog();
    });
  
    ipcMain.handle('load:object', (event, { object }) => {
      console.log('Received object:', object);
      return 'Object received successfully';
    });
  
    ipcMain.handle('password-check', async (event, inputPassword) => {
      return inputPassword === config.winpass;
    });
  
    ipcMain.on('open-dev-tools', () => {
      if (win) {
        win.webContents.openDevTools();
      }
    });
  }
  
  function createPasswordWindow() {
    passWin = new BrowserWindow({
      width: 400,
      height: 300,
      modal: true,
      minimizable: false,
      maximizable: false,
      resizable: false,
      parent: win,
      webPreferences: {
        preload: path.join(__dirname, 'preload.js'),
        contextIsolation: true,
        enableRemoteModule: false,
        nodeIntegration: false,
        sandbox: true,
      }
    });
  
    passWin.loadFile('password.html').catch(error => console.error('Error loading password file:', error));
    passWin.setMenuBarVisibility(false);
  }
  
  function sendData(channel, data) {
    if (win && win.webContents) {
      win.webContents.send(channel, data);
    }
  }
  
  function lerLog() {
    try {
      const logData = lerArquivoLog();
      if (logData) {
        sendData('logData', logData);
      }
    } catch (e) {
      let data = { key: 'error', value: e };
      sendData('data:load', data);
    }
  }
  
  function startLog() {
    //let data = { key: 'startLog', value: "OK" };
    //sendData('data:load', data);
    //setInterval(lerLog, 15000);
  }
  
  app.whenReady().then(() => {
    createWindow();
  
    //const iconPath = path.join(process.resourcesPath, 'imagem.png');
    const iconPath = path.join(__dirname, 'imagem.png');

    tray = new Tray(iconPath);
    const contextMenu = Menu.buildFromTemplate([
      {
        label: 'Abrir', click: () => {
          if (!win) {
            createWindow();
          } else {
            win.show();
          }
        }
      },
      { label: 'Sair', click: () => { app.quit(); } }
    ]);
    tray.setToolTip('Etiquetando');
    tray.setContextMenu(contextMenu);
  
    tray.on('click', () => {
      if (win) {
        win.show();
      } else {
        createWindow();
      }
    });
  
    app.on('activate', () => {
      if (BrowserWindow.getAllWindows().length === 0) {
        createWindow();
      }
    });
  
  }).catch(error => console.error('App initialization error:', error));
  
  app.on('window-all-closed', () => {
    if (process.platform !== 'darwin') {
      app.quit();
    }
  });
  
  app.on('before-quit', () => {
    if (tray) {
      tray.destroy();
    }
  });
  
  autoUpdater.on('checking-for-update', () => {
    sendData('update', '🖥️ Procurando por atualizações...');
  });
  
  autoUpdater.on('update-available', (info) => {
    sendData('update', '📥 Atualização disponível:');
  });
  
  autoUpdater.on('update-not-available', (info) => {
    sendData('update', '📪 Nenhuma atualização disponível:');
  });
  
  autoUpdater.on('error', (err) => {
    sendData('update', '📮 Erro ao verificar atualizações:');
    sendData('update', '   ' + err);
  });
  
  autoUpdater.on('download-progress', (progress) => {
    console.log(`Progresso do download: ${progress.percent}%`);
  });
  
  autoUpdater.on('update-downloaded', (info) => {
    sendData('update', '✅ Atualização baixada; instalando agora...');
    autoUpdater.quitAndInstall();
  });
  
} catch (error) {
  console.log(error)  
}