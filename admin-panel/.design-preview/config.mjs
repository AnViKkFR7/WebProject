import {defineConfig} from 'vite'
import react from '@vitejs/plugin-react'
import {fileURLToPath} from 'node:url'
const mock=fileURLToPath(new URL('./mocks.jsx',import.meta.url))
export default defineConfig({plugins:[{name:'review-fixture',enforce:'pre',resolveId(source,importer){if(importer?.replaceAll('\\','/').endsWith('/src/pages/Invoicing.jsx') && /contexts\/CompanyContext|hooks\/usePermissions|services\/invoicingService/.test(source)) return mock;if(/services\/(billingReuseService|billingTemplateService|billingFinanceService|billingPaletteService|documentDraftService)/.test(source))return mock}},react()]})
