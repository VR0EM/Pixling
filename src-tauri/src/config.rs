use std::{fs, io, path::PathBuf};

use serde::{Deserialize, Serialize};
use tauri::{AppHandle, Manager};

/// A place for the weather, found by name.
#[derive(Clone, Debug, Deserialize, Serialize)]
pub struct Place {
    pub name: String,
    pub lat: f64,
    pub lon: f64,
}

/// What the buddy looks like. Stored as JSON in the app's config folder.
#[derive(Clone, Debug, Deserialize, Serialize)]
#[serde(rename_all = "camelCase", default)]
pub struct Config {
    pub species: String,
    /// A palette id, or "default" for the species' own colours.
    pub palette: String,
    /// An accessory id, or "none" for none.
    pub accessory: String,
    /// How many screen pixels one sprite pixel takes.
    pub scale: u32,
    /// Dresses up for the app in front (a laptop for code, headphones for music, ...).
    pub watch_apps: bool,
    /// Climbs onto windows and rides along when they move.
    pub climb_windows: bool,
    /// Its character: sweet, hyper, calm or cheeky. Changes what it says and how lively it is.
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
    /// What only a built-in buddy does: the robot charging, the mug's coffee, the dragon flying, ...
    pub quirks: bool,
    /// Calendars to read, as secret iCal addresses (Google Calendar, iCloud, Outlook, ...).
    pub calendars: Vec<String>,
    /// Calendar: says so a few minutes before something starts.
    pub meeting_alerts: bool,
    /// Calendar: steps aside and keeps quiet during video calls.
    pub hide_in_calls: bool,
    /// Now and then asks to play (fetch, hide and seek, basket). The Play menu always works.
    pub games: bool,
    /// Dresses for the weather at `place`: an umbrella, a beanie, sunglasses.
    pub weather: bool,
    pub place: Option<Place>,
    /// Holidays (Halloween, Christmas, Easter eggs, snow on the windows) and birthdays.
    pub seasons: bool,
    /// Your birthday as MM-DD, for a party.
    pub birthday: Option<String>,
    /// Stickers for little achievements, some of which unlock accessories.
    pub stickers: bool,
    /// Every accessory available right away, without earning it.
    pub unlock_all: bool,
}

impl Default for Config {
    fn default() -> Self {
        // The look picked while sketching: the sky-blue robot.
        Self {
            species: "robot".into(),
            palette: "sky".into(),
            accessory: "none".into(),
            scale: 3,
            watch_apps: true,
            climb_windows: true,
            character: "sweet".into(),
            met_on: None,
            watch_system: true,
            water: true,
            breaks: true,
            focus_minutes: 25,
            break_minutes: 5,
            quirks: true,
            calendars: Vec::new(),
            meeting_alerts: true,
            hide_in_calls: true,
            games: true,
            weather: true,
            place: None,
            seasons: true,
            birthday: None,
            stickers: true,
            unlock_all: false,
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
    let path = path(app).ok_or_else(|| io::Error::other("no folder for settings"))?;
    if let Some(dir) = path.parent() {
        fs::create_dir_all(dir)?;
    }
    let text = serde_json::to_string_pretty(config).map_err(io::Error::other)?;
    fs::write(path, text)
}
