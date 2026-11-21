import {parseAttributeExcel} from './excelImportParser'
self.onmessage=event=>{
  try{self.postMessage({definitions:parseAttributeExcel(event.data)})}
  catch(error){self.postMessage({error:/^excelImport\./.test(error.message)?error.message:'excelImport.format'})}
}
