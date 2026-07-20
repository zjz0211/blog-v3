import { cp, mkdir } from 'node:fs/promises'
import { dirname, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'

const __dirname = dirname(fileURLToPath(import.meta.url))
const root = resolve(__dirname, '..')
const reactDist = resolve(root, '../tinytrails-404/dist')
const nuxtOut = resolve(root, '.output/public')

await mkdir(resolve(nuxtOut, 'assets'), { recursive: true })
await cp(resolve(reactDist, 'index.html'), resolve(nuxtOut, '404.html'))
await cp(resolve(reactDist, 'assets'), resolve(nuxtOut, 'assets'), { recursive: true })

console.log('✅ Copied React 404 page into .output/public/404.html')
