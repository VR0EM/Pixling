use tauri::{
    image::Image,
    menu::{CheckMenuItem, IsMenuItem, Menu, MenuItem, PredefinedMenuItem, Submenu},
    tray::TrayIconBuilder,
    AppHandle, Emitter, Manager, Wry,
};
use tauri_plugin_autostart::ManagerExt;

use crate::{config, overlay, platform, AppState, Choice};

const TRAY_ID: &str = "pixling";

/// The menu bar icon. Its menu changes the buddy's look and habits; changes are saved and sent to the
/// frontend.
pub fn create(app: &AppHandle) -> tauri::Result<()> {
    // macOS recolours a black template icon for light and dark menu bars; elsewhere the coloured app icon
    // stays readable on any taskbar.
    #[cfg(target_os = "macos")]
    let icon = Image::from_bytes(include_bytes!("../icons/tray.png"))?;
    #[cfg(not(target_os = "macos"))]
    let icon = Image::from_bytes(include_bytes!("../icons/32x32.png"))?;
    TrayIconBuilder::with_id(TRAY_ID)
        .icon(icon)
        .icon_as_template(true)
        .tooltip("Pixling")
        .menu(&build_menu(app)?)
        .show_menu_on_left_click(true)
        .on_menu_event(|app, event| handle(app, event.id().as_ref()))
        .build(app)?;
    Ok(())
}

/// Shows text next to the menu bar icon (the focus timer), or nothing. Windows has no text next to tray
/// icons, so there it goes in the tooltip.
pub fn set_title(app: &AppHandle, title: Option<String>) -> tauri::Result<()> {
    if let Some(tray) = app.tray_by_id(TRAY_ID) {
        #[cfg(target_os = "macos")]
        tray.set_title(title)?;
        #[cfg(not(target_os = "macos"))]
        tray.set_tooltip(Some(title.map(|t| format!("Pixling · {t}")).unwrap_or_else(|| "Pixling".into())))?;
    }
    Ok(())
}

/// Rebuilds the menu so the check marks and labels match the current state.
pub fn refresh(app: &AppHandle) -> tauri::Result<()> {
    if let Some(tray) = app.tray_by_id(TRAY_ID) {
        tray.set_menu(Some(build_menu(app)?))?;
    }
    Ok(())
}

pub fn build_menu(app: &AppHandle) -> tauri::Result<Menu<Wry>> {
    let state = app.state::<AppState>();
    let cfg = state.config.lock().unwrap().clone();
    let catalog = state.catalog.lock().unwrap().clone();
    let visible = app
        .get_webview_window(overlay::LABEL)
        .and_then(|w| w.is_visible().ok())
        .unwrap_or(true);

    let wardrobe = MenuItem::with_id(app, "wardrobe", "Wardrobe…", true, None::<&str>)?;
    let studio = MenuItem::with_id(app, "studio", "Studio…", true, None::<&str>)?;
    let notes = MenuItem::with_id(app, "notes", "Notes…", true, None::<&str>)?;
    let diary = MenuItem::with_id(app, "diary", "Diary…", true, None::<&str>)?;
    let character = choices(app, "Character", "character", &catalog.characters, &cfg.character)?;
    let toggle = MenuItem::with_id(
        app,
        "toggle",
        if visible { "Hide Pixling" } else { "Show Pixling" },
        true,
        None::<&str>,
    )?;
    let species = choices(app, "Buddy", "species", &catalog.species, &cfg.species)?;
    let palettes = choices(app, "Colour", "palette", &catalog.palettes, &cfg.palette)?;
    let accessories = choices(app, "Accessory", "accessory", &catalog.accessories, &cfg.accessory)?;
    let sizes: Vec<Choice> = (2..=4)
        .map(|s| Choice { id: s.to_string(), name: format!("{s}×") })
        .collect();
    let size = choices(app, "Size", "scale", &sizes, &cfg.scale.to_string())?;
    let watch = CheckMenuItem::with_id(app, "flag:watchApps", "Watches your apps", true, cfg.watch_apps, None::<&str>)?;
    let climb = CheckMenuItem::with_id(app, "flag:climbWindows", "Climbs windows", true, cfg.climb_windows, None::<&str>)?;
    let login = CheckMenuItem::with_id(
        app,
        "autostart",
        "Start at login",
        true,
        app.autolaunch().is_enabled().unwrap_or(false),
        None::<&str>,
    )?;
    let backpack = backpack_menu(app, &cfg)?;
    let quit = MenuItem::with_id(app, "quit", "Quit Pixling", true, None::<&str>)?;

    Menu::with_items(
        app,
        &[
            &toggle,
            &wardrobe,
            &studio,
            &notes,
            &diary,
            &PredefinedMenuItem::separator(app)?,
            &species,
            &palettes,
            &accessories,
            &size,
            &character,
            &PredefinedMenuItem::separator(app)?,
            &backpack,
            &PredefinedMenuItem::separator(app)?,
            &watch,
            &climb,
            &login,
            &PredefinedMenuItem::separator(app)?,
            &quit,
        ],
    )
}

/// The backpack: start or stop a focus round, its length, and the reminders.
fn backpack_menu(app: &AppHandle, cfg: &config::Config) -> tauri::Result<Submenu<Wry>> {
    let start = MenuItem::with_id(app, "backpack:start", format!("Start focus ({} min)", cfg.focus_minutes), true, None::<&str>)?;
    let stop = MenuItem::with_id(app, "backpack:stop", "Stop focus", true, None::<&str>)?;
    let lengths: Vec<Choice> = [15, 25, 50]
        .iter()
        .map(|m| Choice { id: m.to_string(), name: format!("{m} minutes") })
        .collect();
    let length = choices(app, "Focus length", "focus", &lengths, &cfg.focus_minutes.to_string())?;
    let water = CheckMenuItem::with_id(app, "flag:water", "Water reminder", true, cfg.water, None::<&str>)?;
    let breaks = CheckMenuItem::with_id(app, "flag:breaks", "Break reminder", true, cfg.breaks, None::<&str>)?;
    let system = CheckMenuItem::with_id(app, "flag:watchSystem", "Watch battery and load", true, cfg.watch_system, None::<&str>)?;
    Submenu::with_items(
        app,
        "Backpack",
        true,
        &[&start, &stop, &length, &PredefinedMenuItem::separator(app)?, &water, &breaks, &system],
    )
}

/// A submenu with one check item per choice; the current one is checked.
fn choices(app: &AppHandle, title: &str, group: &str, list: &[Choice], current: &str) -> tauri::Result<Submenu<Wry>> {
    let items = list
        .iter()
        .map(|c| CheckMenuItem::with_id(app, format!("{group}:{}", c.id), &c.name, true, c.id == current, None::<&str>))
        .collect::<tauri::Result<Vec<_>>>()?;
    let refs: Vec<&dyn IsMenuItem<Wry>> = items.iter().map(|i| i as &dyn IsMenuItem<Wry>).collect();
    Submenu::with_items(app, title, !list.is_empty(), &refs)
}

fn handle(app: &AppHandle, id: &str) {
    match id {
        "quit" => app.exit(0),
        "wardrobe" | "notes" | "diary" | "studio" => {
            let label = match id {
                "notes" => overlay::NOTES,
                "diary" => overlay::DIARY,
                "studio" => overlay::STUDIO,
                _ => overlay::WARDROBE,
            };
            if let Err(e) = overlay::open_page(app, label) {
                eprintln!("Pixling: could not open the window: {e}");
            }
            return; // the new window should keep the focus
        }
        _ if id.starts_with("file:") => crate::files::run(app, &id["file:".len()..]),
        "toggle" => {
            if let Some(window) = app.get_webview_window(overlay::LABEL) {
                let _ = if window.is_visible().unwrap_or(true) { window.hide() } else { window.show() };
            }
        }
        "autostart" => {
            let autostart = app.autolaunch();
            let result = if autostart.is_enabled().unwrap_or(false) { autostart.disable() } else { autostart.enable() };
            if let Err(e) = result {
                eprintln!("Pixling: could not change 'start at login': {e}");
            }
        }
        "backpack:start" | "backpack:stop" => {
            let _ = app.emit("backpack", &id["backpack:".len()..]);
        }
        _ => {
            let Some((group, value)) = id.split_once(':') else { return };
            let state = app.state::<AppState>();
            let cfg = {
                let mut cfg = state.config.lock().unwrap();
                match (group, value) {
                    ("species", _) => cfg.species = value.to_string(),
                    ("palette", _) => cfg.palette = value.to_string(),
                    ("accessory", _) => cfg.accessory = value.to_string(),
                    ("character", _) => cfg.character = value.to_string(),
                    ("scale", _) => {
                        if let Ok(scale) = value.parse() {
                            cfg.scale = scale;
                        }
                    }
                    ("flag", "watchApps") => cfg.watch_apps = !cfg.watch_apps,
                    ("flag", "climbWindows") => cfg.climb_windows = !cfg.climb_windows,
                    ("flag", "water") => cfg.water = !cfg.water,
                    ("flag", "breaks") => cfg.breaks = !cfg.breaks,
                    ("flag", "watchSystem") => cfg.watch_system = !cfg.watch_system,
                    ("focus", _) => {
                        if let Ok(minutes) = value.parse() {
                            cfg.focus_minutes = minutes;
                        }
                    }
                    _ => return,
                }
                cfg.clone()
            };
            if let Err(e) = config::save(app, &cfg) {
                eprintln!("Pixling: could not save the settings: {e}");
            }
            let _ = app.emit("config-changed", &cfg);
        }
    }
    let _ = refresh(app);
    // When the menu was opened by right-clicking the buddy, Pixling became the active app.
    platform::deactivate();
}
