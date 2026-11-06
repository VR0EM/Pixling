//! How the computer is doing: battery and how busy the processor is, checked every half minute; nothing
//! else is looked at. macOS asks the built-in `pmset` and `sysctl` tools, Windows asks the system directly.

use std::time::Duration;

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

#[cfg(target_os = "macos")]
fn run(program: &str, args: &[&str]) -> Option<String> {
    let output = std::process::Command::new(program).args(args).output().ok()?;
    output.status.success().then(|| String::from_utf8_lossy(&output.stdout).into_owned())
}

/// Parses `pmset -g batt`, e.g. "Now drawing from 'Battery Power' ... 72%; discharging; ...".
#[cfg_attr(not(target_os = "macos"), allow(dead_code))]
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
#[cfg_attr(not(target_os = "macos"), allow(dead_code))]
pub fn parse_load(text: &str) -> Option<f64> {
    text.trim().trim_matches(|c| c == '{' || c == '}').split_whitespace().next()?.parse().ok()
}

#[cfg(target_os = "macos")]
pub fn read() -> SystemInfo {
    let (battery, charging) = run("pmset", &["-g", "batt"]).map(|t| parse_battery(&t)).unwrap_or((None, true));
    let cores: f64 = run("sysctl", &["-n", "hw.ncpu"]).and_then(|t| t.trim().parse().ok()).unwrap_or(4.0);
    let load = run("sysctl", &["-n", "vm.loadavg"]).and_then(|t| parse_load(&t)).unwrap_or(0.0);
    SystemInfo { battery, charging, busy: load > cores * 0.85 }
}

/// Processor times (idle, kernel, user) at the previous check, to compare against.
#[cfg(target_os = "windows")]
static LAST_TIMES: std::sync::Mutex<Option<(u64, u64, u64)>> = std::sync::Mutex::new(None);

#[cfg(target_os = "windows")]
pub fn read() -> SystemInfo {
    use windows::Win32::{
        Foundation::FILETIME,
        System::{
            Power::{GetSystemPowerStatus, SYSTEM_POWER_STATUS},
            Threading::GetSystemTimes,
        },
    };

    let mut power = SYSTEM_POWER_STATUS::default();
    let (battery, charging) = if unsafe { GetSystemPowerStatus(&mut power) }.is_ok() {
        // 128 means "no battery", 255 "unknown".
        let has_battery = power.BatteryFlag != 128 && power.BatteryFlag != 255 && power.BatteryLifePercent <= 100;
        (has_battery.then_some(power.BatteryLifePercent), power.ACLineStatus == 1)
    } else {
        (None, true)
    };

    // Busy: more than 85% of the processor time since the previous check went to work, not idling.
    let (mut idle, mut kernel, mut user) = (FILETIME::default(), FILETIME::default(), FILETIME::default());
    let ticks = |t: FILETIME| (u64::from(t.dwHighDateTime) << 32) | u64::from(t.dwLowDateTime);
    let mut busy = false;
    if unsafe { GetSystemTimes(Some(&mut idle), Some(&mut kernel), Some(&mut user)) }.is_ok() {
        let now = (ticks(idle), ticks(kernel), ticks(user));
        let mut last = LAST_TIMES.lock().unwrap();
        if let Some((i, k, u)) = *last {
            // Kernel time includes the idle time.
            let total = (now.1 - k) + (now.2 - u);
            let idle = now.0 - i;
            busy = total > 0 && (total - idle.min(total)) as f64 / total as f64 > 0.85;
        }
        *last = Some(now);
    }
    SystemInfo { battery, charging, busy }
}

#[cfg(not(any(target_os = "macos", target_os = "windows")))]
pub fn read() -> SystemInfo {
    SystemInfo::default()
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
