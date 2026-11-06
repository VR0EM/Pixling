//! Reading calendars from their secret iCal address (Google Calendar, iCloud, Outlook all have one). Uses
//! the system's own curl, which ships with macOS and Windows 10 and 11. The address is a secret, so it's
//! never written to the log; the calendar itself is only read, never changed.

use std::process::Command;

/// The calendar as text (iCalendar), or a short explanation of what went wrong.
pub fn fetch(url: &str) -> Result<String, String> {
    let url = url.trim();
    let url = match url.strip_prefix("webcal://") {
        Some(rest) => format!("https://{rest}"),
        None => url.to_string(),
    };
    if !url.starts_with("https://") {
        return Err("That doesn’t look like a calendar address: it should start with https://".into());
    }
    let mut command = Command::new("curl");
    command.args([
        "--fail",
        "--silent",
        "--show-error",
        "--location",
        "--proto",
        "=https",
        "--proto-redir",
        "=https",
        "--max-time",
        "20",
        "--max-filesize",
        "20000000",
        "--url",
        &url,
    ]);
    #[cfg(target_os = "windows")]
    {
        use std::os::windows::process::CommandExt;
        command.creation_flags(0x0800_0000); // no console window
    }
    let output = command.output().map_err(|_| "Couldn’t reach the calendar (curl is missing).".to_string())?;
    if output.status.success() {
        return Ok(String::from_utf8_lossy(&output.stdout).into_owned());
    }
    Err(match output.status.code() {
        Some(6) | Some(7) => "Couldn’t reach the calendar. Is the internet on?".into(),
        Some(22) => "The calendar said no. The address may be wrong or reset; copy it again.".into(),
        Some(28) => "The calendar took too long to answer.".into(),
        Some(63) => "That calendar is too big to read.".into(),
        _ => "Couldn’t read the calendar.".into(),
    })
}
