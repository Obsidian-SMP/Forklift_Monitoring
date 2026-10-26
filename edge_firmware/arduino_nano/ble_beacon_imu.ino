// ==============================================================================
// File: edge_firmware/arduino_nano/ble_beacon_imu.ino
// Description: Multi-Role BLE Beacon & LSM6DS3 IMU Vibration Sensor Firmware.
// Purpose: Solves the hardware dilemma ("can only do one thing at a time: beacon or
//          transmit vibration"). Encodes 3-axis acceleration and vector magnitude
//          directly into the BLE Manufacturer Advertising payload. Mobile phone
//          gateways capture RSSI and IMU in a single scan packet without GATT connections!
// Hardware: Arduino Nano 33 IoT (Cortex-M0+ SAMD21 + NINA-W102 BLE + LSM6DS3 IMU)
// ==============================================================================

#include <ArduinoBLE.h>
#include <Arduino_LSM6DS3.h>

// -----------------------------------------------------------------------------
// Beacon Identification Constants
// -----------------------------------------------------------------------------
#define FORKLIFT_ID          1          // Forklift ID #1
#define BEACON_LOCAL_NAME    "forklift_1"
#define COMPANY_ID_CUSTOM    0xFFFF     // Custom manufacturer identifier

// Transmission interval in milliseconds (100ms = 10 Hz telemetry update rate)
const unsigned long ADVERTISING_INTERVAL_MS = 100;
unsigned long lastAdvertiseTime = 0;

// Structure of the manufacturer payload broadcasted in every advertising packet
struct __attribute__((packed)) BeaconPayload {
    uint16_t companyId;      // 0xFFFF (2 bytes)
    uint8_t  forkliftId;     // Forklift ID (1 byte)
    int16_t  accelX;         // X-axis accel * 100 (2 bytes, e.g., 5 = 0.05g)
    int16_t  accelY;         // Y-axis accel * 100 (2 bytes)
    int16_t  accelZ;         // Z-axis accel * 100 (2 bytes, e.g., 98 = 0.98g)
    uint16_t magnitude;      // Total vector magnitude |a| * 100 (2 bytes)
    uint8_t  batteryPercent; // Simulated or measured battery % (1 byte)
};

BeaconPayload payload;

void setup() {
    Serial.begin(115200);
    pinMode(LED_BUILTIN, OUTPUT);
    digitalWrite(LED_BUILTIN, HIGH);

    // 1. Initialize Onboard LSM6DS3 6-Axis IMU
    if (!IMU.begin()) {
        Serial.println("FATAL: Failed to initialize LSM6DS3 IMU!");
        while (1) {
            digitalWrite(LED_BUILTIN, !digitalRead(LED_BUILTIN));
            delay(150);
        }
    }
    Serial.println("LSM6DS3 IMU initialized successfully.");

    // 2. Initialize Bluetooth Low Energy Hardware
    if (!BLE.begin()) {
        Serial.println("FATAL: Failed to start BLE module!");
        while (1) {
            digitalWrite(LED_BUILTIN, !digitalRead(LED_BUILTIN));
            delay(500);
        }
    }
    Serial.println("Arduino BLE module initialized.");

    // 3. Configure BLE Radio Parameters
    BLE.setLocalName(BEACON_LOCAL_NAME);
    BLE.setDeviceName(BEACON_LOCAL_NAME);

    // Initial payload population
    payload.companyId = COMPANY_ID_CUSTOM;
    payload.forkliftId = FORKLIFT_ID;
    payload.accelX = 0;
    payload.accelY = 0;
    payload.accelZ = 100;
    payload.magnitude = 100;
    payload.batteryPercent = 95;

    // Set initial manufacturer data and start advertising
    BLE.setManufacturerData((const uint8_t*)&payload, sizeof(payload));
    BLE.advertise();

    Serial.println("BLE Beacon Advertising active. Ready for gateway scans.");
    digitalWrite(LED_BUILTIN, LOW);
}

void loop() {
    // Keep BLE stack events serviced
    BLE.poll();

    unsigned long currentMillis = millis();

    if (currentMillis - lastAdvertiseTime >= ADVERTISING_INTERVAL_MS) {
        lastAdvertiseTime = currentMillis;

        // 1. Read real-time 3-axis acceleration from LSM6DS3 (retain last reading if sample busy)
        static float lastX = 0.0f, lastY = 0.0f, lastZ = 1.0f;
        if (IMU.accelerationAvailable()) {
            IMU.readAcceleration(lastX, lastY, lastZ); // Values are in g's (1g = 9.81 m/s^2)
        }
        float x = lastX;
        float y = lastY;
        float z = lastZ;

        // Calculate total vector magnitude: |a| = sqrt(x^2 + y^2 + z^2)
        float mag = sqrt(x * x + y * y + z * z);

        // Flash LED if an impact spike is registered (> 4.0g)
        if (mag > 4.0f) {
            digitalWrite(LED_BUILTIN, HIGH);
        } else {
            digitalWrite(LED_BUILTIN, LOW);
        }

        // 2. Encode telemetry into packed advertising buffer (Scale factor: 100)
        payload.companyId = COMPANY_ID_CUSTOM;
        payload.forkliftId = FORKLIFT_ID;
        payload.accelX = (int16_t)(x * 100.0f);
        payload.accelY = (int16_t)(y * 100.0f);
        payload.accelZ = (int16_t)(z * 100.0f);
        payload.magnitude = (uint16_t)(mag * 100.0f);
        payload.batteryPercent = 95; // Can be wired to analog battery divider

        // 3. Update BLE manufacturer data in the air:
        // In ArduinoBLE, stopAdvertise() + setManufacturerData() + advertise()
        // is required to refresh advertising packets on the NINA-W102 controller.
        BLE.stopAdvertise();
        BLE.setManufacturerData((const uint8_t*)&payload, sizeof(payload));
        BLE.advertise();

        #if 0 // Debug output (enable if testing over USB serial)
        Serial.print("Ax: "); Serial.print(x);
        Serial.print(" Ay: "); Serial.print(y);
        Serial.print(" Az: "); Serial.print(z);
        Serial.print(" |a|: "); Serial.println(mag);
        #endif
    }
}

