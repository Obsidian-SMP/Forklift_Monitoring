// ==============================================================================
// File: edge_firmware/android_gateway/SettingsManager.kt
// Description: Persistent Key-Value Configuration Manager for Android Gateway.
// Purpose: Stores Gateway Anchor ID, Laptop IP, Port, Beacon Name, Transmission
//          Mode (Raw vs Smoothed), and Rolling Window Size across app restarts.
// ==============================================================================

package com.warehouse.iot.gateway

import android.content.Context
import android.content.SharedPreferences

class SettingsManager(context: Context) {
    private val prefs: SharedPreferences =
        context.getSharedPreferences("WarehouseGatewaySettings", Context.MODE_PRIVATE)

    var gatewayId: String
        get() = prefs.getString("gateway_id", "phone_1") ?: "phone_1"
        set(value) = prefs.edit().putString("gateway_id", value).apply()

    var serverIp: String
        get() = prefs.getString("server_ip", "192.168.1.50") ?: "192.168.1.50"
        set(value) = prefs.edit().putString("server_ip", value).apply()

    var serverPort: Int
        get() = prefs.getInt("server_port", 5000)
        set(value) = prefs.edit().putInt("server_port", value).apply()

    var beaconName: String
        get() = prefs.getString("beacon_name", "forklift_1") ?: "forklift_1"
        set(value) = prefs.edit().putString("beacon_name", value).apply()

    var forkliftId: String
        get() = prefs.getString("forklift_id", "forklift_1") ?: "forklift_1"
        set(value) = prefs.edit().putString("forklift_id", value).apply()

    var transmitMode: String
        get() = prefs.getString("transmit_mode", "RAW") ?: "RAW" // "RAW" or "SMOOTHED"
        set(value) = prefs.edit().putString("transmit_mode", value).apply()

    var smoothWindowSize: Int
        get() = prefs.getInt("smooth_window_size", 5)
        set(value) = prefs.edit().putInt("smooth_window_size", value).apply()

    var isScanning: Boolean
        get() = prefs.getBoolean("is_scanning", false)
        set(value) = prefs.edit().putBoolean("is_scanning", value).apply()
}
