use std::{fs, io, path::PathBuf};

use serde::{Deserialize, Serialize};
use tauri::{AppHandle, Manager};

/// What the buddy looks like. Stored as JSON in the app's config folder.
#[derive(Clone, Debug, Deserialize, Serialize)]
#[serde(rename_all = "camelCase", default)]
pub struct Config {
    pub species: String,
    /// A palette id, or "eigen" for the species' own colours.
    pub palette: String,
    /// An accessory id, or "geen" for none.
    pub accessory: String,
    /// How many screen pixels one sprite pixel takes.
    pub scale: u32,
    /// Dresses up for the app in front (glasses for code, headphones for music, ...).
    pub watch_apps: bool,
    /// Climbs onto windows and rides along when they move.
    pub climb_windows: bool,
    /// Its character: lief, druk, rustig or brutaal. Changes what it says and how lively it is.
    pub character: String,
    /// The day the two of you met (YYYY-MM-DD), set by the webpage on the first start.
    pub met_on: Option<String>,
    /// Backpack: reacts to the battery and to a busy processor.
    pub watch_system: bool,
    /// Backpack: holds up a glass of water now and then.
    pub water: bool,
    /// Backpack: gets tired after an hour without a break.
    pub breaks: bool,
    /// Backpack: length of a focus round and of the break after it, in minutes.
    pub focus_minutes: u32,
    pub break_minutes: u32,
}

impl Default for Config {
    fn default() -> Self {
        // The look picked while sketching: the sky-blue robot.
        Self {
            species: "robotje".into(),
            palette: "hemel".into(),
            accessory: "geen".into(),
            scale: 3,
            watch_apps: true,
            climb_windows: true,
            character: "lief".into(),
            met_on: None,
            watch_system: true,
            water: true,
            breaks: true,
            focus_minutes: 25,
            break_minutes: 5,
        }
    }
}

fn path(app: &AppHandle) -> Option<PathBuf> {
    app.path().app_config_dir().ok().map(|dir| dir.join("config.json"))
}

/// Loads the saved config, falling back to the defaults when there is none (or it can't be read).
pub fn load(app: &AppHandle) -> Config {
    path(app)
        .and_then(|p| fs::read_to_string(p).ok())
        .and_then(|text| serde_json::from_str(&text).ok())
        .unwrap_or_default()
}

pub fn save(app: &AppHandle, config: &Config) -> io::Result<()> {
    let path = path(app).ok_or_else(|| io::Error::other("geen map voor instellingen"))?;
    if let Some(dir) = path.parent() {
        fs::create_dir_all(dir)?;
    }
    let text = serde_json::to_string_pretty(config).map_err(io::Error::other)?;
    fs::write(path, text)
}
