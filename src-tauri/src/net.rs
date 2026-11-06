//! Fetching text over https with the system's own curl, which ships with macOS and Windows 10 and 11. Used
//! for calendars and the weather; nothing is sent but the request itself.

use std::process::Command;

/// The body of an https address, or a short explanation of what went wrong.
pub fn get(url: &str) -> Result<String, String> {
    if !url.starts_with("https://") {
        return Err("Only https addresses can be read.".into());
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
        url,
    ]);
    #[cfg(target_os = "windows")]
    {
        use std::os::windows::process::CommandExt;
        command.creation_flags(0x0800_0000); // no console window
    }
    let output = command.output().map_err(|_| "Couldn’t go online (curl is missing).".to_string())?;
    if output.status.success() {
        return Ok(String::from_utf8_lossy(&output.stdout).into_owned());
    }
    Err(match output.status.code() {
        Some(6) | Some(7) => "Couldn’t connect. Is the internet on?".into(),
        Some(22) => "The server said no. The address may be wrong or reset.".into(),
        Some(28) => "That took too long to answer.".into(),
        Some(63) => "That’s too big to read.".into(),
        _ => "Couldn’t read it.".into(),
    })
}

/// Encodes text for use in an address (`São Paulo` → `S%C3%A3o%20Paulo`).
pub fn encode(text: &str) -> String {
    text.bytes()
        .map(|b| match b {
            b'A'..=b'Z' | b'a'..=b'z' | b'0'..=b'9' | b'-' | b'_' | b'.' | b'~' => (b as char).to_string(),
            _ => format!("%{b:02X}"),
        })
        .collect()
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn encodes_and_refuses_plain_http() {
        assert_eq!(encode("São Paulo"), "S%C3%A3o%20Paulo");
        assert!(get("http://example.com").is_err());
    }
}
