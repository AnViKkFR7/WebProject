// @vitest-environment happy-dom
import {afterEach,describe,expect,it,vi} from 'vitest'
import {maxBillingLogoBytes,readBillingLogo,validLogoBytes} from './billingLogo'
const png=new Uint8Array([137,80,78,71,13,10,26,10,0,0,0,13,73,72,68,82])
afterEach(()=>vi.unstubAllGlobals())
describe('billing logo validation',()=>{
  it('requires the declared image signature and enforces supported types and size',async()=>{
    expect(validLogoBytes(png,'image/png')).toBe(true)
    expect(validLogoBytes(png,'image/jpeg')).toBe(false)
    expect(validLogoBytes(new Uint8Array([255,216,255]),'image/jpeg')).toBe(true)
    for(const file of [new File(['<svg/>'],'logo.svg',{type:'image/svg+xml'}),new File([png],'wrong.jpg',{type:'image/jpeg'}),new File([new Uint8Array(maxBillingLogoBytes+1)],'big.png',{type:'image/png'})]) {
      await expect(readBillingLogo(file)).rejects.toThrow()
    }
  })
  it('requires successful decoding and bounded dimensions before returning the image',async()=>{
    vi.stubGlobal('Image',class {width=5000;height=100;set src(value){void value;queueMicrotask(()=>this.onload?.())}})
    await expect(readBillingLogo(new File([png],'logo.png',{type:'image/png'}))).rejects.toThrow('dimensions')
    vi.stubGlobal('Image',class {width=200;height=80;set src(value){void value;queueMicrotask(()=>this.onload?.())}})
    await expect(readBillingLogo(new File([png],'logo.png',{type:'image/png'}))).resolves.toMatch(/^data:image\/png;base64,/)
    vi.stubGlobal('Image',class {set src(value){void value;queueMicrotask(()=>this.onerror?.())}})
    await expect(readBillingLogo(new File([png],'broken.png',{type:'image/png'}))).rejects.toThrow('decode')
  })
})
