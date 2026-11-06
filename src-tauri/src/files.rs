//! Feeding files to the buddy: drop them on it and pick what it does with them. Uses the system's own
//! tools (on macOS ditto, sips, pbcopy and open; on Windows PowerShell and Explorer), so the files never
//! leave the computer.

use std::path::{Path, PathBuf};

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
    let count = if paths.len() == 1 { "1 file".to_string() } else { format!("{} files", paths.len()) };
    *app.state::<AppState>().dropped.lock().unwrap() = paths;

    let title = MenuItem::with_id(app, "file:none", format!("Nom! {count}"), false, None::<&str>)?;
    let zip = MenuItem::with_id(app, "file:zip", "Make a zip", true, None::<&str>)?;
    let png = MenuItem::with_id(app, "file:png", "Convert to PNG", has_images, None::<&str>)?;
    let jpg = MenuItem::with_id(app, "file:jpg", "Convert to JPG", has_images, None::<&str>)?;
    let copy = MenuItem::with_id(app, "file:copy", "Copy the path", true, None::<&str>)?;
    let reveal = MenuItem::with_id(app, "file:reveal", tool::REVEAL_LABEL, true, None::<&str>)?;
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
        let message = if !cfg!(any(target_os = "macos", target_os = "windows")) {
            "I can’t do that here yet.".to_string()
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
pub fn free_path(dir: &Path, stem: &str, ext: &str) -> PathBuf {
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
    let stem = path.file_stem().map(|s| s.to_string_lossy().into_owned()).unwrap_or_else(|| "file".into());
    (dir, stem)
}

fn zip(paths: &[PathBuf]) -> String {
    let mut ok = 0;
    for path in paths {
        let (dir, _) = parts(path);
        let name = path.file_name().map(|n| n.to_string_lossy().into_owned()).unwrap_or_default();
        let out = free_path(&dir, &name, "zip");
        if tool::zip(path, &out) {
            ok += 1;
        }
    }
    match ok {
        0 => "Zipping didn’t work.".into(),
        1 => "Zipped! It’s right next to it.".into(),
        n => format!("{n} zips made!"),
    }
}

fn convert(paths: &[PathBuf], format: &str, ext: &str) -> String {
    let mut ok = 0;
    for path in paths.iter().filter(|p| IMAGES.contains(&extension(p).as_str())) {
        let (dir, stem) = parts(path);
        let out = free_path(&dir, &stem, ext);
        if tool::convert(path, &out, format) {
            ok += 1;
        }
    }
    let label = ext.to_uppercase();
    match ok {
        0 => format!("Converting to {label} didn’t work."),
        1 => format!("Converted to {label}!"),
        n => format!("{n} images converted to {label}!"),
    }
}

fn copy(paths: &[PathBuf]) -> String {
    let text = paths.iter().map(|p| p.to_string_lossy()).collect::<Vec<_>>().join("\n");
    if copy_text(&text) { "Path copied!".into() } else { "Copying didn’t work.".into() }
}

pub use tool::{copy_text, reveal_path};

fn reveal(paths: &[PathBuf]) -> String {
    match paths.first() {
        Some(path) if reveal_path(path) => "There it is!".into(),
        _ => "I couldn’t find it.".into(),
    }
}

#[cfg(target_os = "macos")]
mod tool {
    use std::{
        io::Write,
        path::Path,
        process::{Command, Stdio},
    };

    pub const REVEAL_LABEL: &str = "Show in Finder";

    pub fn zip(path: &Path, out: &Path) -> bool {
        let status = Command::new("ditto").args(["-c", "-k", "--sequesterRsrc", "--keepParent"]).arg(path).arg(out).status();
        status.map(|s| s.success()).unwrap_or(false)
    }

    /// `format` is "png" or "jpeg".
    pub fn convert(path: &Path, out: &Path, format: &str) -> bool {
        let status = Command::new("sips").args(["-s", "format", format]).arg(path).arg("--out").arg(out).stdout(Stdio::null()).status();
        status.map(|s| s.success()).unwrap_or(false)
    }

    /// Puts text on the clipboard.
    pub fn copy_text(text: &str) -> bool {
        Command::new("pbcopy")
            .stdin(Stdio::piped())
            .spawn()
            .and_then(|mut child| {
                child.stdin.take().map(|mut stdin| stdin.write_all(text.as_bytes())).transpose()?;
                child.wait()
            })
            .map(|s| s.success())
            .unwrap_or(false)
    }

    /// Opens Finder with the file selected.
    pub fn reveal_path(path: &Path) -> bool {
        Command::new("open").arg("-R").arg(path).status().is_ok()
    }
}

#[cfg(target_os = "windows")]
mod tool {
    use std::{
        os::windows::process::CommandExt,
        path::Path,
        process::{Command, Stdio},
    };

    pub const REVEAL_LABEL: &str = "Show in Explorer";

    /// Keeps PowerShell from flashing a console window.
    const CREATE_NO_WINDOW: u32 = 0x0800_0000;

    /// Runs a PowerShell script. Paths and text go in through environment variables, never through the
    /// script itself, so quotes or spaces in a file name can't change what runs.
    fn powershell(script: &str, env: &[(&str, &std::ffi::OsStr)]) -> bool {
        let mut command = Command::new("powershell");
        command
            .args(["-NoProfile", "-NonInteractive", "-ExecutionPolicy", "Bypass", "-Command", script])
            .creation_flags(CREATE_NO_WINDOW)
            .stdout(Stdio::null())
            .stderr(Stdio::null());
        for (key, value) in env {
            command.env(key, value);
        }
        command.status().map(|s| s.success()).unwrap_or(false)
    }

    pub fn zip(path: &Path, out: &Path) -> bool {
        powershell(
            "Compress-Archive -LiteralPath $env:PIXLING_IN -DestinationPath $env:PIXLING_OUT",
            &[("PIXLING_IN", path.as_os_str()), ("PIXLING_OUT", out.as_os_str())],
        )
    }

    /// `format` is "png" or "jpeg". Uses .NET's image tools, which read PNG, JPG, GIF, BMP and TIFF.
    pub fn convert(path: &Path, out: &Path, format: &str) -> bool {
        let script = "$ErrorActionPreference = 'Stop'; Add-Type -AssemblyName System.Drawing; \
            $image = [System.Drawing.Image]::FromFile($env:PIXLING_IN); \
            $kind = if ($env:PIXLING_FORMAT -eq 'png') { [System.Drawing.Imaging.ImageFormat]::Png } else { [System.Drawing.Imaging.ImageFormat]::Jpeg }; \
            $image.Save($env:PIXLING_OUT, $kind); $image.Dispose()";
        powershell(
            script,
            &[("PIXLING_IN", path.as_os_str()), ("PIXLING_OUT", out.as_os_str()), ("PIXLING_FORMAT", std::ffi::OsStr::new(format))],
        )
    }

    /// Puts text on the clipboard.
    pub fn copy_text(text: &str) -> bool {
        powershell("Set-Clipboard -Value $env:PIXLING_TEXT", &[("PIXLING_TEXT", std::ffi::OsStr::new(text))])
    }

    /// Opens Explorer with the file selected.
    pub fn reveal_path(path: &Path) -> bool {
        // Explorer wants exactly `/select,"C:\path"`, so the argument goes in unchanged.
        Command::new("explorer").raw_arg(format!("/select,\"{}\"", path.display())).spawn().is_ok()
    }
}

#[cfg(not(any(target_os = "macos", target_os = "windows")))]
mod tool {
    use std::path::Path;

    pub const REVEAL_LABEL: &str = "Show in the file manager";

    pub fn zip(_path: &Path, _out: &Path) -> bool {
        false
    }

    pub fn convert(_path: &Path, _out: &Path, _format: &str) -> bool {
        false
    }

    pub fn copy_text(_text: &str) -> bool {
        false
    }

    pub fn reveal_path(path: &Path) -> bool {
        std::process::Command::new("xdg-open").arg(path.parent().unwrap_or(path)).spawn().is_ok()
    }
}

#[cfg(all(test, target_os = "macos"))]
mod tests {
    use super::*;

    #[test]
    fn zips_and_converts_next_to_the_original() {
        let dir = std::env::temp_dir().join(format!("pixling-files-{}", std::process::id()));
        std::fs::create_dir_all(&dir).unwrap();
        let png = dir.join("picture.png");
        std::fs::copy(concat!(env!("CARGO_MANIFEST_DIR"), "/icons/32x32.png"), &png).unwrap();

        assert_eq!(zip(std::slice::from_ref(&png)), "Zipped! It’s right next to it.");
        assert!(dir.join("picture.png.zip").exists());
        assert_eq!(convert(std::slice::from_ref(&png), "jpeg", "jpg"), "Converted to JPG!");
        assert!(dir.join("picture.jpg").exists());
        // A second zip doesn't overwrite the first one.
        zip(&[png]);
        assert!(dir.join("picture.png 2.zip").exists());

        std::fs::remove_dir_all(&dir).unwrap();
    }
}
