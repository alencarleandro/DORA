// Cadastra somente este app e preserva configurações/credenciais dos demais.
const fs=require('node:fs');
const path=require('node:path');
const {ConfigStore}=require('C:/Users/Leandro Alencar/Projetos/A.R.S.E.N.A.L/electron/store.cjs');
const configFile=process.argv[2];
if(!configFile)throw new Error('Informe o caminho completo de arsenal.json.');
const store=new ConfigStore(configFile), existing=store.getSnapshot().apps.find(a=>a.slug==='dora');
const backup=`${configFile}.before-dora-${Date.now()}.bak`;
fs.copyFileSync(configFile,backup);
const app=store.saveApp({id:existing?.id,name:'DORA · Workflows',description:'Lab03 Sprint 1 · coleta de GitHub Actions, CFR de CI e recuperação.',slug:'dora',cwd:path.resolve(__dirname,'..'),command:'npm start',env:{},port:4117,pathMode:'strip',autoStart:true,visibleInHub:true,gitAutomationEnabled:false});
console.log(JSON.stringify({registered:app.slug,port:app.port,backup,activation:'Reabra o Arsenal para carregar o cadastro salvo.'}));
