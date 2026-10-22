export const paletteRoles = ['accent', 'ink', 'muted', 'paper', 'surface']
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
