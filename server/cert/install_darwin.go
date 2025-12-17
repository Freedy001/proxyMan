//go:build darwin

package cert

import (
	"bytes"
	"fmt"
	"os"
	"os/exec"
	"path/filepath"
	"strings"
)

type macOSInstaller struct{}

func newInstaller(info SystemInfo) (CertInstaller, error) {
	return &macOSInstaller{}, nil
}

// Install installs the certificate to macOS keychain
func (m *macOSInstaller) Install(certPath string) error {
	// Check if certificate file exists
	if _, err := os.Stat(certPath); os.IsNotExist(err) {
		return ErrCertNotFound
	}

	// Check if already installed
	installed, err := m.IsInstalled()
	if err == nil && installed {
		// Already installed, uninstall first to avoid conflicts
		_ = m.Uninstall()
	}

	// Get absolute path
	absPath, err := filepath.Abs(certPath)
	if err != nil {
		return fmt.Errorf("failed to get absolute path: %w", err)
	}

	cmd := exec.Command("osascript", "-e", fmt.Sprintf(`do shell script "security add-trusted-cert -d -r trustRoot -k /Library/Keychains/System.keychain '%s'" with administrator privileges`, absPath))

	var importStderr bytes.Buffer
	cmd.Stderr = &importStderr

	err = cmd.Run()
	if err != nil {
		installed, err = m.IsInstalled()
		if err == nil && installed {
			return nil //安装成功
		}

		stderrStr := importStderr.String()
		// User cancelled the authentication dialog
		if strings.Contains(stderrStr, "User canceled") ||
			strings.Contains(stderrStr, "cancelled") ||
			strings.Contains(stderrStr, "-128") {
			return ErrPermissionDenied
		}
		return fmt.Errorf("failed to import certificate: %w, stderr: %s", err, stderrStr)
	}

	return nil
}

// IsInstalled checks if the certificate is installed in macOS keychain
func (m *macOSInstaller) IsInstalled() (bool, error) {
	email := CAEmail

	// Search in System keychain using email
	cmd := exec.Command("security", "find-certificate",
		"-a", "-e", email,
		"-p", "/Library/Keychains/System.keychain")

	output, err := cmd.Output()
	if err != nil {
		// If command fails, certificate is likely not installed
		return false, nil
	}

	// If output contains certificate data, it's installed
	return len(output) > 0, nil
}

// Uninstall removes the certificate from macOS keychain
func (m *macOSInstaller) Uninstall() error {
	email := CAEmail

	// First, find the certificate hash
	cmd := exec.Command("security", "find-certificate",
		"-a", "-e", email,
		"-Z", "/Library/Keychains/System.keychain")

	output, err := cmd.Output()
	if err != nil {
		return ErrNotInstalled
	}

	// Parse SHA-256 hash from output
	lines := strings.Split(string(output), "\n")
	var certHash string
	for _, line := range lines {
		if strings.HasPrefix(line, "SHA-256 hash:") {
			certHash = strings.TrimSpace(strings.TrimPrefix(line, "SHA-256 hash:"))
			break
		}
	}

	if certHash == "" {
		return fmt.Errorf("failed to find certificate hash")
	}

	// Delete certificate using osascript for GUI password prompt
	script := fmt.Sprintf(`do shell script "security delete-certificate -Z %s /Library/Keychains/System.keychain" with administrator privileges`, certHash)

	delCmd := exec.Command("osascript", "-e", script)

	var stderr bytes.Buffer
	delCmd.Stderr = &stderr

	err = delCmd.Run()
	if err != nil {
		stderrStr := stderr.String()
		// User cancelled the authentication dialog
		if strings.Contains(stderrStr, "User canceled") ||
			strings.Contains(stderrStr, "cancelled") ||
			strings.Contains(stderrStr, "-128") {
			return ErrPermissionDenied
		}
		return fmt.Errorf("failed to uninstall certificate: %w, stderr: %s", err, stderrStr)
	}

	return nil
}

// GetInstallScript generates a bash script for manual installation on macOS
func (m *macOSInstaller) GetInstallScript(certPath string) (string, error) {
	absPath, err := filepath.Abs(certPath)
	if err != nil {
		return "", fmt.Errorf("failed to get absolute path: %w", err)
	}

	script := fmt.Sprintf(`#!/bin/bash
# ProxyMan Certificate Installation Script for macOS
# This script installs the ProxyMan CA certificate to the system keychain

set -e

echo "Installing ProxyMan CA certificate..."
sudo security add-trusted-cert -d -r trustAsRoot \
  -k /Library/Keychains/System.keychain \
  "%s"

echo "Certificate installed successfully!"
echo "You may need to restart your browser for changes to take effect."
`, absPath)

	return script, nil
}

// GetUninstallScript generates a bash script for manual uninstallation on macOS
func (m *macOSInstaller) GetUninstallScript() (string, error) {
	email := CAEmail

	script := fmt.Sprintf(`#!/bin/bash
# ProxyMan Certificate Uninstallation Script for macOS
# This script removes the ProxyMan CA certificate from the system keychain

set -e

echo "Finding ProxyMan CA certificate with email: %s"
CERT_HASH=$(security find-certificate -a -e "%s" -Z /Library/Keychains/System.keychain | grep "SHA-256 hash:" | head -1 | awk '{print $3}')

if [ -z "$CERT_HASH" ]; then
  echo "Certificate not found in system keychain."
  exit 1
fi

echo "Removing certificate with hash: $CERT_HASH"
sudo security delete-certificate -Z "$CERT_HASH" /Library/Keychains/System.keychain

echo "Certificate uninstalled successfully!"
echo "You may need to restart your browser for changes to take effect."
`, email, email)

	return script, nil
}
