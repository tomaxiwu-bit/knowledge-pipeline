import { describe, expect, it } from 'vitest'
import { runForceLayout, type GraphNode } from '../src/lib/graph'

describe('runForceLayout', () => {
  it('positions nodes inside the supplied viewport', async () => {
    const nodes: GraphNode[] = [
      { id: 'a', title: 'A', type: 'rss', x: 0, y: 0, vx: 0, vy: 0, radius: 12 },
      { id: 'b', title: 'B', type: 'memo', x: 0, y: 0, vx: 0, vy: 0, radius: 12 }
    ]

    await runForceLayout(nodes, [{ source: 'a', target: 'b', kind: 'references' }], {
      width: 240,
      height: 160,
      iterations: 10
    })

    for (const node of nodes) {
      expect(node.x).toBeGreaterThanOrEqual(node.radius + 10)
      expect(node.x).toBeLessThanOrEqual(240 - node.radius - 10)
      expect(node.y).toBeGreaterThanOrEqual(node.radius + 10)
      expect(node.y).toBeLessThanOrEqual(160 - node.radius - 10)
      expect(Number.isFinite(node.x)).toBe(true)
      expect(Number.isFinite(node.y)).toBe(true)
    }
  })
})
