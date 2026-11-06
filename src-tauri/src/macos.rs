//! macOS-only helpers: handing focus back, the frontmost app, and the list of windows on screen.

use core_foundation::base::{CFType, TCFType};
use core_foundation::dictionary::CFDictionary;
use core_foundation::number::CFNumber;
use core_foundation::string::CFString;
use core_graphics::window::{
    copy_window_info, kCGNullWindowID, kCGWindowListExcludeDesktopElements, kCGWindowListOptionOnScreenOnly,
};
use objc2::MainThreadMarker;
use objc2_app_kit::{NSApplication, NSWorkspace};

use crate::{FrontApp, WindowRect};

/// Makes the app the user was working in active again. Only works on the main thread.
pub fn deactivate() {
    if let Some(mtm) = MainThreadMarker::new() {
        NSApplication::sharedApplication(mtm).deactivate();
    }
}

pub fn frontmost_app() -> Option<FrontApp> {
    let app = NSWorkspace::sharedWorkspace().frontmostApplication()?;
    Some(FrontApp {
        bundle_id: app.bundleIdentifier().map(|s| s.to_string()).unwrap_or_default(),
        name: app.localizedName().map(|s| s.to_string()).unwrap_or_default(),
        pid: app.processIdentifier(),
    })
}

type Dict = CFDictionary<CFString, CFType>;

fn number(dict: &Dict, key: &'static str) -> Option<f64> {
    dict.find(CFString::from_static_string(key))?.downcast::<CFNumber>()?.to_f64()
}

/// Normal app windows that are on screen, front to back, in points from the top-left of the main screen.
/// Window positions don't need any permission; titles would, and aren't read.
pub fn windows(skip_pid: i32) -> Vec<WindowRect> {
    let options = kCGWindowListOptionOnScreenOnly | kCGWindowListExcludeDesktopElements;
    let Some(list) = copy_window_info(options, kCGNullWindowID) else {
        return Vec::new();
    };
    let mut out = Vec::new();
    for item in list.iter() {
        let dict: Dict = unsafe { CFDictionary::wrap_under_get_rule(*item as _) };
        // Layer 0 holds ordinary windows; the Dock, menu bar and pop-ups live on other layers.
        if number(&dict, "kCGWindowLayer") != Some(0.0) {
            continue;
        }
        if number(&dict, "kCGWindowOwnerPID") == Some(f64::from(skip_pid)) {
            continue;
        }
        if number(&dict, "kCGWindowAlpha").unwrap_or(1.0) < 0.1 {
            continue;
        }
        let Some(bounds) = dict
            .find(CFString::from_static_string("kCGWindowBounds"))
            .and_then(|v| v.downcast::<CFDictionary>())
        else {
            continue;
        };
        let bounds: Dict = unsafe { CFDictionary::wrap_under_get_rule(bounds.as_concrete_TypeRef()) };
        let (Some(x), Some(y), Some(w), Some(h)) = (
            number(&bounds, "X"),
            number(&bounds, "Y"),
            number(&bounds, "Width"),
            number(&bounds, "Height"),
        ) else {
            continue;
        };
        if w < 120.0 || h < 60.0 {
            continue;
        }
        let id = number(&dict, "kCGWindowNumber").unwrap_or(0.0) as i64;
        out.push(WindowRect { id, x, y, w, h });
    }
    out
}
