import mermaid from 'mermaid'
import { class11MindMapDefinition } from '../src/data/class11MindMap.js'

mermaid.initialize({ startOnLoad: false, securityLevel: 'loose', theme: 'base' })

try {
  await mermaid.parse(class11MindMapDefinition)
  console.log('PARSE_OK')
} catch (error) {
  console.log('PARSE_FAIL')
  console.log(error?.message || error)
  if (error?.str) {
    console.log('ERROR_SNIPPET_START')
    console.log(error.str)
    console.log('ERROR_SNIPPET_END')
  }
}
