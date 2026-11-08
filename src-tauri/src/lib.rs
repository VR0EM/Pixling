mod calendar;
mod config;
mod net;
mod files;
mod notes;
mod overlay;
mod system;
mod tray;
mod updater;

#[cfg(target_os = "macos")]
mod macos;
#[cfg(target_os = "macos")]
use macos as platform;

#[cfg(target_os = "windows")]
mod win;
#[cfg(target_os = "windows")]
use win as platform;

/// Linux doesn't have these yet (it comes last); the buddy simply stays on the ground there.
#[cfg(not(any(target_os = "macos", target_os = "windows")))]
mod platform {
    use crate::{FrontApp, WindowRect};

    pub const PHYSICAL_PIXELS: bool = false;

    pub fn deactivate() {}

    pub fn dragging() -> bool {
        false
    }

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
    #[serde(default)]
    pub characters: Vec<Choice>,
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
    /// Files last dropped on the buddy, waiting for a choice in the file menu.
    pub dropped: Mutex<Vec<String>>,
    /// The next thing in the calendar, shown at the top of the menu.
    pub next_event: Mutex<Option<String>>,
    /// A newer version found on GitHub, waiting for "Update" in the menu.
    pub update: Mutex<Option<tauri_plugin_updater::Update>>,
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

/// The cursor position in CSS pixels, relative to the overlay's top-left corner, and whether something is
/// being dragged. The overlay ignores the mouse most of the time, so the frontend polls this.
#[tauri::command]
fn cursor(app: AppHandle, window: WebviewWindow) -> Option<(f64, f64, bool)> {
    let pos = app.cursor_position().ok()?;
    let origin = window.outer_position().ok()?;
    let scale = window.scale_factor().ok()?;
    Some(((pos.x - origin.x as f64) / scale, (pos.y - origin.y as f64) / scale, platform::dragging()))
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
    // macOS reports points (already CSS pixels); Windows reports physical pixels.
    let k = if platform::PHYSICAL_PIXELS { scale } else { 1.0 };
    platform::windows(std::process::id() as i32)
        .into_iter()
        .map(|r| WindowRect { x: r.x / k - ox, y: r.y / k - oy, w: r.w / k, h: r.h / k, ..r })
        .collect()
}

#[tauri::command]
fn active_app(state: State<'_, AppState>) -> Option<FrontApp> {
    state.front_app.lock().unwrap().clone()
}

/// Changes some settings at once (from the wardrobe): saves them, tells every window and updates the menu.
#[tauri::command]
fn update_config(app: AppHandle, state: State<'_, AppState>, patch: serde_json::Value) -> Result<Config, String> {
    let cfg = {
        let mut cfg = state.config.lock().unwrap();
        let mut value = serde_json::to_value(&*cfg).map_err(|e| e.to_string())?;
        if let (Some(target), Some(changes)) = (value.as_object_mut(), patch.as_object()) {
            for (key, v) in changes {
                target.insert(key.clone(), v.clone());
            }
        }
        *cfg = serde_json::from_value(value).map_err(|e| e.to_string())?;
        cfg.clone()
    };
    config::save(&app, &cfg).map_err(|e| e.to_string())?;
    let _ = app.emit("config-changed", &cfg);
    let _ = tray::refresh(&app);
    Ok(cfg)
}

#[tauri::command]
fn open_wardrobe(app: AppHandle) -> Result<(), String> {
    overlay::open_page(&app, overlay::WARDROBE).map_err(|e| e.to_string())
}

#[tauri::command]
fn get_autostart(app: AppHandle) -> bool {
    use tauri_plugin_autostart::ManagerExt;
    app.autolaunch().is_enabled().unwrap_or(false)
}

#[tauri::command]
fn set_autostart(app: AppHandle, on: bool) -> Result<(), String> {
    use tauri_plugin_autostart::ManagerExt;
    let autostart = app.autolaunch();
    let result = if on { autostart.enable() } else { autostart.disable() };
    result.map_err(|e| e.to_string())?;
    let _ = tray::refresh(&app);
    Ok(())
}

#[tauri::command]
fn get_notes(app: AppHandle) -> Vec<notes::Note> {
    notes::load(&app)
}

/// Saves the notes and tells the buddy, so it can say it wrote them down.
#[tauri::command]
fn set_notes(app: AppHandle, list: Vec<notes::Note>) -> Result<(), String> {
    notes::save(&app, &list).map_err(|e| e.to_string())?;
    let _ = app.emit("notes-changed", list.iter().filter(|n| !n.done).count());
    Ok(())
}

#[tauri::command]
fn open_notes(app: AppHandle) -> Result<(), String> {
    overlay::open_page(&app, overlay::NOTES).map_err(|e| e.to_string())
}

/// The diary is owned by the webpage; Rust only keeps it in diary.json.
#[tauri::command]
fn get_diary(app: AppHandle) -> serde_json::Value {
    app.path()
        .app_config_dir()
        .ok()
        .and_then(|dir| std::fs::read_to_string(dir.join("diary.json")).ok())
        .and_then(|text| serde_json::from_str(&text).ok())
        .unwrap_or_else(|| serde_json::json!({ "days": {} }))
}

#[tauri::command]
fn set_diary(app: AppHandle, diary: serde_json::Value) -> Result<(), String> {
    let dir = app.path().app_config_dir().map_err(|e| e.to_string())?;
    std::fs::create_dir_all(&dir).map_err(|e| e.to_string())?;
    let text = serde_json::to_string_pretty(&diary).map_err(|e| e.to_string())?;
    std::fs::write(dir.join("diary.json"), text).map_err(|e| e.to_string())
}

/// Home-made accessories and buddies from the studio, kept in creations.json.
#[tauri::command]
fn get_creations(app: AppHandle) -> serde_json::Value {
    app.path()
        .app_config_dir()
        .ok()
        .and_then(|dir| std::fs::read_to_string(dir.join("creations.json")).ok())
        .and_then(|text| serde_json::from_str(&text).ok())
        .unwrap_or_else(|| serde_json::json!([]))
}

/// Saves them and tells every window, so the buddy and the wardrobe pick them up right away.
#[tauri::command]
fn set_creations(app: AppHandle, list: serde_json::Value) -> Result<(), String> {
    let dir = app.path().app_config_dir().map_err(|e| e.to_string())?;
    std::fs::create_dir_all(&dir).map_err(|e| e.to_string())?;
    let text = serde_json::to_string_pretty(&list).map_err(|e| e.to_string())?;
    std::fs::write(dir.join("creations.json"), text).map_err(|e| e.to_string())?;
    let _ = app.emit("creations-changed", &list);
    Ok(())
}

/// Reads a Pixling file the user dropped or picked. Only small JSON files, so nothing else gets read.
#[tauri::command]
fn read_text_file(path: String) -> Result<String, String> {
    let path = std::path::Path::new(&path);
    if path.extension().and_then(|e| e.to_str()).map(|e| e.eq_ignore_ascii_case("json")) != Some(true) {
        return Err("Only .json files can be added.".into());
    }
    let size = std::fs::metadata(path).map_err(|e| e.to_string())?.len();
    if size > 2_000_000 {
        return Err("That file is too big to be a Pixling file.".into());
    }
    std::fs::read_to_string(path).map_err(|e| e.to_string())
}

/// Saves a creation to share in the Downloads folder, without overwriting anything, and shows it in Finder.
#[tauri::command]
fn export_file(app: AppHandle, name: String, contents: String) -> Result<String, String> {
    let dir = app.path().download_dir().map_err(|e| e.to_string())?;
    let safe: String = name.chars().filter(|c| c.is_ascii_alphanumeric() || *c == '-' || *c == '.').collect();
    let (stem, ext) = safe.split_once('.').unwrap_or((safe.as_str(), "json"));
    let stem = if stem.is_empty() { "pixling" } else { stem };
    let path = files::free_path(&dir, stem, ext);
    std::fs::write(&path, contents).map_err(|e| e.to_string())?;
    files::reveal_path(&path);
    Ok(path.to_string_lossy().into_owned())
}

#[tauri::command]
fn copy_text(text: String) -> Result<(), String> {
    if files::copy_text(&text) {
        Ok(())
    } else {
        Err("Copying didn’t work.".into())
    }
}

/// Reads a calendar from its secret iCal address, off the main thread.
#[tauri::command]
async fn fetch_calendar(url: String) -> Result<String, String> {
    tauri::async_runtime::spawn_blocking(move || calendar::fetch(&url)).await.map_err(|e| e.to_string())?
}

/// Places matching a name, for the weather: Open-Meteo's answer as JSON.
#[tauri::command]
async fn find_place(name: String) -> Result<String, String> {
    tauri::async_runtime::spawn_blocking(move || calendar::find_place(&name)).await.map_err(|e| e.to_string())?
}

/// The weather right now at a place: Open-Meteo's answer as JSON.
#[tauri::command]
async fn fetch_weather(lat: f64, lon: f64) -> Result<String, String> {
    tauri::async_runtime::spawn_blocking(move || calendar::weather(lat, lon)).await.map_err(|e| e.to_string())?
}

/// Looks for a newer version on GitHub; returns its number, or None when this is the newest.
#[tauri::command]
async fn check_update(app: AppHandle) -> Result<Option<String>, String> {
    updater::check(&app).await
}

/// The next thing in the calendar, for the menu; None hides it.
#[tauri::command]
fn set_next_event(app: AppHandle, state: State<'_, AppState>, text: Option<String>) -> Result<(), String> {
    *state.next_event.lock().unwrap() = text;
    tray::refresh(&app).map_err(|e| e.to_string())
}

#[tauri::command]
fn open_studio(app: AppHandle) -> Result<(), String> {
    overlay::open_page(&app, overlay::STUDIO).map_err(|e| e.to_string())
}

#[tauri::command]
fn open_diary(app: AppHandle) -> Result<(), String> {
    overlay::open_page(&app, overlay::DIARY).map_err(|e| e.to_string())
}

#[tauri::command]
fn system_info() -> system::SystemInfo {
    system::read()
}

/// Files were dropped on the buddy: show what it can do with them.
#[tauri::command]
fn file_menu(app: AppHandle, window: WebviewWindow, paths: Vec<String>) -> Result<(), String> {
    files::show_menu(&app, &window, paths).map_err(|e| e.to_string())
}

/// Text next to the menu bar icon, used for the focus timer.
#[tauri::command]
fn set_tray_title(app: AppHandle, title: Option<String>) -> Result<(), String> {
    tray::set_title(&app, title).map_err(|e| e.to_string())
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
        .plugin(tauri_plugin_updater::Builder::new().build())
        .setup(|app| {
            // Pixling lives in the menu bar, not in the Dock or the app switcher.
            #[cfg(target_os = "macos")]
            app.set_activation_policy(tauri::ActivationPolicy::Accessory);

            let handle = app.handle().clone();
            app.manage(AppState {
                config: Mutex::new(config::load(&handle)),
                catalog: Mutex::new(Catalog::default()),
                front_app: Mutex::new(platform::frontmost_app()),
                dropped: Mutex::new(Vec::new()),
                next_event: Mutex::new(None),
                update: Mutex::new(None),
            });
            overlay::create(&handle)?;
            tray::create(&handle)?;
            overlay::follow_screen_changes(&handle);
            watch_front_app(&handle);
            system::watch(&handle);
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
            set_tray_title,
            update_config,
            open_wardrobe,
            get_notes,
            set_notes,
            open_notes,
            system_info,
            get_diary,
            set_diary,
            open_diary,
            get_creations,
            set_creations,
            open_studio,
            fetch_calendar,
            find_place,
            fetch_weather,
            set_next_event,
            check_update,
            read_text_file,
            export_file,
            copy_text,
            file_menu,
            get_autostart,
            set_autostart,
            log
        ])
        .run(tauri::generate_context!())
        .expect("Pixling could not start");
}
