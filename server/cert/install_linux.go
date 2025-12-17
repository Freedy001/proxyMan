//go:build linux
// +build linux

package cert

import (
	"bytes"
	"fmt"
	"io"
	"os"
	"os/exec"
	"path/filepath"
	"strings"
)

type linuxInstaller struct {
	distro LinuxDistro
}

// newLinuxInstaller creates a new Linux installer
func newInstaller(info SystemInfo) (CertInstaller, error) {
	return &linuxInstaller{distro: info.Distro}, nil
}

// Install installs the certificate to Linux system certificate store
func (l *linuxInstaller) Install(certPath string) error {
	// Check if certificate file exists
	if _, err := os.Stat(certPath); os.IsNotExist(err) {
		return ErrCertNotFound
	}

	// Get absolute path
	absPath, err := filepath.Abs(certPath)
	if err != nil {
		return fmt.Errorf("failed to get absolute path: %w", err)
	}

	// Determine target directory and update command based on distro
	var destPath string
	var updateCmd []string

	if l.distro.IsDebianBased() {
		destPath = "/usr/local/share/ca-certificates/proxyMan-ca.crt"
		updateCmd = []string{"update-ca-certificates"}
	} else if l.distro.IsRHELBased() {
		destPath = "/etc/pki/ca-trust/source/anchors/proxyMan-ca.crt"
		updateCmd = []string{"update-ca-trust", "extract"}
	} else {
		// Default to Debian-style for unknown distros
		destPath = "/usr/local/share/ca-certificates/proxyMan-ca.crt"
		updateCmd = []string{"update-ca-certificates"}
	}

	// Copy certificate file
	if err := l.copyCertificate(absPath, destPath); err != nil {
		if os.IsPermission(err) {
			return ErrPermissionDenied
		}
		return fmt.Errorf("failed to copy certificate: %w", err)
	}

	// Update certificate store
	cmd := exec.Command("sudo", updateCmd...)
	var stderr bytes.Buffer
	cmd.Stderr = &stderr

	err = cmd.Run()
	if err != nil {
		stderrStr := stderr.String()
		if strings.Contains(stderrStr, "permission denied") ||
			strings.Contains(stderrStr, "not allowed") {
			return ErrPermissionDenied
		}
		return fmt.Errorf("failed to update certificate store: %w, stderr: %s", err, stderrStr)
	}

	return nil
}

// IsInstalled checks if the certificate is installed in Linux system certificate store
func (l *linuxInstaller) IsInstalled() (bool, error) {
	// Check common certificate locations based on distro
	if l.distro.IsDebianBased() {
		if _, err := os.Stat("/usr/local/share/ca-certificates/proxyMan-ca.crt"); err == nil {
			return true, nil
		}
	}

	if l.distro.IsRHELBased() {
		if _, err := os.Stat("/etc/pki/ca-trust/source/anchors/proxyMan-ca.crt"); err == nil {
			return true, nil
		}
	}

	// For unknown distros, check both locations
	if l.distro == DistroUnknown {
		if _, err := os.Stat("/usr/local/share/ca-certificates/proxyMan-ca.crt"); err == nil {
			return true, nil
		}
		if _, err := os.Stat("/etc/pki/ca-trust/source/anchors/proxyMan-ca.crt"); err == nil {
			return true, nil
		}
	}

	return false, nil
}

// Uninstall removes the certificate from Linux system certificate store
func (l *linuxInstaller) Uninstall() error {
	var destPath string
	var updateCmd []string
	var found bool

	// Check and remove from Debian-based location
	if l.distro.IsDebianBased() || l.distro == DistroUnknown {
		destPath = "/usr/local/share/ca-certificates/proxyMan-ca.crt"
		if _, err := os.Stat(destPath); err == nil {
			found = true
			updateCmd = []string{"update-ca-certificates", "--fresh"}
		}
	}

	// Check and remove from RHEL-based location
	if !found && (l.distro.IsRHELBased() || l.distro == DistroUnknown) {
		destPath = "/etc/pki/ca-trust/source/anchors/proxyMan-ca.crt"
		if _, err := os.Stat(destPath); err == nil {
			found = true
			updateCmd = []string{"update-ca-trust", "extract"}
		}
	}

	if !found {
		return ErrNotInstalled
	}

	// Remove certificate file
	cmd := exec.Command("sudo", "rm", "-f", destPath)
	var stderr bytes.Buffer
	cmd.Stderr = &stderr

	err := cmd.Run()
	if err != nil {
		stderrStr := stderr.String()
		if strings.Contains(stderrStr, "permission denied") ||
			strings.Contains(stderrStr, "not allowed") {
			return ErrPermissionDenied
		}
		return fmt.Errorf("failed to remove certificate: %w, stderr: %s", err, stderrStr)
	}

	// Update certificate store
	updateCertCmd := exec.Command("sudo", updateCmd...)
	stderr.Reset()
	updateCertCmd.Stderr = &stderr

	err = updateCertCmd.Run()
	if err != nil {
		return fmt.Errorf("failed to update certificate store: %w, stderr: %s", err, stderr.String())
	}

	return nil
}

// GetInstallScript generates a bash script for manual installation on Linux
func (l *linuxInstaller) GetInstallScript(certPath string) (string, error) {
	absPath, err := filepath.Abs(certPath)
	if err != nil {
		return "", fmt.Errorf("failed to get absolute path: %w", err)
	}

	script := fmt.Sprintf(`#!/bin/bash
# ProxyMan Certificate Installation Script for Linux
# This script installs the ProxyMan CA certificate to the system trust store

set -e

echo "Detecting Linux distribution..."

# Detect distribution
if [ -f /etc/os-release ]; then
    . /etc/os-release
    DISTRO=$ID
elif [ -f /etc/lsb-release ]; then
    . /etc/lsb-release
    DISTRO=$DISTRIB_ID
else
    echo "Unable to detect distribution. Trying Debian-style installation..."
    DISTRO="debian"
fi

echo "Detected distribution: $DISTRO"

# Install based on distribution
case "$DISTRO" in
    ubuntu|debian)
        echo "Installing certificate for Debian/Ubuntu..."
        sudo cp "%s" /usr/local/share/ca-certificates/proxyMan-ca.crt
        sudo update-ca-certificates
        ;;
    centos|rhel|fedora)
        echo "Installing certificate for RHEL/CentOS/Fedora..."
        sudo cp "%s" /etc/pki/ca-trust/source/anchors/proxyMan-ca.crt
        sudo update-ca-trust extract
        ;;
    *)
        echo "Unknown distribution. Trying Debian-style installation..."
        sudo cp "%s" /usr/local/share/ca-certificates/proxyMan-ca.crt
        sudo update-ca-certificates
        ;;
esac

echo "Certificate installed successfully!"
echo ""
echo "For Firefox users, you need to manually import the certificate:"
echo "1. Open Firefox -> Settings -> Privacy & Security -> Certificates -> View Certificates"
echo "2. Go to 'Authorities' tab -> Import -> Select the certificate file"
echo "3. Check 'Trust this CA to identify websites'"
`, absPath, absPath, absPath)

	return script, nil
}

// GetUninstallScript generates a bash script for manual uninstallation on Linux
func (l *linuxInstaller) GetUninstallScript() (string, error) {
	script := `#!/bin/bash
# ProxyMan Certificate Uninstallation Script for Linux
# This script removes the ProxyMan CA certificate from the system trust store

set -e

echo "Detecting Linux distribution..."

# Detect distribution
if [ -f /etc/os-release ]; then
    . /etc/os-release
    DISTRO=$ID
elif [ -f /etc/lsb-release ]; then
    . /etc/lsb-release
    DISTRO=$DISTRIB_ID
else
    echo "Unable to detect distribution. Trying Debian-style removal..."
    DISTRO="debian"
fi

echo "Detected distribution: $DISTRO"

# Uninstall based on distribution
case "$DISTRO" in
    ubuntu|debian)
        echo "Removing certificate for Debian/Ubuntu..."
        if [ -f /usr/local/share/ca-certificates/proxyMan-ca.crt ]; then
            sudo rm -f /usr/local/share/ca-certificates/proxyMan-ca.crt
            sudo update-ca-certificates --fresh
            echo "Certificate removed successfully!"
        else
            echo "Certificate not found."
            exit 1
        fi
        ;;
    centos|rhel|fedora)
        echo "Removing certificate for RHEL/CentOS/Fedora..."
        if [ -f /etc/pki/ca-trust/source/anchors/proxyMan-ca.crt ]; then
            sudo rm -f /etc/pki/ca-trust/source/anchors/proxyMan-ca.crt
            sudo update-ca-trust extract
            echo "Certificate removed successfully!"
        else
            echo "Certificate not found."
            exit 1
        fi
        ;;
    *)
        echo "Unknown distribution. Trying Debian-style removal..."
        if [ -f /usr/local/share/ca-certificates/proxyMan-ca.crt ]; then
            sudo rm -f /usr/local/share/ca-certificates/proxyMan-ca.crt
            sudo update-ca-certificates --fresh
            echo "Certificate removed successfully!"
        else
            echo "Certificate not found."
            exit 1
        fi
        ;;
esac

echo ""
echo "If you imported the certificate in Firefox, you need to manually remove it:"
echo "1. Open Firefox -> Settings -> Privacy & Security -> Certificates -> View Certificates"
echo "2. Go to 'Authorities' tab -> Find 'ProxyMan Inc.' -> Delete"
`

	return script, nil
}

// copyCertificate copies the certificate file using sudo
func (l *linuxInstaller) copyCertificate(src, dest string) error {
	// Try direct copy first (might work if running as root)
	srcFile, err := os.Open(src)
	if err != nil {
		return err
	}
	defer srcFile.Close()

	// Use sudo cp for copying
	cmd := exec.Command("sudo", "cp", src, dest)
	var stderr bytes.Buffer
	cmd.Stderr = &stderr

	err = cmd.Run()
	if err != nil {
		stderrStr := stderr.String()
		if strings.Contains(stderrStr, "permission denied") {
			return ErrPermissionDenied
		}
		return fmt.Errorf("copy failed: %w, stderr: %s", err, stderrStr)
	}

	// Set appropriate permissions
	chmodCmd := exec.Command("sudo", "chmod", "644", dest)
	return chmodCmd.Run()
}

// Helper function to copy file content
func copyFile(src, dest string) error {
	srcFile, err := os.Open(src)
	if err != nil {
		return err
	}
	defer srcFile.Close()

	destFile, err := os.Create(dest)
	if err != nil {
		return err
	}
	defer destFile.Close()

	_, err = io.Copy(destFile, srcFile)
	return err
}
