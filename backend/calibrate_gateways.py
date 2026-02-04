#!/usr/bin/env python3
"""
Gateway RSSI Calibration Tool
Automatically calibrates TX_POWER and path loss exponents for accurate positioning
"""

import requests
import time
import statistics
import math
from datetime import datetime, timedelta
from colorama import init, Fore, Style
import sys

# Initialize colorama for colored terminal output
init(autoreset=True)

API_BASE = "http://localhost:5000/api"
BEACON_ID = "forklift_001"  # Arduino beacon ID


def print_header(text):
    """Print colored header"""
    print(f"\n{Fore.CYAN}{'='*70}")
    print(f"{Fore.CYAN}{text:^70}")
    print(f"{Fore.CYAN}{'='*70}{Style.RESET_ALL}\n")


def print_success(text):
    """Print success message"""
    print(f"{Fore.GREEN}✓ {text}{Style.RESET_ALL}")


def print_error(text):
    """Print error message"""
    print(f"{Fore.RED}✗ {text}{Style.RESET_ALL}")


def print_warning(text):
    """Print warning message"""
    print(f"{Fore.YELLOW}⚠ {text}{Style.RESET_ALL}")


def print_info(text):
    """Print info message"""
    print(f"{Fore.BLUE}ℹ {text}{Style.RESET_ALL}")


def get_active_gateways():
    """Fetch list of active gateways from backend that are currently sending data"""
    try:
        response = requests.get(f"{API_BASE}/rssi/gateways", timeout=5)
        response.raise_for_status()
        data = response.json()
        
        # Filter for active gateways that have sent data recently (within 5 minutes)
        now = datetime.utcnow()
        active_gateways = []
        
        for g in data['gateways']:
            if g['is_active']:
                # Check if gateway has sent data recently
                last_seen = datetime.fromisoformat(g['last_seen'].replace('Z', ''))
                minutes_ago = (now - last_seen).total_seconds() / 60
                
                if minutes_ago < 5:  # Active within last 5 minutes
                    active_gateways.append(g)
        
        return active_gateways
    except Exception as e:
        print_error(f"Failed to fetch gateways: {e}")
        return []


def collect_rssi_samples(gateway_id, duration=60, min_samples=20):
    """
    Collect RSSI samples from a specific gateway
    
    Args:
        gateway_id: Gateway to collect from
        duration: Maximum time to wait (seconds) - safety timeout
        min_samples: Minimum number of samples required
    
    Returns:
        List of RSSI values, or None if failed
    """
    print_info(f"Collecting {min_samples} RSSI samples (max wait: {duration}s)...")
    print_info("Please wait while beacon transmits data...")
    
    start_time = datetime.utcnow()
    samples = []
    seen_ids = set()  # Track reading IDs to avoid processing same reading twice
    last_count = 0
    
    # Progress bar based on sample count
    print(f"\nProgress: [" + " " * 50 + f"] 0/{min_samples} samples", end='', flush=True)
    
    while len(samples) < min_samples:
        # Safety timeout check
        elapsed = (datetime.utcnow() - start_time).total_seconds()
        if elapsed > duration:
            print_warning(f"\n⚠ Timeout reached ({duration}s) - only collected {len(samples)} samples")
            break
            
        try:
            # Fetch recent RSSI history
            response = requests.get(
                f"{API_BASE}/rssi/history",
                params={"forklift_id": BEACON_ID, "hours": 1, "limit": 100},
                timeout=3
            )
            
            if response.ok:
                data = response.json()
                
                # Filter readings from this gateway in last 10 seconds
                cutoff_time = datetime.utcnow() - timedelta(seconds=10)
                
                for reading in data.get('readings', []):
                    if reading['gateway_id'] == gateway_id:
                        reading_time = datetime.fromisoformat(reading['timestamp'].replace('Z', '+00:00'))
                        if reading_time > cutoff_time:
                            # Use reading ID to avoid duplicates (not RSSI value)
                            reading_id = reading['id']
                            if reading_id not in seen_ids:
                                seen_ids.add(reading_id)
                                samples.append(reading['rssi'])
            
            # Update progress bar when sample count changes
            if len(samples) != last_count:
                progress = int((len(samples) / min_samples) * 50)
                progress = min(progress, 50)  # Cap at 50
                print(f"\rProgress: [{'#' * progress}{' ' * (50 - progress)}] {len(samples)}/{min_samples} samples", 
                      end='', flush=True)
                last_count = len(samples)
            
            time.sleep(0.5)
            
        except Exception as e:
            pass  # Silent fail for individual requests
    
    print()  # New line after progress bar
    
    if len(samples) < min_samples:
        print_warning(f"Only collected {len(samples)} samples (minimum {min_samples} needed)")
        print_info("Try moving beacon closer or check if beacon is transmitting")
        return None
    
    print_success(f"Collected {len(samples)} RSSI samples in {elapsed:.1f}s")
    return samples


def analyze_rssi_samples(samples):
    """
    Analyze RSSI samples and calculate statistics
    
    Returns:
        Dictionary with mean, median, std_dev, min, max
    """
    if not samples:
        return None
    
    return {
        'mean': statistics.mean(samples),
        'median': statistics.median(samples),
        'std_dev': statistics.stdev(samples) if len(samples) > 1 else 0,
        'min': min(samples),
        'max': max(samples),
        'count': len(samples)
    }


def calibrate_tx_power(gateway_id):
    """
    Calibrate TX_POWER at 1 meter distance
    
    Returns:
        Calibrated TX_POWER value (average RSSI at 1m)
    """
    print_header(f"TX_POWER Calibration: {gateway_id}")
    
    print(f"{Fore.YELLOW}SETUP INSTRUCTIONS:{Style.RESET_ALL}")
    print(f"  1. Place Arduino beacon EXACTLY 1.0 meter from gateway '{gateway_id}'")
    print(f"  2. Ensure CLEAR LINE-OF-SIGHT (no obstacles)")
    print(f"  3. Keep beacon and phone STATIONARY")
    print(f"  4. Beacon should be at same height as phone")
    print()
    
    input(f"{Fore.GREEN}Press ENTER when ready to start measurement...{Style.RESET_ALL}")
    
    # Collect samples - wait up to 60 seconds for 20 samples
    samples = collect_rssi_samples(gateway_id, duration=60, min_samples=20)
    
    if not samples:
        print_error("Failed to collect enough samples")
        return None
    
    # Analyze
    stats = analyze_rssi_samples(samples)
    
    print(f"\n{Fore.CYAN}RSSI Statistics at 1 meter:{Style.RESET_ALL}")
    print(f"  Average (TX_POWER):  {stats['mean']:.1f} dBm")
    print(f"  Median:              {stats['median']:.1f} dBm")
    print(f"  Std Deviation:       {stats['std_dev']:.2f} dBm")
    print(f"  Range:               {stats['min']} to {stats['max']} dBm")
    print(f"  Sample Count:        {stats['count']}")
    
    # Quality check
    if stats['std_dev'] > 5.0:
        print_warning(f"High variation detected ({stats['std_dev']:.1f} dBm)")
        print_warning("Consider repeating measurement in more stable environment")
    else:
        print_success(f"Low variation ({stats['std_dev']:.1f} dBm) - Good measurement!")
    
    return stats['mean']


def calibrate_path_loss_exponent(gateway_id, tx_power):
    """
    Calibrate path loss exponent at multiple distances
    
    Returns:
        Calculated path loss exponent (n)
    """
    print_header(f"Path Loss Exponent Calibration: {gateway_id}")
    
    print(f"{Fore.CYAN}This step helps improve distance accuracy.{Style.RESET_ALL}")
    print(f"You'll need to measure RSSI at different distances: 2m, 4m, 8m")
    print()
    
    answer = input(f"{Fore.YELLOW}Do you want to calibrate path loss exponent? (y/n): {Style.RESET_ALL}").lower()
    
    if answer != 'y':
        print_info("Skipping path loss calibration (will use default n=2.0)")
        return None
    
    distances = [2.0, 4.0, 8.0]
    measurements = []
    
    for distance in distances:
        print(f"\n{Fore.YELLOW}SETUP: Place beacon at {distance} meters from gateway{Style.RESET_ALL}")
        print(f"  - Use measuring tape for accuracy")
        print(f"  - Maintain line-of-sight")
        print()
        
        input(f"{Fore.GREEN}Press ENTER when ready...{Style.RESET_ALL}")
        
        samples = collect_rssi_samples(gateway_id, duration=45, min_samples=15)
        
        if samples:
            avg_rssi = statistics.mean(samples)
            measurements.append((distance, avg_rssi))
            print_success(f"Measured RSSI at {distance}m: {avg_rssi:.1f} dBm")
        else:
            print_warning(f"Failed to measure at {distance}m - skipping")
    
    if len(measurements) < 2:
        print_error("Not enough measurements to calculate path loss exponent")
        return None
    
    # Calculate path loss exponent using linear regression
    # Formula: RSSI = TX_POWER - 10*n*log10(distance)
    # Rearranged: n = (TX_POWER - RSSI) / (10 * log10(distance))
    
    n_values = []
    for distance, rssi in measurements:
        if distance > 1.0:  # Skip 1m (reference point)
            n = (tx_power - rssi) / (10 * math.log10(distance))
            n_values.append(n)
    
    if n_values:
        avg_n = statistics.mean(n_values)
        print(f"\n{Fore.CYAN}Calculated Path Loss Exponent:{Style.RESET_ALL}")
        print(f"  n = {avg_n:.2f}")
        
        # Interpretation
        if avg_n < 2.0:
            print_info("  Low n value - suggests very clear environment")
        elif avg_n < 3.0:
            print_success("  Good value for indoor line-of-sight")
        elif avg_n < 4.0:
            print_info("  Moderate n - some obstacles present")
        else:
            print_warning("  High n - many obstacles or reflections")
        
        return avg_n
    
    return None


def update_positioning_engine_config(tx_power):
    """
    Update positioning_engine.py with new TX_POWER value
    """
    config_file = "/home/rpi/warehouse_iot/backend/app/services/positioning_engine.py"
    
    try:
        with open(config_file, 'r') as f:
            content = f.read()
        
        # Replace TX_POWER in get_positioning_engine function
        old_line = "_positioning_engine = PositioningEngine(update_interval=0.5, tx_power=-55)"
        new_line = f"_positioning_engine = PositioningEngine(update_interval=0.5, tx_power={tx_power:.1f})"
        
        if old_line in content:
            content = content.replace(old_line, new_line)
            
            with open(config_file, 'w') as f:
                f.write(content)
            
            print_success(f"Updated {config_file}")
            return True
        else:
            print_warning("Could not find TX_POWER line in positioning_engine.py")
            return False
            
    except Exception as e:
        print_error(f"Failed to update config file: {e}")
        return False


def update_gateway_config(tx_power, path_loss_n=None):
    """
    Update gateway_config.py with calibrated values
    """
    config_file = "/home/rpi/warehouse_iot/backend/app/gateway_config.py"
    
    try:
        with open(config_file, 'r') as f:
            lines = f.readlines()
        
        updated = False
        for i, line in enumerate(lines):
            if '"TX_POWER":' in line and 'RSSI_CONFIG' in ''.join(lines[max(0, i-5):i]):
                lines[i] = f'    "TX_POWER": {tx_power:.1f},  # Calibrated on {datetime.now().strftime("%Y-%m-%d")}\n'
                updated = True
            
            if path_loss_n and '"PATH_LOSS_N_LOS":' in line:
                lines[i] = f'    "PATH_LOSS_N_LOS": {path_loss_n:.2f},  # Calibrated\n'
        
        if updated:
            with open(config_file, 'w') as f:
                f.writelines(lines)
            
            print_success(f"Updated {config_file}")
            return True
        
        return False
            
    except Exception as e:
        print_error(f"Failed to update config file: {e}")
        return False


def main():
    """Main calibration workflow"""
    print_header("Gateway RSSI Calibration Tool")
    
    print(f"{Fore.CYAN}This tool will help you calibrate your positioning system for accuracy.{Style.RESET_ALL}")
    print(f"You will need:")
    print(f"  • Arduino beacon (forklift_001) powered on")
    print(f"  • Mobile gateway(s) running and sending RSSI data")
    print(f"  • Measuring tape")
    print(f"  • ~5-10 minutes per gateway")
    print()
    
    # Check backend connectivity
    try:
        response = requests.get(f"{API_BASE}/health", timeout=5)
        if response.ok:
            print_success("Backend connected")
        else:
            print_error("Backend not responding properly")
            return
    except:
        print_error("Cannot connect to backend at http://localhost:5000")
        print_info("Make sure backend is running: cd backend && python run.py")
        return
    
    # Get active gateways
    gateways = get_active_gateways()
    
    if not gateways:
        print_error("No active gateways found!")
        print_info("Make sure mobile app gateways are running and active")
        return
    
    print_success(f"Found {len(gateways)} active gateway(s):")
    for i, gw in enumerate(gateways, 1):
        print(f"  {i}. {gw['gateway_id']} ({gw['name']})")
    print()
    
    # Ask which gateways to calibrate
    print(f"{Fore.YELLOW}Which gateways do you want to calibrate?{Style.RESET_ALL}")
    print(f"  1. All gateways")
    print(f"  2. Select specific gateways")
    
    choice = input(f"\nChoice (1 or 2): ").strip()
    
    if choice == '2':
        print("\nEnter gateway numbers to calibrate (comma-separated, e.g., 1,3):")
        selected = input("Numbers: ").strip()
        try:
            indices = [int(x.strip()) - 1 for x in selected.split(',')]
            gateways_to_calibrate = [gateways[i] for i in indices if 0 <= i < len(gateways)]
        except:
            print_error("Invalid selection")
            return
    else:
        gateways_to_calibrate = gateways
    
    # Calibration results
    calibration_results = {}
    
    # Calibrate each gateway
    for gateway in gateways_to_calibrate:
        gateway_id = gateway['gateway_id']
        
        # TX_POWER calibration (required)
        tx_power = calibrate_tx_power(gateway_id)
        
        if tx_power is None:
            print_warning(f"Skipping {gateway_id} due to calibration failure")
            continue
        
        calibration_results[gateway_id] = {
            'tx_power': tx_power,
            'path_loss_n': None
        }
        
        # Path loss calibration (optional)
        path_loss_n = calibrate_path_loss_exponent(gateway_id, tx_power)
        
        if path_loss_n:
            calibration_results[gateway_id]['path_loss_n'] = path_loss_n
        
        print()
    
    # Summary
    print_header("Calibration Summary")
    
    if not calibration_results:
        print_error("No successful calibrations")
        return
    
    print(f"{Fore.CYAN}Calibrated Values:{Style.RESET_ALL}\n")
    
    avg_tx_power = statistics.mean([r['tx_power'] for r in calibration_results.values()])
    
    for gateway_id, results in calibration_results.items():
        print(f"{Fore.GREEN}{gateway_id}:{Style.RESET_ALL}")
        print(f"  TX_POWER: {results['tx_power']:.1f} dBm")
        if results['path_loss_n']:
            print(f"  Path Loss (n): {results['path_loss_n']:.2f}")
    
    print(f"\n{Fore.CYAN}Recommended TX_POWER (average): {avg_tx_power:.1f} dBm{Style.RESET_ALL}\n")
    
    # Ask to update config files
    print(f"{Fore.YELLOW}Do you want to update the configuration files automatically? (y/n): {Style.RESET_ALL}", end='')
    update_choice = input().lower()
    
    if update_choice == 'y':
        print()
        
        # Update positioning engine
        update_positioning_engine_config(avg_tx_power)
        
        # Update gateway config
        avg_path_loss = None
        path_loss_values = [r['path_loss_n'] for r in calibration_results.values() if r['path_loss_n']]
        if path_loss_values:
            avg_path_loss = statistics.mean(path_loss_values)
        
        update_gateway_config(avg_tx_power, avg_path_loss)
        
        print()
        print_warning("⚠️  IMPORTANT: Restart the backend to apply changes!")
        print_info("Run: cd /home/rpi/warehouse_iot/backend && python run.py")
    else:
        print()
        print_info("Configuration files NOT updated. Manual update required:")
        print(f"\n{Fore.CYAN}1. Update backend/app/services/positioning_engine.py:{Style.RESET_ALL}")
        print(f"   Line 276: tx_power={avg_tx_power:.1f}")
        print(f"\n{Fore.CYAN}2. Update backend/app/gateway_config.py:{Style.RESET_ALL}")
        print(f"   TX_POWER: {avg_tx_power:.1f}")
        if avg_path_loss:
            print(f"   PATH_LOSS_N_LOS: {avg_path_loss:.2f}")
    
    print()
    print_success("Calibration complete! 🎉")


if __name__ == "__main__":
    try:
        main()
    except KeyboardInterrupt:
        print(f"\n\n{Fore.YELLOW}Calibration cancelled by user{Style.RESET_ALL}")
        sys.exit(0)
    except Exception as e:
        print_error(f"Unexpected error: {e}")
        import traceback
        traceback.print_exc()
        sys.exit(1)
