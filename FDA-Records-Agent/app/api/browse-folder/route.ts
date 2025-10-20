import { NextRequest, NextResponse } from "next/server";
import { exec } from "child_process";
import { promisify } from "util";
import os from "os";

const execAsync = promisify(exec);

/**
 * GET /api/browse-folder
 *
 * Opens native folder picker dialog and returns selected path
 */
export async function GET(req: NextRequest) {
  try {
    const platform = os.platform();
    let folderPath: string | null = null;

    if (platform === "darwin") {
      // macOS - use AppleScript
      const script = `
        tell application "System Events"
          activate
          set folderPath to choose folder with prompt "Select FDA Documents Folder"
          return POSIX path of folderPath
        end tell
      `;

      try {
        const { stdout } = await execAsync(`osascript -e '${script.replace(/'/g, "'\\''")}'`);
        folderPath = stdout.trim();
      } catch (err: any) {
        // User cancelled or error occurred
        if (err.message.includes("User canceled")) {
          return NextResponse.json({ cancelled: true });
        }
        throw err;
      }

    } else if (platform === "linux") {
      // Linux - try zenity or kdialog
      try {
        const { stdout } = await execAsync('zenity --file-selection --directory --title="Select FDA Documents Folder"');
        folderPath = stdout.trim();
      } catch (zenityErr) {
        try {
          const { stdout } = await execAsync('kdialog --getexistingdirectory . --title "Select FDA Documents Folder"');
          folderPath = stdout.trim();
        } catch (kdialogErr) {
          return NextResponse.json({
            error: "No folder picker available. Please install zenity or kdialog, or enter path manually."
          }, { status: 400 });
        }
      }

    } else if (platform === "win32") {
      // Windows - use PowerShell
      const script = `
        Add-Type -AssemblyName System.Windows.Forms
        $dialog = New-Object System.Windows.Forms.FolderBrowserDialog
        $dialog.Description = "Select FDA Documents Folder"
        $dialog.RootFolder = [System.Environment+SpecialFolder]::MyComputer
        $result = $dialog.ShowDialog()
        if ($result -eq [System.Windows.Forms.DialogResult]::OK) {
          Write-Output $dialog.SelectedPath
        }
      `;

      try {
        const { stdout } = await execAsync(`powershell -Command "${script.replace(/"/g, '\\"')}"`);
        folderPath = stdout.trim();
      } catch (err: any) {
        // User cancelled or error occurred
        if (!err.stdout || err.stdout.trim() === "") {
          return NextResponse.json({ cancelled: true });
        }
        throw err;
      }

    } else {
      return NextResponse.json({
        error: `Unsupported platform: ${platform}. Please enter path manually.`
      }, { status: 400 });
    }

    if (!folderPath || folderPath === "") {
      return NextResponse.json({ cancelled: true });
    }

    return NextResponse.json({
      path: folderPath,
      platform,
    });

  } catch (error: any) {
    console.error("Folder picker error:", error);
    return NextResponse.json({
      error: error.message || "Failed to open folder picker"
    }, { status: 500 });
  }
}
