package cert

import (
	"os"
	"runtime"
	"strings"
)

// OSType represents the operating system type
type OSType string

const (
	OSMacOS   OSType = "darwin"
	OSWindows OSType = "windows"
	OSLinux   OSType = "linux"
	OSUnknown OSType = "unknown"
)

// LinuxDistro represents Linux distribution type
type LinuxDistro string

const (
	DistroDebian  LinuxDistro = "debian"
	DistroUbuntu  LinuxDistro = "ubuntu"
	DistroCentOS  LinuxDistro = "centos"
	DistroFedora  LinuxDistro = "fedora"
	DistroRHEL    LinuxDistro = "rhel"
	DistroUnknown LinuxDistro = "unknown"
)

// SystemInfo contains detected system information
type SystemInfo struct {
	OS     OSType
	Distro LinuxDistro // Only applicable for Linux
}

// DetectOS detects the current operating system
func DetectOS() OSType {
	switch runtime.GOOS {
	case "darwin":
		return OSMacOS
	case "windows":
		return OSWindows
	case "linux":
		return OSLinux
	default:
		return OSUnknown
	}
}

// DetectLinuxDistro detects the Linux distribution
// It checks common files like /etc/os-release, /etc/lsb-release, etc.
func DetectLinuxDistro() LinuxDistro {
	if runtime.GOOS != "linux" {
		return DistroUnknown
	}

	// Check /etc/os-release (most modern distributions)
	if content, err := os.ReadFile("/etc/os-release"); err == nil {
		osRelease := string(content)
		osReleaseLower := strings.ToLower(osRelease)

		if strings.Contains(osReleaseLower, "ubuntu") {
			return DistroUbuntu
		}
		if strings.Contains(osReleaseLower, "debian") {
			return DistroDebian
		}
		if strings.Contains(osReleaseLower, "centos") {
			return DistroCentOS
		}
		if strings.Contains(osReleaseLower, "fedora") {
			return DistroFedora
		}
		if strings.Contains(osReleaseLower, "rhel") || strings.Contains(osReleaseLower, "red hat") {
			return DistroRHEL
		}
	}

	// Check /etc/lsb-release (older Ubuntu/Debian)
	if content, err := os.ReadFile("/etc/lsb-release"); err == nil {
		lsbRelease := strings.ToLower(string(content))
		if strings.Contains(lsbRelease, "ubuntu") {
			return DistroUbuntu
		}
		if strings.Contains(lsbRelease, "debian") {
			return DistroDebian
		}
	}

	// Check /etc/redhat-release
	if _, err := os.Stat("/etc/redhat-release"); err == nil {
		if content, err := os.ReadFile("/etc/redhat-release"); err == nil {
			releaseLower := strings.ToLower(string(content))
			if strings.Contains(releaseLower, "centos") {
				return DistroCentOS
			}
			if strings.Contains(releaseLower, "fedora") {
				return DistroFedora
			}
			if strings.Contains(releaseLower, "red hat") {
				return DistroRHEL
			}
		}
	}

	// Check /etc/debian_version
	if _, err := os.Stat("/etc/debian_version"); err == nil {
		return DistroDebian
	}

	return DistroUnknown
}

// DetectSystem detects the complete system information
func DetectSystem() SystemInfo {
	os := DetectOS()
	var distro LinuxDistro

	if os == OSLinux {
		distro = DetectLinuxDistro()
	}

	return SystemInfo{
		OS:     os,
		Distro: distro,
	}
}

// IsDebianBased checks if the Linux distro is Debian-based
func (d LinuxDistro) IsDebianBased() bool {
	return d == DistroDebian || d == DistroUbuntu
}

// IsRHELBased checks if the Linux distro is RHEL-based
func (d LinuxDistro) IsRHELBased() bool {
	return d == DistroCentOS || d == DistroFedora || d == DistroRHEL
}

// String returns the string representation of OSType
func (o OSType) String() string {
	return string(o)
}

// String returns the string representation of LinuxDistro
func (d LinuxDistro) String() string {
	return string(d)
}
