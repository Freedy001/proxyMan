//go:build windows
// +build windows

package cert

import (
	"bytes"
	"fmt"
	"os"
	"os/exec"
	"path/filepath"
	"strings"
	"syscall"
)

type windowsInstaller struct{}

// newWindowsInstaller creates a new Windows installer
func newInstaller(info SystemInfo) (CertInstaller, error) {
	return &windowsInstaller{}, nil
}

// Install installs the certificate to Windows certificate store
func (w *windowsInstaller) Install(certPath string) error {
	// Check if certificate file exists
	if _, err := os.Stat(certPath); os.IsNotExist(err) {
		return ErrCertNotFound
	}

	// Get absolute path
	absPath, err := filepath.Abs(certPath)
	if err != nil {
		return fmt.Errorf("failed to get absolute path: %w", err)
	}

	// Use certutil to add certificate to Root store
	cmd := customCmd(exec.Command("certutil", "-addstore", "Root", absPath))

	var stderr bytes.Buffer
	cmd.Stderr = &stderr

	err = cmd.Run()
	if err != nil {
		stderrStr := stderr.String()
		if strings.Contains(stderrStr, "access is denied") ||
			strings.Contains(stderrStr, "Access is denied") {
			return ErrPermissionDenied
		}
		return fmt.Errorf("failed to install certificate: %w, stderr: %s", err, stderrStr)
	}

	return nil
}

// IsInstalled checks if the certificate is installed in Windows certificate store
func (w *windowsInstaller) IsInstalled() (bool, error) {
	// Use certutil to check if certificate exists in Root store
	cmd := customCmd(exec.Command("certutil", "-store", "Root"))

	output, err := cmd.Output()
	if err != nil {
		return false, fmt.Errorf("failed to query certificate store: %w", err)
	}

	// Check if "ProxyMan Inc." appears in the output
	return strings.Contains(string(output), CaSha1), nil
}

// Uninstall removes the certificate from Windows certificate store
func (w *windowsInstaller) Uninstall() error {
	// First, verify the certificate is installed
	installed, err := w.IsInstalled()
	if err != nil {
		return err
	}
	if !installed {
		return ErrNotInstalled
	}

	// Delete certificate using serial number
	delCmd := customCmd(exec.Command("certutil", "-delstore", "Root", CaSha1))

	var stderr bytes.Buffer
	delCmd.Stderr = &stderr

	err = delCmd.Run()
	if err != nil {
		stderrStr := stderr.String()
		if strings.Contains(stderrStr, "access is denied") ||
			strings.Contains(stderrStr, "Access is denied") {
			return ErrPermissionDenied
		}
		return fmt.Errorf("failed to uninstall certificate: %w, stderr: %s", err, stderrStr)
	}

	installed, err = w.IsInstalled()
	if err != nil {
		return err
	}
	if installed {
		return fmt.Errorf("failed to delete certificate: %w", CaSha1)
	}

	return nil
}

// GetInstallScript generates a PowerShell script for manual installation on Windows
func (w *windowsInstaller) GetInstallScript(certPath string) (string, error) {
	absPath, err := filepath.Abs(certPath)
	if err != nil {
		return "", fmt.Errorf("failed to get absolute path: %w", err)
	}

	// Convert path to Windows format
	absPath = filepath.ToSlash(absPath)

	script := fmt.Sprintf(`@echo off
REM ProxyMan Certificate Installation Script for Windows
REM This script must be run as Administrator

echo Installing ProxyMan CA certificate...
certutil -addstore Root "%s"

if %%errorlevel%% equ 0 (
    echo Certificate installed successfully!
    echo You may need to restart your browser for changes to take effect.
) else (
    echo Failed to install certificate. Make sure to run this script as Administrator.
    pause
    exit /b 1
)

pause
`, absPath)

	return script, nil
}

// GetUninstallScript generates a PowerShell script for manual uninstallation on Windows
func (w *windowsInstaller) GetUninstallScript() (string, error) {
	script := `@echo off
REM ProxyMan Certificate Uninstallation Script for Windows
REM This script must be run as Administrator

echo Finding ProxyMan CA certificate...
certutil -store Root | findstr /C:"ProxyMan Inc." >nul

if %errorlevel% neq 0 (
    echo Certificate not found in Root store.
    pause
    exit /b 1
)

echo Certificate found. Retrieving serial number...
for /f "tokens=2 delims=:" %%a in ('certutil -store Root ^| findstr /C:"Serial Number:"') do (
    set SERIAL=%%a
    goto :delete
)

:delete
echo Removing certificate with serial: %SERIAL%
certutil -delstore Root %SERIAL%

if %errorlevel% equ 0 (
    echo Certificate uninstalled successfully!
    echo You may need to restart your browser for changes to take effect.
) else (
    echo Failed to uninstall certificate. Make sure to run this script as Administrator.
    pause
    exit /b 1
)

pause
`

	return script, nil
}

func customCmd(cmd *exec.Cmd) *exec.Cmd {
	cmd.SysProcAttr = &syscall.SysProcAttr{
		HideWindow:    true,
		CreationFlags: 0x08000000, // CREATE_NO_WINDOW
	}
	return cmd
}
