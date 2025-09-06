#!/bin/bash

# ProxyMan 跨平台构建脚本
# 构建不需要包含证书的发布版本

set -e

# 项目信息
PROJECT_NAME="proxyMan"
VERSION="1.0.0"
BUILD_DIR="build"
DIST_DIR="dist"

# 颜色输出
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

# 日志函数
log_info() {
    echo -e "${GREEN}[INFO]${NC} $1"
}

log_warn() {
    echo -e "${YELLOW}[WARN]${NC} $1"
}

log_error() {
    echo -e "${RED}[ERROR]${NC} $1"
}

# 清理之前的构建
clean_build() {
    log_info "清理之前的构建文件..."
    rm -rf $BUILD_DIR $DIST_DIR
    mkdir -p $BUILD_DIR $DIST_DIR
}

# 获取最新版本号
get_version() {
    if [ -n "$(git tag --sort=-version:refname | head -n 1)" ]; then
        VERSION=$(git tag --sort=-version:refname | head -n 1 | sed 's/v//')
    fi
    log_info "使用版本号: $VERSION"
}

# 构建函数
build() {
    local os=$1
    local arch=$2
    local output_name="${PROJECT_NAME}-${VERSION}-${os}-${arch}"
    
    if [ "$os" = "windows" ]; then
        output_name="${PROJECT_NAME}-${VERSION}-${os}-${arch}.exe"
    fi
    
    log_info "构建 $os/$arch 版本..."
    
    # 设置构建标签，不包含证书初始化
    go build -tags="release" \
        -ldflags="-X main.Version=$VERSION -X main.BuildDate=$(date -u +%Y-%m-%dT%H:%M:%SZ) -s -w" \
        -o "$DIST_DIR/$output_name" \
        ./main.go
    
    log_info "✅ $os/$arch 构建完成: $output_name"
}

# 主构建流程
main() {
    log_info "开始构建 ProxyMan $VERSION..."
    
    clean_build
    get_version
    
    # 定义要构建的平台
    declare -a platforms=(
        "darwin amd64"
        "darwin arm64"
        "linux amd64"
        "linux arm64"
        "windows amd64"
        "windows arm64"
    )
    
    # 构建所有平台
    for platform in "${platforms[@]}"; do
        read -r os arch <<< "$platform"
        GOOS=$os GOARCH=$arch build "$os" "$arch"
    done
    
    # 计算文件哈希
    log_info "计算文件哈希..."
    cd $DIST_DIR
    > checksums.txt  # 清空校验和文件
    for file in proxyMan-* proxyMan.exe-*; do
        if [ -f "$file" ]; then
            sha256sum "$file" >> "checksums.txt"
            log_info "📋 $(sha256sum "$file")"
        fi
    done
    cd - > /dev/null
    
    # 创建版本信息文件
    cat > "$DIST_DIR/RELEASE_NOTES.md" << EOF
# ProxyMan $VERSION Release Notes

## 构建信息
- 构建时间: $(date -u +"%Y-%m-%dT%H:%M:%SZ")
- Go 版本: $(go version | cut -d' ' -f3)
- Git 提交: $(git rev-parse --short HEAD)

## 支持的平台
- macOS (Intel): ${PROJECT_NAME}-${VERSION}-darwin-amd64
- macOS (Apple Silicon): ${PROJECT_NAME}-${VERSION}-darwin-arm64
- Linux (x86_64): ${PROJECT_NAME}-${VERSION}-linux-amd64
- Linux (ARM64): ${PROJECT_NAME}-${VERSION}-linux-arm64
- Windows (x86_64): ${PROJECT_NAME}-${VERSION}-windows-amd64.exe
- Windows (ARM64): ${PROJECT_NAME}-${VERSION}-windows-arm64.exe

## 使用说明
1. 下载对应平台的二进制文件
2. 给文件添加执行权限 (macOS/Linux):
   \`\`\`bash
   chmod +x ${PROJECT_NAME}-${VERSION}-darwin-amd64
   \`\`\`
3. 运行程序:
   - macOS/Linux: \`./${PROJECT_NAME}-${VERSION}-darwin-amd64\`
   - Windows: `${PROJECT_NAME}-${VERSION}-windows-amd64.exe`

## 注意事项
- 首次运行时会自动生成 CA 证书文件
- 默认代理端口: 8888
- Web 管理界面: http://localhost:8080

## 文件验证
请使用 checksums.txt 文件验证下载的完整性。
EOF
    
    log_info "✅ 构建完成！"
    log_info "📦 构建产物位于: $DIST_DIR/"
    log_info "📋 版本信息: $DIST_DIR/RELEASE_NOTES.md"
    log_info "🔐 校验和: $DIST_DIR/checksums.txt"
    
    # 显示文件列表
    log_info "📂 构建产物列表:"
    ls -la $DIST_DIR/
}

# 检查依赖
check_dependencies() {
    if ! command -v go &> /dev/null; then
        log_error "Go 未安装，请先安装 Go"
        exit 1
    fi
    
    log_info "✅ 依赖检查通过"
}

# 检查参数
if [ "$1" = "--clean" ]; then
    clean_build
    exit 0
fi

if [ "$1" = "--help" ] || [ "$1" = "-h" ]; then
    echo "ProxyMan 构建脚本"
    echo ""
    echo "用法: $0 [选项]"
    echo ""
    echo "选项:"
    echo "  --clean    清理构建文件"
    echo "  --help     显示帮助信息"
    echo ""
    exit 0
fi

# 运行主流程
check_dependencies
main