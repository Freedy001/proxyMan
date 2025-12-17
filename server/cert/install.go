package cert

import (
	"errors"
	"fmt"
	"log"
)

// CertInstaller defines the interface for certificate installation
type CertInstaller interface {
	// Install installs the certificate to the system trust store
	Install(certPath string) error

	// IsInstalled checks if the certificate is installed in the system trust store
	IsInstalled() (bool, error)

	// Uninstall removes the certificate from the system trust store
	Uninstall() error

	// GetInstallScript generates an installation script for manual execution
	GetInstallScript(certPath string) (string, error)

	// GetUninstallScript generates an uninstallation script for manual execution
	GetUninstallScript() (string, error)
}

// InstallResult represents the result of an installation attempt
type InstallResult struct {
	Success      bool
	RequiresRoot bool
	Script       string // Fallback script if automatic installation fails
	Message      string
}

var (
	ErrUnsupportedPlatform = errors.New("unsupported platform")
	ErrCertNotFound        = errors.New("certificate file not found")
	ErrPermissionDenied    = errors.New("permission denied, administrator rights required")
	ErrNotInstalled        = errors.New("certificate not installed")
)

// GetInstaller returns the appropriate installer for the current platform
func GetInstaller() (CertInstaller, error) {
	sysInfo := DetectSystem()

	if sysInfo.OS == OSUnknown {
		return nil, ErrUnsupportedPlatform
	}

	return newInstaller(sysInfo)
}

// InstallCertificate attempts to install the certificate with automatic fallback to script generation
func InstallCertificate(certPath string) *InstallResult {
	installer, err := GetInstaller()
	if err != nil {
		return &InstallResult{
			Success: false,
			Message: fmt.Sprintf("Platform not supported: %v", err),
		}
	}

	// Check if already installed
	installed, err := installer.IsInstalled()
	if err != nil {
		log.Printf("Warning: Could not check installation status: %v", err)
	}
	if installed {
		return &InstallResult{
			Success: true,
			Message: "Certificate is already installed",
		}
	}

	// Try automatic installation
	err = installer.Install(certPath)
	if err == nil {
		return &InstallResult{
			Success: true,
			Message: "Certificate installed successfully",
		}
	}

	// If automatic installation fails, generate fallback script
	log.Printf("Automatic installation failed: %v. Generating fallback script...", err)

	script, scriptErr := installer.GetInstallScript(certPath)
	if scriptErr != nil {
		return &InstallResult{
			Success:      false,
			RequiresRoot: true,
			Message:      fmt.Sprintf("Automatic installation failed and could not generate script: %v,cause %s", scriptErr, err.Error()),
		}
	}

	return &InstallResult{
		Success:      false,
		RequiresRoot: true,
		Script:       script,
		Message:      "Automatic installation requires administrator rights. Please run the provided script manually.cause " + err.Error(),
	}
}

// UninstallCertificate attempts to uninstall the certificate
func UninstallCertificate() *InstallResult {
	installer, err := GetInstaller()
	if err != nil {
		return &InstallResult{
			Success: false,
			Message: fmt.Sprintf("Platform not supported: %v", err),
		}
	}

	// Check if installed
	installed, err := installer.IsInstalled()
	if err != nil {
		log.Printf("Warning: Could not check installation status: %v", err)
	}
	if !installed {
		return &InstallResult{
			Success: true,
			Message: "Certificate is not installed",
		}
	}

	// Try automatic uninstallation
	err = installer.Uninstall()
	if err == nil {
		return &InstallResult{
			Success: true,
			Message: "Certificate uninstalled successfully",
		}
	}

	// If automatic uninstallation fails, generate fallback script
	log.Printf("Automatic uninstallation failed: %v. Generating fallback script...", err)

	script, scriptErr := installer.GetUninstallScript()
	if scriptErr != nil {
		return &InstallResult{
			Success:      false,
			RequiresRoot: true,
			Message:      fmt.Sprintf("Automatic uninstallation failed and could not generate script: %v,cause %s", scriptErr, err.Error()),
		}
	}

	return &InstallResult{
		Success:      false,
		RequiresRoot: true,
		Script:       script,
		Message:      "Automatic uninstallation requires administrator rights. Please run the provided script manually. cause :" + err.Error(),
	}
}

// CheckCertificateInstalled checks if the certificate is installed
func CheckCertificateInstalled() (bool, error) {
	installer, err := GetInstaller()
	if err != nil {
		return false, err
	}

	return installer.IsInstalled()
}
