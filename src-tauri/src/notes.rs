use std::{fs, io, path::PathBuf};

use serde::{Deserialize, Serialize};
use tauri::{AppHandle, Manager};

/// A quick note from the backpack. Stored as JSON next to the config.
#[derive(Clone, Debug, Deserialize, Serialize)]
pub struct Note {
    /// Milliseconds since 1970 when it was written; doubles as its id.
    pub id: u64,
    pub text: String,
    pub done: bool,
}

fn path(app: &AppHandle) -> Option<PathBuf> {
    app.path().app_config_dir().ok().map(|dir| dir.join("notes.json"))
}

pub fn load(app: &AppHandle) -> Vec<Note> {
    path(app)
        .and_then(|p| fs::read_to_string(p).ok())
        .and_then(|text| serde_json::from_str(&text).ok())
        .unwrap_or_default()
}

pub fn save(app: &AppHandle, notes: &[Note]) -> io::Result<()> {
    let path = path(app).ok_or_else(|| io::Error::other("no folder for notes"))?;
    if let Some(dir) = path.parent() {
        fs::create_dir_all(dir)?;
    }
    fs::write(path, serde_json::to_string_pretty(notes).map_err(io::Error::other)?)
}
