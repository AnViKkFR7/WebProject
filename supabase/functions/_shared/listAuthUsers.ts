/** Return a complete list or an error; never silently return a partial page. */
export async function listAuthUsers(admin:any,pageSize=100,maxPages=1000){
 const result:any[]=[];const seen=new Set<string>()
 for(let page=1;page<=maxPages;page++){
  const{data,error}=await admin.auth.admin.listUsers({page,perPage:pageSize})
  if(error||!Array.isArray(data?.users))throw new Error('auth_list_failed')
  let added=0
  for(const user of data.users){
   if(typeof user?.id!=='string')throw new Error('invalid_auth_page')
   if(!seen.has(user.id)){seen.add(user.id);result.push(user);added++}
  }
  if(data.users.length&&!added)throw new Error('repeated_auth_page')
  if(data.users.length<pageSize)return result
 }
 throw new Error('auth_list_limit_exceeded')
}
