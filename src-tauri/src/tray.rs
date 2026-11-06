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
    TrayIconBuilder::with_id(TRAY_ID)
        .icon(Image::from_bytes(include_bytes!("../icons/tray.png"))?)
        .icon_as_template(true)
        .tooltip("Pixling")
        .menu(&build_menu(app)?)
        .show_menu_on_left_click(true)
        .on_menu_event(|app, event| handle(app, event.id().as_ref()))
        .build(app)?;
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

    let toggle = MenuItem::with_id(
        app,
        "toggle",
        if visible { "Verstop Pixling" } else { "Toon Pixling" },
        true,
        None::<&str>,
    )?;
    let species = choices(app, "Maatje", "species", &catalog.species, &cfg.species)?;
    let palettes = choices(app, "Kleur", "palette", &catalog.palettes, &cfg.palette)?;
    let accessories = choices(app, "Accessoire", "accessory", &catalog.accessories, &cfg.accessory)?;
    let sizes: Vec<Choice> = (2..=4)
        .map(|s| Choice { id: s.to_string(), name: format!("{s}×") })
        .collect();
    let size = choices(app, "Grootte", "scale", &sizes, &cfg.scale.to_string())?;
    let watch = CheckMenuItem::with_id(app, "flag:watchApps", "Kijkt mee met je apps", true, cfg.watch_apps, None::<&str>)?;
    let climb = CheckMenuItem::with_id(app, "flag:climbWindows", "Klimt op vensters", true, cfg.climb_windows, None::<&str>)?;
    let login = CheckMenuItem::with_id(
        app,
        "autostart",
        "Start bij inloggen",
        true,
        app.autolaunch().is_enabled().unwrap_or(false),
        None::<&str>,
    )?;
    let quit = MenuItem::with_id(app, "quit", "Stop Pixling", true, None::<&str>)?;

    Menu::with_items(
        app,
        &[
            &toggle,
            &PredefinedMenuItem::separator(app)?,
            &species,
            &palettes,
            &accessories,
            &size,
            &PredefinedMenuItem::separator(app)?,
            &watch,
            &climb,
            &login,
            &PredefinedMenuItem::separator(app)?,
            &quit,
        ],
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
        "toggle" => {
            if let Some(window) = app.get_webview_window(overlay::LABEL) {
                let _ = if window.is_visible().unwrap_or(true) { window.hide() } else { window.show() };
            }
        }
        "autostart" => {
            let autostart = app.autolaunch();
            let result = if autostart.is_enabled().unwrap_or(false) { autostart.disable() } else { autostart.enable() };
            if let Err(e) = result {
                eprintln!("Pixling: kon 'start bij inloggen' niet aanpassen: {e}");
            }
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
                    ("scale", _) => {
                        if let Ok(scale) = value.parse() {
                            cfg.scale = scale;
                        }
                    }
                    ("flag", "watchApps") => cfg.watch_apps = !cfg.watch_apps,
                    ("flag", "climbWindows") => cfg.climb_windows = !cfg.climb_windows,
                    _ => return,
                }
                cfg.clone()
            };
            if let Err(e) = config::save(app, &cfg) {
                eprintln!("Pixling: kon de instellingen niet bewaren: {e}");
            }
            let _ = app.emit("config-changed", &cfg);
        }
    }
    let _ = refresh(app);
    // When the menu was opened by right-clicking the buddy, Pixling became the active app.
    platform::deactivate();
}
