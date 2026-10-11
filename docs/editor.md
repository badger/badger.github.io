# Browser editor

The `/editor` page uses CodeMirror for editing and a locally hosted MicroPython WASM worker for simulation. It loads the saved project on startup and runs it automatically. With Auto-run enabled, source changes restart the simulation after a 650 ms pause in typing. Stop disables automatic simulation; Run, F5, or Command/Ctrl+Enter runs the current project manually.

Projects contain an `__init__.py` entry point, companion Python and text files, and binary assets. The file sidebar lets users switch between files, edit text, preview images, and add files. Each simulation stages the complete project in the virtual filesystem, sets its working directory and import path, and executes the entry point using its actual filename. A fresh worker terminates the previous program and resets its virtual state. The display receives RGBA framebuffer messages. Pointer and keyboard controls release held buttons when focus changes, and execution pauses in hidden tabs.

The examples use the same installable-app selection rules as `/apps`. `public/editor-apps/catalog.json` records the bundled public `badger/home` revision and lists every project file. Run `npm run sync:editor-apps` to refresh the bundled examples, including modules and assets. Editing an example changes only the editor project.

The current project, including edited files and assets, is saved in the `badger-editor-projects` IndexedDB database. Replacing an edited project with New app, an example, a local file, or a badge app requires confirmation. The guard includes renamed projects and empty added files and survives draft restoration. Earlier drafts without a checkpoint are protected conservatively. Earlier single-file localStorage drafts are migrated when no project draft exists. Open and Download icon buttons load a local Python file and save the active file. Undo and Redo use the active text file’s CodeMirror history, which is retained when switching files within the project.

On screens at least 1024 pixels wide, drag the divider between the code and simulator panes to resize them. Arrow keys adjust the split, Shift uses larger steps, and double-click or Enter restores the default. The split is saved locally. Narrow screens keep the stacked layout. Drag the bottom handle to resize both panes vertically on any screen size. Up/Down keys adjust the height; double-click or Enter restores 620 pixels. Height is saved separately from the horizontal split. The source editor fills the available height, while simulator contents scroll when needed.

## Badge disk workflow

Connect the badge over USB and double tap its reset button to enter disk mode. Connect badge opens the native directory picker. Select the BADGER volume itself; it must contain an existing `apps` directory. This requires HTTPS or localhost and a browser supporting `showDirectoryPicker`, such as Arc.

The connected badge app selector reads Python apps from `/apps`. Opening an app loads its source, companion files, and assets for editing and simulation. Hidden files and Python caches are skipped. Menu and Startup are protected. Projects are limited to 16 MB and twelve path components.

The badge mounts the USB volume at `/system` during execution. Simulation therefore stages each project only at `/system/apps/<name>`, corresponding to `/apps/<name>` on the selected volume. It does not create aliases under the original example name. Apps referencing their original folder in Python source must retain their name or have those paths edited before simulation or upload. Companion modules are checked too.

Uploads to an existing app write only edited and added files from a badge app or example. Unmodified files and assets are skipped without opening or reading them. Restored drafts retain their verified-file baseline across reconnects. Only files actually verified are marked as known on the badge, so a partial example update does not claim its other files match the device. Edits to known files changed externally cause the upload to stop before those files are overwritten. Editing an unverified example file that differs from its installed version requires allowing the update explicitly. UTF-8 byte-order marks are preserved to prevent unchanged text files being rewritten.

The button shows the number of files eligible for upload, or No changes when there is nothing to send. A first install copies the entire project, including required modules and assets, and is labelled Install with the full file count. A new or locally opened project can also replace its files in an existing destination after confirmation. Other files in an existing app remain intact. The uploader writes companion files and assets before `__init__.py`, closes each writer, and verifies each file byte for byte. Progress shows the current filename and completed count. A failure restores files already written or removes a newly created app. Upload uses a snapshot so edits typed during a write remain in the editor afterward. The app selector updates from its cached list after upload; Refresh files performs an explicit disk rescan.

Uploads rewrite each changed file. The browser's `createWritable` API writes to a temporary file and replaces the original at close. Seeking to a changed line would still copy and replace the file, so byte-range patches do not provide an in-place USB update.

Disconnect drops the editor's directory handle. Eject BADGER through the computer before unplugging it, then restart the badge to run the uploaded project. Browser filesystem tests do not establish physical USB acceptance.

## Runtime provenance and limits

The runtime is adapted from badgeware-web-simulator commit `eb3b3fbf27e6e61635aef5de11ab17e6303e8c20`. Its MIT notice and the MicroPython MIT notice remain in `public/simulator/LICENSE`. `public/simulator/THIRD_PARTY.md` records the compiled-dependency audit, source revisions, artifact hashes, and notices in `public/simulator/licenses/`. The interface uses the Badger site theme and GitHub branding. The upstream interface, 3D model, OS apps, and promotional assets are excluded. The worker reports boot failures, Python failures, and completed programs to the editor. Runtime, font, module, and example requests use the site's origin.

The runtime provides a 320 by 240 color display and six keyboard or pointer buttons. Compatibility modules map the catalog's newer directional button names to these inputs. Touch follows held buttons; orientation and IMU readings are synthetic. Wi-Fi reports disconnected, requests and time synchronization report unavailable, and simulator secrets contain only empty placeholders. Actual device credentials are never loaded. Network-dependent features and physical sensors require testing on the badge. Bundling an app does not establish complete runtime compatibility.

## Verification

Run `npm run test:editor` for project and upload tests, `npm run test:app-descriptions` for the existing catalog tests, and `npm run build` for the static site build. Editor tests use an in-memory disk adapter and cover catalog assets, nested project reads, virtual filesystem staging, complete uploads, dirty-file updates, external modifications, rollback, failed-write cleanup, protected apps, unsafe paths, and denied disk access. Browser and physical badge testing remain separate acceptance checks.
