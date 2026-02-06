# Quick Connection Reference

## 🔌 Simple Wiring Guide

### 3-Wire Connection (Minimum Required)

```
Arduino Nano 33 IoT          ESP32-CAM
═══════════════════════════════════════════
    TX (Pin 1) ──────────────► U0R (RX/GPIO3)
       GND     ──────────────── GND
    5V (opt)   ──────────────── 5V

Note: U0R on ESP32-CAM = UART0 RX = GPIO 3
      U0T on ESP32-CAM = UART0 TX = GPIO 1 (don't connect)
```

## 📍 Pin Identification

### Arduino Nano 33 IoT Pins:
```
        USB
         ║
    ┌────╨────┐
    │ ●    ● │  D13/SCK
    │ ●    ● │  D12/MISO  
    │ ●    ● │  D11/MOSI
    │ ●    ● │  D10
    │ ●    ● │  D9
    │ ●    ● │  D8
    │ ●    ● │  D7
    │ ●┬───┼ │  D6
    │ ●│*  ● │  D5
    │ ●│   ● │  D4
    │ ●│   ● │  D3
    │ ●│   ● │  D2
 TX │ ●◄───┘ │  D1  ◄── Connect this to ESP32-CAM RX
 RX │ ●    ● │  D0
GND │ ●──┐ ● │  RST
    │ ●  │ ● │  GND
    │ ●  └─┼─●  ◄── Connect this to ESP32-CAM GND
    │ ●    ● │  VIN
 5V │ ●────┼─●  ◄── Optional: Connect to ESP32-CAM 5V
    └────────┘
```

### ESP32-CAM Pins (Top View):
```
    ┌─────────────┐
    │   Camera    │
    │   Connector │
    └─────────────┘
    
    Front View:
    ┌─────────────────────────┐
    │  ●  ●  ●  ●  ●  ●  ●  ● │
    │  │  │  │  │  │  │  │  │ │
    │ 5V GND IO0 GND
    │        ▲───────────── Programming: Connect to GND
    │  ●  ●  ●  ●  ●  ●  ●  ● │
    │        │        │      │
    │       U0T     U0R      │
    │     (GPIO1) (GPIO3)    │
    │      (TX)     (RX)     │
    │                ▲───────── Arduino TX connects HERE
    │                          
    │  [SD Card Slot]          
    │                          
    │  [ESP32-CAM Module]      
    └─────────────────────────┘
    
    Back Row (Power):
    5V  ◄── Connect Arduino 5V here (optional)
    GND ◄── Connect Arduino GND here (REQUIRED)
    
    Front Row (Serial):
    U0R (GPIO3/RX) ◄── Connect Arduino TX here (REQUIRED)
    U0T (GPIO1/TX) ◄── Leave disconnected
    
    Note: U0R = UART0 RX = GPIO3
          U0T = UART0 TX = GPIO1
```

## 🔋 Power Connection Options

### Option 1: Separate Power (Development/Testing)
```
USB Power Bank     5V Power Supply
     │                  │
     ↓                  ↓
Arduino Nano      ESP32-CAM
     │                  │
     └──── GND ─────────┘  ◄── Common ground
     │
     └──── TX ──────► RX on ESP32
```

### Option 2: Shared Power (Development)
```
5V 2A Power Supply
       │
       ├──────────► Arduino 5V
       ├──────────► ESP32 5V
       └──────────► GND (both)

Arduino TX ────────► ESP32 RX
```

### Option 3: Battery-Powered (Forklift Deployment)

**⚠️ CRITICAL: ESP32-CAM needs 5V, NOT 3.3V!**

**A. Separate Batteries (2 wires between devices):**
```
Battery1 (5V)          Battery2 (5V)
    │                      │
    ├─→ Arduino VIN        ├─→ ESP32-CAM 5V
    │                      │
    └─→ Arduino GND ←──────┘─→ ESP32-CAM GND
            ↑                       [GND wire required!]
            │
         TX ─────────────────→ U0R (RX)
```
**Wiring:** TX→U0R (data) + GND→GND (common ground required)

**B. Single Shared Battery (RECOMMENDED - 1 wire only):**
```
    5V Battery
        │
    ┌───┴───┐
    ↓       ↓
Arduino  ESP32-CAM
  VIN      5V
   │        │
  GND ←───→ GND  [Ground shared via battery - no extra wire]
   │
   TX ────→ U0R (RX)  [Only 1 data wire between devices]
```

**Battery Requirements:**
- Voltage: **5V** (ESP32-CAM will brownout with 3.3V)
- Current: ≥1.5A output
- Capacity: ≥2000mAh for 4-6 hours
- Type: USB power bank, 4×AA+regulator, or LiPo+5V boost

## 📡 Complete System Diagram

```
┌─────────────────────────────────────────────────────────┐
│                    Forklift System                       │
│                                                          │
│  ┌────────────────────┐         ┌─────────────────┐     │
│  │ Arduino Nano 33IoT │  TX→RX  │   ESP32-CAM     │     │
│  │                    │─────────│   (No Camera)   │     │
│  │  • BLE Beacon      │  Serial │                 │     │
│  │  • IMU Sensor      │  115200 │  • WiFi Gateway │     │
│  │  • 10Hz Sampling   │   baud  │  • HTTP Client  │     │
│  └────────────────────┘         └─────────────────┘     │
│           │                              │               │
│           │ BLE                          │ WiFi          │
│           │ RSSI                         │ HTTP POST     │
│           ↓                              ↓               │
└───────────────────────────────────────────────────────────┘
            │                              │
            │                              │
┌───────────┴──────────────────────────────┴──────────┐
│              Raspberry Pi Backend                    │
│                                                      │
│  BLE Gateways  ←─ RSSI Data  ─→  Position Tracking  │
│                                                      │
│  API Endpoint  ←─ Vibration  ─→  Database Storage   │
│                                                      │
│  WebSocket     ─→ Real-time Updates                 │
└──────────────────────────────────────────────────────┘
            │
            │ HTTP/WebSocket
            ↓
┌──────────────────────────────────────────────────────┐
│              Frontend Dashboard                       │
│                                                      │
│  • Path Tracking Page  (BLE positioning data)       │
│  • Forklift Monitor    (Camera + Vibration)         │
│  • Alerts Page         (Anomalies & events)         │
└──────────────────────────────────────────────────────┘
```

## ⚡ Power Requirements

| Component | Voltage | Current | Notes |
|-----------|---------|---------|-------|
| Arduino Nano 33 IoT | 5V | 50-80mA | BLE + IMU active |
| ESP32-CAM | 5V | 170-250mA | WiFi transmitting |
| **Total** | **5V** | **~250-330mA** | Use 5V/1A minimum |

## 🎯 Quick Start Steps

1. **Upload Code**
   - Arduino: `ble_beacon.ino`
   - ESP32-CAM: `vibration_gateway.ino` (update WiFi credentials!)

2. **Make 3 Connections**
   - Arduino TX → ESP32 RX
   - Arduino GND → ESP32 GND
   - (Optional) Arduino 5V → ESP32 5V

3. **Power Up**
   - Arduino: USB or 5V supply
   - ESP32: External 5V/1A supply

4. **Verify**
   - Check Serial output (115200 baud)
   - Look for JSON data every second
   - Backend should receive POST requests

## 🔍 Verification Commands

```bash
# Test backend API
curl http://10.136.57.165:5000/api/forklift/forklift-001/vibration/current

# Check database
sqlite3 warehouse.db "SELECT * FROM vibration_data ORDER BY timestamp DESC LIMIT 1;"

# Monitor backend logs
cd /home/rpi/warehouse_iot/backend
python run.py
```

## 📱 Testing with nRF Connect App

1. Install "nRF Connect" on Android/iOS
2. Scan for BLE devices
3. Look for "Forklift-001"
4. Should see RSSI signal strength
5. Connect to see vibration characteristics

---

**That's it!** Three wires, upload two sketches, and you're done. 🎉
