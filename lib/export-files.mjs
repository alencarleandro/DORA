import fs from 'node:fs';
import {replaceFile} from './atomic-file.mjs';
import path from 'node:path';
import {toCSV} from './csv.mjs';
import {RELEASE_DATA_HEADERS,requireDataset} from './datasets.mjs';
const RUN_HEADERS=['repository','default_branch','id','workflow_id','event','head_branch','conclusion','created_at','run_started_at','updated_at','window_start','window_end'];
const COMMIT_HEADERS=['repository','release_tag','release_published_at','commit_sha','author_date','message','lead_time_hours'];
// Write one repository at a time instead of retaining all raw API payloads and one huge CSV string.
export function writeRawExports(job,folder,output){
 requireDataset(job);fs.mkdirSync(output,{recursive:true});
 for(const [kind,headers] of [['release-data',RELEASE_DATA_HEADERS],['runs',RUN_HEADERS],['commits',COMMIT_HEADERS]]){
  const file=path.join(output,kind+'.csv'),temporary=file+'.tmp',fd=fs.openSync(temporary,'w'),header=toCSV([],headers);
  try {
   fs.writeSync(fd,header);
   for(const repo of job.results){
    let rows;
    if(kind==='runs')rows=JSON.parse(fs.readFileSync(path.join(folder,encodeURIComponent(repo.repository)+'.runs.json'),'utf8')).map(r=>({...r,repository:repo.repository,default_branch:repo.default_branch,window_start:job.start,window_end:job.end}));
    else {
     const releases=JSON.parse(fs.readFileSync(path.join(folder,encodeURIComponent(repo.repository)+'.releases.json'),'utf8')).releases;
     if(kind==='release-data')rows=releases.map(r=>({repository:repo.repository,default_branch:repo.default_branch,window_start:job.start,window_end:job.end,...r,commits_json:JSON.stringify(r.commits)}));
     else rows=releases.flatMap(r=>r.commits.map(c=>({repository:repo.repository,release_tag:r.tag_name,release_published_at:r.published_at,commit_sha:c.sha,author_date:c.author_date,message:c.message,lead_time_hours:(Date.parse(r.published_at)-Date.parse(c.author_date))/3600000})));
    }
    for(let start=0;start<rows.length;start+=1000)fs.writeSync(fd,toCSV(rows.slice(start,start+1000),headers).slice(header.length));
   }
  }finally{fs.closeSync(fd);}
  replaceFile(temporary,file);
 }
}
