import { useMemo, useState, useCallback, useEffect } from 'react'
import {
  Background,
  Controls,
  ReactFlow,
} from '@xyflow/react'
import '@xyflow/react/dist/style.css'
import Card from '../components/ui/Card.jsx'
import Chip from '../components/ui/Chip.jsx'
import { class11CrossLinks, class11MindMapDefinition } from '../data/class11MindMap.js'

function parseMindMapGraph(definition) {
  const nodeMap = new Map()
  const edges = []

  const ensureNode = (id, label = id, isFormula = false) => {
    const existing = nodeMap.get(id)
    if (existing) {
      if (label && existing.label === id) {
        existing.label = label
      }
      existing.isFormula = existing.isFormula || isFormula
      return
    }
    nodeMap.set(id, { id, label, isFormula })
  }

  const lineList = definition
    .split('\n')
    .map((line) => line.trim())
    .filter(Boolean)

  lineList.forEach((line) => {
    if (line.startsWith('flowchart') || line.startsWith('class') || line.startsWith('style')) {
      return
    }

    const squareNode = line.match(/^([A-Za-z0-9_]+)\[(.+)\]$/)
    if (squareNode) {
      ensureNode(squareNode[1], squareNode[2], false)
      return
    }

    const formulaNode = line.match(/^([A-Za-z0-9_]+)\(\((.+)\)\)$/)
    if (formulaNode) {
      ensureNode(formulaNode[1], formulaNode[2], true)
      return
    }

    const solidEdge = line.match(/^([A-Za-z0-9_]+)\s*-->\s*([A-Za-z0-9_]+)(?:\[(.+)\]|\(\((.+)\)\))?$/)
    if (solidEdge) {
      const source = solidEdge[1]
      const target = solidEdge[2]
      const targetSquareLabel = solidEdge[3]
      const targetFormulaLabel = solidEdge[4]

      ensureNode(source)
      ensureNode(target, targetSquareLabel || targetFormulaLabel || target, Boolean(targetFormulaLabel))

      edges.push({
        id: `${source}-${target}-${edges.length}`,
        source,
        target,
        kind: 'solid',
      })
      return
    }

    const dottedEdge = line.match(/^([A-Za-z0-9_]+)\s*-\.(.+)\.->\s*([A-Za-z0-9_]+)$/)
    if (dottedEdge) {
      const source = dottedEdge[1]
      const target = dottedEdge[3]
      ensureNode(source)
      ensureNode(target)

      edges.push({
        id: `${source}-${target}-${edges.length}`,
        source,
        target,
        kind: 'cross',
        label: dottedEdge[2].trim(),
      })
    }
  })

  return {
    nodes: Array.from(nodeMap.values()),
    edges,
  }
}

function subjectForNode(nodeId, parentMap) {
  let current = nodeId
  while (current) {
    if (current === 'P') return 'physics'
    if (current === 'C') return 'chemistry'
    if (current === 'M') return 'maths'
    current = parentMap.get(current)
  }
  return 'neutral'
}

function colorForSubject(subject, isFormula) {
  if (isFormula) {
    return {
      background: '#fff7ed',
      border: '#ea580c',
      color: '#7c2d12',
    }
  }

  if (subject === 'physics') {
    return {
      background: '#dbeafe',
      border: '#2563eb',
      color: '#0b3a75',
    }
  }

  if (subject === 'chemistry') {
    return {
      background: '#dcfce7',
      border: '#16a34a',
      color: '#14532d',
    }
  }

  if (subject === 'maths') {
    return {
      background: '#ffedd5',
      border: '#f97316',
      color: '#7c2d12',
    }
  }

  return {
    background: '#f8fafc',
    border: '#334155',
    color: '#0f172a',
  }
}

function buildReactFlowData(definition) {
  const parsed = parseMindMapGraph(definition)
  const childMap = new Map()
  const parentMap = new Map()
  const depthMap = new Map([['ROOT', 0]])

  parsed.edges
    .filter((edge) => edge.kind === 'solid')
    .forEach((edge) => {
      if (!childMap.has(edge.source)) childMap.set(edge.source, [])
      childMap.get(edge.source).push(edge.target)
      if (!parentMap.has(edge.target)) parentMap.set(edge.target, edge.source)
    })

  const queue = ['ROOT']
  while (queue.length) {
    const current = queue.shift()
    const children = childMap.get(current) || []
    children.forEach((childId) => {
      if (!depthMap.has(childId)) {
        depthMap.set(childId, (depthMap.get(current) || 0) + 1)
        queue.push(childId)
      }
    })
  }

  parsed.nodes.forEach((node) => {
    if (!depthMap.has(node.id)) {
      depthMap.set(node.id, 1)
    }
  })

  const depthBuckets = new Map()
  parsed.nodes.forEach((node) => {
    const depth = depthMap.get(node.id) || 1
    if (!depthBuckets.has(depth)) depthBuckets.set(depth, [])
    depthBuckets.get(depth).push(node)
  })

  const nodes = []
  const bucketEntries = Array.from(depthBuckets.entries()).sort((a, b) => a[0] - b[0])
  bucketEntries.forEach(([depth, list]) => {
    list.sort((a, b) => a.id.localeCompare(b.id))
    list.forEach((node, index) => {
      const subject = subjectForNode(node.id, parentMap)
      const palette = colorForSubject(subject, node.isFormula)
      nodes.push({
        id: node.id,
        data: { label: node.label },
        position: { x: depth * 280, y: index * 90 },
        style: {
          background: palette.background,
          border: `2px solid ${palette.border}`,
          color: palette.color,
          borderRadius: node.isFormula ? 999 : 12,
          fontWeight: 700,
          minWidth: 130,
          textAlign: 'center',
          padding: '8px 10px',
          boxShadow: '0 4px 10px rgba(17, 24, 39, 0.08)',
        },
      })
    })
  })

  const edges = parsed.edges.map((edge) => ({
    id: edge.id,
    source: edge.source,
    target: edge.target,
    kind: edge.kind,
    animated: edge.kind === 'cross',
    label: edge.kind === 'cross' ? edge.label : '',
    style:
      edge.kind === 'cross'
        ? { stroke: '#6b7280', strokeDasharray: '5 5', strokeWidth: 1.3 }
        : { stroke: '#64748b', strokeWidth: 1.2 },
  }))

  const labelMap = new Map(parsed.nodes.map((node) => [node.id, node.label]))

  return { nodes, edges, childMap, parentMap, labelMap }
}

function buildPathToRoot(nodeId, parentMap) {
  const path = []
  let current = nodeId

  while (current) {
    path.unshift(current)
    current = parentMap.get(current)
  }

  return path
}

function collectDescendants(nodeId, childMap) {
  const descendants = new Set()
  const queue = [...(childMap.get(nodeId) || [])]

  while (queue.length) {
    const current = queue.shift()
    if (descendants.has(current)) continue
    descendants.add(current)
    const children = childMap.get(current) || []
    children.forEach((childId) => queue.push(childId))
  }

  return descendants
}

function depthFromRoot(nodeId, parentMap) {
  let depth = 0
  let current = nodeId

  while (current && current !== 'ROOT') {
    current = parentMap.get(current)
    depth += 1
  }

  return depth
}

function MindMapCanvas({ initialNodes, initialEdges, childMap, parentMap, labelMap }) {
  const [activeNode, setActiveNode] = useState('ROOT')
  const [expandedNodes, setExpandedNodes] = useState(() => new Set(['ROOT']))
  const [flowInstance, setFlowInstance] = useState(null)

  const visibleNodeIds = useMemo(() => {
    const ids = new Set(['ROOT'])
    const queue = ['ROOT']

    while (queue.length) {
      const current = queue.shift()
      if (!expandedNodes.has(current)) {
        continue
      }

      const children = childMap.get(current) || []
      children.forEach((childId) => {
        if (!ids.has(childId)) {
          ids.add(childId)
          queue.push(childId)
        }
      })
    }

    return ids
  }, [childMap, expandedNodes])

  const filteredVisibleNodes = useMemo(
    () =>
      initialNodes
        .filter((node) => visibleNodeIds.has(node.id))
        .map((node) => {
        const children = childMap.get(node.id) || []
        const hasChildren = children.length > 0
        const expanded = expandedNodes.has(node.id)
        const isActive = node.id === activeNode

        return {
          ...node,
          data: {
            ...node.data,
            label: (
              <div className="mindmap-node-label">
                <span>{node.data.label}</span>
                {hasChildren ? (
                  <span className="mindmap-node-toggle">{expanded ? '-' : '+'}</span>
                ) : (
                  <span className="mindmap-node-dot">.</span>
                )}
              </div>
            ),
          },
          style: {
            ...node.style,
            boxShadow: isActive ? '0 0 0 3px rgba(29, 125, 122, 0.28)' : node.style?.boxShadow,
          },
        }
      }),
    [activeNode, childMap, expandedNodes, initialNodes, visibleNodeIds],
  )

  const compactPositions = useMemo(() => {
    const byDepth = new Map()

    filteredVisibleNodes.forEach((node) => {
      const depth = depthFromRoot(node.id, parentMap)
      if (!byDepth.has(depth)) byDepth.set(depth, [])
      byDepth.get(depth).push(node)
    })

    const positionMap = new Map()
    Array.from(byDepth.entries())
      .sort((a, b) => a[0] - b[0])
      .forEach(([depth, list]) => {
        list
          .sort((left, right) => (labelMap.get(left.id) || left.id).localeCompare(labelMap.get(right.id) || right.id))
          .forEach((node, index) => {
            positionMap.set(node.id, {
              x: depth * 290,
              y: index * 100,
            })
          })
      })

    return positionMap
  }, [filteredVisibleNodes, labelMap, parentMap])

  const visibleNodes = useMemo(() => {
    if (filteredVisibleNodes.length) {
      return filteredVisibleNodes.map((node) => ({
        ...node,
        position: compactPositions.get(node.id) || node.position,
      }))
    }

    // Hard fallback to avoid blank white canvas.
    return initialNodes
      .filter((node) => ['ROOT', 'P', 'C', 'M'].includes(node.id))
      .map((node) => ({ ...node }))
  }, [compactPositions, filteredVisibleNodes, initialNodes])

  const visibleEdges = useMemo(() => {
    const nodeIds = new Set(visibleNodes.map((node) => node.id))
    return initialEdges.filter((edge) => nodeIds.has(edge.source) && nodeIds.has(edge.target))
  }, [initialEdges, visibleNodes])

  const focusOnNode = useCallback(
    (nodeId) => {
      const targets = [nodeId, ...(childMap.get(nodeId) || [])]
      const targetNodes = visibleNodes.filter((node) => targets.includes(node.id))
      if (targetNodes.length && flowInstance) {
        flowInstance.fitView({
          nodes: targetNodes,
          duration: 600,
          padding: 0.45,
        })
      }
    },
    [childMap, flowInstance, visibleNodes],
  )

  const onNodeClick = useCallback(
    (_, node) => {
      setActiveNode(node.id)
      const children = childMap.get(node.id) || []

      setExpandedNodes((current) => {
        const next = new Set(current)

        if (!children.length) {
          return next
        }

        if (next.has(node.id)) {
          next.delete(node.id)

          // Collapse full subtree when parent is collapsed.
          const descendants = collectDescendants(node.id, childMap)
          descendants.forEach((descendantId) => next.delete(descendantId))
          return next
        }

        const path = buildPathToRoot(node.id, parentMap)
        path.forEach((id) => next.add(id))
        next.add(node.id)
        return next
      })

      focusOnNode(node.id)
    },
    [childMap, focusOnNode, parentMap],
  )

  useEffect(() => {
    if (!flowInstance) return

    if (visibleNodes.length) {
      flowInstance.fitView({ nodes: visibleNodes, duration: 450, padding: 0.28 })
    }
  }, [flowInstance, visibleNodes])

  const activeChildren = childMap.get(activeNode) || []

  return (
    <div className="mindmap-layout">
      <div className="mindmap-canvas mindmap-canvas--interactive">
        <ReactFlow
          nodes={visibleNodes}
          edges={visibleEdges}
          onNodeClick={onNodeClick}
          onInit={setFlowInstance}
          fitView
          fitViewOptions={{ padding: 0.28, minZoom: 1.05 }}
          defaultViewport={{ x: 0, y: 0, zoom: 1.15 }}
          minZoom={0.15}
          maxZoom={10}
          zoomOnScroll
          zoomOnScrollSpeed={10}
          zoomOnDoubleClick
          panOnDrag
          panOnScroll
          nodesDraggable={false}
        >
          <Controls showInteractive />
          <Background gap={20} color="#eadfcf" />
        </ReactFlow>
      </div>

      <aside className="mindmap-sidepanel">
        <h3>Node Navigator</h3>
        <p className="muted-copy">Selected: {labelMap.get(activeNode) || activeNode}</p>
        <p className="muted-copy">Click node to expand/collapse child topics.</p>
        <div className="mindmap-child-list">
          {activeChildren.length ? (
            activeChildren.map((childId) => (
              <button
                key={childId}
                type="button"
                className="mindmap-child-btn"
                onClick={() => {
                  setActiveNode(childId)
                  setExpandedNodes((current) => {
                    const next = new Set(current)
                    const path = buildPathToRoot(childId, parentMap)
                    path.forEach((id) => next.add(id))
                    return next
                  })
                  focusOnNode(childId)
                }}
              >
                Go to {labelMap.get(childId) || childId}
              </button>
            ))
          ) : (
            <p className="muted-copy">No child nodes for this selection.</p>
          )}
        </div>
      </aside>
    </div>
  )
}

function MindMapPage() {
  const { nodes, edges, childMap, parentMap, labelMap } = useMemo(
    () => buildReactFlowData(class11MindMapDefinition),
    [],
  )

  return (
    <div className="page-grid">
      <section className="hero-panel">
        <p className="eyebrow">Mind Map</p>
        <h1>Class 11 Knowledge Graph</h1>
        <p>
          Physics, Chemistry, and Mathematics mapped chapter-wise with key concepts,
          formula nodes, and interdisciplinary links.
        </p>
        <div className="chip-row mindmap-legend-row">
          <Chip tone="brand">Physics: Blue</Chip>
          <Chip tone="success">Chemistry: Green</Chip>
          <Chip tone="alert">Maths: Orange</Chip>
          <Chip tone="neutral">Formula Nodes: Double Circle</Chip>
        </div>
      </section>

      <Card
        title="Interactive Revision Graph"
        subtitle="Click any node, pan/zoom with controls, and jump from parent to child nodes"
      >
        <MindMapCanvas
          initialNodes={nodes}
          initialEdges={edges}
          childMap={childMap}
          parentMap={parentMap}
          labelMap={labelMap}
        />
      </Card>

      <Card title="Cross Links" subtitle="High-value interconnections for integrated revision">
        <ul className="mindmap-link-list">
          {class11CrossLinks.map((item) => (
            <li key={item}>{item}</li>
          ))}
        </ul>
      </Card>
    </div>
  )
}

export default MindMapPage