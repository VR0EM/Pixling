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
    window.set_ignore_cursor_events(true)?;
    window.show()?;
    Ok(window)
}

pub const WARDROBE: &str = "kleerkast";

/// Opens the wardrobe, a normal window for choosing the look and habits, or brings it forward.
pub fn open_wardrobe(app: &AppHandle) -> tauri::Result<()> {
    let window = match app.get_webview_window(WARDROBE) {
        Some(window) => window,
        None => WebviewWindowBuilder::new(app, WARDROBE, WebviewUrl::App("kleerkast.html".into()))
            .title("Pixling · Kleerkast")
            .inner_size(640.0, 760.0)
            .resizable(false)
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
                eprintln!("Pixling: kon het venster niet passend maken: {e}");
            }
        }
    });
}
