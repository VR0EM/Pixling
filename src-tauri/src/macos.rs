//! macOS-only helpers: handing focus back, the frontmost app, and the list of windows on screen.

use core_foundation::base::{CFType, TCFType};
use core_foundation::dictionary::CFDictionary;
use core_foundation::number::CFNumber;
use core_foundation::string::CFString;
use core_graphics::window::{
    copy_window_info, kCGNullWindowID, kCGWindowListExcludeDesktopElements, kCGWindowListOptionOnScreenOnly,
};
use objc2::runtime::{AnyClass, AnyObject};
use objc2::{msg_send, sel, ClassType, MainThreadMarker};
use objc2_app_kit::{NSApplication, NSEvent, NSPanel, NSPasteboard, NSPasteboardNameDrag, NSWindow, NSWindowStyleMask, NSWorkspace};
use std::sync::atomic::{AtomicIsize, Ordering};

use crate::{FrontApp, WindowRect};

/// Window positions on macOS are in points, the same unit as CSS pixels.
pub const PHYSICAL_PIXELS: bool = false;

/// Makes the app the user was working in active again. Only works on the main thread.
pub fn deactivate() {
    if let Some(mtm) = MainThreadMarker::new() {
        NSApplication::sharedApplication(mtm).deactivate();
    }
}

/// Turns the overlay into a non-activating panel, the kind of window Spotlight uses: clicking or dragging
/// the buddy then never makes Pixling the active app, so the app you work in keeps its focus. Must run on
/// the main thread, right after the window is made.
pub fn make_nonactivating(ns_window: *mut std::ffi::c_void) {
    if ns_window.is_null() || MainThreadMarker::new().is_none() {
        return;
    }
    unsafe {
        // Same window, now treated as a panel; the web view and its events stay as they are.
        objc2::ffi::object_setClass(ns_window.cast::<AnyObject>(), NSPanel::class() as *const AnyClass);
        let window = &*ns_window.cast::<NSWindow>();
        window.setStyleMask(window.styleMask() | NSWindowStyleMask::NonactivatingPanel);
        // Panels hide when their app isn't active, and Pixling never is.
        window.setHidesOnDeactivate(false);
        // The style mask alone isn't always honoured after creation; this private switch makes it stick.
        let prevent = sel!(_setPreventsActivation:);
        let responds: bool = msg_send![window, respondsToSelector: prevent];
        if responds {
            let _: () = msg_send![window, _setPreventsActivation: true];
        }
    }
}

/// The drag pasteboard's change count the last time no mouse button was down.
static DRAG_COUNT_AT_REST: AtomicIsize = AtomicIsize::new(-1);

/// Is the user dragging something (a file, say) right now? macOS bumps the drag pasteboard's change count
/// when a drag starts, so: a mouse button is down and that count moved since the button went down.
pub fn dragging() -> bool {
    let count = NSPasteboard::pasteboardWithName(unsafe { NSPasteboardNameDrag }).changeCount();
    if NSEvent::pressedMouseButtons() == 0 {
        DRAG_COUNT_AT_REST.store(count, Ordering::Relaxed);
        return false;
    }
    let at_rest = DRAG_COUNT_AT_REST.load(Ordering::Relaxed);
    at_rest >= 0 && count != at_rest
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

/// Is the window in front covering the whole main screen (a film, a presentation, a game)?
pub fn fullscreen(skip_pid: i32) -> bool {
    let screen = core_graphics::display::CGDisplay::main().bounds();
    let (sx, sy, sw, sh) = (screen.origin.x, screen.origin.y, screen.size.width, screen.size.height);
    windows(skip_pid)
        .first()
        .is_some_and(|w| w.x <= sx + 1.0 && w.y <= sy + 1.0 && w.x + w.w >= sx + sw - 1.0 && w.y + w.h >= sy + sh - 1.0)
}

#[repr(C)]
struct PropertyAddress {
    selector: u32,
    scope: u32,
    element: u32,
}

#[link(name = "CoreAudio", kind = "framework")]
extern "C" {
    fn AudioObjectGetPropertyData(
        object: u32,
        address: *const PropertyAddress,
        qualifier_size: u32,
        qualifier: *const std::ffi::c_void,
        size: *mut u32,
        data: *mut std::ffi::c_void,
    ) -> i32;
}

/// Reads a 32-bit CoreAudio property; the four-letter codes are CoreAudio's own.
fn audio_property(object: u32, selector: &[u8; 4]) -> Option<u32> {
    let address = PropertyAddress { selector: u32::from_be_bytes(*selector), scope: u32::from_be_bytes(*b"glob"), element: 0 };
    let mut value: u32 = 0;
    let mut size = std::mem::size_of::<u32>() as u32;
    let status = unsafe {
        AudioObjectGetPropertyData(object, &address, 0, std::ptr::null(), &mut size, (&mut value as *mut u32).cast())
    };
    (status == 0).then_some(value)
}

/// Is any app using the microphone right now (a call)? Only whether it's on, never what it hears; this
/// needs no permission.
pub fn mic_in_use() -> bool {
    // The system object (1): its default input device ('dIn '), and whether that is running anywhere ('gone').
    match audio_property(1, b"dIn ") {
        Some(device) if device != 0 => audio_property(device, b"gone").unwrap_or(0) != 0,
        _ => false,
    }
}

#[cfg(test)]
mod tests {
    #[test]
    fn reads_the_screen_state_without_permissions() {
        // Whatever the answer on this computer, asking must work and not crash.
        println!("fullscreen: {}, microphone in use: {}", super::fullscreen(0), super::mic_in_use());
    }
}
