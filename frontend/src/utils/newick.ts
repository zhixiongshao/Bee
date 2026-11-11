export type TreeNode = {
  name: string
  length: number
  children: TreeNode[]
}

export function parseNewick(input: string): TreeNode {
  const s = input.trim().replace(/;+\s*$/, '')
  let i = 0

  function parseName(): string {
    let name = ''
    while (i < s.length && !'(),:;'.includes(s[i])) {
      name += s[i]
      i += 1
    }
    return name.trim()
  }

  function parseLength(): number {
    if (s[i] !== ':') return 0
    i += 1
    let num = ''
    while (i < s.length && /[0-9.eE+-]/.test(s[i])) {
      num += s[i]
      i += 1
    }
    return Number(num) || 0
  }

  function parseNode(): TreeNode {
    const node: TreeNode = { name: '', length: 0, children: [] }
    if (s[i] === '(') {
      i += 1
      node.children.push(parseNode())
      while (s[i] === ',') {
        i += 1
        node.children.push(parseNode())
      }
      if (s[i] !== ')') throw new Error('Invalid Newick: expected )')
      i += 1
      node.name = parseName()
      node.length = parseLength()
    } else {
      node.name = parseName()
      node.length = parseLength()
    }
    return node
  }

  return parseNode()
}

export type LaidOut = {
  x: number
  y: number
  name: string
  length: number
  isLeaf: boolean
  color: string
  parent?: { x: number; y: number }
}

type Meta = Record<string, { lineage?: string; color?: string }>

function countLeaves(node: TreeNode): number {
  if (!node.children.length) return 1
  return node.children.reduce((a, c) => a + countLeaves(c), 0)
}

function depthOf(node: TreeNode): number {
  if (!node.children.length) return node.length || 0
  return (node.length || 0) + Math.max(...node.children.map(depthOf), 0)
}

export function layoutRectangular(
  root: TreeNode,
  meta: Meta,
  width: number,
  height: number,
): LaidOut[] {
  const leaves = countLeaves(root)
  const maxDepth = Math.max(depthOf(root), 1e-9)
  const pad = 24
  const out: LaidOut[] = []
  let leafIndex = 0
  const positions = new Map<TreeNode, { x: number; y: number }>()

  function assignLeaves(node: TreeNode, dist: number) {
    const d = dist + (node.length || 0)
    if (!node.children.length) {
      const y = pad + ((height - pad * 2) * leafIndex) / Math.max(leaves - 1, 1)
      leafIndex += 1
      positions.set(node, { x: pad + ((width - pad * 2) * d) / maxDepth, y })
      return
    }
    for (const c of node.children) assignLeaves(c, d)
    const ys = node.children.map((c) => positions.get(c)!.y)
    const y = (Math.min(...ys) + Math.max(...ys)) / 2
    positions.set(node, { x: pad + ((width - pad * 2) * d) / maxDepth, y })
  }

  assignLeaves(root, 0)

  function emit(node: TreeNode, parent?: TreeNode) {
    const p = positions.get(node)!
    const m = meta[node.name] || {}
    out.push({
      x: p.x,
      y: p.y,
      name: node.name,
      length: node.length,
      isLeaf: node.children.length === 0,
      color: m.color || '#5b6b67',
      parent: parent
        ? { x: positions.get(parent)!.x, y: positions.get(parent)!.y }
        : undefined,
    })
    for (const c of node.children) emit(c, node)
  }
  emit(root)
  return out
}

export function layoutRadial(
  root: TreeNode,
  meta: Meta,
  width: number,
  height: number,
): LaidOut[] {
  const leaves = countLeaves(root)
  const maxDepth = Math.max(depthOf(root), 1e-9)
  const cx = width / 2
  const cy = height / 2
  const R = Math.min(width, height) / 2 - 28
  const out: LaidOut[] = []
  let leafIndex = 0
  const positions = new Map<TreeNode, { x: number; y: number; angle: number }>()

  function assign(node: TreeNode, dist: number) {
    const d = dist + (node.length || 0)
    if (!node.children.length) {
      const angle = (Math.PI * 2 * leafIndex) / leaves - Math.PI / 2
      leafIndex += 1
      const r = (R * d) / maxDepth
      positions.set(node, {
        x: cx + r * Math.cos(angle),
        y: cy + r * Math.sin(angle),
        angle,
      })
      return
    }
    for (const c of node.children) assign(c, d)
    const angles = node.children.map((c) => positions.get(c)!.angle)
    const angle = angles.reduce((a, b) => a + b, 0) / angles.length
    const r = (R * d) / maxDepth
    positions.set(node, {
      x: cx + r * Math.cos(angle),
      y: cy + r * Math.sin(angle),
      angle,
    })
  }
  assign(root, 0)

  function emit(node: TreeNode, parent?: TreeNode) {
    const p = positions.get(node)!
    const m = meta[node.name] || {}
    out.push({
      x: p.x,
      y: p.y,
      name: node.name,
      length: node.length,
      isLeaf: node.children.length === 0,
      color: m.color || '#5b6b67',
      parent: parent
        ? { x: positions.get(parent)!.x, y: positions.get(parent)!.y }
        : undefined,
    })
    for (const c of node.children) emit(c, node)
  }
  emit(root)
  return out
}
