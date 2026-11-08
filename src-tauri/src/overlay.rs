use std::time::Duration;

use tauri::{AppHandle, Manager, PhysicalPosition, PhysicalSize, WebviewUrl, WebviewWindow, WebviewWindowBuilder};

pub const LABEL: &str = "buddy";

/// Creates the transparent, always-on-top window the buddy lives in. It covers the work area of the main
/// screen (everything except the menu bar and the Dock) and lets clicks through until the cursor is on
/// the buddy itself; the frontend switches that on and off.
pub fn create(app: &AppHandle) -> tauri::Result<WebviewWindow> {
    let window = WebviewWindowBuilder::new(app, LABEL, WebviewUrl::App("index.html".into()))
        .title("Pixling")
        .transparent(true)
        .decorations(false)
        .shadow(false)
        .always_on_top(true)
        .skip_taskbar(true)
        .resizable(false)
        .focused(false)
        .visible(false)
        .visible_on_all_workspaces(true)
        .accept_first_mouse(true)
        .build()?;
    fit_to_screen(&window)?;
    #[cfg(target_os = "macos")]
    crate::macos::make_nonactivating(window.ns_window()?);
    #[cfg(target_os = "windows")]
    crate::win::make_nonactivating(window.hwnd()?.0);
    window.set_ignore_cursor_events(true)?;
    window.show()?;
    Ok(window)
}

pub const WARDROBE: &str = "wardrobe";
pub const NOTES: &str = "notes";
pub const DIARY: &str = "diary";
pub const STUDIO: &str = "studio";
pub const WELCOME: &str = "welcome";

/// Opens one of the normal windows (the wardrobe or the notes), or brings it forward.
pub fn open_page(app: &AppHandle, label: &str) -> tauri::Result<()> {
    let (title, width, height) = match label {
        NOTES => ("Pixling · Notes", 420.0, 520.0),
        DIARY => ("Pixling · Diary", 460.0, 600.0),
        STUDIO => ("Pixling · Studio", 1040.0, 760.0),
        WELCOME => ("Welcome to Pixling", 560.0, 660.0),
        _ => ("Pixling · Wardrobe", 640.0, 880.0),
    };
    let window = match app.get_webview_window(label) {
        Some(window) => window,
        None => WebviewWindowBuilder::new(app, label, WebviewUrl::App(format!("{label}.html").into()))
            .title(title)
            .inner_size(width, height)
            .resizable(label != WARDROBE && label != STUDIO && label != WELCOME)
            .center()
            .build()?,
    };
    window.show()?;
    window.set_focus()?;
    Ok(())
}

/// Sizes the overlay to the main screen's work area, if it isn't already.
pub fn fit_to_screen(window: &WebviewWindow) -> tauri::Result<()> {
    let Some(monitor) = window.primary_monitor()? else {
        return Ok(());
    };
    let area = monitor.work_area();
    let position = PhysicalPosition::new(area.position.x, area.position.y);
    let size = PhysicalSize::new(area.size.width, area.size.height);
    if window.outer_position()? != position {
        window.set_position(position)?;
    }
    if window.inner_size()? != size {
        window.set_size(size)?;
    }
    Ok(())
}

/// Checks every few seconds whether the work area changed (Dock moved or resized, another main screen)
/// and refits the overlay. The webpage gets a resize event and moves the buddy back onto the ground.
pub fn follow_screen_changes(app: &AppHandle) {
    let app = app.clone();
    std::thread::spawn(move || loop {
        std::thread::sleep(Duration::from_secs(3));
        if let Some(window) = app.get_webview_window(LABEL) {
            if let Err(e) = fit_to_screen(&window) {
                eprintln!("Pixling: could not fit the window to the screen: {e}");
            }
        }
    });
}
