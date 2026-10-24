import { loadExampleProject, loadSimulatorExample, simulationRequest, type EditorCatalog, type EditorProject, type SimulatorExamples } from './badge-editor-project'

import { initThumbnails } from './badge-editor-thumbnails'
import appDescriptions from '../data/app-descriptions.json'
import { sitePath } from './site-path'

type Collection = 'apps' | 'examples' | 'badge'
type PickerItem = { key: string; title: string; description: string; category: string; load: () => Promise<EditorProject> }

export function initProjectPicker(onChoose: (item: PickerItem) => Promise<void>, onToggle: (open: boolean) => void) {
  const dialog = document.getElementById('project-picker') as HTMLDialogElement
  const gallery = document.getElementById('picker-gallery')!
  const thumbnails = initThumbnails(gallery)
  const search = document.getElementById('picker-search') as HTMLInputElement
  const status = document.getElementById('picker-status')!
  const tabs = [...dialog.querySelectorAll<HTMLButtonElement>('[data-collection]')]
  const buttons = {
    apps: document.getElementById('browse-apps') as HTMLButtonElement,
    examples: document.getElementById('browse-examples') as HTMLButtonElement,
    badge: document.getElementById('device-app') as HTMLButtonElement,
  }
  const collections: Record<Collection, PickerItem[]> = { apps: [], examples: [], badge: [] }
  const failures: Partial<Record<Collection, string>> = {}
  const projects = new Map<string, Promise<EditorProject>>()
  let active: Collection = 'apps'
  let preview: Worker | null = null
  let generation = 0
  let timer: number | undefined
  let resetPreview: (() => void) | null = null

  function stopPreview() {
    generation++
    clearTimeout(timer)
    preview?.terminate()
    preview = null
    resetPreview?.()
    resetPreview = null
  }

  async function load(item: PickerItem) {
    if (item.key.startsWith('badge/')) return item.load()
    let pending = projects.get(item.key)
    if (!pending) {
      pending = item.load()
      projects.set(item.key, pending)
      pending.catch(() => projects.delete(item.key))
    }
    return structuredClone(await pending)
  }

  async function play(item: PickerItem, canvas: HTMLCanvasElement, cover: HTMLElement, label: HTMLElement) {
    stopPreview()
    const current = generation
    canvas.dataset.live = 'true'
    label.textContent = 'Loading preview…'
    resetPreview = () => { delete canvas.dataset.live; label.textContent = 'Play preview' }
    try {
      const project = await load(item)
      if (current !== generation || !dialog.open) return
      const worker = new Worker(sitePath('/simulator/micropython.worker.js'), { type: 'module' })
      preview = worker
      const fail = () => {
        if (preview !== worker) return
        stopPreview()
        cover.hidden = false
        label.textContent = 'Preview unavailable'
        status.textContent = `Could not preview ${item.title}. Use Edit to open its code and output.`
      }
      worker.onerror = event => { event.preventDefault(); fail() }
      worker.onmessageerror = fail
      timer = window.setTimeout(fail, 30000)
      worker.onmessage = ({ data }) => {
        if (preview !== worker) return
        if (data.bootError || data.failed) return fail()
        if (data.ready) {
          clearTimeout(timer)
          timer = window.setTimeout(fail, 6000)
          worker.postMessage({ ...simulationRequest(project), debug: false })
        }
        if (data.frame) {
          clearTimeout(timer)
          const { width, height, buffer } = data.frame
          canvas.width = width
          canvas.height = height
          canvas.getContext('2d')?.putImageData(new ImageData(new Uint8ClampedArray(buffer), width, height), 0, 0)
          cover.hidden = true
          label.textContent = 'Playing'
        }
        if (data.backlight !== undefined) canvas.style.opacity = String(Math.max(0, Math.min(1, data.backlight)))
      }
    } catch {
      if (current !== generation) return
      stopPreview()
      cover.hidden = false
      label.textContent = 'Preview unavailable'
      status.textContent = `Could not load ${item.title}. Try again.`
    }
  }

  function render() {
    stopPreview()
    thumbnails.reset()
    tabs.forEach(tab => {
      const selected = tab.dataset.collection === active
      tab.setAttribute('aria-selected', String(selected))
      tab.tabIndex = selected ? 0 : -1
    })
    gallery.setAttribute('aria-labelledby', `picker-tab-${active}`)
    gallery.replaceChildren()
    const query = search.value.trim().toLowerCase()
    const items = collections[active].filter(item => `${item.key} ${item.title} ${item.description} ${item.category}`.toLowerCase().includes(query))
    const noun = active === 'examples' ? 'example' : 'app'
    status.textContent = failures[active] || (items.length ? `${items.length} ${noun}${items.length === 1 ? '' : 's'}. Preview a card or choose Edit.` : query ? 'No matches. Try another search.' : active === 'badge' ? 'No editable apps found. Refresh the badge files.' : 'Loading collection…')
    for (const category of new Set(items.map(item => item.category))) {
      const section = document.createElement('section')
      const heading = document.createElement('h3')
      heading.className = 'font-mono'
      heading.textContent = `${category} · ${items.filter(item => item.category === category).length}`
      const grid = document.createElement('div')
      grid.className = 'picker-grid'
      for (const item of items.filter(item => item.category === category)) {
        const card = document.createElement('article')
        card.className = 'picker-card'
        const playButton = document.createElement('button')
        playButton.className = 'picker-preview'
        playButton.setAttribute('aria-label', `Preview ${item.title}`)
        const canvas = document.createElement('canvas')
        canvas.width = 320
        canvas.height = 240
        canvas.setAttribute('aria-hidden', 'true')
        const cover = document.createElement('span')
        cover.className = 'picker-cover'
        cover.textContent = 'Rendering preview…'
        const label = document.createElement('span')
        label.className = 'picker-preview-label'
        label.textContent = 'Loading'
        playButton.append(canvas, cover, label)
        playButton.addEventListener('click', () => { void play(item, canvas, cover, label) })
        const meta = document.createElement('div')
        meta.className = 'picker-meta'
        const caption = document.createElement('div')
        const title = document.createElement('strong')
        title.textContent = item.title
        const description = document.createElement('span')
        description.textContent = item.description
        caption.append(title, description)
        const edit = document.createElement('button')
        edit.className = 'editor-button'
        edit.textContent = 'Edit'
        edit.setAttribute('aria-label', `Edit ${item.title}`)
        edit.addEventListener('click', () => {
          dialog.close()
          void onChoose({ ...item, load: () => load(item) })
        })
        meta.append(caption, edit)
        card.append(playButton, meta)
        grid.append(card)
        thumbnails.add({ key: item.key, canvas, cover, label, load: () => load(item) })
      }
      section.append(heading, grid)
      gallery.append(section)
    }
  }

  function open(collection: Collection) {
    active = collection
    search.value = ''
    render()
    dialog.showModal()
    onToggle(true)
  }
  for (const [collection, button] of Object.entries(buttons)) button.addEventListener('click', () => open(collection as Collection))
  tabs.forEach((tab, index) => {
    tab.addEventListener('click', () => { active = tab.dataset.collection as Collection; render() })
    tab.addEventListener('keydown', event => {
      if (!['ArrowLeft', 'ArrowRight', 'Home', 'End'].includes(event.key)) return
      event.preventDefault()
      const enabled = tabs.filter(button => !button.disabled)
      const position = enabled.indexOf(tabs[index])
      const next = event.key === 'Home' ? 0 : event.key === 'End' ? enabled.length - 1 : (position + (event.key === 'ArrowRight' ? 1 : -1) + enabled.length) % enabled.length
      enabled[next].focus()
      enabled[next].click()
    })
  })
  search.addEventListener('input', render)
  document.getElementById('close-picker')!.addEventListener('click', () => dialog.close())
  dialog.addEventListener('close', () => { stopPreview(); thumbnails.reset(); onToggle(false) })
  const pausePreview = () => preview?.postMessage({ pause: document.hidden })
  document.addEventListener('visibilitychange', pausePreview)

  return {
    setApps(catalog: EditorCatalog) {
      collections.apps = catalog.apps.map(app => ({ key: `apps/${app.name}`, title: app.title, description: appDescriptions[app.name as keyof typeof appDescriptions] || `${app.files.length} ${app.files.length === 1 ? 'file' : 'files'}`, category: 'Badge apps', load: () => loadExampleProject(app) }))
      if (dialog.open) render()
    },
    setExamples(catalog: SimulatorExamples) {
      collections.examples = catalog.categories.flatMap(category => category.examples.map(example => ({ key: `examples/${example.file}`, title: example.file.replace(/\.py$/, '').replaceAll('_', ' ').replace(/\b\w/g, letter => letter.toUpperCase()), description: example.description, category: category.name, load: () => loadSimulatorExample(example) })))
      if (dialog.open) render()
    },
    setBadgeApps(names: string[], read: (name: string) => Promise<EditorProject>) {
      thumbnails.invalidateBadge()
      for (const key of projects.keys()) if (key.startsWith('badge/')) projects.delete(key)
      collections.badge = names.map(name => ({ key: `badge/${name}`, title: name, description: `/apps/${name}/`, category: 'On your badge', load: () => read(name) }))
      if (dialog.open) render()
    },
    setFailure(collection: 'apps' | 'examples', reason: string) { failures[collection] = reason; if (dialog.open) render() },
    setDisabled(busy: boolean, connected: boolean) {
      buttons.apps.disabled = busy
      buttons.examples.disabled = busy
      buttons.badge.disabled = busy || !connected
      tabs.find(tab => tab.dataset.collection === 'badge')!.disabled = !connected
    },
    get open() { return dialog.open },
    dispose() { stopPreview(); thumbnails.dispose(); document.removeEventListener('visibilitychange', pausePreview) },
  }
}
