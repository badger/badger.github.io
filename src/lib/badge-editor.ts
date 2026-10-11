import { ExistingAppError, uploadEditorProject, validateAppName, type DiskDirectory } from './badge-editor-upload'
import { initEditorSplit } from './badge-editor-split'
import { bytesEqual, fileBytes, hasProjectChanges, listBadgeApps, loadExampleProject, projectCheckpoint, projectFile, readBadgeProject, readProjectDraft, saveProjectDraft, simulationRequest, validateFilePath, validateProjectLocation, type EditorCatalog, type EditorProject } from './badge-editor-project'
import { basicSetup } from 'codemirror'
import { EditorView, keymap } from '@codemirror/view'
import { EditorState } from '@codemirror/state'
import { indentWithTab, undo, redo, undoDepth, redoDepth } from '@codemirror/commands'
import { python } from '@codemirror/lang-python'
import { HighlightStyle, syntaxHighlighting } from '@codemirror/language'
import { tags } from '@lezer/highlight'

const starter = `import badgeware

badge.mode(LORES)

def update():
    screen.pen = color.rgb(95, 237, 131)
    screen.text("Hello, GitHub!", 10, 20)

run(update)
`

function newProject(): EditorProject {
  return { name: 'my-app', sourceName: 'my-app', origin: 'new', activePath: '__init__.py', files: [projectFile('__init__.py', new TextEncoder().encode(starter))] }
}

export async function initBadgeEditor() {
  const element = <T extends HTMLElement>(id: string) => document.getElementById(id) as T
  const appName = element<HTMLInputElement>('app-name')
  const example = element<HTMLSelectElement>('example')
  const deviceApp = element<HTMLSelectElement>('device-app')
  const live = element<HTMLInputElement>('live-preview')
  const stopButton = element<HTMLButtonElement>('stop')
  const connectButton = element<HTMLButtonElement>('connect-disk')
  const releaseButton = element<HTMLButtonElement>('release-disk')
  const uploadButton = element<HTMLButtonElement>('upload-code')
  const overwrite = element<HTMLInputElement>('overwrite')
  const overwriteOption = element('overwrite-option')
  const message = element('upload-message')
  const screen = element<HTMLCanvasElement>('badge-screen')
  const output = element('console-output')
  const runtimeStatus = element('runtime-status')
  const draftStatus = element('draft-status')
  const undoButton = element<HTMLButtonElement>('undo')
  const redoButton = element<HTMLButtonElement>('redo')
  const fileList = element('project-files')
  const assetPreview = element('asset-preview')
  const keyButtons = [...document.querySelectorAll<HTMLButtonElement>('[data-button]')]
  let project = newProject()
  let catalog: EditorCatalog | null = null
  let states = new Map<string, EditorState>()
  let currentEditorPath: string | null = null
  let worker: Worker | null = null
  let workerTimer: number | undefined
  let autoRunTimer: number | undefined
  let draftTimer: number | undefined
  let buttons = 0
  let disk: DiskDirectory | null = null
  let boundDisk: DiskDirectory | null = null
  let baseline: Map<string, Uint8Array> | undefined
  let busy = false
  let errorReported = false
  let previewUrl: string | null = null
  let saveGeneration = 0
  let saveChain = Promise.resolve()
  let initialized = false
  let locationError = false

  const extensions = [
        keymap.of([
          { key: 'F5', run: () => { runCode(); return true } },
          { key: 'Mod-Enter', run: () => { runCode(); return true } },
          { key: 'Mod-s', run: () => { saveDraft(); return true } },
          indentWithTab,
        ]),
        basicSetup,
        python(),
        EditorState.tabSize.of(4),
        EditorView.contentAttributes.of({ 'aria-label': 'Python source code', spellcheck: 'false' }),
        EditorView.theme({
          '&': { height: '100%', backgroundColor: '#0d1117', color: '#c9d1d9', fontSize: '13px' },
          '.cm-scroller': { overflow: 'auto', fontFamily: 'ui-monospace, SFMono-Regular, Menlo, monospace', lineHeight: '1.8' },
          '.cm-content': { padding: '18px 0', caretColor: '#5fed83' },
          '.cm-line': { padding: '0 16px' },
          '.cm-gutters': { backgroundColor: '#0d1117', color: '#6e7681', border: 'none', padding: '0 4px' },
          '.cm-activeLine, .cm-activeLineGutter': { backgroundColor: '#161b22' },
          '&.cm-focused': { outline: 'none' },
          '&.cm-focused .cm-cursor': { borderLeftColor: '#5fed83' },
          '&.cm-focused .cm-selectionBackground, .cm-selectionBackground, ::selection': { backgroundColor: '#26452f' },
          '.cm-panels': { backgroundColor: '#161b22', color: '#c9d1d9' },
        }, { dark: true }),
        syntaxHighlighting(HighlightStyle.define([
          { tag: tags.keyword, color: '#ff7b72' },
          { tag: [tags.string, tags.special(tags.string)], color: '#a5d6ff' },
          { tag: [tags.number, tags.bool, tags.null], color: '#79c0ff' },
          { tag: tags.comment, color: '#8b949e' },
          { tag: tags.function(tags.variableName), color: '#d2a8ff' },
          { tag: [tags.className, tags.typeName], color: '#ffa657' },
        ])),
    EditorView.updateListener.of(update => {
      updateHistoryButtons(update.state)
      if (update.docChanged) {
        const file = project.files.find(file => file.path === project.activePath)
        if (file && file.text !== null) file.text = update.state.doc.toString()
        states.set(project.activePath, update.state)
        renderFiles()
        updateLocationMessage()
        scheduleSave()
        scheduleRun()
      }
      if (update.selectionSet || update.docChanged) {
        const position = update.state.selection.main.head
        const line = update.state.doc.lineAt(position)
        element('cursor-position').textContent = `Ln ${line.number}, Col ${position - line.from + 1}`
      }
    }),
  ]
  const editor = new EditorView({ parent: element('code-editor'), state: EditorState.create({ doc: starter, extensions: [...extensions, EditorState.readOnly.of(true)] }) })
  const disposeSplit = initEditorSplit(() => editor.requestMeasure())

  function updateHistoryButtons(state: EditorState) {
    const editable = currentEditorPath !== null && !state.readOnly
    undoButton.disabled = !editable || undoDepth(state) === 0
    redoButton.disabled = !editable || redoDepth(state) === 0
  }

  undoButton.addEventListener('click', () => { undo(editor); editor.focus() })
  redoButton.addEventListener('click', () => { redo(editor); editor.focus() })

  function log(text: string) {
    output.textContent = ((output.textContent || '') + text.replace(/Pimoroni/gi, 'GitHub') + '\n').slice(-18000)
    output.scrollTop = output.scrollHeight
  }

  function showMessage(text: string, error = false) {
    locationError = false
    message.hidden = false
    message.textContent = text
    message.className = `mt-3 text-sm ${error ? 'text-red-400' : 'text-primary'}`
  }

  function updateLocationMessage() {
    try {
      validateProjectLocation(project)
      if (locationError) message.hidden = true
      locationError = false
    } catch (error) {
      showMessage(error instanceof Error ? error.message : 'Update the app paths before renaming.', true)
      locationError = true
    }
  }

  function scheduleSave() {
    clearTimeout(draftTimer)
    draftStatus.textContent = 'Saving draft…'
    draftTimer = window.setTimeout(saveDraft, 350)
  }

  function saveDraft() {
    clearTimeout(draftTimer)
    const snapshot = structuredClone(project)
    const generation = ++saveGeneration
    saveChain = saveChain.then(() => saveProjectDraft(snapshot)).then(() => {
      if (generation === saveGeneration) draftStatus.textContent = 'Draft saved'
    }).catch(() => {
      draftStatus.textContent = 'Draft could not be saved'
    })
  }

  function renderFiles() {
    fileList.replaceChildren()
    for (const file of project.files) {
      const button = document.createElement('button')
      button.type = 'button'
      button.className = 'project-file'
      button.setAttribute('aria-current', String(file.path === project.activePath))
      button.setAttribute('aria-label', `Open ${file.path}`)
      button.textContent = file.path + (bytesEqual(file.data, fileBytes(file)) ? '' : ' *')
      button.addEventListener('click', () => openProjectFile(file.path))
      fileList.append(button)
    }
  }

  function openProjectFile(path: string) {
    const file = project.files.find(file => file.path === path)
    if (!file) return
    if (currentEditorPath) states.set(currentEditorPath, editor.state)
    project.activePath = path
    element('active-file').textContent = path
    if (previewUrl) { URL.revokeObjectURL(previewUrl); previewUrl = null }
    assetPreview.replaceChildren()
    if (file.text !== null) {
      element('code-editor').hidden = false
      assetPreview.hidden = true
      editor.setState(states.get(path) || EditorState.create({ doc: file.text, extensions }))
      currentEditorPath = path
      editor.requestMeasure()
    } else {
      currentEditorPath = null
      element('code-editor').hidden = true
      assetPreview.hidden = false
      const label = document.createElement('p')
      label.textContent = `${file.path} · ${file.data.byteLength.toLocaleString()} bytes`
      assetPreview.append(label)
      if (/\.(png|jpe?g|gif|webp)$/i.test(path)) {
        previewUrl = URL.createObjectURL(new Blob([new Uint8Array(file.data)]))
        const image = document.createElement('img')
        image.src = previewUrl
        image.alt = path
        image.className = 'mt-5 max-h-80 max-w-full object-contain'
        assetPreview.append(image)
      }
    }
    renderFiles()
    updateHistoryButtons(editor.state)
    element('cursor-position').textContent = 'Ln 1, Col 1'
    saveDraft()
  }

  async function confirmReplacement() {
    const dialog = element<HTMLDialogElement>('replace-project')
    dialog.returnValue = ''
    const decision = new Promise<boolean>(resolve => dialog.addEventListener('close', () => resolve(dialog.returnValue === 'replace'), { once: true }))
    dialog.showModal()
    return decision
  }

  async function openProject(next: EditorProject, device: DiskDirectory | null = null, expected?: Map<string, Uint8Array>, restored = false) {
    if (initialized && hasProjectChanges(project) && !await confirmReplacement()) {
      return false
    }
    if (!restored) next.checkpoint = projectCheckpoint(next)
    stopWorker()
    project = next
    initialized = true
    boundDisk = device
    baseline = expected
    states = new Map()
    currentEditorPath = null
    appName.value = project.name
    overwrite.checked = false
    overwriteOption.hidden = true
    message.hidden = true
    locationError = false
    states.set(project.activePath, EditorState.create({ doc: project.files.find(file => file.path === project.activePath)?.text || '', extensions }))
    openProjectFile(project.activePath)
    updatePath()
    scheduleRun(0)
    return true
  }

  function releaseButtons() {
    buttons = 0
    worker?.postMessage({ buttons })
    keyButtons.forEach(button => button.dataset.pressed = 'false')
  }

  function stopWorker(status = 'Stopped') {
    clearTimeout(autoRunTimer)
    clearTimeout(workerTimer)
    worker?.terminate()
    worker = null
    releaseButtons()
    runtimeStatus.textContent = status
    stopButton.disabled = true
  }

  function scheduleRun(delay = 650) {
    clearTimeout(autoRunTimer)
    if (!live.checked) return
    runtimeStatus.textContent = delay ? 'Updating preview…' : 'Starting…'
    autoRunTimer = window.setTimeout(runCode, delay)
  }

  function runCode() {
    let request: ReturnType<typeof simulationRequest>
    try {
      validateAppName(project.name)
      request = simulationRequest(project)
    } catch (error) {
      stopWorker('Preview unavailable')
      output.textContent = error instanceof Error ? error.message : 'Could not simulate this project.'
      return
    }
    stopWorker()
    output.textContent = ''
    errorReported = false
    runtimeStatus.textContent = 'Loading MicroPython…'
    stopButton.disabled = false
    saveDraft()
    const activeWorker = new Worker('/simulator/micropython.worker.js', { type: 'module' })
    worker = activeWorker
    const fail = (reason: string) => {
      if (worker !== activeWorker) return
      log(reason)
      stopWorker('Runtime error')
    }
    activeWorker.onerror = event => { event.preventDefault(); fail(event.message || 'Could not load the simulator runtime.') }
    activeWorker.onmessageerror = () => fail('Could not read a simulator response.')
    workerTimer = window.setTimeout(() => fail('Runtime did not become ready. Press Run to retry.'), 30000)
    activeWorker.onmessage = ({ data }) => {
      if (worker !== activeWorker) return
      if (data.bootError) return fail(`Runtime could not start: ${data.bootError}`)
      if (data.ready) {
        clearTimeout(workerTimer)
        activeWorker.postMessage({ ...request, debug: false })
      }
      if (data.running) {
        runtimeStatus.textContent = 'Running'
        if (document.hidden) activeWorker.postMessage({ pause: true })
      }
      if (data.failed) { errorReported = true; runtimeStatus.textContent = 'Python error' }
      if (data.completed) {
        runtimeStatus.textContent = errorReported ? 'Python error' : 'Finished'
        stopButton.disabled = true
      }
      if (data.stdout) {
        log(String(data.stdout))
        if (String(data.stdout).includes('- ERROR:')) { errorReported = true; runtimeStatus.textContent = 'Python error' }
      }
      if (data.frame) {
        const { width, height, buffer } = data.frame
        screen.width = width
        screen.height = height
        screen.getContext('2d')?.putImageData(new ImageData(new Uint8ClampedArray(buffer), width, height), 0, 0)
        element('screen-placeholder').hidden = true
      }
      if (data.backlight !== undefined) screen.style.opacity = String(Math.max(0, Math.min(1, data.backlight)))
    }
    screen.style.opacity = '1'
  }

  function sendButton(bit: number, pressed: boolean) {
    if (pressed) buttons |= bit
    else buttons &= ~bit
    worker?.postMessage({ buttons })
    keyButtons.forEach(button => button.dataset.pressed = String(Boolean(buttons & Number(button.dataset.button))))
  }
  const keyMap: Record<string, number> = { ArrowLeft: 16, ' ': 8, ArrowRight: 4, ArrowUp: 2, ArrowDown: 1, Escape: 32 }
  for (const type of ['keydown', 'keyup'] as const) screen.addEventListener(type, event => {
    const bit = keyMap[event.key]
    if (!bit) return
    event.preventDefault()
    sendButton(bit, type === 'keydown')
  })
  screen.addEventListener('blur', releaseButtons)
  window.addEventListener('blur', releaseButtons)
  for (const button of keyButtons) {
    const bit = Number(button.dataset.button)
    button.addEventListener('pointerdown', event => { button.setPointerCapture(event.pointerId); sendButton(bit, true) })
    for (const type of ['pointerup', 'pointercancel', 'lostpointercapture']) button.addEventListener(type, () => sendButton(bit, false))
    button.addEventListener('keydown', event => {
      if (event.key === ' ' || event.key === 'Enter') { event.preventDefault(); sendButton(bit, true) }
    })
    button.addEventListener('keyup', event => {
      if (event.key === ' ' || event.key === 'Enter') { event.preventDefault(); sendButton(bit, false) }
    })
    button.addEventListener('blur', () => sendButton(bit, false))
  }

  function updatePath() {
    element('upload-path').textContent = `/apps/${project.name}/`
    overwrite.checked = false
    overwriteOption.hidden = true
    saveDraft()
  }

  function setBusy(value: boolean) {
    busy = value
    for (const id of ['connect-disk', 'release-disk', 'new-project', 'open-file', 'add-file']) element<HTMLButtonElement>(id).disabled = value
    uploadButton.disabled = value || !disk
    appName.disabled = value
    overwrite.disabled = value
    example.disabled = value || !catalog
    deviceApp.disabled = value || !disk
    element<HTMLButtonElement>('refresh-badge').disabled = value || !disk
  }

  async function refreshDeviceApps() {
    if (!disk) return
    const names = await listBadgeApps(disk)
    deviceApp.replaceChildren(new Option(names.length ? 'Choose an app to edit' : 'No Python apps found', ''))
    names.forEach(name => deviceApp.add(new Option(name, name)))
    element('badge-editor').dataset.connected = 'true'
    element('disk-status').textContent = `BADGER · ${names.length} apps`
  }

  connectButton.addEventListener('click', async () => {
    const picker = (window as unknown as { showDirectoryPicker?: (options: { mode: string }) => Promise<DiskDirectory> }).showDirectoryPicker
    if (!picker) { showMessage('Direct upload needs a Chromium browser such as Arc over HTTPS or localhost.', true); return }
    setBusy(true)
    try {
      const root = await picker.call(window, { mode: 'readwrite' })
      if (root.name.toUpperCase() !== 'BADGER') throw new Error('Select the BADGER USB volume itself, rather than an app folder.')
      await root.getDirectoryHandle('apps')
      const oldDisk = disk
      disk = root
      try { await refreshDeviceApps() } catch (error) { disk = oldDisk; throw error }
      releaseButton.hidden = false
      connectButton.hidden = true
      showMessage('Open a badge app to edit its files, or upload the current project.')
    } catch (error) {
      if (!(error instanceof DOMException && error.name === 'AbortError')) showMessage(error instanceof Error ? error.message : 'Could not open the BADGER disk.', true)
    } finally { setBusy(false) }
  })

  releaseButton.addEventListener('click', () => {
    disk = null
    boundDisk = null
    baseline = undefined
    releaseButton.hidden = true
    connectButton.hidden = false
    deviceApp.replaceChildren(new Option('Choose an app to edit', ''))
    overwrite.checked = false
    overwriteOption.hidden = true
    element('badge-editor').dataset.connected = 'false'
    element('disk-status').textContent = 'No badge connected'
    setBusy(false)
    showMessage('Disk released. Eject BADGER using your computer before unplugging it.')
  })

  element('refresh-badge').addEventListener('click', async () => {
    if (busy || !disk) return
    setBusy(true)
    try { await refreshDeviceApps() } catch (error) { showMessage(error instanceof Error ? error.message : 'Could not refresh badge files.', true) } finally { setBusy(false) }
  })

  deviceApp.addEventListener('change', async () => {
    if (busy || !disk || !deviceApp.value) return
    const name = deviceApp.value
    const root = disk
    setBusy(true)
    try {
      const loaded = await readBadgeProject(root, name)
      if (await openProject(loaded, root, new Map(loaded.files.map(file => [file.path, new Uint8Array(file.data)])))) showMessage(`Opened /apps/${name}/ from BADGER.`)
    } catch (error) { showMessage(error instanceof Error ? error.message : 'Could not read this app.', true) } finally { deviceApp.value = ''; setBusy(false) }
  })

  uploadButton.addEventListener('click', async () => {
    if (busy || !disk) return
    const root = disk
    const snapshot = structuredClone(project)
    const expected = boundDisk === root && snapshot.name === snapshot.sourceName ? baseline : undefined
    setBusy(true)
    try {
      element('disk-status').textContent = 'Uploading…'
      const result = await uploadEditorProject(root, snapshot, { replace: overwrite.checked && !overwriteOption.hidden, expected })
      boundDisk = root
      baseline = new Map(snapshot.files.map(file => [file.path, fileBytes(file)]))
      project.origin = 'badge'
      project.sourceName = project.name
      for (const file of project.files) {
        const uploaded = snapshot.files.find(item => item.path === file.path)
        if (uploaded) file.data = fileBytes(uploaded)
      }
      project.checkpoint = projectCheckpoint(snapshot)
      overwriteOption.hidden = true
      overwrite.checked = false
      renderFiles()
      saveDraft()
      showMessage(`${result.written} files uploaded and verified in ${result.path}/. Eject BADGER, then restart it.`)
      await refreshDeviceApps()
    } catch (error) {
      if (error instanceof ExistingAppError) overwriteOption.hidden = false
      showMessage(error instanceof Error ? error.message : 'Upload failed. Check the USB connection and try again.', true)
    } finally { setBusy(false) }
  })

  example.addEventListener('change', async () => {
    const app = catalog?.apps.find(app => app.name === example.value)
    if (!app || busy) return
    setBusy(true)
    try {
      const loaded = await loadExampleProject(app)
      await openProject(loaded)
    } catch (error) { showMessage(error instanceof Error ? error.message : 'Could not load this app.', true) } finally { example.value = ''; setBusy(false) }
  })

  element('new-project').addEventListener('click', async () => { if (!busy) await openProject(newProject()) })
  element('add-file').addEventListener('click', () => { element('new-file-form').hidden = !element('new-file-form').hidden; element<HTMLInputElement>('new-file-path').focus() })
  element<HTMLFormElement>('new-file-form').addEventListener('submit', event => {
    event.preventDefault()
    if (busy) return
    try {
      const path = validateFilePath(element<HTMLInputElement>('new-file-path').value.trim())
      if (!/\.(py|txt|json|csv|md|ini|toml|yaml|yml)$/i.test(path)) throw new Error('Use a Python or text file extension.')
      if (project.files.some(file => file.path === path)) throw new Error('This file already exists.')
      project.files.push(projectFile(path, new Uint8Array()))
      project.files.sort((a, b) => a.path.localeCompare(b.path))
      element('new-file-form').hidden = true
      element<HTMLInputElement>('new-file-path').value = ''
      openProjectFile(path)
      editor.focus()
    } catch (error) { showMessage(error instanceof Error ? error.message : 'Could not add this file.', true) }
  })

  const fileInput = element<HTMLInputElement>('file-input')
  element('open-file').addEventListener('click', () => fileInput.click())
  fileInput.addEventListener('change', async () => {
    const file = fileInput.files?.[0]
    if (!file || busy) return
    try {
      if (file.size > 1024 * 1024) throw new Error('Choose a Python file smaller than 1 MB.')
      const loaded = newProject()
      loaded.name = file.name.replace(/\.py$/i, '').toLowerCase().replace(/[^a-z0-9_-]/g, '-').slice(0, 48) || 'my-app'
      loaded.sourceName = loaded.name
      loaded.files = [projectFile('__init__.py', new Uint8Array(await file.arrayBuffer()))]
      if (loaded.files[0].text === null) throw new Error('Choose a UTF-8 Python file.')
      await openProject(loaded)
    } catch (error) { showMessage(error instanceof Error ? error.message : 'Could not open the file.', true) } finally { fileInput.value = '' }
  })
  element('download').addEventListener('click', () => {
    const file = project.files.find(file => file.path === project.activePath)
    if (!file) return
    const url = URL.createObjectURL(new Blob([new Uint8Array(fileBytes(file))]))
    const link = document.createElement('a')
    link.href = url
    link.download = file.path.split('/').at(-1) || '__init__.py'
    link.click()
    window.setTimeout(() => URL.revokeObjectURL(url), 1000)
  })
  element('run').addEventListener('click', runCode)
  stopButton.addEventListener('click', () => { live.checked = false; stopWorker(); log('Stopped by user.') })
  live.addEventListener('change', () => { if (live.checked) scheduleRun(0); else clearTimeout(autoRunTimer) })
  element('clear-output').addEventListener('click', () => output.textContent = '')
  appName.addEventListener('input', () => {
    project.name = appName.value.trim()
    updatePath()
    updateLocationMessage()
    scheduleRun()
  })
  document.addEventListener('visibilitychange', () => { releaseButtons(); worker?.postMessage({ pause: document.hidden }) })
  window.addEventListener('pagehide', event => { saveDraft(); stopWorker(); if (!event.persisted) { disposeSplit(); editor.destroy(); if (previewUrl) URL.revokeObjectURL(previewUrl) } })
  window.addEventListener('pageshow', event => { if (event.persisted) scheduleRun(0) })

  setBusy(true)
  void (async () => {
    try {
      const response = await fetch('/editor-apps/catalog.json')
      if (!response.ok) throw new Error('Could not load the app examples.')
      catalog = await response.json() as EditorCatalog
      example.replaceChildren(new Option('App examples', ''))
      catalog.apps.forEach(app => example.add(new Option(app.title, app.name)))
      example.disabled = busy
    } catch (error) { example.disabled = true; showMessage(error instanceof Error ? error.message : 'Could not load the app examples.', true) }
  })()
  let restored = false
  try {
    const draft = await readProjectDraft()
    if (draft?.files?.length && draft.files.some(file => file.path === '__init__.py')) {
      draft.files.forEach(file => validateFilePath(file.path))
      if (!draft.files.some(file => file.path === draft.activePath)) draft.activePath = '__init__.py'
      project = draft
      restored = true
    } else {
      const legacy = JSON.parse(localStorage.getItem('badger-editor-draft-v1') || 'null')
      if (legacy && typeof legacy.code === 'string' && typeof legacy.name === 'string') {
        project.name = legacy.name
        project.sourceName = legacy.name
        project.files = [projectFile('__init__.py', new TextEncoder().encode(legacy.code))]
        restored = true
      }
    }
  } catch { draftStatus.textContent = 'Browser storage unavailable' }
  await openProject(project, null, undefined, restored)
  setBusy(false)
}
