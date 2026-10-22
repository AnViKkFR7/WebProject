export function quoteChapters(lines) {
  const groups=new Map()
  lines.forEach((line,index)=>{
    const chapter=line.chapter?.trim() || ''
    if(!groups.has(chapter)) groups.set(chapter,{chapter,rows:[],firstIndex:index})
    groups.get(chapter).rows.push({line,index})
  })
  return [...groups.values()]
}

