#!/bin/bash

###############################################################################
# 🏭 Warehouse IoT - Unified Backend & Frontend Launcher
# Runs both Flask backend and React frontend with proper logging and management
###############################################################################

set -e  # Exit on error

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
MAGENTA='\033[0;35m'
CYAN='\033[0;36m'
NC='\033[0m' # No Color

# Configuration
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
BACKEND_DIR="${SCRIPT_DIR}/backend"
FRONTEND_DIR="${SCRIPT_DIR}/frontend"
LOG_DIR="${SCRIPT_DIR}/logs"
BACKEND_LOG="${LOG_DIR}/backend.log"
FRONTEND_LOG="${LOG_DIR}/frontend.log"
COMBINED_LOG="${LOG_DIR}/combined.log"

# Default ports
BACKEND_PORT=${BACKEND_PORT:-5000}
FRONTEND_PORT=${FRONTEND_PORT:-5173}
BACKEND_HOST=${BACKEND_HOST:-0.0.0.0}

# PID files for process management
BACKEND_PID_FILE="${SCRIPT_DIR}/.backend.pid"
FRONTEND_PID_FILE="${SCRIPT_DIR}/.frontend.pid"

###############################################################################
# Functions
###############################################################################

log_info() {
  echo -e "${BLUE}[INFO]${NC} $1" | tee -a "${COMBINED_LOG}"
}

log_success() {
  echo -e "${GREEN}[✓]${NC} $1" | tee -a "${COMBINED_LOG}"
}

log_error() {
  echo -e "${RED}[✗]${NC} $1" | tee -a "${COMBINED_LOG}"
}

log_warn() {
  echo -e "${YELLOW}[!]${NC} $1" | tee -a "${COMBINED_LOG}"
}

log_debug() {
  if [[ "${DEBUG}" == "1" ]]; then
    echo -e "${MAGENTA}[DEBUG]${NC} $1" | tee -a "${COMBINED_LOG}"
  fi
}

# Setup logging directory
setup_logging() {
  mkdir -p "${LOG_DIR}"
  > "${COMBINED_LOG}"  # Clear combined log
  log_info "Logging initialized to ${LOG_DIR}"
}

# Check if port is in use
check_port() {
  local port=$1
  local port_name=$2
  
  if lsof -Pi :${port} -sTCP:LISTEN -t >/dev/null 2>&1 ; then
    log_warn "${port_name} port ${port} is already in use"
    return 1
  else
    log_info "${port_name} port ${port} is available"
    return 0
  fi
}

# Check if directory exists
check_directory() {
  local dir=$1
  local name=$2
  
  if [[ ! -d "${dir}" ]]; then
    log_error "${name} directory not found: ${dir}"
    return 1
  fi
  log_info "${name} directory found: ${dir}"
  return 0
}

# Kill process by PID file
kill_process() {
  local pid_file=$1
  local name=$2
  
  if [[ -f "${pid_file}" ]]; then
    local pid=$(cat "${pid_file}")
    if kill -0 "${pid}" 2>/dev/null; then
      log_info "Stopping ${name} (PID: ${pid})..."
      kill "${pid}" 2>/dev/null || true
      sleep 2
      if kill -0 "${pid}" 2>/dev/null; then
        log_warn "${name} didn't stop gracefully, forcing..."
        kill -9 "${pid}" 2>/dev/null || true
      fi
      rm -f "${pid_file}"
      log_success "${name} stopped"
    else
      log_debug "${name} process ${pid} not running, cleaning up PID file"
      rm -f "${pid_file}"
    fi
  fi
}

# Cleanup function
cleanup() {
  log_warn "\n🛑 Shutting down services..."
  kill_process "${FRONTEND_PID_FILE}" "Frontend"
  kill_process "${BACKEND_PID_FILE}" "Backend"
  log_success "Cleanup complete"
  exit 0
}

# Start backend
start_backend() {
  log_info "Starting Flask backend..."
  
  if [[ ! -f "${BACKEND_DIR}/run.py" ]]; then
    log_error "Backend run.py not found at ${BACKEND_DIR}/run.py"
    return 1
  fi
  
  cd "${BACKEND_DIR}"
  
  # No venv - using system-wide packages
  log_info "Using system-wide Python packages..."
  
  # Start backend in background
  {
    export FLASK_APP=run.py
    export FLASK_ENV=production
    export FLASK_RUN_HOST=${BACKEND_HOST}
    export FLASK_RUN_PORT=${BACKEND_PORT}
    
    python3 run.py >> "${BACKEND_LOG}" 2>&1 &
    echo $! > "${BACKEND_PID_FILE}"
  }
  
  log_success "Backend started (PID: $(cat ${BACKEND_PID_FILE}))"
  sleep 3  # Give backend time to start
}

# Start frontend
start_frontend() {
  log_info "Starting React frontend..."
  
  if [[ ! -f "${FRONTEND_DIR}/package.json" ]]; then
    log_error "Frontend package.json not found at ${FRONTEND_DIR}/package.json"
    return 1
  fi
  
  cd "${FRONTEND_DIR}"
  
  # Check and install dependencies if needed
  if [[ ! -d "node_modules" ]]; then
    log_info "Installing frontend dependencies (this may take a minute)..."
    npm install --silent
  fi
  
  # Create .env.local if it doesn't exist
  if [[ ! -f ".env.local" ]]; then
    log_info "Creating .env.local for frontend..."
    cat > .env.local << EOF
VITE_API_URL=http://localhost:${BACKEND_PORT}/api
VITE_WS_URL=ws://localhost:${BACKEND_PORT}
EOF
    log_success ".env.local created"
  fi
  
  # Start frontend in background
  {
    VITE_API_URL="http://localhost:${BACKEND_PORT}/api" \
    npm run dev -- --host 0.0.0.0 --port ${FRONTEND_PORT} >> "${FRONTEND_LOG}" 2>&1 &
    echo $! > "${FRONTEND_PID_FILE}"
  }
  
  log_success "Frontend started (PID: $(cat ${FRONTEND_PID_FILE}))"
  sleep 2
}

# Wait for services to be ready
wait_for_services() {
  log_info "Waiting for services to be ready..."
  
  local max_attempts=30
  local attempt=0
  local backend_ready=0
  local frontend_ready=0
  
  while (( attempt < max_attempts )); do
    # Check backend
    if (( backend_ready == 0 )); then
      if curl -s http://localhost:${BACKEND_PORT}/api/health > /dev/null 2>&1; then
        log_success "Backend is ready at http://localhost:${BACKEND_PORT}"
        backend_ready=1
      fi
    fi
    
    # Check frontend
    if (( frontend_ready == 0 )); then
      if curl -s http://localhost:${FRONTEND_PORT}/ > /dev/null 2>&1; then
        log_success "Frontend is ready at http://localhost:${FRONTEND_PORT}"
        frontend_ready=1
      fi
    fi
    
    if (( backend_ready == 1 && frontend_ready == 1 )); then
      log_success "All services are ready!"
      return 0
    fi
    
    ((attempt++))
    sleep 1
  done
  
  log_warn "Services took longer than expected to start"
  return 0
}

# Display usage
usage() {
  cat << EOF
${CYAN}🏭 Warehouse IoT - Unified Launcher${NC}

Usage: $0 [COMMAND] [OPTIONS]

Commands:
  start              Start both backend and frontend (default)
  stop               Stop all running services
  status             Show service status
  logs               Tail combined logs
  backend-logs       Tail backend logs only
  frontend-logs      Tail frontend logs only
  clean              Remove all logs and PID files
  restart            Stop and start services

Options:
  --debug            Enable debug output
  --backend-port P   Backend port (default: 5000)
  --frontend-port P  Frontend port (default: 5173)
  --backend-host H   Backend host (default: 0.0.0.0)

Examples:
  $0 start                          # Start with defaults
  $0 start --backend-port 8000      # Start backend on port 8000
  $0 logs                           # Follow combined logs
  $0 stop                           # Stop all services
  
${GREEN}🚀 Quick Start:${NC}
  cd ~/warehouse_iot
  ./run_all.sh start
  # Visit http://localhost:5173 in your browser
  # Backend API: http://localhost:5000/api

EOF
}

# Show status
show_status() {
  echo ""
  echo -e "${CYAN}═══════════════════════════════════════════════════════════${NC}"
  echo -e "${CYAN}📊 Service Status${NC}"
  echo -e "${CYAN}═══════════════════════════════════════════════════════════${NC}"
  
  # Backend status
  echo -n "Backend (port ${BACKEND_PORT}):    "
  if [[ -f "${BACKEND_PID_FILE}" ]] && kill -0 $(cat "${BACKEND_PID_FILE}") 2>/dev/null; then
    echo -e "${GREEN}✓ Running${NC} (PID: $(cat ${BACKEND_PID_FILE}))"
  else
    echo -e "${RED}✗ Stopped${NC}"
  fi
  
  # Frontend status
  echo -n "Frontend (port ${FRONTEND_PORT}):   "
  if [[ -f "${FRONTEND_PID_FILE}" ]] && kill -0 $(cat "${FRONTEND_PID_FILE}") 2>/dev/null; then
    echo -e "${GREEN}✓ Running${NC} (PID: $(cat ${FRONTEND_PID_FILE}))"
  else
    echo -e "${RED}✗ Stopped${NC}"
  fi
  
  echo ""
  echo -e "${CYAN}🔗 Access Points:${NC}"
  echo -e "  Web UI:        ${GREEN}http://localhost:${FRONTEND_PORT}${NC}"
  echo -e "  Backend API:   ${GREEN}http://localhost:${BACKEND_PORT}/api${NC}"
  echo ""
  echo -e "${CYAN}📝 Logs:${NC}"
  echo -e "  Combined:      ${LOG_DIR}/combined.log"
  echo -e "  Backend:       ${LOG_DIR}/backend.log"
  echo -e "  Frontend:      ${LOG_DIR}/frontend.log"
  echo ""
  echo -e "${CYAN}═══════════════════════════════════════════════════════════${NC}"
  echo ""
}

###############################################################################
# Main Script
###############################################################################

# Parse command line arguments
COMMAND="start"
while [[ $# -gt 0 ]]; do
  case $1 in
    start|stop|status|logs|backend-logs|frontend-logs|clean|restart)
      COMMAND="$1"
      shift
      ;;
    --debug)
      DEBUG=1
      shift
      ;;
    --backend-port)
      BACKEND_PORT="$2"
      shift 2
      ;;
    --frontend-port)
      FRONTEND_PORT="$2"
      shift 2
      ;;
    --backend-host)
      BACKEND_HOST="$2"
      shift 2
      ;;
    -h|--help)
      usage
      exit 0
      ;;
    *)
      log_error "Unknown option: $1"
      usage
      exit 1
      ;;
  esac
done

# Execute command
case "${COMMAND}" in
  start)
    setup_logging
    
    echo ""
    echo -e "${CYAN}╔════════════════════════════════════════════════════════╗${NC}"
    echo -e "${CYAN}║  🏭 Warehouse IoT System - Starting Services         ║${NC}"
    echo -e "${CYAN}╚════════════════════════════════════════════════════════╝${NC}"
    echo ""
    
    # Validate setup
    check_directory "${BACKEND_DIR}" "Backend" || exit 1
    check_directory "${FRONTEND_DIR}" "Frontend" || exit 1
    check_port ${BACKEND_PORT} "Backend" || log_warn "Attempting to use port ${BACKEND_PORT} anyway..."
    check_port ${FRONTEND_PORT} "Frontend" || log_warn "Attempting to use port ${FRONTEND_PORT} anyway..."
    
    echo ""
    
    # Start services
    start_backend || exit 1
    start_frontend || exit 1
    
    # Wait for services
    wait_for_services
    
    # Show status
    show_status
    
    # Setup signal handlers for cleanup
    trap cleanup SIGINT SIGTERM
    
    # Wait for any process to exit
    log_info "Services running. Press Ctrl+C to stop."
    wait
    ;;
    
  stop)
    setup_logging
    echo -e "${YELLOW}🛑 Stopping all services...${NC}"
    kill_process "${FRONTEND_PID_FILE}" "Frontend"
    kill_process "${BACKEND_PID_FILE}" "Backend"
    log_success "All services stopped"
    ;;
    
  status)
    show_status
    ;;
    
  logs)
    if [[ -f "${COMBINED_LOG}" ]]; then
      tail -f "${COMBINED_LOG}"
    else
      log_error "No logs found"
      exit 1
    fi
    ;;
    
  backend-logs)
    if [[ -f "${BACKEND_LOG}" ]]; then
      tail -f "${BACKEND_LOG}"
    else
      log_error "No backend logs found"
      exit 1
    fi
    ;;
    
  frontend-logs)
    if [[ -f "${FRONTEND_LOG}" ]]; then
      tail -f "${FRONTEND_LOG}"
    else
      log_error "No frontend logs found"
      exit 1
    fi
    ;;
    
  clean)
    log_info "Cleaning up logs and PID files..."
    rm -f "${BACKEND_PID_FILE}" "${FRONTEND_PID_FILE}"
    rm -rf "${LOG_DIR}"
    log_success "Cleanup complete"
    ;;
    
  restart)
    setup_logging
    echo -e "${YELLOW}🔄 Restarting services...${NC}"
    kill_process "${FRONTEND_PID_FILE}" "Frontend"
    kill_process "${BACKEND_PID_FILE}" "Backend"
    sleep 2
    start_backend || exit 1
    start_frontend || exit 1
    wait_for_services
    show_status
    trap cleanup SIGINT SIGTERM
    log_info "Services restarted. Press Ctrl+C to stop."
    wait
    ;;
    
  *)
    log_error "Unknown command: ${COMMAND}"
    usage
    exit 1
    ;;
esac
