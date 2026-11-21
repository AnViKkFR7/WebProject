import {readFile,mkdir,writeFile,readdir} from 'node:fs/promises'
import {createHash} from 'node:crypto'
import {fileURLToPath} from 'node:url'
import {resolve,dirname,relative,isAbsolute} from 'node:path'
export const databaseRoot=fileURLToPath(new URL('../database/',import.meta.url))
export async function loadBootstrap(root=databaseRoot){
 const manifest=JSON.parse(await readFile(resolve(root,'bootstrap/manifest.json'),'utf8'))
 if(manifest.version!==1||!Array.isArray(manifest.steps)||!manifest.excludedMigrations)throw new Error('Invalid bootstrap manifest')
 const included=new Set(manifest.steps.map(step=>step.path))
 if(included.size!==manifest.steps.length)throw new Error('Duplicate bootstrap step')
 const migrations=(await readdir(resolve(root,'migrations'))).filter(file=>file.endsWith('.sql'))
 for(const [file,reason] of Object.entries(manifest.excludedMigrations)){
  if(!migrations.includes(file)||typeof reason!=='string'||!reason.trim()||included.has(`migrations/${file}`))throw new Error(`Invalid migration exclusion: ${file}`)
 }
 for(const file of migrations){
  if(!included.has(`migrations/${file}`)&&!manifest.excludedMigrations[file])throw new Error(`Unclassified migration: ${file}`)
 }
 const steps=[]
 for(const step of manifest.steps){
  const path=resolve(root,step.path),rel=relative(root,path)
  if(rel.startsWith('..')||isAbsolute(rel)||!/^(bootstrap|schema|migrations)\/[A-Z0-9_]+\.sql$/.test(step.path)||step.path.endsWith('/BDD_REFERENCIA.sql'))throw new Error('Invalid bootstrap path')
  const source=await readFile(path,'utf8')
  let sql=source
  if(step.after){
   const index=source.indexOf(step.after)
   if(index<0||source.indexOf(step.after,index+1)>=0)throw new Error(`Missing or ambiguous section marker: ${step.path}`)
   sql=source.slice(index+step.after.length)
  }
  if(step.before){
   const index=sql.indexOf(step.before)
   if(index<0||sql.indexOf(step.before,index+1)>=0)throw new Error(`Missing or ambiguous section marker: ${step.path}`)
   sql=sql.slice(0,index)
  }
  if(step.omit){
   const start=sql.indexOf(step.omit.from),end=sql.indexOf(step.omit.through,start+step.omit.from.length)
   if(start<0||end<0||sql.indexOf(step.omit.from,start+1)>=0)throw new Error(`Missing or ambiguous section marker: ${step.path}`)
   sql=sql.slice(0,start)+sql.slice(end+step.omit.through.length)
  }
  if(/\b(?:cron\.(?:schedule|unschedule)|net\.http_post|vault\.(?:create_secret|update_secret)|create\s+extension)\b/i.test(sql.replace(/^\s*--.*$/gm,'')))throw new Error(`Operational SQL must be activated separately: ${step.path}`)
  steps.push({...step,sql,sha256:createHash('sha256').update(source).digest('hex')})
 }
 return{manifest,steps}
}
export async function buildBootstrap(output){
 const{steps}=await loadBootstrap()
 const sql='-- Generated for a NEW Supabase application schema only. No cron, secrets or demo data.\n\\set ON_ERROR_STOP on\n'+steps.map(step=>`\n-- SOURCE: ${step.path}; SHA256: ${step.sha256}\n${step.sql}\n`).join('')
 await mkdir(dirname(output),{recursive:true});await writeFile(output,sql,{flag:'wx'})
 return{output,steps:steps.length}
}
if(process.argv[1]&&resolve(process.argv[1])===fileURLToPath(import.meta.url)){
 const output=resolve(process.argv[2]??'database/local/bootstrap.generated.sql')
 await buildBootstrap(output)
 console.log(`Bootstrap written: ${output}`)
}
