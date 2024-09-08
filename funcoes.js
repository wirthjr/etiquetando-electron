const path = require('node:path');
const fs = require('fs');
const db = require('./mssql.js');
const { Promise } = require('mssql');
const fetch = require('node-fetch').default;

function agora() {
  var d = new Date();
  let options = { year: 'numeric', month: '2-digit', day: '2-digit' };
  options.timeZone = 'UTC';
  d.toLocaleDateString('pt-BR', options)

  var day = d.getDate();
  if (day.length < 2) {
    day = '0' + day;
  };

  var month = d.getMonth() + 1;
  if (month.length < 2) {
    month = '0' + month;
  };

  var hora = d.getHours();
  if (hora.length < 10) {
    hora = '0' + hora;
  };

  var minuto = d.getMinutes();
  if (minuto.length < 10) {
    minuto = '0' + minuto;
  };

  var year = d.getFullYear();

  return year + '-' + month + '-' + day + ' ' + hora + ':' + minuto;
}
//-------------------------------------------

function sqlDescargaColetas(empresa) {
  let sql = ""
  sql = `set	nocount on
  select A.NrPlaca as Carro, FORMAT (A.DtMovimento, 'dd-MM-yy HH:mm') as Data FROM CODMOV A with (NoLock) 
  where A.cdempresa = ${empresa}
  and A.intipomovimento=52
  and isdate(a.dtfechamento) = 0 
  order by a.DtMovimento, a.NrPlaca`

  return sql;

}//sqlDescargaColetas

//-------------------------------------------
async function validasenhalogin(usuario, senha) {
  var sql = `select [softran_translovato].[dbo].fn_ValidaSenha('${usuario}','${senha}')  as retorno;`;
  var retorno;


  try {
    retorno = await db.query(sql);
    if (retorno.length == 0) {
      console.log(agora() + ' 📋' + 'Usuário não encontrado : ' + retorno.length);
      return false;
    } else {
      if (retorno[0].retorno == true) {
        return true;
      } else {
        return false;
      }

    }
  } catch (e) {
    console.error("📋 " + e);
    return false
  }



}//validasenha


//-----------------------------------------------
//async function validasenhaloginromaneio(empresa, romaneio, senha) {
async function validasenhaloginromaneio(empresa, carro, romaneio) {
  return new Promise((resolve, reject) => {
    let sql = '';

    if (empresa && romaneio && carro) {

      sql = `WITH VeiculoInfo AS (
    SELECT NrPlaca, VlCapacIdeal, QtAltura, QtLargura, QtComprimento
    FROM (
        SELECT 'SISVeicu' AS Source, NrPlaca, VlCapacIdeal, QtAltura, QtLargura, QtComprimento
        FROM [softran_translovato].[dbo].[SISVeicu]
        UNION ALL
        SELECT 'GTCTerc' AS Source, NrPlaca, VlCapacidadeIdeal AS VlCapacIdeal, QtAltura, QtLargura, QtComprimento
        FROM [softran_translovato].[dbo].[GTCTerc]
    ) AS Combined
    WHERE Source = 'SISVeicu' OR NOT EXISTS (
        SELECT 1 
        FROM [softran_translovato].[dbo].[SISVeicu] 
        WHERE Combined.NrPlaca = SISVeicu.NrPlaca
    )
)
SELECT 
    CCE.CdEmpresa, 
    CCE.NrPlaca, 
    CCE.NrCPFMotorista, 
    CCE.cdromaneio AS 'romaneio', 
    B.DsNome, 
    B.DsApelido, 
    E.DsApelido AS Filial,
    VI.VlCapacIdeal,
    VI.QtAltura,
    VI.QtLargura,
    VI.QtComprimento
FROM [softran_translovato].[dbo].[CCERoman] CCE
LEFT JOIN softran_translovato.dbo.GTCFundp B ON B.NrCPF = CCE.NrCPFMotorista
LEFT JOIN SISEmpre E ON E.CdEmpresa = CCE.CdEmpresa 
LEFT JOIN VeiculoInfo VI ON VI.NrPlaca = CCE.NrPlaca
WHERE CCE.CdEmpresa = ${empresa} 
  AND CCE.cdromaneio = ${romaneio} 
  AND CCE.NrPlaca = '${carro}';
`


    } else {
      console.warn(`📋 validasenhaloginromaneio ${empresa} && ${romaneio} && ${carro}`)
      return reject('Dados para login não conferem')
    }

    try {
      var retorno;
      (async function () {
        try {
          retorno = await db.query(sql);

          if (retorno[0]) {
            //console.log(JSON.stringify(retorno[0]))
            return resolve(retorno);
          } else {
            console.warn('📋 Dados para login não conferem:' + retorno[0])
            return reject('Dados para login não conferem')
          }
        } catch (e) {
          console.error("📋 " + e)
          return reject(e)
        }

      })();

    } catch (ex) {
      return reject(e)
    }

  })


}//validasenhalogin

//-------------------------------------
async function buscaCliente(cnpj) {


  return new Promise((resolve, reject) => {

    let sql = `
      declare @cnpj varchar(15);
      set @cnpj = '${cnpj}';
      SELECT CLI.DsEntidade, CLI.NrCEP, CLI.DsEndereco as 'DsEndereco', CEP.DsLocal as 'DsCidade', CEP.DsUF as 'DsUf' FROM softran_translovato.dbo.SISCli CLI 
      LEFT JOIN SISCEP CEP ON CLI.NrCEP = CEP.NrCEP  
      WHERE CLI.CdInscricao = @cnpj;`


    try {
      var retorno;
      (async function () {
        retorno = await db.query(sql);

        if (retorno.length == 0) {
          //console.log(agora() + ' ' + 'buscaCliente Consulta SQL não retornou nenhum registro');
          reject('Cliente não encontrado para: ' + cnpj)
        } else {
          resolve(retorno[0])
        }
      })();
    } catch (e) {
      console.error("📋 " + e)
      reject(e)
    }

  })
}//buscaCliente
//-------------------------------------
async function buscaDestinatario(cnpj) {

  if (cnpj.length === 11) {
    //cpf
    reject({ cpf: true });
    return;
  }

  return new Promise((resolve, reject) => {
    const fetchNcmListFromSefaz = async () => {
      const url = `https://minhareceita.org/${cnpj}`;
      let response = await fetch(url, { method: 'GET' });
      const dados = await response.json();
      return dados;
    };

    try {
      var retorno;
      (async function () {
        retorno = await fetchNcmListFromSefaz();
        if (retorno.cnpj) {
          resolve(retorno)
        } else {
          reject(retorno.message)
        }
      })();
    } catch (e) {
      console.error("📋 " + e)
      reject(e)
    }

  })
}//buscaCliente
//-------------------------------------

async function capacidadeVeiculo(placa) {

  return new Promise((resolve, reject) => {

    let sql = `DECLARE @NrPlaca VARCHAR(8);
SET @NrPlaca = '${placa}';

SELECT VlCapacIdeal, QtAltura, QtLargura, QtComprimento
FROM (
    SELECT 'SISVeicu' AS Source, VlCapacIdeal, QtAltura, QtLargura, QtComprimento
    FROM [softran_translovato].[dbo].[SISVeicu]
    WHERE NrPlaca = @NrPlaca
    UNION ALL
    SELECT 'GTCTerc' AS Source, VlCapacidadeIdeal, QtAltura, QtLargura, QtComprimento
    FROM [softran_translovato].[dbo].[GTCTerc]
    WHERE NrPlaca = @NrPlaca
) AS Combined
WHERE Source = 'SISVeicu' OR NOT EXISTS (SELECT 1 FROM [softran_translovato].[dbo].[SISVeicu] WHERE NrPlaca = @NrPlaca);
`


    try {
      var retorno;
      (async function () {
        retorno = await db.query(sql);

        if (retorno.length == 0) {
          //console.log(agora() + ' ' + 'Consulta SQL não retornou nenhum registro em capacidadeVeiculo');
          reject(' Capaciade veículo não cadastrada!')
        } else {
          resolve(retorno[0].DsEntidade)
        }
      })();
    } catch (e) {
      console.error("📋 " + e)
      reject(e)
    }

  })
}//capacidadeVeiculo
//-----------------------------------------------------------
async function capacidadeVeiculoSocket(ws, dieison) {

  let uuid = '';
  try {
    uuid = dieison.uuid;
  } catch (e) {
    console.log('📋 - - - - - - - - - -')
    console.log('📋 uuid não repassado')
    console.log('📋 - - - - - - - - - -')
  }


  let dados = {};
  try {
    dados = dieison['veiculo/capacidade'];
  } catch (e) {
    console.log('📋 Error dieison[veiculo/capacidade]')
    console.eror(e)
    e.uuid = 0
    ws.send(`"{'res_error' : ${e}}"`);
    return;
  }

  let empresa;
  try {
    empresa = dados.empresa;
  } catch (e) {
    console.log('📋 capacidadeVeiculoSocket dados.empresa')
    console.error(e)
    e.uuid = uuid
    ws.send(`"{'res_error' : ${e}}"`);
    return;
  }


  capacidadeVeiculo(empresa)
    .then(retorno => {
      let dados = {
        'veiculo/capacidade': retorno,
        'uuid': uuid
      }
      ws.send(JSON.stringify(dados))

    })
    .catch(e => {
      console.log('capacidadeVeiculoSocket')
      console.log(e)
      e.uuid = uuid
      ws.send(`"{'res_error' : ${e}}"`);
    })

}

//--------------------------------------
async function buscaCep(cep, empresa) {

  return new Promise((resolve, reject) => {

    let sql = `
DECLARE @cep VARCHAR(15);
DECLARE @empresa INT;
DECLARE @cepFormatado VARCHAR(15);

SET @cep = ${cep};
SET @empresa = ${empresa};
SET @cepFormatado = @cep;

-- Primeira tentativa de consulta com o CEP completo
IF EXISTS (
    SELECT 1 
    FROM softran_translovato.dbo.SISCEP CEP 
    WHERE CEP.NrCep = @cep
)
BEGIN
    -- Executa a consulta original
    SELECT 
        CEP.DsLogradouros,
        CEP.DsTipo,
        CEP.DsLocal,
        CEP.DsUf,
        ISNULL(CEP.CdRotaEntrega, 0) AS CdRotaEntrega,
        (SELECT M.Dsapelido 
         FROM softran_translovato.dbo.SISempre M WITH (NOLOCK), 
              softran_translovato.dbo.SISCEP C WITH (NOLOCK), 
              softran_translovato.dbo.SISRegia Z WITH (NOLOCK) 
         WHERE C.NrCep = CEP.NrCep 
           AND Z.CdRegiao = C.CdRegiao 
           AND M.CdEmpresa = Z.CdEmpresa
        ) AS Praca,          
        (SELECT M.Dsapelido
         FROM softran_translovato.dbo.SISempre M WITH (NOLOCK) 
         WHERE M.CdEmpresa = ISNULL(
            (SELECT CdEmpCentralizadora   
             FROM softran_translovato.dbo.ESP31906 
             WHERE CdEmpresaEmitente = @empresa 
               AND CdEmpresaDestino = 
                   (SELECT M.CdEmpresa 
                    FROM softran_translovato.dbo.SISempre M WITH (NOLOCK), 
                         softran_translovato.dbo.SISCEP C WITH (NOLOCK), 
                         softran_translovato.dbo.SISRegia Z WITH (NOLOCK) 
                    WHERE C.NrCep = CEP.NrCep 
                      AND Z.CdRegiao = C.CdRegiao 
                      AND M.CdEmpresa = Z.CdEmpresa)
            ), '')
        ) AS Cd
    FROM softran_translovato.dbo.SISCEP CEP 
    WHERE CEP.NrCep = @cep;
END
ELSE
BEGIN
    -- Formata o CEP substituindo os três últimos caracteres por '000'
    SET @cepFormatado = LEFT(@cep, LEN(@cep) - 3) + '000';

    -- Executa a consulta novamente com o CEP formatado
    SELECT 
        CEP.DsLogradouros,
        CEP.DsTipo,
        CEP.DsLocal,
        CEP.DsUf,
        ISNULL(CEP.CdRotaEntrega, 0) AS CdRotaEntrega,
        (SELECT M.Dsapelido 
         FROM softran_translovato.dbo.SISempre M WITH (NOLOCK), 
              softran_translovato.dbo.SISCEP C WITH (NOLOCK), 
              softran_translovato.dbo.SISRegia Z WITH (NOLOCK) 
         WHERE C.NrCep = CEP.NrCep 
           AND Z.CdRegiao = C.CdRegiao 
           AND M.CdEmpresa = Z.CdEmpresa
        ) AS Praca,          
        (SELECT M.Dsapelido
         FROM softran_translovato.dbo.SISempre M WITH (NOLOCK) 
         WHERE M.CdEmpresa = ISNULL(
            (SELECT CdEmpCentralizadora   
             FROM softran_translovato.dbo.ESP31906 
             WHERE CdEmpresaEmitente = @empresa 
               AND CdEmpresaDestino = 
                   (SELECT M.CdEmpresa 
                    FROM softran_translovato.dbo.SISempre M WITH (NOLOCK), 
                         softran_translovato.dbo.SISCEP C WITH (NOLOCK), 
                         softran_translovato.dbo.SISRegia Z WITH (NOLOCK) 
                    WHERE C.NrCep = CEP.NrCep 
                      AND Z.CdRegiao = C.CdRegiao 
                      AND M.CdEmpresa = Z.CdEmpresa)
            ), '')
        ) AS Cd
    FROM softran_translovato.dbo.SISCEP CEP 
    WHERE CEP.NrCep = @cepFormatado;
END
;
  `

    try {
      var retorno;
      (async function () {
        retorno = await db.query(sql);

        if (retorno.length == 0) {
          console.log(agora() + ' ' + 'buscaCep Consulta SQL não retornou nenhum registro');
          reject('Cep não encontrado!')
        } else {
          resolve(retorno)
        }
      })();
    } catch (e) {
      console.warn(e)
      reject(e)
    }

  })
}//buscaCep

async function buscaCepSocket(ws, dieison) {

  let uuid = '';
  try {
    uuid = dieison.uuid;
  } catch (e) {
    console.log('- - - - - - - - - -')
    console.log('uuid não repassado')
    console.log('- - - - - - - - - -')
  }


  let dados = {};
  try {
    dados = dieison['buscacep'];
  } catch (e) {
    console.log('Error dieison[buscacep]')
    console.log(e)
    e.uuid = 0
    ws.send(`"{'res_error' : ${e}}"`);
    return;
  }

  let empresa;
  try {
    empresa = dados.empresa;
  } catch (e) {
    console.log('buscacep dados.empresa')
    console.log(e)
    e.uuid = uuid
    ws.send(`"{'res_error' : ${e}}"`);
    return;
  }

  let cep;
  try {
    cep = dados.cep;
  } catch (e) {
    console.log('buscacep dados.cep')
    console.log(e)
    e.uuid = uuid
    ws.send(`"{'res_error' : ${e}}"`);
    return;
  }

  buscaCep(cep, empresa)
    .then(retorno => {
      console.log(retorno)
      let dados = {
        'buscacep': retorno,
        'uuid': uuid
      }
      ws.send(JSON.stringify(dados))

    })
    .catch(e => {
      console.log(e)
      if (e === 'Cep não encontrado!') {

      } else {
        e.uuid = uuid
        ws.send(`"{'res_error' : ${e}}"`);

      }
    })

}

//----------------------------------------------------------
async function descargaColetas(empresa) {
  return new Promise((resolve, reject) => {
    if (!empresa) {
      return reject('Empresa da DANFE não informada')
    }

    let sql = sqlDescargaColetas(empresa)

    try {
      var retorno;
      (async function () {
        retorno = await db.query(sql);
        if (retorno.length == 0) {
          console.log(agora() + ' ' + 'Consulta SQL não retornou nenhum registro');
          resolve({});
        } else {
          resolve(retorno)
        }
      })()

    } catch (e) {
      logger.warn(e)
      reject(e)
    }


  })

}//descargacoletas

//-----------------------------------------------------------
async function buscaDescargaColetasSocket(ws, dieison) {

  let uuid = '';
  try {
    uuid = dieison.uuid;
  } catch (e) {
    console.log('- - - - - - - - - -')
    console.log('uuid não repassado')
    console.log('- - - - - - - - - -')
  }


  let dados = {};
  try {
    dados = dieison['descargas/coletas'];
  } catch (e) {
    console.log('Error dieison[descargas/coletas]')
    console.log(e)
    e.uuid = 0
    ws.send(`"{'res_error' : ${e}}"`);
    return;
  }

  let empresa;
  try {
    empresa = dados.empresa;
  } catch (e) {
    console.log('descargaColetasSocket dados.empresa')
    console.log(e)
    e.uuid = uuid
    ws.send(`"{'res_error' : ${e}}"`);
    return;
  }


  descargaColetas(empresa)
    .then(retorno => {
      let dados = {
        'descargas/coletas': retorno,
        'uuid': uuid
      }
      ws.send(JSON.stringify(dados))

    })
    .catch(e => {
      console.log('descargaColetasSocket')
      console.log(e)
      e.uuid = uuid
      ws.send(`"{'res_error' : ${e}}"`);
    })

}

//------------------------------------------------------------
async function dadosusuario(usuario) {
  return new Promise((resolve, reject) => {
    var sql = `
    SELECT  
    B.CdEmpresa, 
    C.DsApelido AS Empresa,
    A.CdFuncionario,
    A.DsApelido,
    B.DsNome AS Nome,
	P.InInfLocalExp ,
	P.InGerarEtiqNF
FROM softran_translovato.dbo.SISUsuFu A WITH (NOLOCK)
LEFT JOIN softran_translovato.dbo.SISFun B WITH (NOLOCK) ON A.CdFuncionario = B.CdFuncionario
LEFT JOIN softran_translovato.dbo.SISEmpre C WITH (NOLOCK) ON C.CdEmpresa = B.CdEmpresa
LEFT JOIN softran_translovato.dbo.SISFun D WITH (NOLOCK) ON D.CdFuncionario = A.CdFuncionario 
LEFT JOIN softran_translovato.dbo.SISPERNF P WITH (NOLOCK) ON A.CdPerfil = P.CdPerfil  
WHERE A.DsApelido = '${usuario}' 
AND D.FgDemitido = 0;
`;

    try {
      var retorno;
      (async function () {
        retorno = await db.query(sql);

        if (retorno[0].DsApelido == usuario) {
          return resolve(retorno[0]);
        } else {
          console.log('nome usuario passado diferente do recebido')
          return reject('nome usuario passado diferente do recebido')
        }

      })();

    } catch (ex) {
      return reject(e)
    }

  })

}//vdadosusuario

//------------------------------------------------------------  
async function loginpelosocket(ws, dieison) {

  let login = {};
  try {
    login = dieison.login;
  } catch (e) {
    console.log('Error JSON.parse(dieison.login)')
    console.log(e)
    ws.send(`"{'login_error' : ${e}}"`);
    return;
  }

  let uuid = '';
  try {
    uuid = dieison.uuid;
  } catch (e) {
    console.log('Error JSON.parse(dieison.uuid)')
    console.log(e)
    ws.send(`"{'login_error' : ${e}, 'uuid': ${uuid}}"`);
    return;
  }


  let usuario;
  try {
    usuario = String(login.usuario).toUpperCase();
  } catch (e) {
    console.log('String(login.usuario).toUpperCase()')
    console.log(e)
    ws.send(`"{'login_error' : ${e}, 'uuid': ${uuid}}"`);
    return;
  }

  let senha;
  try {
    senha = login.senha;
  } catch (e) {
    console.log('login.senha')
    console.log(e)
    ws.send(`"{'login_error' : ${e}, 'uuid': ${uuid}}"`);
    return;
  }

  console.log(agora() + ' ' + 'POST /LOGIN VIA SOCKET usuario: ' + usuario);


  if (usuario && senha) {
    validasenhalogin(usuario, senha)
      .then(valido => {
        if (valido === true) {
          console.log("Usuario: " + usuario + " validou.")
          console.log("Buscar dados.")

          dadosusuario(usuario)
            .then(dados => {
              try {
                let sendData = { 'login': dados, 'uuid': uuid }
                ws.send(JSON.stringify(sendData));
              } catch (e) {
                console.log('error ws.send: ' + e)
                ws.send(`"{'login_error' : ${e}, 'uuid': ${uuid}}"`);
              }
            })
            .catch(e => {
              ws.send(`"{'login_error' : ${e}, 'uuid': ${uuid}}"`);
              return;
            })

        } else {
          console.log(`Usuário ou senha inválidos -> ${usuario}`)
          let data = { 'login_error': 'Usuário ou senha invalidos', 'uuid': uuid }
          ws.send(JSON.stringify(data));
          return;
        }
      })
      .catch(e => {
        console.log(e)
        ws.send(`"{'login_error' : ${e}, 'uuid': ${uuid}}"`);
        return;

      })

  } else {
    console.log('Please enter Username and Password!')
    ws.send(`"{'login_error' : ${e}, 'uuid': ${uuid}}"`);

  }

}//loginviawebsocket


//-------------------------------------------------------------
async function loginpeloromaneiosocket(ws, dieison) {

  let login = {};
  try {
    login = dieison.loginpeloromaneio;
  } catch (e) {
    console.log('Error JSON.parse(dieison.loginpeloromaneio)')
    console.log(e)
    let data = { 'login_error': e, 'uuid': dieison.uuid }
    ws.send(JSON.stringify(data));
    return;
    return;
  }


  let uuid = '';
  try {
    uuid = dieison.uuid;
  } catch (e) {
    console.log('uuid não repassado')
  }



  let empresa;
  try {
    empresa = login.empresa;
  } catch (e) {
    console.log('login.empresa')
    console.log(e)
    e.uuid = uuid
    let data = { 'login_error': e, 'uuid': uuid }
    ws.send(JSON.stringify(data));
    return;
  }


  let romaneio;
  try {
    romaneio = login.romaneio;
  } catch (e) {
    console.log('login.romaneio')
    console.log(e)
    let data = { 'login_error': e, 'uuid': uuid }
    ws.send(JSON.stringify(data));
    return;
  }



  let placa;

  try {
    placa = login.placa;
  } catch (e) {
    console.log('login.placa')
    console.log(e)
    let data = { 'login_error': e, 'uuid': uuid }
    ws.send(JSON.stringify(data));
    return;
  }

  if (empresa && romaneio && placa) {
    validasenhaloginromaneio(empresa, placa, romaneio)
      .then(retorno => {

        if (retorno[0].NrCPFMotorista != '') {
          let dados = {
            'loginpeloromaneio': retorno, 'uuid': uuid
          }
          ws.send(JSON.stringify(dados));

        } else {
          console.warn('NrCPFMotorista não encontrado')
          let data = { 'login_error': 'NrCPFMotorista não encontrado', 'uuid': uuid }
          ws.send(JSON.stringify(data));
          return;
        }
      })
      .catch(e => {
        console.log(e)
        let data = { 'login_error': e, 'uuid': uuid }
        ws.send(JSON.stringify(data));
        return;
      })

  } else {
    console.log('Please enter Username and Password!')
    ws.send('Please enter Username and Password!').status(409);

  }

}//loginpeloromaneiosocket

//-------------------------------------------------------------------------------

async function coletaspeloRomaneio(empresa, placa, romaneio) {
  return new Promise((resolve, reject) => {
    if (!empresa) {
      return reject('empresa não informada');
    }

    if (!romaneio) {
      return reject('romaneio não informado');
    }

    if (!placa) {
      return reject('Placa não informada');
    }


    let sql = ""
    sql = `	use softran_translovato;
    
      SELECT 
      IT.NrColeta
      ,COL.CdInscricao 
      ,cli.DsEntidade
      from [softran_translovato].[dbo].[CCERoman] ROM
      LEFT JOIN [softran_translovato].[dbo].[CCERomIt] IT ON IT.InColetaEntrega = 0 and IT.cdempresa = ROM.cdempresa and IT.CdRomaneio = ROM.CdRomaneio  and IT.cdRota = ROM.cdRota 
      left join [softran_translovato].[dbo].[CCEColet] COL ON IT.CdEmpresa = COL.CdEmpresa  AND  IT.NRCOLETA = COL.NRCOLETA   
      LEFT JOIN [softran_translovato].[dbo].[SISCli]   CLI ON COL.CdInscricao = CLI.CdInscricao 
      WHERE ROM.CdEmpresa = ${empresa} 
      AND ROM.CdRomaneio = ${romaneio}  
      AND ROM.NrPlaca = '${placa}'  
      order by CLI.DsEntidade`


    try {
      var retorno;
      (async function () {
        retorno = await db.query(sql);

        if (retorno.length == 0) {
          console.log(agora() + ' ' + 'Consulta SQL não retornou nenhum registro');
          resolve({})
          return;
        } else {
          resolve(retorno);
        }
      })()

    } catch (e) {
      console.warn(e)
      reject(e)
    }

  })


}//coletaspeloRomaneio


function buscaColetaspeloRomaneioSocket(ws, dieison) {
  let coleta = {};
  try {
    coleta = dieison.coletas;
  } catch (e) {
    console.log('Error JSON.parse(dieison.coletas)')
    console.log(e)
    e.uuid = 0
    ws.send(`"{'login_error' : ${e}}"`);
    return;
  }


  let uuid = '';
  try {
    uuid = dieison.uuid;
  } catch (e) {
    console.log('uuid não repassado')
  }



  let empresa;
  try {
    empresa = coleta.empresa;
  } catch (e) {
    console.log('coleta.empresa')
    console.log(e)
    e.uuid = uuid
    ws.send(`"{'login_error' : ${e}}"`);
    return;
  }


  let romaneio;
  try {
    romaneio = coleta.romaneio;
  } catch (e) {
    console.log('coleta.romaneio')
    console.log(e)
    e.uuid = uuid
    ws.send(`"{'login_error' : ${e}}"`);
    return;
  }

  let placa;
  try {
    placa = coleta.placa;
  } catch (e) {
    console.log('coleta.placa')
    console.log(e)
    e.uuid = uuid
    ws.send(`"{'login_error' : ${e}}"`);
    return;
  }



  coletaspeloRomaneio(empresa, placa, romaneio)
    .then(retorno => {
      if (retorno.length == 0) {
        console.log(agora() + ' ' + 'Consulta SQL não retornou nenhum registro');
        return;
      } else {
        let dados = {
          'coletas': retorno,
          'uuid': uuid
        }
        ws.send(JSON.stringify(dados))
      }

    })
    .catch(e => {
      e.uuid = uuid
      ws.send(`"{'login_error' : ${e}}"`);
    })


}//buscacoletaspeloromaeniosocket

//--------------------------------------------------------------------------------

async function notapelachave(empresa, chave) {

  return new Promise((resolve, reject) => {
    if (!chave) {
      return reject('Chave da DANFE não informada')
    }

    if (!empresa) {
      return reject('Empresa da DANFE não informada')
    }


    let sql = `
          declare @chave varchar(50);
        declare @empresa int;
        
        set @empresa = ${empresa};
        set @chave = '${chave}';
        
        declare	@Tbdados table (
          Chave                varchar(45)  default(''),
          Cnpj                 varchar(15)  default(''),
          Remetente            varchar(100) default(''),
          Nota	               varchar(15)  default(''),
          Serie	               varchar(6)   default(''),
          Volumes  	           int  default(''),
          Peso                 numeric(14,2) default(0),
          M3                   numeric(14,2) default(0),
          CdNatureza             int,
          Natureza             varchar(40) default(''),
          Pedido	             varchar(50)  default(''),
          NrTransporte         varchar(100) default(''),
          NrIdentificacaoCarga varchar(100) default(''),
          CnpjDestinatario     varchar(15)  default(''),
          Destinatario	       varchar(100) default(''),
          CepEntrega           INT,
          Endereco      	     varchar(150) default(''),
          Destino              varchar(100) default(''),
          UF                   varchar(4) default('') ,
          Praca                varchar(4) default('') ,
          Rota                 varchar(4) default('') ,
          Sigla                int ,
          CD                   varchar(4) default(''),
          Obs                  text,
          Status               int default(0)
          )
        
        -- Insert dados 
        insert	into @Tbdados   (Chave,Cnpj,Nota,Serie,Volumes,Peso,M3,CdNatureza,Natureza,Pedido,NrTransporte,NrIdentificacaoCarga,CepEntrega,Endereco,CnpjDestinatario,Destino,UF,Rota,Obs,Status)
        
        select 
        e.NrChaveAcessoNFe as 'Chave',
        E.CdRemetente as 'Cnpj', 
        E.nrnotafiscal as 'Nota',
        E.nrserie as 'Serie',
        --Convert(NUMERIC(4), E.qtvolume)  as 'Volumes',
        E.qtvolume  as 'Volumes',
        E.QtPeso as 'Peso',
        E.QtMetrosCubicos as 'M3',
        E.CdNatureza,
        NAT.DsNatureza,
        ISNULL(E.Dsmarca,'') as 'Pedido',
        ISNULL(E.NrTransporte,''),
        ISNULL(E.NrIdentificacaoCarga,''),
        E.NrCepEntrega as 'CepEntrega',
        E.DsEndereco as 'Endereco',
        E.CdDestinatario as 'CnpjDestinatario',
        G.DsLocal as 'Destino', 
        G.Dsuf as 'UF',
        right(E.cdrotaentrega,2) as Rota,
        E.DsObs as Obs,
        0 as 'Status'  
        FROM GTCNf E with (NoLock) 
        LEFT JOIN SISCEP G  with (NoLock) ON G.NrCep = E.NrCepEntrega 
        LEFT JOIN softran_translovato.dbo.GTCNatur NAT on NAT.CdNatureza = E.CdNatureza 
        where  e.NrChaveAcessoNFe = @chave
        
        --Atualiza 
        update	@Tbdados 
        set Remetente = (SELECT D.DsEntidade FROM SISCLI D with (NoLock) WHERE D.CdInscricao = Cnpj)
        
        update	@Tbdados 
        set Destinatario = (SELECT D.DsEntidade FROM SISCLI D with (NoLock) WHERE D.CdInscricao = CnpjDestinatario)
        
        update	@Tbdados 
        set Destinatario = (SELECT D.DsEntidade FROM SISCLI D with (NoLock) WHERE D.CdInscricao = CnpjDestinatario)
        
        update	@Tbdados 
        set Praca = 
        (select	M.Dsapelido
        from	SISempre M with (NoLock), SISCEP C with (NoLock),SISRegia Z with (NoLock) 
        where(C.nrcep = COALESCE(CepEntrega, ''))
        and Z.cdregiao = c.cdregiao 
        and  M.cdempresa = z.cdempresa)
        
        update	@Tbdados 
        set Praca = 
        (select	M.Dsapelido
        from	SISempre M with (NoLock), SISCEP C with (NoLock),SISRegia Z with (NoLock) 
        where(C.nrcep = COALESCE(CepEntrega, ''))
        and Z.cdregiao = c.cdregiao 
        and  M.cdempresa = z.cdempresa)
        
        update	@Tbdados 
        set Sigla = 
        (select	M.CdEmpresa
        from	SISempre M with (NoLock), SISCEP C with (NoLock),SISRegia Z with (NoLock) 
        where(C.nrcep = COALESCE(CepEntrega, ''))
        and Z.cdregiao = c.cdregiao 
        and  M.cdempresa = z.cdempresa)
        
        update	@Tbdados 
        set	CD = (select	M.Dsapelido 
        from  softran_translovato.dbo.SISempre M with (NoLock) 
        where M.cdempresa = isnull((SELECT CdEmpCentralizadora 
        FROM [softran_translovato].[dbo].[ESP31906] 
        WHERE CdEmpresaEmitente = @empresa AND CdEmpresaDestino = Sigla),Sigla))
        
        
        -- Lista os dados
        SELECT * FROM @Tbdados;`


    try {
      var retorno;
      (async function () {
        retorno = await db.query(sql);
        if (retorno.length == 0) {
          console.log(agora() + ' ' + 'buscaNotapelaChave Consulta SQL não retornou nenhum registro');
          reject('buscaNotapelaChave Consulta SQL não retornou nenhum registro!')
        } else {
          resolve(retorno)
        }
      })();
    } catch (e) {
      console.warn(e)
      reject(e)
    }

  })
}//notapelachave


async function notaspelocarro(empresa, placa) {

  return new Promise((resolve, reject) => {
    if (!empresa) {
      return reject('Empresa não informada')
    }

    if (!placa) {
      return reject('Placa do carro não informada')
    }



    let sql = `
    declare @empresa int;
  set @empresa = ${empresa};

DECLARE @Tbdados TABLE (
    Carro                VARCHAR(8)   DEFAULT(''),
    Cnpj                 VARCHAR(15)  DEFAULT(''),
    Remetente            VARCHAR(150) DEFAULT(''),
    Nota                 VARCHAR(15)  DEFAULT(''),
    Serie                VARCHAR(6)   DEFAULT(''),
    Pedido               VARCHAR(50)  DEFAULT(''),
    NrTransporte         VARCHAR(100) DEFAULT(''),
    NrIdentificacaoCarga VARCHAR(100) DEFAULT(''),
    Volumes              VARCHAR(15)  DEFAULT(''),
    CnpjDestinatario     VARCHAR(15)  DEFAULT(''),
    Destinatario         VARCHAR(150) DEFAULT(''),
    Endereco             VARCHAR(150) DEFAULT(''),
    Destino              VARCHAR(150) DEFAULT(''),
    UF                   VARCHAR(4) DEFAULT(''),
    Praça                VARCHAR(4) DEFAULT(''),
    Rota                 VARCHAR(4) DEFAULT(''),
    Sigla                INT,
    CD                   VARCHAR(4) DEFAULT('')
);

-- Insert dados 
INSERT INTO @Tbdados (Carro, Cnpj, Remetente, Nota, Serie, Pedido, NrTransporte, NrIdentificacaoCarga, Volumes, CnpjDestinatario,Destinatario, Endereco, Destino, UF, Praça, Rota, Sigla)
SELECT DISTINCT 
    A.NrPlaca AS Carro,
    B.CdInscricao AS Cnpj, 
    D.DsEntidade AS 'Remetente',
    E.nrnotafiscal AS Nota,
    E.nrserie AS Serie,
    E.Dsmarca AS Pedido,
    E.NrTransporte,
    E.NrIdentificacaoCarga,
    CONVERT(NUMERIC(4), E.qtvolume) AS 'Volumes',
    F.CdInscricao as 'CnpjDestinatario',
    F.DsEntidade AS 'Destinatario',
    E.DsEndereco AS Endereco,
    G.DsLocal AS Destino,
    G.Dsuf AS 'UF',
    (SELECT M.Dsapelido
     FROM SISempre M WITH (NOLOCK), SISCEP C WITH (NOLOCK), SISRegia Z WITH (NOLOCK)
     WHERE C.nrcep = COALESCE(E.nrcepentrega, '')
     AND Z.cdregiao = C.cdregiao
     AND M.cdempresa = Z.cdempresa) AS Praça,
    RIGHT(E.cdrotaentrega, 2) AS Rota,
    (SELECT M.CdEmpresa 
     FROM softran_translovato.dbo.SISempre M WITH (NOLOCK), softran_translovato.dbo.SISCEP C WITH (NOLOCK), softran_translovato.dbo.SISRegia Z WITH (NOLOCK)
     WHERE C.nrcep = E.nrcepentrega
     AND Z.cdregiao = C.cdregiao
     AND M.cdempresa = Z.cdempresa) AS Sigla
FROM CODMOV A WITH (NOLOCK), CODMOVIT B WITH (NOLOCK), SISCLI D WITH (NOLOCK), GTCNf E WITH (NOLOCK), SISCLI F WITH (NOLOCK), SISCEP G WITH (NOLOCK), EXPLOTNF H WITH (NOLOCK)
WHERE 
    A.cdempresa = @Empresa
    AND A.intipomovimento = 52
    AND A.NrPlaca = '${placa}'
    AND B.cdsequencia = A.cdsequencia
    AND B.cdinscricao = D.cdinscricao
    AND F.cdinscricao = E.cddestinatario
    AND ISDATE(A.dtfechamento) = 0
    AND B.cdinscricao = E.cdremetente
    AND E.nrnotafiscal = B.nrnotafiscal
    AND E.nrserie = B.nrserie
    AND H.cdremetente = E.cdremetente
    AND H.nrnotafiscal = E.nrnotafiscal
    AND H.nrserie = E.nrserie
    AND H.cdempresaemitente = A.cdempresa
    AND G.nrcep = E.nrcepentrega
    AND B.cdempresa = A.cdempresa
ORDER BY D.dsentidade;

-- Atualiza
UPDATE @Tbdados
SET CD = (SELECT M.Dsapelido
          FROM softran_translovato.dbo.SISempre M WITH (NOLOCK)
          WHERE M.cdempresa = ISNULL((SELECT CdEmpCentralizadora 
                                      FROM [softran_translovato].[dbo].[ESP31906]
                                      WHERE CdEmpresaEmitente = @empresa AND CdEmpresaDestino = Sigla), Sigla));

-- Lista os dados
SELECT * FROM @Tbdados;
`;

    try {
      var retorno;
      (async function () {
        retorno = await db.query(sql);
        if (retorno.length == 0) {
          console.log(agora() + ' ' + 'buscaNotaspeloCarro Consulta SQL não retornou nenhum registro');
          reject('buscaNotaspeloCarro Consulta SQL não retornou nenhum registro!')
        } else {
          resolve(retorno)
        }
      })();
    } catch (e) {
      console.warn(e)
      reject(e)
    }

  })
}//



async function buscaNotapelaChaveSocket(ws, dieison) {

  let uuid = '';
  try {
    uuid = dieison.uuid;
  } catch (e) {
    console.log('- - - - - - - - - -')
    console.log('uuid não repassado')
    console.log('- - - - - - - - - -')
  }


  let dados = {};
  try {
    dados = dieison['nota/chave'];
  } catch (e) {
    console.log('Error dieison[nota/chave]')
    console.log(e)
    e.uuid = 0
    ws.send(`"{'res_error' : ${e}}"`);
    return;
  }


  let empresa;
  try {
    empresa = dados.empresa;
  } catch (e) {
    console.log('dados.empresa')
    console.log(e)
    e.uuid = uuid
    ws.send(`"{'res_error' : ${e}}"`);
    return;
  }

  let chave;
  try {
    chave = dados.chave;
  } catch (e) {
    console.log('dados.chave')
    console.log(e)
    e.uuid = uuid
    ws.send(`"{'res_error' : ${e}}"`);
    return;
  }


  try {
    notapelachave(empresa, chave)
      .then(retorno => {
        if (retorno.length == 0) {
          console.log(agora() + ' ' + 'Consulta SQL não retornou nenhum registro');
          return;
        } else {
          let dados = {
            'nota/chave': retorno,
            'uuid': uuid
          }
          ws.send(JSON.stringify(dados))
        }
      })
      .catch(e => {
        let dados = {
          'res_error': e,
          'uuid': uuid
        }
        ws.send(JSON.stringify(dados));
      })

  } catch (e) {
    let dados = {
      'res_error': e,
      'uuid': uuid
    }
    ws.send(JSON.stringify(dados));
  }

}//buscaNotapelaChaveSocket
//---------------------------------------------------------------  


async function notapelonumero(empresa, cnpj, nota, serie) {

  return new Promise((resolve, reject) => {

    let sql = `
      declare @cnpj varchar(15);
      declare @nota varchar(15);
      declare @serie varchar(6);
      declare @empresa int;
    
    set @empresa = ${empresa};
    set @cnpj = '${cnpj}';
    set @nota = '${nota}';
    set @serie = '${serie}';
    
    declare	@Tbdados table (
      Chave                varchar(45)  default(''),
      Cnpj                 varchar(15)  default(''),
      Remetente            varchar(100) default(''),
      DsEndereco           varchar(100) default(''),
      DsCidade             varchar(100) default(''),
      DsUf                 varchar(3) default(''),
      DsCep                int,
      Nota	               varchar(15)  default(''),
      Serie	               varchar(6)   default(''),
      Volumes  	           int  default(''),
      Peso                 numeric(14,2) default(0),
      M3                   numeric(14,2) default(0),
      CdNatureza             int,
      Natureza             varchar(40) default(''),
      Pedido	             varchar(50)  default(''),
      NrTransporte         varchar(100) default(''),
      NrIdentificacaoCarga varchar(100) default(''),
      CnpjDestinatario     varchar(15)  default(''),
      Destinatario	       varchar(100) default(''),
      CepEntrega           INT,
      Endereco      	     varchar(150) default(''),
      Destino              varchar(100) default(''),
      UF                   varchar(4) default('') ,
      Praca                varchar(4) default('') ,
      Rota                 varchar(4) default('') ,
      Sigla                int ,
      CD                   varchar(4) default(''),
      Obs                  text,
      Status               int default(0)
      )
    
    -- Insert dados 
    insert	into @Tbdados   (Chave,Cnpj,Remetente,DsEndereco,DsCep,Nota,Serie,Volumes,Peso,M3,CdNatureza,Natureza,Pedido,NrTransporte,NrIdentificacaoCarga,CepEntrega,Endereco,CnpjDestinatario,Destino,UF,Rota,Obs,Status)
    
    select 
    e.NrChaveAcessoNFe as 'Chave',
    E.CdRemetente as 'Cnpj', 
    CLI.DsEntidade as 'Remetente',
    CLI.DsEndereco as 'DsEndereco',
    CLI.NrCEP as 'DsCep',
    E.nrnotafiscal as 'Nota',
    E.nrserie as 'Serie',
    --Convert(NUMERIC(4), E.qtvolume)  as 'Volumes',
    E.qtvolume  as 'Volumes',
    E.QtPeso as 'Peso',
    E.QtMetrosCubicos as 'M3',
  E.CdNatureza,
  NAT.DsNatureza,
    ISNULL(E.Dsmarca,'') as 'Pedido',
    ISNULL(E.NrTransporte,''),
    ISNULL(E.NrIdentificacaoCarga,''),
    E.NrCepEntrega as 'CepEntrega',
    E.DsEndereco as 'Endereco',
    E.CdDestinatario as 'CnpjDestinatario',
    G.DsLocal as 'Destino', 
    G.Dsuf as 'UF',
    right(E.cdrotaentrega,2) as Rota,
    E.DsObs as Obs,
    0 as 'Status'  
    FROM GTCNf E with (NoLock) 
    LEFT JOIN SISCEP G  with (NoLock) ON G.NrCep = E.NrCepEntrega 
  LEFT JOIN softran_translovato.dbo.GTCNatur NAT on NAT.CdNatureza = E.CdNatureza 
  LEFT JOIN softran_translovato.dbo.SISCLI CLI on e.CdRemetente = CLI.CdInscricao  
  where  e.CdRemetente = @cnpj 
    and E.nrnotafiscal = @nota 
    and E.nrserie = @serie 
    
    --Atualiza 
    update	@Tbdados 
    set DsCidade = (SELECT DsLocal FROM SISCEP D with (NoLock) WHERE D.NrCep = DsCep)


    update	@Tbdados 
    set DsUF = (SELECT DsUf FROM SISCEP D with (NoLock) WHERE D.NrCep = DsCep)
    
    update	@Tbdados 
    set Destinatario = (SELECT D.DsEntidade FROM SISCLI D with (NoLock) WHERE D.CdInscricao = CnpjDestinatario)
    
    update	@Tbdados 
    set Destinatario = (SELECT D.DsEntidade FROM SISCLI D with (NoLock) WHERE D.CdInscricao = CnpjDestinatario)
    
    update	@Tbdados 
    set Praca = 
    (select	M.Dsapelido
    from	SISempre M with (NoLock), SISCEP C with (NoLock),SISRegia Z with (NoLock) 
    where(C.nrcep = COALESCE(CepEntrega, ''))
    and Z.cdregiao = c.cdregiao 
    and  M.cdempresa = z.cdempresa)
    
    update	@Tbdados 
    set Praca = 
    (select	M.Dsapelido
    from	SISempre M with (NoLock), SISCEP C with (NoLock),SISRegia Z with (NoLock) 
    where(C.nrcep = COALESCE(CepEntrega, ''))
    and Z.cdregiao = c.cdregiao 
    and  M.cdempresa = z.cdempresa)
    
    update	@Tbdados 
    set Sigla = 
    (select	M.CdEmpresa
    from	SISempre M with (NoLock), SISCEP C with (NoLock),SISRegia Z with (NoLock) 
    where(C.nrcep = COALESCE(CepEntrega, ''))
    and Z.cdregiao = c.cdregiao 
    and  M.cdempresa = z.cdempresa)
    
    update	@Tbdados 
    set	CD = (select	M.Dsapelido 
    from  softran_translovato.dbo.SISempre M with (NoLock) 
    where M.cdempresa = isnull((SELECT CdEmpCentralizadora 
    FROM [softran_translovato].[dbo].[ESP31906] 
    WHERE CdEmpresaEmitente = @empresa AND CdEmpresaDestino = Sigla),Sigla))
    
    
    -- Lista os dados
    SELECT * FROM @Tbdados;`


    try {
      var retorno;
      (async function () {
        retorno = await db.query(sql);
        if (retorno.length == 0) {
          console.log(agora() + ' ' + 'buscaNotapeloNumero Consulta SQL não retornou nenhum registro');
          reject('Nota não encontrada!')
        } else {
          resolve(retorno)
        }
      })();
    } catch (e) {
      console.warn(e)
      reject(e)
    }

  })
}//notapelonumero


async function buscaNotapeloNumeroSocket(ws, dieison) {
  let uuid = '';
  try {
    uuid = dieison.uuid;
  } catch (e) {
    console.log('- - - - - - - - - -')
    console.log('uuid não repassado')
    console.log('- - - - - - - - - -')
  }


  let dados = {};
  try {
    dados = dieison['nota/numero'];
  } catch (e) {
    console.log('Error dieison[nota/numero]')
    console.log(e)
    e.uuid = 0
    ws.send(`"{'res_error' : ${e}}"`);
    return;
  }




  let empresa;
  try {
    empresa = dados.empresa;
  } catch (e) {
    console.log('nota.empresa')
    console.log(e)
    e.uuid = uuid
    ws.send(`"{'login_error' : ${e}}"`);
    return;
  }

  let cnpj;
  try {
    cnpj = dados.cnpj;
  } catch (e) {
    console.log('nota.cmpj')
    console.log(e)
    e.uuid = uuid
    ws.send(`"{'login_error' : ${e}}"`);
    return;
  }


  let nota;
  try {
    nota = dados.nota;
  } catch (e) {
    console.log('nota.nota')
    console.log(e)
    e.uuid = uuid
    ws.send(`"{'login_error' : ${e}}"`);
    return;
  }


  let serie;
  try {
    serie = dados.serie;
  } catch (e) {
    console.log('nota.serie')
    console.log(e)
    e.uuid = uuid
    ws.send(`"{'login_error' : ${e}}"`);
    return;
  }

  try {
    notapelonumero(empresa, cnpj, nota, serie)
      .then(retorno => {
        if (retorno.length > 0) {
          let dados = {
            'nota/numero': retorno,
            'uuid': uuid
          }
          ws.send(JSON.stringify(dados))
        }
      })
      .catch(e => {
        let dados = {
          'res_error': e,
          'uuid': uuid
        }
        ws.send(JSON.stringify(dados));
      })
  } catch (e) {
    let dados = {
      'res_error': e,
      'uuid': uuid
    }
    ws.send(JSON.stringify(dados));
  }


}//buscaNotapelonumerosocket 


function buscaNotasVeiculoSocket(ws, dieison) {

  let uuid = '';
  try {
    uuid = dieison.uuid;
  } catch (e) {
    console.log('- - - - - - - - - -')
    console.log('uuid não repassado')
    console.log('- - - - - - - - - -')
  }


  let dados = {};
  try {
    dados = dieison['notas/veiculo'];
  } catch (e) {
    console.log('Error dieison[notas/veiculo]')
    console.log(e)
    e.uuid = 0
    ws.send(`"{'res_error' : ${e}}"`);
    return;
  }

  let empresa;
  try {
    empresa = dados.empresa;
  } catch (e) {
    console.log('notas/veiculo')
    console.log(e)
    e.uuid = uuid
    ws.send(`"{'login_error' : ${e}}"`);
    return;
  }

  let placa;
  try {
    placa = dados.placa;
  } catch (e) {
    console.log('notas/veiculo')
    console.log(e)
    e.uuid = uuid
    ws.send(`"{'login_error' : ${e}}"`);
    return;
  }


  try {
    notaspelocarro(empresa, placa)
      .then(retorno => {

        if (retorno.length > 0) {
          let dados = {            
            'notas/veiculo': retorno,
            'uuid': uuid
          }
          ws.send(JSON.stringify(dados))
        }
      })
      .catch(e => {
        let dados = {
          'res_error': e,
          'uuid': uuid
        }
        ws.send(JSON.stringify(dados));
      })
  } catch (e) {
    let dados = {
      'res_error': e,
      'uuid': uuid
    }
    ws.send(JSON.stringify(dados));
  }



}//


async function finalizabuscaDadosNotaManual(dados, ws) {

  buscaCep(dados.cepentrega, dados.empresa)
    .then(retorno2 => {
      if (retorno2) {
        try {
          dados.endereco = retorno2[0].DsTipo + " " + retorno2[0].DsLogradouros;
          dados.destino = retorno2[0].DsLocal;
          dados.uf = retorno2[0].DsUf;
          dados.praca = retorno2[0].Praca;
          dados.rota = retorno2[0].CdRotaEntrega;
          dados.sigla = 0;
          dados.cd = retorno2[0].Cd;
          if (!dados.cd) {
            dados.cd = '';
          }

        } catch (error) {
          console.warn("Erro em buscaCep de X para")
          console.error(error)
        }

        //criar nota
        try {
          let necessario = {
            'empresa': dados.empresa,
            'carro': dados.carro,
            'romaneio': dados.romaneio,
            'Cnpj': dados.cnpj,
            'Remetente': dados.remetente,
            'CnpjDestinatario': dados.cnpjdestinatario,
            "Destinatario": dados.destinatario,
            "Endereco": dados.endereco,
            "Destino": dados.destino,
            'UF': dados.uf,
            'Nota': dados.nota,
            'Serie': dados.serie,
            'chave': "0",
            'Volumes': dados.volumes,
            'Peso': dados.peso,
            'M3': dados.m3,
            "Pedido": dados.pedido,
            "NrTransporte": '',
            "NrIdentificacaoCarga": '',
            "CepEntrega": dados.cepentrega,
            'Cdnatureza': '',
            'Dsnatureza': '',
            'Praca': dados.praca,
            'Rota': dados.rota,
            "Sigla": dados.sigla,
            'CD': dados.cd,
            "Obs": '',
            'Status': 0,
            'lote': String(dados.empresa) + String(dados.carro) + String(dados.romaneio)
          }

          //console.log(necessario)

          let dados_ret = {
            'nota/manual': necessario,
            'uuid': dados.uuid
          }
          console.log(" >> devolvendo dados CRIARNOTA para: " + dados.uuid)
          ws.send(JSON.stringify(dados_ret))

        } catch (e) {
          console.log(e)
          let dadosErr = {
            'res_error': 'Erro ao criar JSON em buscaDadosNotaManual: ' + e,
            'uuid': dados.uuid
          }
          ws.send(JSON.stringify(dadosErr));

        }


      } else {
        let dadosErr = {
          'res_error': 'CEP não cadastrado na Transportadora',
          'uuid': dados.uuid
        }
        ws.send(JSON.stringify(dadosErr));

      }
    })
    .catch(e => {
      let dadosErr = {
        'res_error': e,
        'uuid': dados.uuid
      }
      ws.send(JSON.stringify(dadosErr));
    })




}

//----------------------------------------------------------------

async function buscaDadosNotaManual(ws, dieison) {

  let uuid = '';
  try {
    uuid = dieison.uuid;
  } catch (e) {
    console.log('- - - - - - - - - -')
    console.log('uuid não repassado')
    console.log('- - - - - - - - - -')
  }


  let dados = {};
  try {
    dados = dieison['nota/manual'];
  } catch (e) {
    console.log('Error dieison[nota/manual]')
    console.log(e)
    e.uuid = 0
    ws.send(`"{'res_error' : ${e}}"`);
    return;
  }

  dados.uuid = uuid

  let empresa;
  try {
    empresa = dados.empresa;
  } catch (e) {
    console.log('nota.empresa')
    console.log(e)
    e.uuid = 0
    ws.send(`"{'res_error' : 'empresa não informada'}"`);
    return;
  }

  dados.empresa = empresa

  let carro;
  try {
    carro = dados.carro;
  } catch (e) {
    console.log('nota.carro')
    console.log(e)
    e.uuid = 0
    ws.send(`"{'res_error' : 'carro não informado'}"`);
    return;
  }

  dados.carro = carro

  let romaneio;
  try {
    romaneio = dados.romaneio;
  } catch (e) {
    console.log('nota.romaneio')
    console.log(e)
    e.uuid = 0
    ws.send(`"{'res_error' : 'romaneio não informado'}"`);
    return;
  }

  dados.romaneio = romaneio

  let cnpj;
  try {
    cnpj = dados.cnpj;
  } catch (e) {
    console.log('nota.cnpj')
    console.log(e)
    e.uuid = 0
    ws.send(`"{'res_error' : 'Cnpj do Remetnte não informado'}"`);
    return;
  }


  let cnpjdestinatario;
  try {
    cnpjdestinatario = dados.cnpjdestinatario;
  } catch (e) {
    console.log('nota.cnpjdestinatario')
    console.log(e)
    e.uuid = 0
    ws.send(`"{'res_error' : 'Cnpj não informado'}"`);
    return;
  }

  let nota;
  try {
    nota = dados.nota;
  } catch (e) {
    console.log('nota.Nota')
    console.log(e)
    e.uuid = 0
    ws.send(`"{'res_error' : 'Nota não informada'}"`);
    return;
  }


  let serie;
  try {
    serie = dados.serie;
  } catch (e) {
    console.log('nota.Serie')
    console.log(e)
    e.uuid = 0
    ws.send(`"{'res_error' : 'Serie não informada'}"`);
    return;
  }


  let volumes;
  try {
    volumes = dados.volumes;
  } catch (e) {
    console.log('nota.Volumes')
    console.log(e)
    e.uuid = 0
    ws.send(`"{'res_error' : 'Volumes não informado'}"`);
    return;
  }


  let cepentrega;
  try {
    cepentrega = dados.cepentrega
  } catch (error) {

  }


  console.log(dados)

  try {
    buscaCliente(cnpj)
      .then(retorno => {
        if (retorno) {
          dados.remetente = retorno.DsEntidade
          //console.log("Remetente OK: " + dados.remetente)

          buscaCliente(cnpjdestinatario)
            .then(retorno => {
              if (retorno.NrCEP) {
                dados.cepentrega = retorno.NrCEP;
                dados.destinatario = retorno.DsEntidade;
                dados.cnpjdestinatario = cnpjdestinatario;
                //console.log(dados)
                finalizabuscaDadosNotaManual(dados, ws)
                return;
              } else {
                console.log("Destinatario sem CEP na base do cliente")
                buscaDestinatario(cnpjdestinatario)
                  .then(dados2 => {
                    dados.cepentrega = dados2.cep;
                    dados.destinatario = retorno.razao_social;
                    dados.cnpjdestinatario = cnpjdestinatario;
                    //console.log(dados)
                    finalizabuscaDadosNotaManual(dados, ws)
                  })
                  .catch(err => {
                    let dadosErr = {
                      'res_error': err,
                      'uuid': uuid
                    }
                    ws.send(JSON.stringify(dadosErr));
                  })
              }
            })
            .catch(e => {
              console.log("📋 Destinatario não cadastrado na base do cliente. Buscar SEfaz")
              buscaDestinatario(cnpjdestinatario)
                .then(dados2 => {
                  dados.cepentrega = dados2.cep;
                  dados.destinatario = dados2.razao_social;
                  dados.cnpjdestinatario = cnpjdestinatario;
                  finalizabuscaDadosNotaManual(dados, ws)
                })
                .catch(err => {

                  if (err.cpf = true) {
                    if (dados.cepentrega) {
                      dados.destinatario = ""
                      finalizabuscaDadosNotaManual(dados, ws)
                    } else {
                      let dados_ret = {
                        'nota/manual/cep': "Cep necessário",
                        'uuid': dados.uuid
                      }
                      ws.send(JSON.stringify(dados_ret));

                    }
                  } else {
                    let dadosErr = {
                      'res_error': err,
                      'uuid': uuid
                    }
                    ws.send(JSON.stringify(dadosErr));
                  }

                })


            })



        } else {
          console.log('nota.remetente')
          console.log(e)
          e.uuid = 0
          ws.send(`"{'res_error' : 'Remetente não encontrado na base de dados'}"`);
          return;
        }
      })
      .catch(e => {
        let dadosErr = {
          'res_error': e,
          'uuid': uuid
        }
        ws.send(JSON.stringify(dadosErr));
      })


  } catch (e) {
    let dadosErr = {
      'res_error': e,
      'uuid': uuid
    }
    ws.send(JSON.stringify(dadosErr));
  }

}//buscaDadosNotaManual


async function getCDporCep(cep, empresa) {

  return new Promise((resolve, reject) => {
    if (!cep) {
      reject("Cep não informado")
      return;
    }

    if (!empresa) {
      reject("Empresa não informada")
      return;
    }

    let sql = `
      USE softran_translovato
  
      declare @cep int
      DECLARE @cdempresa int
      
      set @cdempresa = ${empresa}
      set @cep = ${cep}
      
      Select DISTINCT e.dsApelido as ROTA,
    isnull((select	M.Dsapelido
          from  softran_translovato.dbo.SISempre M with (NoLock) 
          where M.cdempresa = esp.CdEmpCentralizadora),'') AS CD,
          a.dslocal as 'CIDADE'  
      From softran_translovato.dbo.Siscep a 
      Left Join softran_translovato.dbo.SisRegia r On r.CdRegiao = a.CdRegiao
      Left Join softran_translovato.dbo.Sisempre e On e.cdEmpresa = r.cdEmpresa
      LEFT JOIN [softran_translovato].[dbo].[ESP31906] esp ON esp.CdEmpresaEmitente = @cdempresa and esp.CdEmpresaDestino = e.CdEmpresa 
      WHERE a.NrCep = @cep
      Order by ROTA`

    try {
      var retorno;
      (async function () {
        retorno = await db.query(sql);

        if (retorno.length == 0) {
          resolve({})
          return;
        } else {
          resolve(retorno);
        }
      })()

    } catch (e) {
      console.error(e)
      reject(e)
    }




  })


}//getCDporcep

async function getCDporSigla(sigla, empresa) {

  return new Promise((resolve, reject) => {
    if (!sigla) {
      //console.error(e)
      reject("Sigla não informada")
      return;
    }

    if (!empresa) {
      //console.error(e)
      reject("Empresa não informada")
      return;
    }

    let sql = `
      USE softran_translovato
  
      declare @sigla varchar(5)
      DECLARE @cdempresa int
      
      set @cdempresa = ${empresa}
      set @sigla = '${sigla}'
      
      Select DISTINCT e.dsApelido as ROTA,
      isnull((select	M.Dsapelido
          from  softran_translovato.dbo.SISempre M with (NoLock) 
          where M.cdempresa = e.CdEmpresaLigada),' ') AS EMPLIGADA,
    isnull((select	M.Dsapelido
                      from  softran_translovato.dbo.SISempre M with (NoLock) 
                      where M.cdempresa = esp.CdEmpCentralizadora),' ') AS CD,
      e.NrCgcCpf as 'CNPJ',
      e.dsendereco as 'ENDERECO',
      e.dsbairro as 'BAIRRO',
      e.nrcep as 'CEP',
      e.nrtelefone as 'TELEFONE',
      e.dsemail as 'EMAIL',
      cep.dslocal as 'CIDADE',
      cep.dsuf as 'UF'   
      From softran_translovato.dbo.Sisempre e 
    LEFT JOIN [softran_translovato].[dbo].[ESP31906] esp ON esp.CdEmpresaEmitente = @cdempresa and esp.CdEmpresaDestino = e.CdEmpresa 
    LEFT JOIN [softran_translovato].[dbo].[SISCEP]   cep ON cep.nrcep = e.nrcep  
      WHERE e.DsApelido = @sigla
      Order by ROTA`


    try {
      var retorno;
      (async function () {
        retorno = await db.query(sql);

        if (retorno.length == 0) {
          resolve({})
          return;
        } else {
          resolve(retorno);
        }
      })()

    } catch (e) {
      console.error(e)
      reject(e)
    }

  })


}//CDporSigla

async function getCDporCidade(cidade, uf, empresa) {
  return new Promise((resolve, reject) => {
    if (!cidade) {
      //console.error(e)
      reject("Cidade não informada")
      return;
    }

    if (!empresa) {
      //console.error(e)
      reject("Empresa não informada")
      return;
    }

    let sql = `
      USE softran_translovato
  
      declare @cidade varchar(50)
      declare @uf varchar(3)
      DECLARE @cdempresa int
      
      set @cidade = '${cidade}'
      set @uf = '${uf}'
      set @cdempresa = ${empresa}
  
      Select DISTINCT e.dsApelido as ROTA,
    isnull((select	M.Dsapelido
          from  softran_translovato.dbo.SISempre M with (NoLock) 
          where M.cdempresa = esp.CdEmpCentralizadora),'') AS CD,
          a.dslocal as 'CIDADE'  
      From softran_translovato.dbo.Siscep a 
      Left Join softran_translovato.dbo.SisRegia r On r.CdRegiao = a.CdRegiao
      Left Join softran_translovato.dbo.Sisempre e On e.cdEmpresa = r.cdEmpresa
    LEFT JOIN [softran_translovato].[dbo].[ESP31906] esp ON esp.CdEmpresaEmitente = @cdempresa and esp.CdEmpresaDestino = e.CdEmpresa 
      WHERE a.DsLocal = @cidade and a.DsUF = @uf
      Order by ROTA`
    try {
      var retorno;
      (async function () {
        retorno = await db.query(sql);

        if (retorno.length == 0) {
          resolve({})
          return;
        } else {
          resolve(retorno);
        }
      })()

    } catch (e) {
      console.error(e)
      reject(e)
    }


  })


}//CDporCidade

async function getCDs(empresa) {
  return new Promise((resolve, reject) => {
    if (!empresa) {
      //console.error(e)
      reject("Empresa não informada")
      return;
    }

    /* IMPORTANTE
    ORDER BY CD
    */

    let sql = `USE softran_translovato
    Select DISTINCT e.dsApelido as ROTA,
    isnull((select	M.Dsapelido
                  from  softran_translovato.dbo.SISempre M with (NoLock) 
                  where M.cdempresa = esp.CdEmpCentralizadora),'VAZIO') AS CD,
    e.CdEmpresa 
    From softran_translovato.dbo.Sisempre e 
    LEFT JOIN [softran_translovato].[dbo].[ESP31906] esp ON esp.CdEmpresaEmitente = ${empresa} and esp.CdEmpresaDestino = e.CdEmpresa 
    WHERE e.InAtiva = 1 
    Order by CD,ROTA`

    try {
      var retorno;
      (async function () {
        retorno = await db.query(sql);

        if (retorno.length == 0) {
          resolve({})
          return;
        } else {
          resolve(retorno);
        }
      })()

    } catch (e) {
      console.error(e)
      reject(e)
    }


  })
}//gerCDs



function cds(ws, dieison) {
  let uuid = '';
  try {
    uuid = dieison.uuid;
  } catch (e) {
    console.log('- - - - - - - - - -')
    console.log('uuid não repassado')
    console.log('- - - - - - - - - -')
  }


  let dados = {};
  try {
    dados = dieison['cds'];
  } catch (e) {
    console.error('Error dieison[cds]')
    console.error(e)
    e.uuid = 0
    ws.send(`"{'res_error' : ${e}}"`);
    return;
  }

  let empresa;
  try {
    empresa = dados.empresa;
  } catch (e) {
    console.log('cds.empresa')
    console.log(e)
    e.uuid = 0
    ws.send(`"{'res_error' : 'empresa não informada'}"`);
    return;
  }


  getCDs(empresa)
    .then(result => {
      if (result != "Erro false" || JSON.stringify(result) != "undefined" || Array.isArray(result).lenght > 0 || Array.isArray(result).lenght != 'undefined') {
        let dados_ret = {
          'cds': result,
          'uuid': uuid
        }
        ws.send(JSON.stringify(dados_ret))

      } else {
        console.error('result.CDs: ' + result);
        ws.send(`"{'res_error' : 'Nada encontrado'}"`);
      }//if resut !=


    })
    .catch(result => {
      console.error('CDs:' + result);
      ws.send(`"{'res_error' : ${result}}"`);

    })

}//getCds


function cdPorCep(ws, dieison) {

  let uuid = '';
  try {
    uuid = dieison.uuid;
  } catch (e) {
    console.log('- - - - - - - - - -')
    console.log('uuid não repassado')
    console.log('- - - - - - - - - -')
  }


  let dados = {};
  try {
    dados = dieison['cd-por-cep'];
  } catch (e) {
    console.error('Error dieison[cd-por-cep]')
    console.error(e)
    e.uuid = uuid
    ws.send(`"{'res_error' : ${e}}"`);
    return;
  }

  let cep;
  try {
    cep = dados.cep;
  } catch (e) {
    console.log('cd-por-cep.cep')
    console.log(e)
    e.uuid = uuid
    ws.send(`"{'res_error' : 'CEP não informado'}"`);
    return;
  }


  let filial;
  try {
    filial = dados.empresa;
  } catch (e) {
    console.log('cd-por-cep.empresa')
    console.log(e)
    e.uuid = uuid
    ws.send(`"{'res_error' : 'Filial embarcadora não informada'}"`);
    return;
  }


  getCDporCep(cep, filial)
    .then(result => {
      if (result != "Erro false" || JSON.stringify(result) != "undefined" || Array.isArray(result).lenght > 0 || Array.isArray(result).lenght != 'undefined') {
        let dados_ret = {
          'cd-por-cep': result,
          'uuid': uuid
        }
        ws.send(JSON.stringify(dados_ret))

      } else {
        console.error('result.cd-por-cep: ' + result);
        ws.send(`"{'res_error' : 'Nada encontrado'}"`);
      }//if resut !=


    })
    .catch(result => {
      console.error('cd-por-cep:' + result);
      ws.send(`"{'res_error' : ${result}}"`);

    })

}//cdPorCep


function cdPorSigla(ws, dieison) {

  let uuid = '';
  try {
    uuid = dieison.uuid;
  } catch (e) {
    console.log('- - - - - - - - - -')
    console.log('uuid não repassado')
    console.log('- - - - - - - - - -')
  }



  let dados = {};
  try {
    dados = dieison['cd-por-sigla'];
  } catch (e) {
    console.error('Error dieison[cd-por-sigla]')
    console.error(e)
    e.uuid = 0
    ws.send(`"{'res_error' : ${e}}"`);
    return;
  }



  let sigla;
  try {
    sigla = dados.sigla;
  } catch (e) {
    console.log('cd-por-sigla')
    console.log(e)
    e.uuid = 0
    ws.send(`"{'res_error' : 'Sigla não informada'}"`);
    return;
  }



  let filial;
  try {
    filial = dados.empresa;
  } catch (e) {
    console.log('cd-por-sigla.empresa')
    console.log(e)
    e.uuid = 0
    ws.send(`"{'res_error' : 'Filial embarcadora não informada'}"`);
    return;
  }


  getCDporSigla(sigla, filial)
    .then(result => {
      if (result != "Erro false" || JSON.stringify(result) != "undefined" || Array.isArray(result).lenght > 0 || Array.isArray(result).lenght != 'undefined') {

        let dados_ret = {
          'cd-por-sigla': result,
          'uuid': uuid
        }

        ws.send(JSON.stringify(dados_ret))

      } else {
        console.error('result.cd-por-sigla: ' + result);
        ws.send(`"{'res_error' : 'Nada encontrado'}"`);
      }//if resut !=


    })
    .catch(result => {
      console.error('cd-por-sigla:' + result);
      ws.send(`"{'res_error' : ${result}}"`);

    })

}//cdPorSigla


function cdPorCidade(ws, dieison) {
  let uuid = '';
  try {
    uuid = dieison.uuid;
  } catch (e) {
    console.log('- - - - - - - - - -')
    console.log('uuid não repassado')
    console.log('- - - - - - - - - -')
  }


  let dados = {};
  try {
    dados = dieison['cd-por-cidade'];
  } catch (e) {
    console.error('Error dieison[cd-por-cidade]')
    console.error(e)
    e.uuid = 0
    ws.send(`"{'res_error' : ${e}}"`);
    return;
  }

  let cidade;
  try {
    cidade = dados.cidade;
  } catch (e) {
    console.log('cd-por-cidade')
    console.log(e)
    e.uuid = 0
    ws.send(`"{'res_error' : 'Cidade não informada'}"`);
    return;
  }


  let uf;
  try {
    uf = dados.uf;
  } catch (e) {
    console.log('cd-por-cidade.uf')
    console.log(e)
    e.uuid = 0
    ws.send(`"{'res_error' : 'UF embarcadora não informada'}"`);
    return;
  }

  let filial;
  try {
    filial = dados.empresa;
  } catch (e) {
    console.log('cd-por-cidade.empresa')
    console.log(e)
    e.uuid = 0
    ws.send(`"{'res_error' : 'Filial embarcadora não informada'}"`);
    return;
  }

  getCDporCidade(cidade, uf, filial)
    .then(result => {
      if (result != "Erro false" || JSON.stringify(result) != "undefined" || Array.isArray(result).lenght > 0 || Array.isArray(result).lenght != 'undefined') {
        let dados_ret = {
          'cd-por-cidade': result,
          'uuid': uuid
        }
        ws.send(JSON.stringify(dados_ret))

      } else {
        console.error('result.cd-por-cidade: ' + result);
        ws.send(`"{'res_error' : 'Nada encontrado'}"`);
      }//if resut !=


    })
    .catch(result => {
      console.error('cd-por-cidade:' + result);
      ws.send(`"{'res_error' : ${result}}"`);

    })

}//cdPorCidade

// Função para carregar configurações do arquivo JSON
function loadConfig() {
  const configPath = path.join(__dirname, 'config.json');
  const configContent = fs.readFileSync(configPath, 'utf-8');
  return JSON.parse(configContent);
}



//----------------------------------------------------------------
module.exports = { loginpeloromaneiosocket, buscaColetaspeloRomaneioSocket, buscaNotapelaChaveSocket, buscaNotapeloNumeroSocket, buscaDadosNotaManual, loginpelosocket, buscaDescargaColetasSocket, capacidadeVeiculoSocket, loadConfig, cds, cdPorCep, cdPorSigla, cdPorCidade, buscaCepSocket,buscaNotasVeiculoSocket }