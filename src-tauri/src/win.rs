//! Windows-only helpers: the overlay that never takes the focus, the app in front, the windows on screen
//! and whether something is being dragged. The counterpart of macos.rs.

use std::{
    ffi::c_void,
    path::Path,
    sync::Mutex,
};

use ::windows::Win32::{
    Foundation::{CloseHandle, HWND, LPARAM, POINT, RECT},
    Graphics::{
        Dwm::{DwmGetWindowAttribute, DWMWA_CLOAKED, DWMWA_EXTENDED_FRAME_BOUNDS},
        Gdi::{GetMonitorInfoW, MonitorFromWindow, MONITORINFO, MONITOR_DEFAULTTONEAREST},
    },
    System::Registry::{RegCloseKey, RegEnumKeyExW, RegGetValueW, RegOpenKeyExW, HKEY, HKEY_CURRENT_USER, KEY_READ, RRF_RT_REG_QWORD},
    System::Threading::{OpenProcess, QueryFullProcessImageNameW, PROCESS_NAME_WIN32, PROCESS_QUERY_LIMITED_INFORMATION},
    UI::{
        Input::KeyboardAndMouse::{GetAsyncKeyState, VK_LBUTTON},
        WindowsAndMessaging::{
            EnumWindows, GetClassNameW, GetCursorPos, GetForegroundWindow, GetWindow, GetWindowLongPtrW,
            GetWindowThreadProcessId, IsIconic, IsWindowVisible, SetWindowLongPtrW, GWL_EXSTYLE, GW_OWNER,
            WS_EX_NOACTIVATE, WS_EX_TOOLWINDOW,
        },
    },
};
use ::windows::core::{BOOL, PCWSTR, PWSTR};

use crate::{FrontApp, WindowRect};

/// Window positions on Windows are in physical pixels; lib.rs turns them into CSS pixels.
pub const PHYSICAL_PIXELS: bool = true;

/// The overlay never becomes the active window (see `make_nonactivating`), so there's nothing to give back.
pub fn deactivate() {}

/// Makes clicking or dragging the buddy leave the focus in the app you work in, and keeps the overlay out
/// of Alt+Tab.
pub fn make_nonactivating(hwnd: *mut c_void) {
    if hwnd.is_null() {
        return;
    }
    let hwnd = HWND(hwnd);
    unsafe {
        let style = GetWindowLongPtrW(hwnd, GWL_EXSTYLE);
        SetWindowLongPtrW(hwnd, GWL_EXSTYLE, style | WS_EX_NOACTIVATE.0 as isize | WS_EX_TOOLWINDOW.0 as isize);
    }
}

/// Where the left button went down, while it's held.
static PRESSED_AT: Mutex<Option<POINT>> = Mutex::new(None);

/// Is the user dragging something (a file, say)? Windows has no global "drag in progress" signal that
/// needs no permission, so: the left button is held and the mouse moved a bit since it went down.
pub fn dragging() -> bool {
    let down = unsafe { GetAsyncKeyState(i32::from(VK_LBUTTON.0)) } as u16 & 0x8000 != 0;
    let mut pressed = PRESSED_AT.lock().unwrap();
    if !down {
        *pressed = None;
        return false;
    }
    let mut now = POINT::default();
    if unsafe { GetCursorPos(&mut now) }.is_err() {
        return false;
    }
    let start = *pressed.get_or_insert(now);
    (now.x - start.x).abs() + (now.y - start.y).abs() > 8
}

/// The full path of a process's program, like `C:\...\Code.exe`.
fn program_of(pid: u32) -> Option<String> {
    unsafe {
        let process = OpenProcess(PROCESS_QUERY_LIMITED_INFORMATION, false, pid).ok()?;
        let mut buffer = [0u16; 1024];
        let mut size = buffer.len() as u32;
        let ok = QueryFullProcessImageNameW(process, PROCESS_NAME_WIN32, PWSTR(buffer.as_mut_ptr()), &mut size).is_ok();
        let _ = CloseHandle(process);
        ok.then(|| String::from_utf16_lossy(&buffer[..size as usize]))
    }
}

/// The app in front. Windows has no bundle ids, so the program's file name stands in (`code.exe`), and
/// its name without the extension is the app name.
pub fn frontmost_app() -> Option<FrontApp> {
    let hwnd = unsafe { GetForegroundWindow() };
    if hwnd.0.is_null() {
        return None;
    }
    let mut pid = 0u32;
    unsafe { GetWindowThreadProcessId(hwnd, Some(&mut pid)) };
    let program = program_of(pid)?;
    let path = Path::new(&program);
    Some(FrontApp {
        bundle_id: path.file_name()?.to_string_lossy().to_lowercase(),
        name: path.file_stem()?.to_string_lossy().into_owned(),
        pid: pid as i32,
    })
}

fn class_name(hwnd: HWND) -> String {
    let mut buffer = [0u16; 128];
    let len = unsafe { GetClassNameW(hwnd, &mut buffer) };
    String::from_utf16_lossy(&buffer[..len.max(0) as usize])
}

/// Hidden for real: minimised, invisible, or "cloaked" (on another virtual desktop, or a suspended store app).
fn hidden(hwnd: HWND) -> bool {
    unsafe {
        if !IsWindowVisible(hwnd).as_bool() || IsIconic(hwnd).as_bool() {
            return true;
        }
        let mut cloaked = 0u32;
        let got = DwmGetWindowAttribute(hwnd, DWMWA_CLOAKED, (&mut cloaked as *mut u32).cast(), size_of::<u32>() as u32);
        got.is_ok() && cloaked != 0
    }
}

struct Collect {
    skip_pid: u32,
    out: Vec<WindowRect>,
}

unsafe extern "system" fn visit(hwnd: HWND, data: LPARAM) -> BOOL {
    let collect = &mut *(data.0 as *mut Collect);
    if hidden(hwnd) {
        return true.into();
    }
    // Tool windows (floating palettes) and owned windows (dialogs) aren't places to stand.
    let style = GetWindowLongPtrW(hwnd, GWL_EXSTYLE) as u32;
    if style & WS_EX_TOOLWINDOW.0 != 0 || GetWindow(hwnd, GW_OWNER).map(|o| !o.0.is_null()).unwrap_or(false) {
        return true.into();
    }
    // The desktop and the taskbar are windows too.
    if matches!(class_name(hwnd).as_str(), "Progman" | "WorkerW" | "Shell_TrayWnd" | "Shell_SecondaryTrayWnd") {
        return true.into();
    }
    let mut pid = 0u32;
    GetWindowThreadProcessId(hwnd, Some(&mut pid));
    if pid == collect.skip_pid {
        return true.into();
    }
    // The visible frame, without the invisible resize border around it.
    let mut rect = RECT::default();
    let got = DwmGetWindowAttribute(hwnd, DWMWA_EXTENDED_FRAME_BOUNDS, (&mut rect as *mut RECT).cast(), size_of::<RECT>() as u32);
    if got.is_err() {
        return true.into();
    }
    let (w, h) = (f64::from(rect.right - rect.left), f64::from(rect.bottom - rect.top));
    if w >= 120.0 && h >= 60.0 {
        collect.out.push(WindowRect { id: hwnd.0 as i64, x: f64::from(rect.left), y: f64::from(rect.top), w, h });
    }
    true.into()
}

/// Normal app windows on screen, front to back, in physical pixels from the top-left of the main screen.
/// Only positions are read, never titles or contents.
pub fn windows(skip_pid: i32) -> Vec<WindowRect> {
    let mut collect = Collect { skip_pid: skip_pid as u32, out: Vec::new() };
    unsafe {
        let _ = EnumWindows(Some(visit), LPARAM(&mut collect as *mut Collect as isize));
    }
    collect.out
}

/// Is the window in front covering the whole main screen (a film, a presentation, a game)?
pub fn fullscreen(skip_pid: i32) -> bool {
    unsafe {
        let hwnd = GetForegroundWindow();
        if hwnd.0.is_null() || hidden(hwnd) {
            return false;
        }
        let mut pid = 0u32;
        GetWindowThreadProcessId(hwnd, Some(&mut pid));
        // The desktop and the taskbar cover the screen too, but aren't fullscreen apps.
        if pid == skip_pid as u32 || matches!(class_name(hwnd).as_str(), "Progman" | "WorkerW" | "Shell_TrayWnd") {
            return false;
        }
        let mut rect = RECT::default();
        if ::windows::Win32::UI::WindowsAndMessaging::GetWindowRect(hwnd, &mut rect).is_err() {
            return false;
        }
        let monitor = MonitorFromWindow(hwnd, MONITOR_DEFAULTTONEAREST);
        let mut info = MONITORINFO { cbSize: size_of::<MONITORINFO>() as u32, ..Default::default() };
        // Only the main screen, where the buddy lives.
        if !GetMonitorInfoW(monitor, &mut info).as_bool() || info.dwFlags & 1 == 0 {
            return false;
        }
        let m = info.rcMonitor;
        rect.left <= m.left && rect.top <= m.top && rect.right >= m.right && rect.bottom >= m.bottom
    }
}

fn wide(text: &str) -> Vec<u16> {
    text.encode_utf16().chain(std::iter::once(0)).collect()
}

/// Whether an app's entry in Windows' microphone privacy list says it's using the microphone now:
/// it started and hasn't stopped yet.
unsafe fn using(parent: HKEY, name: &[u16]) -> bool {
    let read = |value: &str| {
        let mut data = 0u64;
        let mut size = size_of::<u64>() as u32;
        let value = wide(value);
        let ok = RegGetValueW(
            parent,
            PCWSTR(name.as_ptr()),
            PCWSTR(value.as_ptr()),
            RRF_RT_REG_QWORD,
            None,
            Some((&mut data as *mut u64).cast()),
            Some(&mut size),
        )
        .is_ok();
        ok.then_some(data)
    };
    matches!((read("LastUsedTimeStart"), read("LastUsedTimeStop")), (Some(start), Some(0)) if start != 0)
}

/// Goes through the apps under a key of the microphone privacy list.
unsafe fn any_using(path: &str) -> bool {
    let mut key = HKEY::default();
    let path = wide(path);
    if RegOpenKeyExW(HKEY_CURRENT_USER, PCWSTR(path.as_ptr()), Some(0), KEY_READ, &mut key).is_err() {
        return false;
    }
    let mut found = false;
    for index in 0.. {
        let mut name = [0u16; 512];
        let mut len = name.len() as u32;
        if RegEnumKeyExW(key, index, Some(PWSTR(name.as_mut_ptr())), &mut len, None, None, None, None).is_err() {
            break;
        }
        if using(key, &name[..=len as usize]) {
            found = true;
            break;
        }
    }
    let _ = RegCloseKey(key);
    found
}

/// Is any app using the microphone right now (a call)? Windows keeps this in its privacy settings;
/// only whether it's on is read, never what it hears.
pub fn mic_in_use() -> bool {
    const BASE: &str = r"Software\Microsoft\Windows\CurrentVersion\CapabilityAccessManager\ConsentStore\microphone";
    unsafe { any_using(BASE) || any_using(&format!(r"{BASE}\NonPackaged")) }
}
