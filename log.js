const path = require('path');
const fs = require('fs');
const { app } = require('electron');
const { EventEmitter } = require('events');
const logEventEmitter = new EventEmitter();

// Use o caminho de dados do usuário para armazenar os logs
const logsDir = path.join(app.getPath('userData'), 'logs');

function ensureLogDirectory() {
  if (!fs.existsSync(logsDir)) {
    fs.mkdirSync(logsDir, { recursive: true });
  }
}

function createLogStream(date) {
  const logFileName = `${date.getFullYear()}-${(date.getMonth() + 1).toString().padStart(2, '0')}-${date.getDate().toString().padStart(2, '0')}.txt`;
  const logFilePath = path.join(logsDir, logFileName);

  // Verificar se o arquivo está corrompido
  if (fs.existsSync(logFilePath)) {
    try {
      fs.appendFileSync(logFilePath, ''); // Tenta abrir o arquivo para escrita
    } catch (err) {
      if (err.code === 'EIO') {
        // Arquivo corrompido, renomeia o arquivo
        const corruptedLogFilePath = `${logFilePath}.corrupted.${Date.now()}`;
        fs.renameSync(logFilePath, corruptedLogFilePath);
        console.error(`O arquivo de log foi corrompido e renomeado para ${corruptedLogFilePath}. Um novo arquivo de log será criado.`);
      } else {
        throw err;
      }
    }
  }

  return fs.createWriteStream(logFilePath, { flags: 'a' });
}

function createLogs() {
  try {
    ensureLogDirectory();
    logEventEmitter.emit('log', `Diretório de LOG's: ${logsDir}`);

    let currentDate = new Date();
    let logStream = createLogStream(currentDate);

    const originalConsoleLog = console.log;
    const originalConsoleError = console.error;
    const originalConsoleWarn = console.warn;

    const logMessage = (type, message) => {
      try {
        const now = new Date();
        const formattedTime = 
          `${now.getHours().toString().padStart(2, '0')}:` +
          `${now.getMinutes().toString().padStart(2, '0')}:${now.getSeconds().toString().padStart(2, '0')}`;
    
        if (now.getDate() !== currentDate.getDate()) {
          if (logStream) logStream.end();
          currentDate = now;
          logStream = createLogStream(currentDate);
        }
    
        const formattedMessage = `${formattedTime}: ${message}\n`;
    
        if (logStream) {
          logStream.write(formattedMessage);
        } else {
          console.error('logStream is not defined or invalid');
        }
    
        process.stdout.write(formattedMessage);
    
        if (logEventEmitter) {
          logEventEmitter.emit('log', formattedMessage);
        } else {
          console.error('logEventEmitter is not defined or invalid');
        }
      } catch (error) {
        console.error('An error occurred in logMessage:', error);
      }
    };
    
    console.log = (message) => {
      logMessage('log', message);
      originalConsoleLog(message);
    };

    console.error = (message) => {
      logMessage('error', `<b class='red'>ERROR</b> - ${message}`);
      originalConsoleError(message);
    };

    console.warn = (message) => {
      logMessage('warn', `<b class='yellow'>WARNING</b> - ${message}`);
      originalConsoleWarn(message);
    };

    // Testando a função
    console.log('createLogs');
    console.log(logsDir);

  } catch (e) {
    console.error("Erro no módulo log.js");
    console.error(e);
  }
}

function dirLogs() {
  return logsDir;
}

function lerArquivoLog() {
  const today = new Date();
  const logFileName = `${today.getFullYear()}-${(today.getMonth() + 1).toString().padStart(2, '0')}-${today.getDate().toString().padStart(2, '0')}.txt`;
  const logFilePath = path.join(logsDir, logFileName);

  if (fs.existsSync(logFilePath)) {
    try {
      const logData = fs.readFileSync(logFilePath, 'utf8');
      return logData;
    } catch (err) {
      console.error('Erro ao ler o arquivo de log:', err);
      return null;
    }
  } else {
    console.log("Arquivo de log não encontrado para hoje.");
    return null;
  }
}

module.exports = { createLogs, lerArquivoLog, logEventEmitter, dirLogs };
