// Patches the vendored simulator runtime for firmware modules and APIs that are
// newer than it. Modules are registered in sys.modules rather than staged as
// files, so simulations still stage exactly the project's files. Hardware-only
// features (IR, LED shows) are inert.
export const firmwareCompat = `
import machine, missing_details, sys

def _compat_module(name, **attributes):
    if name not in sys.modules:
        sys.modules[name] = type(name, (), attributes)

class _RemoteDescriptor:
    on_known = None

class _IR:
    def bind(self, descriptor):
        return descriptor

    def close(self):
        pass

_compat_module("aye_arr")
_compat_module("aye_arr.nec")
_compat_module("aye_arr.nec.remotes")
_compat_module("aye_arr.nec.remotes.descriptor", RemoteDescriptor=_RemoteDescriptor)
_compat_module("badgeware.ir", ir=_IR())
_compat_module("sparkle", resume=staticmethod(lambda: None), request_local_show=staticmethod(lambda: True))

if not hasattr(display, "set_async"):
    display.set_async = lambda *args: None
if not hasattr(machine, "reset_cause"):
    machine.PWRON_RESET = 1
    machine.WDT_RESET = 3
    machine.reset_cause = lambda: machine.PWRON_RESET

_show_missing = missing_details.show

def _show_missing_details(names, background=None, details=()):
    _show_missing(names or [" ".join(details)], background)

missing_details.show = _show_missing_details
`