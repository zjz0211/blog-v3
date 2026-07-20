import type { Root, Heading } from 'mdast'
import type { Plugin } from 'unified'
import { visit } from 'unist-util-visit'

/**
 * 将文章内所有标题降一级（h1→h2, h2→h3...），
 * 避免和页面 PostHeader 的 title 冲突
 */
const remarkHeadingShift: Plugin<[], Root> = () => (tree) => {
  visit(tree, 'heading', (node: Heading) => {
    if (node.depth < 6) {
      node.depth = (node.depth + 1) as Heading['depth']
    }
  })
}

export default remarkHeadingShift
