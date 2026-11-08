//! Updates from GitHub: Pixling looks for a newer release (its latest.json), says so, and installs it only
//! when you pick "Update" in the menu. Releases are signed with the project's key; anything else is
//! refused by the updater.

use std::time::Duration;

use tauri::{AppHandle, Emitter, Manager};
use tauri_plugin_updater::UpdaterExt;

use crate::{tray, AppState};

/// Looks for a newer version. Returns its number, and remembers the update for the menu.
pub async fn check(app: &AppHandle) -> Result<Option<String>, String> {
    let update = app.updater().map_err(|e| e.to_string())?.check().await.map_err(|e| e.to_string())?;
    let version = update.as_ref().map(|u| u.version.clone());
    *app.state::<AppState>().update.lock().unwrap() = update;
    let _ = tray::refresh(app);
    Ok(version)
}

/// "Check for updates…" in the menu: tells the buddy what it found.
pub async fn check_and_tell(app: AppHandle) {
    let status = match check(&app).await {
        Ok(Some(version)) => format!("available:{version}"),
        Ok(None) => "latest".to_string(),
        Err(e) => {
            eprintln!("Pixling: checking for updates failed: {e}");
            "check-failed".to_string()
        }
    };
    let _ = app.emit("update-status", status);
}

/// Downloads and installs the update found earlier, then starts the new version.
pub async fn install(app: AppHandle) {
    let update = app.state::<AppState>().update.lock().unwrap().take();
    let Some(update) = update else {
        return check_and_tell(app).await;
    };
    let _ = app.emit("update-status", "downloading");
    match update.download_and_install(|_, _| {}, || {}).await {
        Ok(()) => {
            let _ = app.emit("update-status", "restarting");
            // A moment for the buddy to say goodbye.
            tokio_sleep(Duration::from_millis(1800)).await;
            app.restart();
        }
        Err(e) => {
            eprintln!("Pixling: installing the update failed: {e}");
            let _ = app.emit("update-status", "failed");
            let _ = tray::refresh(&app);
        }
    }
}

async fn tokio_sleep(d: Duration) {
    let _ = tauri::async_runtime::spawn_blocking(move || std::thread::sleep(d)).await;
}
