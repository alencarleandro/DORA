export function fake({failCompare=false,onCompare=()=>{}}={}) {
  const calls=[];
  const releases=Array.from({length:6},(_,i)=>({tag_name:`v${i}`,draft:false,prerelease:false,published_at:i===0?'2025-12-31T12:00:00Z':`2026-01-${String(i*3).padStart(2,'0')}T12:00:00Z`}));
  return {calls,
    get:async url=>{
      calls.push(url);
      if(url.includes('/search/')) {
        const q=new URL(url,'https://api.github.com').searchParams.get('q');
        return {data:{total_count:1,items:[{id:1,full_name:'a/good',default_branch:'trunk',stargazers_count:2000}]}};
      }
      const name=url.match(/\/repos\/([^/]+\/[^/?]+)/)?.[1];
      if(url.includes('/contributors')) return {data:[{}]};
      if(url.includes('/actions/workflows')) return {data:{total_count:name==='a/noactions'?0:1}};
      if(url.includes('/compare/')) {onCompare(url);if(failCompare)throw new Error('GitHub HTTP 404');return {data:{total_commits:2,commits:[{sha:'old',commit:{author:{date:'2026-01-01T12:00:00Z'},message:'first'}},{sha:'new',commit:{author:{date:'2026-01-02T12:00:00Z'},message:'second'}}]}};}
      return {data:{id:1,full_name:name,default_branch:'trunk',stargazers_count:2000,language:'JavaScript',created_at:'2020-01-01T00:00:00Z'}};
    },
    pages:async url=>{
      calls.push(url);
      if(url.includes('/tags')) return [{name:'v5',commit:{sha:'head'}}];
      return url.includes('/fewreleases/')?releases.slice(0,4):releases;
    },
    runs:async(name,branch,start,end)=>{
      calls.push(`runs:${name}:${branch}:${start}:${end}`);
      return Array.from({length:name==='a/fewruns'?49:50},(_,i)=>({id:i+1,workflow_id:7,event:'push',head_branch:branch,conclusion:i===1?'failure':'success',created_at:`2026-01-01T${String(Math.floor(i/60)).padStart(2,'0')}:${String(i%60).padStart(2,'0')}:00Z`,run_started_at:`2026-01-01T00:${String(i%60).padStart(2,'0')}:00Z`,updated_at:`2026-01-01T00:${String(i%60).padStart(2,'0')}:30Z`}));
    }
  };
}
