export const maxBillingLogoBytes = 1024 * 1024
export function validLogoBytes(bytes,type) {
  return type==='image/png'
    ? [137,80,78,71,13,10,26,10].every((value,index)=>bytes[index]===value)
    : type==='image/jpeg' && bytes[0]===255 && bytes[1]===216 && bytes[2]===255
}
export async function readBillingLogo(file) {
  if (!file || !['image/png','image/jpeg'].includes(file.type) || file.size>maxBillingLogoBytes || !file.size) throw new Error('Invalid logo')
  const bytes=new Uint8Array(await file.arrayBuffer())
  if (!validLogoBytes(bytes,file.type)) throw new Error('Invalid image signature')
  const data=await new Promise((resolve,reject)=>{
    const reader=new FileReader()
    reader.onload=()=>resolve(reader.result);reader.onerror=()=>reject(new Error('Image read failed'))
    reader.readAsDataURL(file)
  })
  await new Promise((resolve,reject)=>{
    const image=new Image()
    const finish=error=>{clearTimeout(timer);image.onload=null;image.onerror=null;if(error) reject(error);else resolve()}
    const timer=setTimeout(()=>finish(new Error('Image decode timeout')),8000)
    image.onload=()=>finish(image.width>0 && image.height>0 && image.width<=4096 && image.height<=4096 ? null : new Error('Invalid image dimensions'))
    image.onerror=()=>finish(new Error('Image decode failed'));image.src=data
  })
  return data
}
