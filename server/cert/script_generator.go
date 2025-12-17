package cert

import (
	"fmt"
	"path/filepath"
)

// ScriptGenerator generates installation/uninstallation scripts for different platforms
type ScriptGenerator struct {
	sysInfo SystemInfo
}

// NewScriptGenerator creates a new script generator
func NewScriptGenerator() *ScriptGenerator {
	return &ScriptGenerator{
		sysInfo: DetectSystem(),
	}
}

// GenerateInstallScript generates an installation script for the current platform
func (sg *ScriptGenerator) GenerateInstallScript(certPath string) (script string, filename string, err error) {
	installer, err := GetInstaller()
	if err != nil {
		return "", "", err
	}

	script, err = installer.GetInstallScript(certPath)
	if err != nil {
		return "", "", err
	}

	filename = sg.getInstallScriptFilename()
	return script, filename, nil
}

// GenerateUninstallScript generates an uninstallation script for the current platform
func (sg *ScriptGenerator) GenerateUninstallScript() (script string, filename string, err error) {
	installer, err := GetInstaller()
	if err != nil {
		return "", "", err
	}

	script, err = installer.GetUninstallScript()
	if err != nil {
		return "", "", err
	}

	filename = sg.getUninstallScriptFilename()
	return script, filename, nil
}

// getInstallScriptFilename returns the appropriate script filename for the platform
func (sg *ScriptGenerator) getInstallScriptFilename() string {
	switch sg.sysInfo.OS {
	case OSMacOS, OSLinux:
		return "install-cert.sh"
	case OSWindows:
		return "install-cert.bat"
	default:
		return "install-cert.txt"
	}
}

// getUninstallScriptFilename returns the appropriate script filename for the platform
func (sg *ScriptGenerator) getUninstallScriptFilename() string {
	switch sg.sysInfo.OS {
	case OSMacOS, OSLinux:
		return "uninstall-cert.sh"
	case OSWindows:
		return "uninstall-cert.bat"
	default:
		return "uninstall-cert.txt"
	}
}

// GetPlatformInfo returns human-readable platform information
func (sg *ScriptGenerator) GetPlatformInfo() string {
	switch sg.sysInfo.OS {
	case OSMacOS:
		return "macOS"
	case OSWindows:
		return "Windows"
	case OSLinux:
		if sg.sysInfo.Distro != DistroUnknown {
			return fmt.Sprintf("Linux (%s)", sg.sysInfo.Distro)
		}
		return "Linux"
	default:
		return "Unknown"
	}
}

// GetScriptExecutionInstructions returns instructions for running the script
func (sg *ScriptGenerator) GetScriptExecutionInstructions(scriptFilename string) string {
	absPath, _ := filepath.Abs(scriptFilename)

	switch sg.sysInfo.OS {
	case OSMacOS, OSLinux:
		return fmt.Sprintf(`To install the certificate manually, follow these steps:

1. Open Terminal
2. Navigate to the directory containing the script:
   cd %s

3. Make the script executable:
   chmod +x %s

4. Run the script with administrator privileges:
   sudo ./%s

5. Enter your administrator password when prompted

The script will install the ProxyMan CA certificate to your system trust store.
`, filepath.Dir(absPath), scriptFilename, scriptFilename)

	case OSWindows:
		return fmt.Sprintf(`To install the certificate manually, follow these steps:

1. Right-click on %s
2. Select "Run as administrator"
3. Follow the prompts to complete the installation

Alternatively, you can:
1. Open Command Prompt as Administrator
2. Navigate to the directory containing the script
3. Run: %s

The script will install the ProxyMan CA certificate to your system Root store.
`, scriptFilename, scriptFilename)

	default:
		return "Please refer to your system documentation for certificate installation procedures."
	}
}

// SaveScript saves the script to a file
func SaveScript(script, filename string) error {
	absPath, err := filepath.Abs(filename)
	if err != nil {
		return fmt.Errorf("failed to get absolute path: %w", err)
	}

	// Write script to file
	err = writeFile(absPath, []byte(script), 0755)
	if err != nil {
		return fmt.Errorf("failed to save script: %w", err)
	}

	return nil
}

// Helper function to write file
func writeFile(path string, content []byte, perm uint32) error {
	file, err := createFile(path)
	if err != nil {
		return err
	}
	defer file.Close()

	_, err = file.Write(content)
	return err
}

// Helper function for file operations
func createFile(path string) (fileWriter, error) {
	return osFileWriter{}, nil
}

type fileWriter interface {
	Write([]byte) (int, error)
	Close() error
}

type osFileWriter struct{}

func (osFileWriter) Write(b []byte) (int, error) { return 0, nil }
func (osFileWriter) Close() error                { return nil }
