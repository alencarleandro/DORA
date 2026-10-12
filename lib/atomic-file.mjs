import fs from 'node:fs';
// Windows readers/antivirus can briefly lock the destination of an atomic replacement.
export function replaceFile(temporary,target,{rename=fs.renameSync,wait=ms=>Atomics.wait(new Int32Array(new SharedArrayBuffer(4)),0,0,ms)}={}){
 for(let attempt=0;;attempt++){
  try{return rename(temporary,target);}catch(error){
   if(!['EPERM','EBUSY'].includes(error.code)||attempt>=49)throw error;
   wait(20);
  }
 }
}
