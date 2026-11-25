<script setup lang="ts">
// Draws one Mermaid diagram in the browser. The diagrams in docs/ set their own
// light fill colours for GitHub, so each sits on a light card in both themes.
import { nextTick, onBeforeUnmount, onMounted, ref, useId } from 'vue'

const props = defineProps<{ code: string }>()
const card = ref<HTMLElement | null>(null)
const svg = ref('')
const failed = ref(false)
// A diagram wider than its card fits it by default; "Full size" draws it at its
// natural width, scrolling sideways inside the card.
const naturalWidth = ref(0)
const fitsCard = ref(true)
const fullSize = ref(false)
const id = `mermaid-${useId()}`

function withNaturalWidth(markup: string): string {
  const width = /max-width:\s*([\d.]+)px/.exec(markup)?.[1]
  if (!width) return markup
  naturalWidth.value = Number(width)
  return markup.replace('width="100%"', `width="${width}"`)
}

/** Whether the diagram fits its card's content box at its natural width. */
function measure() {
  const el = card.value
  if (!el) return
  const style = getComputedStyle(el)
  const content =
    el.clientWidth - parseFloat(style.paddingLeft) - parseFloat(style.paddingRight)
  fitsCard.value = naturalWidth.value <= content
  if (fitsCard.value) fullSize.value = false
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
  await nextTick()
  measure()
  window.addEventListener('resize', measure)
})

onBeforeUnmount(() => window.removeEventListener('resize', measure))
</script>

<template>
  <div ref="card" class="mermaid-card" :class="{ 'mermaid-full': fullSize }">
    <button
      v-if="svg && !fitsCard"
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
