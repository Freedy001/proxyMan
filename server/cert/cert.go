package cert

import (
	"crypto/rand"
	"crypto/rsa"
	"crypto/sha1"
	"crypto/tls"
	"crypto/x509"
	"crypto/x509/pkix"
	"encoding/hex"
	"encoding/pem"
	"fmt"
	"log"
	"math/big"
	"net"
	"os"
	"strings"
	"sync"
	"time"
)

// certCacheEntry represents a cached certificate with expiration time
type certCacheEntry struct {
	cert      *tls.Certificate
	expiresAt time.Time
}

var (
	CAEmail string
	CaSha1  string
)

var (
	ca           *x509.Certificate
	caPrivateKey *rsa.PrivateKey
	certCache    = make(map[string]*certCacheEntry)
	cacheMutex   = &sync.RWMutex{} // 保护证书缓存的并发访问
)

const (
	maxCacheSize = 1000           // 最大缓存数量
	cacheTTL     = 23 * time.Hour // 缓存过期时间（小于证书有效期1天）
)

// cleanExpiredCerts removes expired certificates from cache
func cleanExpiredCerts() {
	cacheMutex.Lock()
	defer cacheMutex.Unlock()

	now := time.Now()
	for host, entry := range certCache {
		if now.After(entry.expiresAt) {
			delete(certCache, host)
			log.Printf("Removed expired certificate for host: %s", host)
		}
	}
}

// evictOldestCerts removes oldest certificates when cache is full
func evictOldestCerts() {
	cacheMutex.Lock()
	defer cacheMutex.Unlock()

	if len(certCache) < maxCacheSize {
		return
	}

	// Find the oldest entry
	var oldestHost string
	var oldestTime time.Time
	first := true

	for host, entry := range certCache {
		if first || entry.expiresAt.Before(oldestTime) {
			oldestHost = host
			oldestTime = entry.expiresAt
			first = false
		}
	}

	if oldestHost != "" {
		delete(certCache, oldestHost)
		log.Printf("Evicted oldest certificate for host: %s", oldestHost)
	}
}

// startCacheCleanupRoutine starts a goroutine to periodically clean expired certificates
func startCacheCleanupRoutine() {
	go func() {
		ticker := time.NewTicker(1 * time.Hour) // 每小时清理一次
		defer ticker.Stop()

		for range ticker.C {
			cleanExpiredCerts()
		}
	}()
}

// InitCA generates a new CA certificate and private key if they don't exist.
func InitCA() {
	// Initialize certificate paths
	if err := InitCertPaths(); err != nil {
		log.Fatalf("Failed to initialize certificate paths: %v", err)
	}

	if _, err := os.Stat(CACertPath); os.IsNotExist(err) {
		log.Printf("Generating new CA in %s...", CACertDir)
		generateCA()
	}
	loadCA()

	CAEmail = ca.EmailAddresses[0]
	CaSha1 = fmt.Sprintf("%x", sha1.Sum(ca.Raw))
	// 启动缓存清理例程
	startCacheCleanupRoutine()
}

func generateCA() {
	email := generateRandomEmail()

	caTemplate := &x509.Certificate{
		SerialNumber: big.NewInt(2023),
		Subject: pkix.Name{
			Organization: []string{"ProxyMan"},
			CommonName:   "ProxyMan",
		},
		EmailAddresses:        []string{email},
		NotBefore:             time.Now(),
		NotAfter:              time.Now().AddDate(10, 0, 0),
		IsCA:                  true,
		ExtKeyUsage:           []x509.ExtKeyUsage{x509.ExtKeyUsageClientAuth, x509.ExtKeyUsageServerAuth},
		KeyUsage:              x509.KeyUsageDigitalSignature | x509.KeyUsageCertSign,
		BasicConstraintsValid: true,
	}

	privKey, err := rsa.GenerateKey(rand.Reader, 4096)
	if err != nil {
		log.Fatal(err)
	}

	caBytes, err := x509.CreateCertificate(rand.Reader, caTemplate, caTemplate, &privKey.PublicKey, privKey)
	if err != nil {
		log.Fatal(err)
	}

	caPEM := pem.EncodeToMemory(&pem.Block{Type: "CERTIFICATE", Bytes: caBytes})
	os.WriteFile(CACertPath, caPEM, 0644)

	privKeyPEM := pem.EncodeToMemory(&pem.Block{Type: "RSA PRIVATE KEY", Bytes: x509.MarshalPKCS1PrivateKey(privKey)})
	os.WriteFile(CAKeyPath, privKeyPEM, 0644)
	log.Printf("CA generated successfully in %s with email: %s", CACertDir, email)
}

func loadCA() {
	log.Printf("Loading CA from %s...", CACertDir)
	caCert, err := os.ReadFile(CACertPath)
	if err != nil {
		log.Fatal(err)
	}
	caPrivKeyPEM, err := os.ReadFile(CAKeyPath)
	if err != nil {
		log.Fatal(err)
	}

	caBlock, _ := pem.Decode(caCert)
	ca, err = x509.ParseCertificate(caBlock.Bytes)
	if err != nil {
		log.Fatal(err)
	}

	privKeyBlock, _ := pem.Decode(caPrivKeyPEM)
	caPrivateKey, err = x509.ParsePKCS1PrivateKey(privKeyBlock.Bytes)
	if err != nil {
		log.Fatal(err)
	}
	log.Println("CA loaded successfully.")
}

// GetCertificate gets a certificate for the given host. It uses a cache with eviction policy.
func GetCertificate(host string) (*tls.Certificate, error) {
	// 先检查缓存
	cacheMutex.RLock()
	entry, exists := certCache[host]
	cacheMutex.RUnlock()

	if exists {
		// 检查证书是否过期
		if time.Now().Before(entry.expiresAt) {
			return entry.cert, nil
		}
		// 证书已过期，从缓存中删除
		cacheMutex.Lock()
		delete(certCache, host)
		cacheMutex.Unlock()
	}

	// 生成新证书
	cert, err := signHost(host)
	if err != nil {
		return nil, err
	}

	// 在缓存中存储新证书之前，检查缓存大小
	evictOldestCerts()

	cacheMutex.Lock()
	certCache[host] = &certCacheEntry{
		cert:      cert,
		expiresAt: time.Now().Add(cacheTTL),
	}
	cacheMutex.Unlock()

	return cert, nil
}

// ClearCertCache clears the certificate cache safely
func ClearCertCache() {
	cacheMutex.Lock()
	defer cacheMutex.Unlock()
	certCache = make(map[string]*certCacheEntry)
	log.Println("Certificate cache cleared")
}

// GetCacheStats returns statistics about the certificate cache
func GetCacheStats() (int, int) {
	cacheMutex.RLock()
	defer cacheMutex.RUnlock()

	total := len(certCache)
	expired := 0
	now := time.Now()

	for _, entry := range certCache {
		if now.After(entry.expiresAt) {
			expired++
		}
	}

	return total, expired
}

func signHost(host string) (*tls.Certificate, error) {
	private, err := rsa.GenerateKey(rand.Reader, 2048)
	if err != nil {
		return nil, err
	}

	// Remove port from host if present
	hostName := host
	if strings.Contains(host, ":") {
		hostName = strings.Split(host, ":")[0]
	}

	template := &x509.Certificate{
		SerialNumber: big.NewInt(1658),
		Subject: pkix.Name{
			Organization: []string{"ProxyMan Inc."},
			CommonName:   hostName, // Set CommonName to the hostname
		},
		NotBefore:   time.Now(),
		NotAfter:    time.Now().AddDate(0, 0, 1),
		KeyUsage:    x509.KeyUsageKeyEncipherment | x509.KeyUsageDigitalSignature,
		ExtKeyUsage: []x509.ExtKeyUsage{x509.ExtKeyUsageServerAuth},
	}

	if ip := net.ParseIP(hostName); ip != nil {
		template.IPAddresses = []net.IP{ip}
	} else {
		template.DNSNames = []string{hostName}
	}

	derBytes, err := x509.CreateCertificate(rand.Reader, template, ca, &private.PublicKey, caPrivateKey)
	if err != nil {
		return nil, err
	}

	return &tls.Certificate{Certificate: [][]byte{derBytes}, PrivateKey: private}, nil
}

// IsCertificateInstalled 检查证书是否已安装
// 使用真实的系统检测，而不是标记文件
func IsCertificateInstalled() (bool, error) {
	// 首先检查证书文件是否存在
	if _, err := os.Stat(CACertPath); os.IsNotExist(err) {
		return false, nil
	}

	// 使用真实的系统检测
	return CheckCertificateInstalled()
}

// generateRandomEmail generates a random email address for the certificate
func generateRandomEmail() string {
	// Generate 8 random bytes
	randomBytes := make([]byte, 8)
	if _, err := rand.Read(randomBytes); err != nil {
		// Fallback to timestamp-based generation
		return "proxyman@localhost"
	}

	// Convert to hex string
	randomStr := hex.EncodeToString(randomBytes)

	return "proxyman-" + randomStr + "@localhost"
}
