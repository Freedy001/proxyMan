#!/bin/bash

# =============================================================================
# ProxyMan 跨平台构建脚本
#
# 功能:
#   - 构建 Wails 桌面应用 (macOS/Linux/Windows)
#   - 构建 Go headless 无 UI 应用 (所有平台)
#   - 支持多架构 (amd64/arm64)
#
# 使用方式:
#   ./build.sh              # 构建所有平台和模式
#   ./build.sh desktop      # 仅构建桌面应用
#   ./build.sh headless     # 仅构建 headless
#   ./build.sh --clean      # 清理后构建
#   ./build.sh --help       # 显示帮助
# =============================================================================

set -e  # 遇到错误立即退出

# 颜色定义
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

# 项目配置
PROJECT_ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
BUILD_DIR="${PROJECT_ROOT}/build/bin"
FRONTEND_DIR="${PROJECT_ROOT}/frontend"
LOG_FILE="${BUILD_DIR}/build.log"
APP_NAME="proxyMan"

# 支持的平台和架构
PLATFORMS=("darwin" "linux" "windows")
ARCHITECTURES=("amd64" "arm64")

# =============================================================================
# 辅助函数
# =============================================================================

# 日志函数
log_info() {
    echo -e "${BLUE}[INFO]${NC} $1" | tee -a "${LOG_FILE}"
}

log_success() {
    echo -e "${GREEN}[SUCCESS]${NC} $1" | tee -a "${LOG_FILE}"
}

log_warn() {
    echo -e "${YELLOW}[WARN]${NC} $1" | tee -a "${LOG_FILE}"
}

log_error() {
    echo -e "${RED}[ERROR]${NC} $1" | tee -a "${LOG_FILE}"
}

# 显示帮助信息
show_help() {
    cat << EOF
ProxyMan 跨平台构建脚本

使用方式:
    $0 [选项] [模式]

模式:
    desktop         仅构建 Wails 桌面应用
    headless        仅构建 Go headless 无 UI 应用
    (默认)          构建所有模式

选项:
    --clean         构建前清理旧的构建产物
    --s             跳过前端构建
    --help          显示此帮助信息

支持的平台:
    - macOS (darwin): amd64, arm64
    - Linux: amd64, arm64
    - Windows: amd64, arm64

构建产物位置:
    build/desktop/   - Wails 桌面应用
    build/headless/  - Go headless 应用
    build/build.log  - 构建日志

示例:
    $0                    # 构建所有平台和模式
    $0 desktop            # 仅构建桌面应用
    $0 headless --clean   # 清理后构建 headless
EOF
}

# =============================================================================
# 环境检查
# =============================================================================

check_environment() {
    log_info "检查构建环境..."

    # 检查 Go
    if ! command -v go &> /dev/null; then
        log_error "未找到 Go 工具链，请先安装 Go (>= 1.25)"
        exit 1
    fi
    GO_VERSION=$(go version | awk '{print $3}')
    log_success "Go 已安装: ${GO_VERSION}"

    # 检查 Node.js
    if ! command -v node &> /dev/null; then
        log_error "未找到 Node.js，请先安装 Node.js (>= 22)"
        exit 1
    fi
    NODE_VERSION=$(node --version)
    log_success "Node.js 已安装: ${NODE_VERSION}"

    # 检查 npm
    if ! command -v npm &> /dev/null; then
        log_error "未找到 npm，请先安装 npm"
        exit 1
    fi
    NPM_VERSION=$(npm --version)
    log_success "npm 已安装: v${NPM_VERSION}"

    # 检查 Wails (仅在需要构建桌面应用时)
    if [[ "$BUILD_MODE" == "all" || "$BUILD_MODE" == "desktop" ]]; then
        if ! command -v wails &> /dev/null; then
            log_error "未找到 Wails CLI，请先安装: go install github.com/wailsapp/wails/v2/cmd/wails@latest"
            exit 1
        fi
        WAILS_VERSION=$(wails version 2>&1 | grep "CLI Version" | awk '{print $3}')
        log_success "Wails 已安装: v${WAILS_VERSION}"
    fi

    log_success "环境检查通过 ✓"
    echo ""
}

# =============================================================================
# 清理函数
# =============================================================================

clean_build() {
    log_info "清理旧的构建产物..."

    if [ -d "${BUILD_DIR}" ]; then
        rm -rf "${BUILD_DIR}"
        log_success "已清理: ${BUILD_DIR}"
    fi

    if [ -d "${FRONTEND_DIR}/dist" ]; then
        rm -rf "${FRONTEND_DIR}/dist"
        log_success "已清理: ${FRONTEND_DIR}/dist"
    fi

    if [ -d "${FRONTEND_DIR}/node_modules" ]; then
        log_warn "保留 node_modules (如需清理请手动删除)"
    fi

    echo ""
}

# =============================================================================
# 前端构建
# =============================================================================

build_frontend() {
    log_info "开始构建前端..."

    cd "${FRONTEND_DIR}"

    # 安装依赖
    if [ ! -d "node_modules" ]; then
        log_info "安装前端依赖..."
        npm install
    else
        log_info "前端依赖已存在，跳过安装"
    fi

    # 构建前端
    log_info "构建前端资源..."
    npm run build

    # 验证构建产物
    if [ ! -d "dist" ]; then
        log_error "前端构建失败: dist 目录不存在"
        exit 1
    fi

    log_success "前端构建完成 ✓"
    echo ""

    cd "${PROJECT_ROOT}"
}

# =============================================================================
# Wails 桌面应用构建
# =============================================================================

build_desktop() {
    log_info "开始构建 Wails 桌面应用..."

    mkdir -p "${BUILD_DIR}"

    for platform in "${PLATFORMS[@]}"; do
        for arch in "${ARCHITECTURES[@]}"; do
            TARGET="${platform}/${arch}"
            if [[ "$platform" == "windows" ]]; then
                TARGET_NAME="${APP_NAME}-${platform}-${arch}.exe"
            else
                TARGET_NAME="${APP_NAME}-${platform}-${arch}"
            fi
            log_info "构建目标: ${TARGET}"

            # 使用 Wails 构建
            # 注意: Wails 在当前平台构建跨平台应用可能需要额外配置
            # 这里尝试使用环境变量指定目标平台
            echo exec cmd: wails build -s\
                -platform "${platform}/${arch}" \
                -o "${TARGET_NAME}" \
                2>&1 | tee -a "${LOG_FILE}"
            wails build -s\
                -platform "${platform}/${arch}" \
                -o "${TARGET_NAME}" \
                2>&1 | tee -a "${LOG_FILE}"

            if [[ "$platform" == "darwin" ]] && [ -d "${BUILD_DIR}/ProxyMan.app" ]; then
                TARGET_NAME="${TARGET_NAME}.app"
                mv "${BUILD_DIR}/ProxyMan.app" "${BUILD_DIR}/${TARGET_NAME}"
                log_success "✓ ${TARGET} -> ${BUILD_DIR}/${TARGET_NAME}"
            elif [ $? -eq 0 ] && [ -f "${BUILD_DIR}/${TARGET_NAME}" ]; then
                log_success "✓ ${TARGET} -> ${BUILD_DIR}/${TARGET_NAME}"
            else
                log_warn "✗ ${TARGET} 构建失败或不支持交叉编译"
            fi

            echo ""
        done
    done

    log_success "Wails 桌面应用构建完成 ✓"
    echo ""
}

# =============================================================================
# Go Headless 应用构建
# =============================================================================

build_headless() {
    log_info "开始构建 Go headless 应用..."

    mkdir -p "${BUILD_DIR}"

    for platform in "${PLATFORMS[@]}"; do
        for arch in "${ARCHITECTURES[@]}"; do
            TARGET="${platform}/${arch}"

            # Windows 特殊处理
            if [[ "$platform" == "windows" ]]; then
                OUTPUT_FILE="${BUILD_DIR}/${APP_NAME}-headless-${platform}-${arch}.exe"
            else
                OUTPUT_FILE="${BUILD_DIR}/${APP_NAME}-headless-${platform}-${arch}"
            fi

            log_info "构建目标: ${TARGET}"

            # 使用 Go 交叉编译
            GOOS="${platform}" GOARCH="${arch}" CGO_ENABLED=0 go build \
                -ldflags="-s -w" \
                -tags "cmd" \
                -o "${OUTPUT_FILE}" \
                "${PROJECT_ROOT}/main.go" \
                2>&1 | tee -a "${LOG_FILE}"

            if [ $? -eq 0 ] && [ -f "${OUTPUT_FILE}" ]; then
                SIZE=$(du -h "${OUTPUT_FILE}" | cut -f1)
                log_success "✓ ${TARGET} (${SIZE})"
            else
                log_error "✗ ${TARGET} 构建失败"
                exit 1
            fi

            echo ""
        done
    done

    log_success "Go headless 应用构建完成 ✓"
    echo ""
}

# =============================================================================
# 主流程
# =============================================================================

main() {
    # 初始化日志
    mkdir -p "${BUILD_DIR}"
    echo "=== ProxyMan 构建日志 ===" > "${LOG_FILE}"
    echo "开始时间: $(date)" >> "${LOG_FILE}"
    echo "" >> "${LOG_FILE}"

    log_info "ProxyMan 跨平台构建脚本"
    log_info "项目路径: ${PROJECT_ROOT}"
    log_info "构建模式: ${BUILD_MODE}"
    echo ""

    # 环境检查
    check_environment

    # 清理（如果需要）
    if [[ "$CLEAN_BUILD" == "true" ]]; then
        clean_build
    fi

    # 构建前端
    if [[ "$SKIP_FRONT" == "false" ]]; then
      build_frontend
    fi

    # 根据模式构建
    if [[ "$BUILD_MODE" == "all" ]]; then
        build_desktop
        build_headless
    elif [[ "$BUILD_MODE" == "desktop" ]]; then
        build_desktop
    elif [[ "$BUILD_MODE" == "headless" ]]; then
        build_headless
    fi

    # 构建完成
    echo ""
    log_success "========================================="
    log_success "构建完成！"
    log_success "========================================="
    echo ""
    log_info "构建产物位置:"

    if [[ "$BUILD_MODE" == "all" || "$BUILD_MODE" == "desktop" ]]; then
        log_info "  - Wails 桌面应用: ${BUILD_DIR}/desktop/"
    fi

    if [[ "$BUILD_MODE" == "all" || "$BUILD_MODE" == "headless" ]]; then
        log_info "  - Go headless 应用: ${BUILD_DIR}/headless/"
    fi

    log_info "  - 构建日志: ${LOG_FILE}"
    echo ""

    echo "结束时间: $(date)" >> "${LOG_FILE}"
}

# =============================================================================
# 参数解析
# =============================================================================

BUILD_MODE="all"
CLEAN_BUILD="false"
SKIP_FRONT="false"

while [[ $# -gt 0 ]]; do
    case $1 in
        --help|-h)
            show_help
            exit 0
            ;;
        --clean)
            CLEAN_BUILD="true"
            shift
            ;;
        --s)
            SKIP_FRONT="true"
            shift
            ;;
        desktop)
            BUILD_MODE="desktop"
            shift
            ;;
        headless)
            BUILD_MODE="headless"
            shift
            ;;
        *)
            log_error "未知参数: $1"
            echo ""
            show_help
            exit 1
            ;;
    esac
done

# 执行主流程
main
