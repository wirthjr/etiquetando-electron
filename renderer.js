
const html = document.documentElement;
const body = document.body;
const logContainer = document.getElementById('logContainer');

function setTheme(){
  dark()    
}

async function dark(){
  const isDarkMode = await window.darkMode.toggle()
}
async function light(){
  await window.darkMode.system()
}

async function dados_login(){
  window.electron.invoke('login-server:server')
  .then(server => {
    const serverInfoInput = document.getElementById('txtservidor');
    serverInfoInput.value = server;
  })
  .catch(error => {
    console.error('Error retrieving server info:', error);
    document.getElementById('txtservidor').value = 'Failed to retrieve server info';
  });

  window.electron.invoke('login-server:empresa')
  .then(empresa => {
    const serverInfoInput = document.getElementById('txtempresa');
    serverInfoInput.value = empresa;
  })
  .catch(error => {
    console.error('Error retrieving empresa info:', error);
    document.getElementById('txtempresa').value = 'Failed to retrieve empresa info';
  });

  window.electron.invoke('login-server:id')
  .then(id => {
    const serverInfoInput = document.getElementById('txtidmicro');
    serverInfoInput.value = id;
  })
  .catch(error => {
    console.error('Error retrieving empresa info:', error);
    document.getElementById('txtidmicro').value = 'Failed to retrieve ID info';
  });

}//dados_login

window.electron.receive('data:load', (data) => {
  try {
    const logInfo = document.getElementById('logInfo');
    
    if(typeof data ===  'object'){
      if(data.key === 'error'){
        logInfo.insertAdjacentHTML("beforeend", `<span class="red">${data.key} : ${data.value}</span><br>`);
      }else if (data.key === 'filiais'){      
        document.getElementById('filiais').innerHTML = "Filiais= " + data.value + "<br>"
      }else{
        logInfo.insertAdjacentHTML("beforeend", `<span>${data.key} : ${data.value}</span><br>`);
      }
    }else{
        logInfo.insertAdjacentHTML("beforeend", `<span">${data}</span><br>`);
    }
    logInfo.scrollTop = logInfo.scrollHeight - logInfo.clientHeight;
  } catch (error) {
    console.error('Error processing received data:', error);
  }
});


window.electron.receive('data:log', (data) => {
  //log atual 
  try {
    const logDados = document.getElementById('logContainer');
    if(typeof data ===  'object'){
      if(data.key === 'error'){
        logDados.insertAdjacentHTML("beforeend", `<span class="red">${data.key} : ${data.value}</span>`);
      }else{
        logDados.insertAdjacentHTML("beforeend", `<span>${data.key} : ${data.value}</span>`);
      }  
    }else{
      logDados.insertAdjacentHTML("beforeend", `<span">${data}</span>`);
    }
    logDados.scrollTop = logDados.scrollHeight - logDados.clientHeight;
  } catch (error) {
    console.error('Error processing received data:', error);
    logDados.insertAdjacentHTML("beforeend", `<span>${data.key} : Error processing received data:</span>`);
    logDados.insertAdjacentHTML("beforeend", `<span>            : ${error}</span>`);
  }
});

window.electron.receive('token', (data) => {
  document.getElementById('txttoken').value = data
})

window.electron.receive('socket:status', (status) => {
  if(status === 'disconnected'){
    changePageHeaderColor('#ec1848')
  }else{
    changePageHeaderColor('gold')
  }

});


  window.electron.onLogData((logData) => {
    //log com dados do arquivo
    logContainer.innerHTML = logData;    
    logContainer.scrollTop = logContainer.scrollHeight - logContainer.clientHeight;
});


function changePageHeaderColor(color) {
  const pageHeader = document.querySelector('.page-header');
  if (pageHeader) {
      pageHeader.style.backgroundColor = color;
  }
}

function parse_object(objeto){
  window.electron.invoke('load:object', objeto).then(response => {
    console.log('Response from main process:', response);
  });
}//parse

function showAlert(mensagem){
  alert(mensagem)
}//

function changePageHeaderColor(color) {
  const pageHeader = document.querySelector('.page-header');
  if (pageHeader) {
      pageHeader.style.backgroundColor = color;
  }
}

function conectar(){
  const servidor = document.getElementById('txtservidor').value;
  const empresa = document.getElementById('txtempresa').value;
  const idMicroServico = document.getElementById('txtidmicro').value;
  const token = document.getElementById('txttoken').value;

  window.electron.invoke('connect',servidor,empresa,idMicroServico,token)

}

document.addEventListener("DOMContentLoaded", (event) => {
  dados_login()
});


console.log('renderer carregado')