//! Feeding files to the buddy: drop them on it and pick what it does with them. Uses macOS's own tools
//! (ditto, sips, pbcopy, open), so the files never leave the computer.

use std::{
    io::Write,
    path::{Path, PathBuf},
    process::{Command, Stdio},
};

use tauri::{
    menu::{Menu, MenuItem, PredefinedMenuItem},
    AppHandle, Emitter, Manager, WebviewWindow, Wry,
};

use crate::AppState;

const IMAGES: &[&str] = &["png", "jpg", "jpeg", "heic", "tiff", "tif", "gif", "webp", "bmp"];

fn extension(path: &Path) -> String {
    path.extension().map(|e| e.to_string_lossy().to_lowercase()).unwrap_or_default()
}

/// Remembers the dropped files and shows what can be done with them, at the cursor.
pub fn show_menu(app: &AppHandle, window: &WebviewWindow, paths: Vec<String>) -> tauri::Result<()> {
    let has_images = paths.iter().any(|p| IMAGES.contains(&extension(Path::new(p)).as_str()));
    let count = if paths.len() == 1 { "1 bestand".to_string() } else { format!("{} bestanden", paths.len()) };
    *app.state::<AppState>().dropped.lock().unwrap() = paths;

    let title = MenuItem::with_id(app, "file:none", format!("Nom! {count}"), false, None::<&str>)?;
    let zip = MenuItem::with_id(app, "file:zip", "Maak er een zip van", true, None::<&str>)?;
    let png = MenuItem::with_id(app, "file:png", "Zet om naar PNG", has_images, None::<&str>)?;
    let jpg = MenuItem::with_id(app, "file:jpg", "Zet om naar JPG", has_images, None::<&str>)?;
    let copy = MenuItem::with_id(app, "file:copy", "Kopieer het pad", true, None::<&str>)?;
    let reveal = MenuItem::with_id(app, "file:reveal", "Toon in Finder", true, None::<&str>)?;
    let menu: Menu<Wry> = Menu::with_items(
        app,
        &[&title, &PredefinedMenuItem::separator(app)?, &zip, &png, &jpg, &copy, &reveal],
    )?;
    window.popup_menu(&menu)
}

/// Does the chosen action in the background and tells the webpage how it went.
pub fn run(app: &AppHandle, action: &str) {
    let paths: Vec<PathBuf> = app.state::<AppState>().dropped.lock().unwrap().iter().map(PathBuf::from).collect();
    let action = action.to_string();
    let app = app.clone();
    std::thread::spawn(move || {
        let message = if !cfg!(target_os = "macos") {
            "Dat kan ik hier nog niet.".to_string()
        } else {
            match action.as_str() {
                "zip" => zip(&paths),
                "png" => convert(&paths, "png", "png"),
                "jpg" => convert(&paths, "jpeg", "jpg"),
                "copy" => copy(&paths),
                "reveal" => reveal(&paths),
                _ => return,
            }
        };
        let _ = app.emit("file-done", message);
    });
}

/// `name.ext` → the first of `name.ext`, `name 2.ext`, ... that doesn't exist yet.
fn free_path(dir: &Path, stem: &str, ext: &str) -> PathBuf {
    let mut candidate = dir.join(format!("{stem}.{ext}"));
    let mut n = 2;
    while candidate.exists() {
        candidate = dir.join(format!("{stem} {n}.{ext}"));
        n += 1;
    }
    candidate
}

fn parts(path: &Path) -> (PathBuf, String) {
    let dir = path.parent().map(Path::to_path_buf).unwrap_or_default();
    let stem = path.file_stem().map(|s| s.to_string_lossy().into_owned()).unwrap_or_else(|| "bestand".into());
    (dir, stem)
}

fn zip(paths: &[PathBuf]) -> String {
    let mut ok = 0;
    for path in paths {
        let (dir, _) = parts(path);
        let name = path.file_name().map(|n| n.to_string_lossy().into_owned()).unwrap_or_default();
        let out = free_path(&dir, &name, "zip");
        let status = Command::new("ditto").args(["-c", "-k", "--sequesterRsrc", "--keepParent"]).arg(path).arg(&out).status();
        if status.map(|s| s.success()).unwrap_or(false) {
            ok += 1;
        }
    }
    match ok {
        0 => "Zippen lukte niet.".into(),
        1 => "Gezipt! Hij staat ernaast.".into(),
        n => format!("{n} zips gemaakt!"),
    }
}

fn convert(paths: &[PathBuf], format: &str, ext: &str) -> String {
    let mut ok = 0;
    for path in paths.iter().filter(|p| IMAGES.contains(&extension(p).as_str())) {
        let (dir, stem) = parts(path);
        let out = free_path(&dir, &stem, ext);
        let status = Command::new("sips").args(["-s", "format", format]).arg(path).arg("--out").arg(&out).stdout(Stdio::null()).status();
        if status.map(|s| s.success()).unwrap_or(false) {
            ok += 1;
        }
    }
    let label = ext.to_uppercase();
    match ok {
        0 => format!("Omzetten naar {label} lukte niet."),
        1 => format!("Omgezet naar {label}!"),
        n => format!("{n} afbeeldingen omgezet naar {label}!"),
    }
}

fn copy(paths: &[PathBuf]) -> String {
    let text = paths.iter().map(|p| p.to_string_lossy()).collect::<Vec<_>>().join("\n");
    let copied = Command::new("pbcopy")
        .stdin(Stdio::piped())
        .spawn()
        .and_then(|mut child| {
            child.stdin.take().map(|mut stdin| stdin.write_all(text.as_bytes())).transpose()?;
            child.wait()
        })
        .map(|s| s.success())
        .unwrap_or(false);
    if copied { "Pad gekopieerd!".into() } else { "Kopiëren lukte niet.".into() }
}

fn reveal(paths: &[PathBuf]) -> String {
    match paths.first() {
        Some(path) if Command::new("open").arg("-R").arg(path).status().is_ok() => "Daar is het!".into(),
        _ => "Ik vond het niet terug.".into(),
    }
}

#[cfg(all(test, target_os = "macos"))]
mod tests {
    use super::*;

    #[test]
    fn zips_and_converts_next_to_the_original() {
        let dir = std::env::temp_dir().join(format!("pixling-files-{}", std::process::id()));
        std::fs::create_dir_all(&dir).unwrap();
        let png = dir.join("plaatje.png");
        std::fs::copy(concat!(env!("CARGO_MANIFEST_DIR"), "/icons/32x32.png"), &png).unwrap();

        assert_eq!(zip(&[png.clone()]), "Gezipt! Hij staat ernaast.");
        assert!(dir.join("plaatje.png.zip").exists());
        assert_eq!(convert(&[png.clone()], "jpeg", "jpg"), "Omgezet naar JPG!");
        assert!(dir.join("plaatje.jpg").exists());
        // A second zip doesn't overwrite the first one.
        zip(&[png]);
        assert!(dir.join("plaatje.png 2.zip").exists());

        std::fs::remove_dir_all(&dir).unwrap();
    }
}
