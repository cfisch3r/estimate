<script setup lang="ts">
// Draws one Mermaid diagram in the browser. The diagrams in docs/ set their own
// light fill colours for GitHub, so each sits on a light card in both themes.
import { onMounted, ref, useId } from 'vue'

const props = defineProps<{ code: string }>()
const svg = ref('')
const failed = ref(false)
// A diagram wider than the column fits it by default; "Full size" draws it at its
// natural width, scrolling sideways inside the card.
const naturalWidth = ref(0)
const fullSize = ref(false)
const id = `mermaid-${useId()}`

function withNaturalWidth(markup: string): string {
  const width = /max-width:\s*([\d.]+)px/.exec(markup)?.[1]
  if (!width) return markup
  naturalWidth.value = Number(width)
  return markup.replace('width="100%"', `width="${width}"`)
}

onMounted(async () => {
  const { default: mermaid } = await import('mermaid')
  mermaid.initialize({
    startOnLoad: false,
    theme: 'base',
    securityLevel: 'strict',
    themeVariables: {
      fontFamily: 'Inter, system-ui, sans-serif',
      fontSize: '14px',
      background: '#fbfbfe',
      edgeLabelBackground: '#fbfbfe',
      lineColor: '#9397ab',
      textColor: '#232532',
    },
    flowchart: { wrappingWidth: 260, padding: 14 },
  })
  try {
    svg.value = withNaturalWidth(
      (await mermaid.render(id, decodeURIComponent(props.code))).svg,
    )
  } catch {
    failed.value = true
  }
})
</script>

<template>
  <div class="mermaid-card" :class="{ 'mermaid-full': fullSize }">
    <button
      v-if="svg && naturalWidth > 760"
      type="button"
      class="mermaid-toggle"
      :aria-pressed="fullSize"
      @click="fullSize = !fullSize"
    >
      {{ fullSize ? 'Fit to page' : 'Full size' }}
    </button>
    <div v-if="svg" class="mermaid-diagram" v-html="svg" />
    <pre v-else-if="failed" class="mermaid-failed">{{ decodeURIComponent(code) }}</pre>
    <div v-else class="mermaid-loading">Drawing the diagram…</div>
  </div>
</template>
