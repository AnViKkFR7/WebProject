export const paletteRoles = ['accent', 'ink', 'muted', 'paper', 'surface']
export const validPaletteName = name => typeof name==='string' && name.trim().length>0 && name.trim().length<=60 && [...name].every(character=>{const code=character.codePointAt(0);return code>=32 && (code<127 || code>159)})
export const samePaletteColors = (first,second) => paletteRoles.every(role=>validHex(first?.[role]) && validHex(second?.[role]) && first[role].toLowerCase()===second[role].toLowerCase())
export const billingColorSamples = {
  accent: ['#334155','#1e4c78','#4d6137','#6d28d9','#be123c','#b45309','#0f766e','#1d4ed8','#9d174d','#7c2d12'],
  ink: ['#20252b','#1c3045','#293424','#312044','#3f202b','#3b2c21','#172554','#134e4a','#ffffff','#f1f5f9'],
  muted: ['#58616d','#52647a','#596450','#665077','#785361','#73553b','#475569','#3f625f','#ffffff','#e2e8f0'],
  paper: ['#ffffff','#fffdf5','#f5f9ff','#faf5ff','#fff5f7','#f3faf6','#fff7ed','#f8fafc','#f5f5f4','#f0fdfa'],
  surface: ['#f1f3f5','#edf3f8','#f1f4ed','#f3e8ff','#fce7f3','#fef3c7','#dbeafe','#dcfce7','#ffedd5','#ccfbf1'],
}
const contrastPairs = [['accent','paper'],['ink','paper'],['ink','surface'],['muted','paper'],['muted','surface']]

// Check only relationships affected by this edit, so other incomplete HEX fields never trap recovery.
export function billingColorConflicts(palette,role,color=palette?.[role]) {
  if (!validHex(color)) return []
  return contrastPairs.filter(pair=>pair.includes(role)).map(pair=>pair.find(part=>part!==role))
    .filter(other=>validHex(palette?.[other]) && contrastRatio(color,palette[other])<4.5)
}
export const billingPalettes = [
  { id:'graphite',accent:'#334155',ink:'#20252b',muted:'#58616d',paper:'#ffffff',surface:'#f1f3f5' },
  { id:'ocean',accent:'#1e4c78',ink:'#1c3045',muted:'#52647a',paper:'#ffffff',surface:'#edf3f8' },
  { id:'olive',accent:'#4d6137',ink:'#293424',muted:'#596450',paper:'#ffffff',surface:'#f1f4ed' },
]
export const validHex = value => typeof value === 'string' && /^#[0-9a-f]{6}$/i.test(value)
const luminance = hex => {
  const rgb=[1,3,5].map(index=>Number.parseInt(hex.slice(index,index+2),16)/255)
  return rgb.reduce((sum,value,index)=>sum+[.2126,.7152,.0722][index]*(value<=.04045 ? value/12.92 : ((value+.055)/1.055)**2.4),0)
}
export function contrastRatio(first,second) {
  if (!validHex(first) || !validHex(second)) return 0
  const a=luminance(first),b=luminance(second)
  return (Math.max(a,b)+.05)/(Math.min(a,b)+.05)
}
export function validBillingPalette(palette) {
  return Boolean(palette && typeof palette === 'object' && !Array.isArray(palette)
    && ['graphite','ocean','olive','custom'].includes(palette.id)
    && Object.keys(palette).length === 6 && paletteRoles.every(role=>validHex(palette[role]))
    && ['ink','muted'].every(role=>['paper','surface'].every(background=>contrastRatio(palette[role],palette[background])>=4.5))
    && contrastRatio(palette.accent,palette.paper)>=4.5)
}
export function documentPalette(issuer) {
  if (validBillingPalette(issuer?.palette)) return issuer.palette
  // Legacy documents keep their original neutrals and accent, including very light brand colors.
  return { id:'legacy',accent:validHex(issuer?.color) ? issuer.color : '#334155',ink:'#20252b',muted:'#62686b',paper:'#ffffff',surface:'#f3f4f5' }
}
export function withBillingAppearance(target,source) {
  const { palette:previous, ...rest }=target
  void previous
  return { ...rest,...('logo' in source || 'logo' in target ? {logo:source.logo || ''} : {}),...('color' in source || 'color' in target ? {color:source.color || '#334155'} : {}),...(source.palette ? {palette:structuredClone(source.palette)} : {}) }
}
export function selectBillingPalette(profile,palette) {
  return {...profile,palette:structuredClone(palette),color:palette.accent}
}
