package common

import (
	"encoding/json"
	"log"
	"os"
	"path/filepath"
	"sync"
)

// Config 应用配置结构
type Config struct {
	// 代理服务器配置
	ProxyHost string `json:"proxy_host"`
	ProxyPort int    `json:"proxy_port"`

	// 上游代理配置
	UpstreamProxy UpstreamProxyConfig `json:"upstream_proxy"`
}

// UpstreamProxyConfig 上游代理配置
type UpstreamProxyConfig struct {
	// Mode: "none" - 不使用上游代理, "env" - 使用环境变量, "custom" - 自定义代理
	Mode     string `json:"mode"`
	Protocol string `json:"protocol"` // http, socket5
	Host     string `json:"host"`
	Port     int    `json:"port"`
}

var (
	configPath string
	configLock sync.RWMutex
	appConfig  *Config
)

// init 初始化配置
func init() {
	// 获取配置文件路径
	homeDir, err := os.UserHomeDir()
	if err != nil {
		log.Fatalf("can not get home dir %v", err)
	}

	configDir := filepath.Join(homeDir, ".proxyMan")
	configPath = filepath.Join(configDir, "config.json")

	// 创建配置目录
	if err := os.MkdirAll(configDir, 0755); err != nil {
		log.Fatalf("Failed to create dir %s cause %v", configDir, err)
	}

	// 加载或创建默认配置
	if err := loadConfig(); err != nil {
		log.Fatalf("Failed to load config, %v", err)
	}

	log.Printf("Config initialized at: %s", configPath)
}

// getDefaultConfig 获取默认配置
func getDefaultConfig() *Config {
	return &Config{
		ProxyHost: "127.0.0.1",
		ProxyPort: 8888,
		UpstreamProxy: UpstreamProxyConfig{
			Mode: "none",
		},
	}
}

// loadConfig 加载配置文件
func loadConfig() error {
	data, err := os.ReadFile(configPath)
	if err != nil {
		if os.IsNotExist(err) {
			appConfig = getDefaultConfig()
			err = saveConfig()
			if err != nil {
				log.Fatal("can not save config ", err)
			}
			return nil
		}
		return err
	}

	appConfig = &Config{}
	if err := json.Unmarshal(data, appConfig); err != nil {
		return err
	}

	return nil
}

// saveConfig 保存配置文件
func saveConfig() error {
	data, err := json.MarshalIndent(appConfig, "", "  ")
	if err != nil {
		return err
	}

	return os.WriteFile(configPath, data, 0644)
}

// GetConfig 获取配置
func GetConfig() *Config {
	configLock.RLock()
	defer configLock.RUnlock()

	// 返回配置的副本，避免外部修改
	config := *appConfig
	return &config
}

// UpdateProxyConfig 更新代理配置
func UpdateProxyConfig(host string, port int) error {
	configLock.Lock()
	defer configLock.Unlock()

	appConfig.ProxyHost = host
	appConfig.ProxyPort = port

	return saveConfig()
}

// UpdateUpstreamProxyConfig 更新上游代理配置
func UpdateUpstreamProxyConfig(config UpstreamProxyConfig) error {
	configLock.Lock()
	defer configLock.Unlock()

	appConfig.UpstreamProxy = config
	return saveConfig()
}
