const mssql = require('mssql');
const path = require('node:path');
const fs = require('fs');
const mainEventEmitter = require('./eventemitter');
const { dialog } = require('electron');


let connectionString = {};

const {readConfig, writeConfig} = require('./config.js')

var config = {};

async function callConfigGet() {
  try {
    config = await readConfig();
    return config;
  } catch (error) {
    console.error('Erro ao obter a configuração:', error);
  }
}

callConfigGet()
.then(configura => {
    //console.log("*************************")
    //connectionString = configura.BD_CLIENTE_STRING
    //console.log(connectionString.server)
})

var dbConfig = {}

var dbConfigOriginal = {
    server: '10.120.200.30',
    database: 'Softran_Translovato',
    user: 'consulta',
    password: 'Lovato.16',
    port: 1433,
    requestTimeout: 0,
    connectionTimeout: 60000,
    stream: false,
    timezone: 'utc-3',
    pool: {
        max: 10,
        min: 5,
        acquireTimeoutMillis: 60000,
        idleTimeoutMillis: 60000,
        log: true
    },
    options: {
        encrypt: false,
        enableArithAbort: true
    }
};

dbConfig = dbConfigOriginal


async function query(sql) {
    let pool;
    try {
        pool = await mssql.connect(dbConfig);
        const result = await pool.request().query(sql);
        return result.recordset;
    } catch (err) {
        console.log("💽 Erro em MSSQL");
        console.error(err);
        console.log('💽 SQL');
        console.log(sql);
        return JSON.stringify(err);
    } finally {
        if (pool) {
            try {
                await pool.close();
            } catch (e) {
                console.error("💽 Erro ao fechar a conexão:", e);
            }
        }
    }
}

mainEventEmitter.on('BD_CLIENTE_STRING', (dados) => {
    /*
    dialog.showMessageBox({
        type: 'info',
        buttons: ['OK'],
        title: 'Dados recebidos do Bandio de Dados',
        message: JSON.stringify( dados)
      })
*/

    if(dados){
        dbConfig = dados;
        console.log("BD_CLIENTE_STRING recebido do banco de dados")
      }else{
        dbConfig = dbConfigOriginal
      }


  });


module.exports = { query };