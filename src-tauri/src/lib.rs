mod config;
mod overlay;
mod tray;

#[cfg(target_os = "macos")]
mod macos;
#[cfg(target_os = "macos")]
use macos as platform;

/// Windows and Linux don't have these yet (macOS comes first); the buddy simply stays on the ground there.
#[cfg(not(target_os = "macos"))]
mod platform {
    use crate::{FrontApp, WindowRect};

    pub fn deactivate() {}

    pub fn frontmost_app() -> Option<FrontApp> {
        None
    }

    pub fn windows(_skip_pid: i32) -> Vec<WindowRect> {
        Vec::new()
    }
}

use std::{sync::Mutex, time::Duration};

use serde::{Deserialize, Serialize};
use tauri::{AppHandle, Emitter, Manager, State, WebviewWindow};

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

/// The app in front, so the buddy can dress for it. Only the app is known, never what's in it.
#[derive(Clone, Debug, Default, PartialEq, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct FrontApp {
    pub bundle_id: String,
    pub name: String,
    pub pid: i32,
}

/// A window of another app; the buddy can stand on its top edge.
#[derive(Clone, Debug, Serialize)]
pub struct WindowRect {
    pub id: i64,
    pub x: f64,
    pub y: f64,
    pub w: f64,
    pub h: f64,
}

pub struct AppState {
    pub config: Mutex<Config>,
    pub catalog: Mutex<Catalog>,
    pub front_app: Mutex<Option<FrontApp>>,
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

/// Clicking the buddy makes Pixling the active app; this hands focus back to the app the user was in.
#[tauri::command]
fn give_back_focus(app: AppHandle) {
    let _ = app.run_on_main_thread(platform::deactivate);
}

/// Opens the menu bar menu at the cursor; used when the buddy is right-clicked.
#[tauri::command]
fn show_menu(app: AppHandle, window: WebviewWindow) -> Result<(), String> {
    let menu = tray::build_menu(&app).map_err(|e| e.to_string())?;
    window.popup_menu(&menu).map_err(|e| e.to_string())
}

/// Other apps' windows, front to back, in CSS pixels relative to the overlay.
#[tauri::command]
fn windows(window: WebviewWindow) -> Vec<WindowRect> {
    let (Ok(origin), Ok(scale)) = (window.outer_position(), window.scale_factor()) else {
        return Vec::new();
    };
    let (ox, oy) = (origin.x as f64 / scale, origin.y as f64 / scale);
    platform::windows(std::process::id() as i32)
        .into_iter()
        .map(|r| WindowRect { x: r.x - ox, y: r.y - oy, ..r })
        .collect()
}

#[tauri::command]
fn active_app(state: State<'_, AppState>) -> Option<FrontApp> {
    state.front_app.lock().unwrap().clone()
}

/// Lets the webpage write to the app's log, so its errors show up in the terminal.
#[tauri::command]
fn log(message: String) {
    eprintln!("[pixling] {message}");
}

/// Keeps an eye on which app is in front and tells the webpage when that changes. Pixling itself is
/// skipped, so clicking the buddy doesn't count as switching apps.
fn watch_front_app(app: &AppHandle) {
    let app = app.clone();
    let own_pid = std::process::id() as i32;
    std::thread::spawn(move || loop {
        if let Some(front) = platform::frontmost_app().filter(|f| f.pid != own_pid) {
            let state = app.state::<AppState>();
            let changed = {
                let mut current = state.front_app.lock().unwrap();
                let changed = current.as_ref() != Some(&front);
                if changed {
                    *current = Some(front.clone());
                }
                changed
            };
            if changed {
                let _ = app.emit("active-app", &front);
            }
        }
        std::thread::sleep(Duration::from_millis(700));
    });
}

pub fn run() {
    tauri::Builder::default()
        .plugin(tauri_plugin_autostart::init(tauri_plugin_autostart::MacosLauncher::LaunchAgent, None))
        .setup(|app| {
            // Pixling lives in the menu bar, not in the Dock or the app switcher.
            #[cfg(target_os = "macos")]
            app.set_activation_policy(tauri::ActivationPolicy::Accessory);

            let handle = app.handle().clone();
            app.manage(AppState {
                config: Mutex::new(config::load(&handle)),
                catalog: Mutex::new(Catalog::default()),
                front_app: Mutex::new(platform::frontmost_app()),
            });
            overlay::create(&handle)?;
            tray::create(&handle)?;
            overlay::follow_screen_changes(&handle);
            watch_front_app(&handle);
            Ok(())
        })
        .invoke_handler(tauri::generate_handler![
            get_config,
            set_catalog,
            cursor,
            set_click_through,
            give_back_focus,
            show_menu,
            windows,
            active_app,
            log
        ])
        .run(tauri::generate_context!())
        .expect("Pixling kon niet starten");
}
