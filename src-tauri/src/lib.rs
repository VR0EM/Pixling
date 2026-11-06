mod config;
mod overlay;
mod tray;

use std::sync::Mutex;

use serde::{Deserialize, Serialize};
use tauri::{AppHandle, Manager, State, WebviewWindow};

pub use config::Config;

/// One choice in the menu bar menu, such as a species or a colour.
#[derive(Clone, Debug, Default, Deserialize, Serialize)]
pub struct Choice {
    pub id: String,
    pub name: String,
}

/// Everything the buddy can look like. The frontend owns the sprites, so it sends this list at startup
/// and the menu is built from it; that keeps the names in one place.
#[derive(Clone, Debug, Default, Deserialize, Serialize)]
pub struct Catalog {
    pub species: Vec<Choice>,
    pub palettes: Vec<Choice>,
    pub accessories: Vec<Choice>,
}

pub struct AppState {
    pub config: Mutex<Config>,
    pub catalog: Mutex<Catalog>,
}

#[tauri::command]
fn get_config(state: State<'_, AppState>) -> Config {
    state.config.lock().unwrap().clone()
}

#[tauri::command]
fn set_catalog(app: AppHandle, state: State<'_, AppState>, catalog: Catalog) -> Result<(), String> {
    *state.catalog.lock().unwrap() = catalog;
    tray::refresh(&app).map_err(|e| e.to_string())
}

/// The cursor position in CSS pixels, relative to the overlay's top-left corner. The overlay ignores the
/// mouse most of the time, so the frontend polls this to know where the cursor is.
#[tauri::command]
fn cursor(app: AppHandle, window: WebviewWindow) -> Option<(f64, f64)> {
    let pos = app.cursor_position().ok()?;
    let origin = window.outer_position().ok()?;
    let scale = window.scale_factor().ok()?;
    Some(((pos.x - origin.x as f64) / scale, (pos.y - origin.y as f64) / scale))
}

/// Lets clicks fall through the transparent overlay to the windows below it.
#[tauri::command]
fn set_click_through(window: WebviewWindow, on: bool) -> Result<(), String> {
    window.set_ignore_cursor_events(on).map_err(|e| e.to_string())
}

/// Opens the menu bar menu at the cursor; used when the buddy is right-clicked.
#[tauri::command]
fn show_menu(app: AppHandle, window: WebviewWindow) -> Result<(), String> {
    let menu = tray::build_menu(&app).map_err(|e| e.to_string())?;
    window.popup_menu(&menu).map_err(|e| e.to_string())
}

/// Lets the webpage write to the app's log, so its errors show up in the terminal.
#[tauri::command]
fn log(message: String) {
    eprintln!("[pixling] {message}");
}

pub fn run() {
    tauri::Builder::default()
        .setup(|app| {
            // Pixling lives in the menu bar, not in the Dock or the app switcher.
            #[cfg(target_os = "macos")]
            app.set_activation_policy(tauri::ActivationPolicy::Accessory);

            let handle = app.handle().clone();
            app.manage(AppState {
                config: Mutex::new(config::load(&handle)),
                catalog: Mutex::new(Catalog::default()),
            });
            overlay::create(&handle)?;
            tray::create(&handle)?;
            overlay::follow_screen_changes(&handle);
            Ok(())
        })
        .invoke_handler(tauri::generate_handler![
            get_config,
            set_catalog,
            cursor,
            set_click_through,
            show_menu,
            log
        ])
        .run(tauri::generate_context!())
        .expect("Pixling kon niet starten");
}
