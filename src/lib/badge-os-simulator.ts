import { firmwareCompat } from './badge-firmware-compat'
import { fileBytes, projectFile, simulationSource, validateFilePath, type EditorCatalog, type EditorCatalogApp, type ProjectFile } from './badge-editor-project'
import { sitePath } from './site-path'

export type BadgeOsApp = { name: string; files: ProjectFile[] }
export type BadgeOsCatalog = EditorCatalog & { launcher?: EditorCatalogApp & { stock?: string[] } }

const appRoot = '/system/apps'

// Mirrors badge/main.py: the menu returns an app path, the app runs until HOME,
// then control returns to the menu. The simulator's machine.reset() and pin IRQs
// are inert, so HOME and reset() unwind the app with a BaseException instead.
const launcher = `
import builtins, machine, sys, time, badgeware

class _ReturnHome(BaseException):
    pass

_armed = False
_target = None
_native_poll = badge.poll

# Like the firmware's HOME interrupt, run the app's on_exit hook once before
# returning to the menu so apps can save state and restore defaults.
def _exit_app():
    app = sys.modules.get(_target)
    on_exit = getattr(app, "on_exit", None)
    if callable(on_exit):
        try:
            on_exit()
        except Exception as e:
            sys.print_exception(e)

def _poll():
    global _armed
    _native_poll()
    if _armed and badge.pressed(BUTTON_HOME):
        _armed = False
        _exit_app()
        raise _ReturnHome()

def _reset():
    raise _ReturnHome()

badge.poll = _poll
machine.reset = _reset
builtins.reset = _reset
badgeware.reset = _reset

def _release():
    badge.poll()
    while badge.held():
        time.sleep(0.02)
        badge.poll()

def _launch(path):
    # Apps (including the menu) may add import paths; restore them all on exit.
    saved_path = list(sys.path)
    try:
        return launch(path)
    except _ReturnHome:
        return None
    finally:
        sys.path[:] = saved_path

while True:
    _armed = False
    badge.mode(LORES | VSYNC)
    badge.autorotate(True)
    badgeware.set_backlight(1.0)
    _release()
    _target = _launch("${appRoot}/menu")
    if not _target:
        continue
    _release()
    badge.mode(LORES | VSYNC)
    _armed = True
    _launch(_target)
`

export function badgeOsRequest(menu: BadgeOsApp, apps: BadgeOsApp[], prelude = '') {
  const files: { name: string; content: Uint8Array }[] = []
  for (const app of [menu, ...apps]) {
    validateFilePath(app.name)
    for (const file of app.files) {
      validateFilePath(file.path)
      const text = file.path.endsWith('.py') && file.text !== null ? simulationSource(file.text) : file.text
      files.push({ name: `${appRoot}/${app.name === menu.name ? 'menu' : app.name}/${file.path}`, content: fileBytes({ ...file, text }) })
    }
  }
  const program = `import editor_support\nimport sys\nsys.path[:0] = ["/system/lib", "/lib", "/system"]\n${firmwareCompat}\n${prelude}\n${launcher}`
  return { program, files }
}

async function loadApp(app: EditorCatalogApp): Promise<BadgeOsApp> {
  const files = await Promise.all(app.files.map(async path => {
    validateFilePath(path)
    const response = await fetch(sitePath(`/editor-apps/${encodeURIComponent(app.name)}/${path.split('/').map(encodeURIComponent).join('/')}`))
    if (!response.ok) throw new Error(`Could not load ${app.name}/${path}`)
    return projectFile(path, new Uint8Array(await response.arrayBuffer()))
  }))
  return { name: app.name, files }
}

export async function loadBadgeOs() {
  const response = await fetch(sitePath('/editor-apps/catalog.json'))
  if (!response.ok) throw new Error('Could not load the app catalog')
  const catalog = await response.json() as BadgeOsCatalog
  if (!catalog.launcher) throw new Error('The app catalog has no launcher')
  const stock = new Set(catalog.launcher.stock ?? catalog.apps.map(app => app.name))
  const [menu, ...apps] = await Promise.all([catalog.launcher, ...catalog.apps.filter(app => stock.has(app.name))].map(loadApp))
  return badgeOsRequest(menu, apps)
}
