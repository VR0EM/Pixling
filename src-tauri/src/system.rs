//! How the computer is doing: battery and how busy the processor is. Read with the built-in `pmset` and
//! `sysctl` tools every half minute; nothing else is looked at.

use std::{process::Command, time::Duration};

use serde::Serialize;
use tauri::{AppHandle, Emitter};

#[derive(Clone, Debug, Default, PartialEq, Serialize)]
pub struct SystemInfo {
    /// Battery charge in percent, or None on a computer without a battery.
    pub battery: Option<u8>,
    /// Plugged in.
    pub charging: bool,
    /// The processor has been working hard over the last minute.
    pub busy: bool,
}

fn run(program: &str, args: &[&str]) -> Option<String> {
    let output = Command::new(program).args(args).output().ok()?;
    output.status.success().then(|| String::from_utf8_lossy(&output.stdout).into_owned())
}

/// Parses `pmset -g batt`, e.g. "Now drawing from 'Battery Power' ... 72%; discharging; ...".
pub fn parse_battery(text: &str) -> (Option<u8>, bool) {
    let charging = text.contains("'AC Power'");
    let percent = text
        .lines()
        .find(|l| l.contains("InternalBattery"))
        .and_then(|l| l.split('\t').nth(1))
        .and_then(|rest| rest.split('%').next())
        .and_then(|n| n.trim().parse().ok());
    (percent, charging)
}

/// Parses `sysctl -n vm.loadavg`, e.g. "{ 2.39 4.42 3.56 }", and returns the one-minute load.
pub fn parse_load(text: &str) -> Option<f64> {
    text.trim().trim_matches(|c| c == '{' || c == '}').split_whitespace().next()?.parse().ok()
}

pub fn read() -> SystemInfo {
    if !cfg!(target_os = "macos") {
        return SystemInfo::default();
    }
    let (battery, charging) = run("pmset", &["-g", "batt"]).map(|t| parse_battery(&t)).unwrap_or((None, true));
    let cores: f64 = run("sysctl", &["-n", "hw.ncpu"]).and_then(|t| t.trim().parse().ok()).unwrap_or(4.0);
    let load = run("sysctl", &["-n", "vm.loadavg"]).and_then(|t| parse_load(&t)).unwrap_or(0.0);
    SystemInfo { battery, charging, busy: load > cores * 0.85 }
}

/// Sends the webpage a "system" event whenever something changed.
pub fn watch(app: &AppHandle) {
    let app = app.clone();
    std::thread::spawn(move || {
        let mut last: Option<SystemInfo> = None;
        loop {
            let info = read();
            if last.as_ref() != Some(&info) {
                let _ = app.emit("system", &info);
                last = Some(info);
            }
            std::thread::sleep(Duration::from_secs(30));
        }
    });
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn reads_battery_and_load() {
        let text = "Now drawing from 'Battery Power'\n -InternalBattery-0 (id=36372579)\t72%; discharging; 6:53 remaining present: true\n";
        assert_eq!(parse_battery(text), (Some(72), false));
        let plugged = "Now drawing from 'AC Power'\n -InternalBattery-0 (id=1)\t100%; charged; 0:00 remaining present: true\n";
        assert_eq!(parse_battery(plugged), (Some(100), true));
        assert_eq!(parse_battery("Now drawing from 'AC Power'\n"), (None, true));
        assert_eq!(parse_load("{ 2.39 4.42 3.56 }\n"), Some(2.39));
    }
}
