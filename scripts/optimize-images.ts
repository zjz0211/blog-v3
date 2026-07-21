/**
 * 图片优化脚本：将 public/images/ 下的 PNG 批量转为 WebP
 * 用法：npx tsx scripts/optimize-images.ts
 */
import { readdir, stat, mkdir, rename } from 'node:fs/promises'
import { resolve, join } from 'node:path'
import sharp from 'sharp'

const IMAGES_DIR = resolve('./public/images')
const BACKUP_DIR = resolve('./public/images-png-backup')
const QUALITY = 85

async function main() {
  console.log('🔍 扫描 public/images/ 目录...')
  const files = await readdir(IMAGES_DIR)
  const pngFiles = files.filter(f => f.endsWith('.png'))

  if (pngFiles.length === 0) {
    console.log('✅ 没有 PNG 文件需要转换')
    return
  }

  console.log(`📦 找到 ${pngFiles.length} 个 PNG 文件\n`)

  // 创建备份目录
  await mkdir(BACKUP_DIR, { recursive: true })

  let totalOriginal = 0
  let totalConverted = 0
  let count = 0
  const errors: string[] = []

  for (const file of pngFiles) {
    const srcPath = join(IMAGES_DIR, file)
    const webpFile = file.replace(/\.png$/i, '.webp')
    const destPath = join(IMAGES_DIR, webpFile)

    const srcStat = await stat(srcPath)
    totalOriginal += srcStat.size

    try {
      // 转换 PNG → WebP
      await sharp(srcPath)
        .webp({ quality: QUALITY, effort: 6 })
        .toFile(destPath)

      const destStat = await stat(destPath)
      totalConverted += destStat.size

      // 将原 PNG 移到备份目录
      await rename(srcPath, join(BACKUP_DIR, file))

      count++
      const ratio = ((1 - destStat.size / srcStat.size) * 100).toFixed(1)
      console.log(`  ✅ [${count}/${pngFiles.length}] ${file} → ${webpFile}  (${(srcStat.size / 1024).toFixed(0)}KB → ${(destStat.size / 1024).toFixed(0)}KB, -${ratio}%)`)
    } catch (err) {
      errors.push(`${file}: ${(err as Error).message}`)
      console.error(`  ❌ ${file}:`, (err as Error).message)
    }
  }

  console.log(`\n📊 统计:`)
  console.log(`  原始 PNG 总大小: ${(totalOriginal / 1024 / 1024).toFixed(1)}MB (${pngFiles.length} 文件)`)
  console.log(`  转换 WebP 总大小: ${(totalConverted / 1024 / 1024).toFixed(1)}MB`)
  console.log(`  空间节省: ${((1 - totalConverted / totalOriginal) * 100).toFixed(1)}%`)
  console.log(`  PNG 原文件已备份到: ${BACKUP_DIR}`)
  if (errors.length) {
    console.log(`  ⚠️ ${errors.length} 个文件转换失败`)
  }
  console.log(`\n💡 下一步: 更新文章中的图片引用 .png → .webp`)
}

main().catch(err => {
  console.error('转换失败:', err)
  process.exit(1)
})
