package cert

import (
	"os"
	"path/filepath"
)

var (
	// CACertDir is the directory where certificates are stored
	CACertDir string
	// CACertPath is the path to the CA certificate file
	CACertPath string
	// CAKeyPath is the path to the CA private key file
	CAKeyPath string
)

// InitCertPaths initializes certificate paths in user's home directory
func InitCertPaths() error {
	homeDir, err := os.UserHomeDir()
	if err != nil {
		return err
	}

	// Set certificate directory to ~/.proxyMan/cert/
	CACertDir = filepath.Join(homeDir, ".proxyMan", "cert")

	// Ensure directory exists
	if err := os.MkdirAll(CACertDir, 0755); err != nil {
		return err
	}

	// Set certificate file paths
	CACertPath = filepath.Join(CACertDir, "ca.crt")
	CAKeyPath = filepath.Join(CACertDir, "ca.key")

	return nil
}
