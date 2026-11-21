import {mkdtemp,mkdir,writeFile,readFile,rm} from 'node:fs/promises'
import {tmpdir} from 'node:os'
import {resolve,join,relative} from 'node:path'
import {afterAll,beforeAll,expect,it} from 'vitest'
import {buildBootstrap,loadBootstrap} from '../../../scripts/build-database-bootstrap.mjs'
let root
beforeAll(async()=>{root=await mkdtemp(join(tmpdir(),'regiamare-bootstrap-'))})
afterAll(async()=>{
 const rel=relative(resolve(tmpdir()),resolve(root))
 if(!rel.startsWith('regiamare-bootstrap-')||rel.includes('..')||rel.includes('/')||rel.includes('\\'))throw new Error('Unsafe temporary directory')
 await rm(root,{recursive:true,force:true})
})
it('classifies every migration and includes only application SQL with source hashes',async()=>{
 const{steps,manifest}=await loadBootstrap()
 expect(steps.length).toBeGreaterThan(60)
 expect(steps.every(step=>/^[0-9a-f]{64}$/.test(step.sha256))).toBe(true)
 expect(steps.some(step=>/WATCH|TIMEZONE_FIX|BDD_REFERENCIA|maintenance|local\//.test(step.path))).toBe(false)
 expect(Object.keys(manifest.excludedMigrations)).toContain('PLANNING_TIMEZONE_FIX.sql')
 const sql=steps.map(step=>step.sql).join('\n').replace(/^\s*--.*$/gm,'')
 expect(sql).not.toMatch(/cron\.(schedule|unschedule)|create extension|net\.http_post/i)
 const readme=await readFile(new URL('../../../database/README.md',import.meta.url),'utf8')
 const section=readme.split('## Orden de ejecución en una base de datos nueva')[1].split('## Migraciones')[0]
 const positions=steps.map(step=>section.indexOf(`\`${step.path}\``))
 expect(positions.every(index=>index>=0)).toBe(true)
 expect(positions).toEqual([...positions].sort((a,b)=>a-b))
})
it('generates a reviewable psql artifact and refuses to overwrite an existing file',async()=>{
 const output=join(root,'generated.sql')
 const result=await buildBootstrap(output)
 expect(result.steps).toBeGreaterThan(60)
 const sql=await readFile(output,'utf8')
 expect(sql).toContain('\\set ON_ERROR_STOP on')
 expect(sql).toContain('SOURCE: bootstrap/PREFLIGHT.sql; SHA256:')
 expect(/create\s+(?:or\s+replace\s+)?(?:table\s+public\.company_weekly_summary_watch_test|function\s+public\.claim_watch_weekly_summary_test)/i.test(sql)).toBe(false)
 await expect(buildBootstrap(output)).rejects.toThrow(/EEXIST/)
 expect(await readFile(output,'utf8')).toBe(sql)
})
async function fixture(name,steps,source='select 1;',files=[]){
 const folder=join(root,name)
 await mkdir(join(folder,'bootstrap'),{recursive:true});await mkdir(join(folder,'migrations'))
 await writeFile(join(folder,'bootstrap','manifest.json'),JSON.stringify({version:1,steps,excludedMigrations:{}}))
 await writeFile(join(folder,'bootstrap','BASE.sql'),source)
 for(const file of files)await writeFile(join(folder,'migrations',file),'select 1;')
 return folder
}
it('fails on missing migration classification rather than silently skipping new SQL',async()=>{
 const folder=await fixture('unclassified',[{path:'bootstrap/BASE.sql'}],undefined,['NEW.sql'])
 await expect(loadBootstrap(folder)).rejects.toThrow('Unclassified migration')
})
it('rejects local/reference files, traversal, duplicated steps and broken section markers',async()=>{
 for(const [name,steps,error] of [
  ['traversal',[{path:'../BASE.sql'}],'Invalid bootstrap path'],
  ['local',[{path:'local/BASE.sql'}],'Invalid bootstrap path'],
  ['reference',[{path:'schema/BDD_REFERENCIA.sql'}],'Invalid bootstrap path'],
  ['duplicate',[{path:'bootstrap/BASE.sql'},{path:'bootstrap/BASE.sql'}],'Duplicate bootstrap step'],
  ['marker',[{path:'bootstrap/BASE.sql',before:'MISSING'}],'Missing or ambiguous section marker'],
 ])await expect(loadBootstrap(await fixture(name,steps))).rejects.toThrow(error)
})
it('refuses operational SQL even if it is accidentally added to the application manifest',async()=>{
 await expect(loadBootstrap(await fixture('cron',[{path:'bootstrap/BASE.sql'}],"select cron.schedule('unexpected','* * * * *','select 1');"))).rejects.toThrow('Operational SQL')
})
