// ==============================================================================
// File: edge_firmware/android_gateway/MainActivity.kt
// Description: Industrial Dashboard Activity for Warehouse BLE Gateway Phone.
// Purpose: Displays real-time signal strength (RSSI HUD), rolling average meter,
//          packet hit rate, decoded beacon IMU acceleration, upstream latency,
//          and provides clean Material design controls and settings persistence.
// ==============================================================================

package com.warehouse.iot.gateway

import android.Manifest
import android.bluetooth.BluetoothAdapter
import android.bluetooth.BluetoothManager
import android.content.*
import android.content.pm.PackageManager
import android.content.res.ColorStateList
import android.os.Build
import android.os.Bundle
import android.util.Log
import android.widget.ProgressBar
import android.widget.TextView
import android.widget.Toast
import androidx.activity.result.contract.ActivityResultContracts
import androidx.appcompat.app.AppCompatActivity
import androidx.core.content.ContextCompat
import com.google.android.material.button.MaterialButton
import com.google.android.material.materialswitch.MaterialSwitch
import com.google.android.material.textfield.TextInputEditText

class MainActivity : AppCompatActivity() {

    private val TAG = "MainActivity"

    private lateinit var settingsManager: SettingsManager
    private var bluetoothAdapter: BluetoothAdapter? = null

    // UI View References
    private lateinit var tvHeaderSubtitle: TextView
    private lateinit var tvServiceStatusBadge: TextView
    private lateinit var tvSignalQualityBadge: TextView
    private lateinit var tvRssiBig: TextView
    private lateinit var tvSmoothedSub: TextView
    private lateinit var progressBarRssi: ProgressBar
    private lateinit var tvDetectionsCount: TextView
    private lateinit var tvScansCount: TextView
    private lateinit var tvHitRate: TextView

    private lateinit var tvBatteryBadge: TextView
    private lateinit var tvAx: TextView
    private lateinit var tvAy: TextView
    private lateinit var tvAz: TextView
    private lateinit var tvMagnitude: TextView

    private lateinit var etGatewayId: TextInputEditText
    private lateinit var etLaptopIp: TextInputEditText
    private lateinit var etPort: TextInputEditText
    private lateinit var etBeaconName: TextInputEditText
    private lateinit var switchTransmitMode: MaterialSwitch
    private lateinit var tvTransmitModeDescription: TextView
    private lateinit var tvUpstreamStatus: TextView
    private lateinit var btnToggleScan: MaterialButton

    private var isReceiverRegistered = false
    private var currentScansCount = 0
    private var currentDetectionsCount = 0

    private val permissionLauncher = registerForActivityResult(
        ActivityResultContracts.RequestMultiplePermissions()
    ) { permissions ->
        val allGranted = permissions.values.all { it }
        if (!allGranted) {
            Toast.makeText(this, "Bluetooth Scan and Location permissions are required.", Toast.LENGTH_LONG).show()
        }
    }

    private val telemetryReceiver = object : BroadcastReceiver() {
        override fun onReceive(context: Context?, intent: Intent?) {
            when (intent?.action) {
                GatewayScannerService.ACTION_RSSI_UPDATE -> {
                    val rawRssi = intent.getIntExtra("raw_rssi", -100)
                    val smoothedRssi = intent.getIntExtra("smoothed_rssi", -100)
                    val detections = intent.getIntExtra("detections_count", currentDetectionsCount)
                    val scans = intent.getIntExtra("scans_count", currentScansCount)
                    val httpStatus = intent.getIntExtra("http_status", -1)
                    val latencyMs = intent.getLongExtra("latency_ms", 0L)

                    val ax = intent.getDoubleExtra("ax", 0.0)
                    val ay = intent.getDoubleExtra("ay", 0.0)
                    val az = intent.getDoubleExtra("az", 1.0)
                    val magnitude = intent.getDoubleExtra("magnitude", 1.0)
                    val battery = intent.getIntExtra("battery", -1)

                    currentDetectionsCount = detections
                    currentScansCount = scans

                    runOnUiThread {
                        updateRssiHud(rawRssi, smoothedRssi)
                        updateCounters(detections, scans)
                        updateImuTelemetry(ax, ay, az, magnitude, battery)
                        updateUpstreamStatus(httpStatus, latencyMs)
                    }
                }

                GatewayScannerService.ACTION_SCAN_COUNT -> {
                    val scans = intent.getIntExtra("scans_count", currentScansCount)
                    val detections = intent.getIntExtra("detections_count", currentDetectionsCount)
                    currentScansCount = scans
                    currentDetectionsCount = detections

                    runOnUiThread {
                        updateCounters(detections, scans)
                    }
                }
            }
        }
    }

    override fun onCreate(savedInstanceState: Bundle?) {
        super.onCreate(savedInstanceState)
        setContentView(R.layout.activity_main)

        settingsManager = SettingsManager(this)
        val bluetoothManager = getSystemService(Context.BLUETOOTH_SERVICE) as BluetoothManager
        bluetoothAdapter = bluetoothManager.adapter

        initViews()
        loadSavedSettings()
        checkAndRequestPermissions()

        // Restore UI state if service was left running
        if (settingsManager.isScanning) {
            applyUiScanningState(true)
        }
    }

    private fun initViews() {
        tvHeaderSubtitle = findViewById(R.id.tvHeaderSubtitle)
        tvServiceStatusBadge = findViewById(R.id.tvServiceStatusBadge)
        tvSignalQualityBadge = findViewById(R.id.tvSignalQualityBadge)
        tvRssiBig = findViewById(R.id.tvRssiBig)
        tvSmoothedSub = findViewById(R.id.tvSmoothedSub)
        progressBarRssi = findViewById(R.id.progressBarRssi)
        tvDetectionsCount = findViewById(R.id.tvDetectionsCount)
        tvScansCount = findViewById(R.id.tvScansCount)
        tvHitRate = findViewById(R.id.tvHitRate)

        tvBatteryBadge = findViewById(R.id.tvBatteryBadge)
        tvAx = findViewById(R.id.tvAx)
        tvAy = findViewById(R.id.tvAy)
        tvAz = findViewById(R.id.tvAz)
        tvMagnitude = findViewById(R.id.tvMagnitude)

        etGatewayId = findViewById(R.id.etGatewayId)
        etLaptopIp = findViewById(R.id.etLaptopIp)
        etPort = findViewById(R.id.etPort)
        etBeaconName = findViewById(R.id.etBeaconName)
        switchTransmitMode = findViewById(R.id.switchTransmitMode)
        tvTransmitModeDescription = findViewById(R.id.tvTransmitModeDescription)
        tvUpstreamStatus = findViewById(R.id.tvUpstreamStatus)
        btnToggleScan = findViewById(R.id.btnToggleScan)

        switchTransmitMode.setOnCheckedChangeListener { _, isChecked ->
            if (isChecked) {
                settingsManager.transmitMode = "SMOOTHED"
                tvTransmitModeDescription.text = "Smoothed Moving Average (Window of 5)"
            } else {
                settingsManager.transmitMode = "RAW"
                tvTransmitModeDescription.text = "Live Raw RSSI (Lag-Free EKF)"
            }
        }

        btnToggleScan.setOnClickListener {
            if (settingsManager.isScanning) {
                stopScannerService()
            } else {
                startScannerService()
            }
        }
    }

    private fun loadSavedSettings() {
        etGatewayId.setText(settingsManager.gatewayId)
        etLaptopIp.setText(settingsManager.serverIp)
        etPort.setText(settingsManager.serverPort.toString())
        etBeaconName.setText(settingsManager.beaconName)

        val isSmoothed = settingsManager.transmitMode == "SMOOTHED"
        switchTransmitMode.isChecked = isSmoothed
        tvTransmitModeDescription.text = if (isSmoothed) "Smoothed Moving Average (Window of 5)" else "Live Raw RSSI (Lag-Free EKF)"

        tvHeaderSubtitle.text = "Anchor: ${settingsManager.gatewayId} • Target: ${settingsManager.beaconName}"
    }

    private fun saveCurrentSettings() {
        settingsManager.gatewayId = etGatewayId.text.toString().trim()
        settingsManager.serverIp = etLaptopIp.text.toString().trim()
        settingsManager.serverPort = etPort.text.toString().toIntOrNull() ?: 5000
        settingsManager.beaconName = etBeaconName.text.toString().trim()
        tvHeaderSubtitle.text = "Anchor: ${settingsManager.gatewayId} • Target: ${settingsManager.beaconName}"
    }

    private fun startScannerService() {
        if (bluetoothAdapter == null || !bluetoothAdapter!!.isEnabled) {
            Toast.makeText(this, "Please enable Bluetooth first.", Toast.LENGTH_SHORT).show()
            return
        }

        val ip = etLaptopIp.text.toString().trim()
        if (ip.isEmpty()) {
            Toast.makeText(this, "Please specify the Laptop IP address.", Toast.LENGTH_SHORT).show()
            return
        }

        saveCurrentSettings()

        val serviceIntent = Intent(this, GatewayScannerService::class.java)
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.O) {
            startForegroundService(serviceIntent)
        } else {
            startService(serviceIntent)
        }

        settingsManager.isScanning = true
        applyUiScanningState(true)
        registerBroadcastReceiver()

        Toast.makeText(this, "Gateway scanner started for anchor ${settingsManager.gatewayId}", Toast.LENGTH_SHORT).show()
    }

    private fun stopScannerService() {
        val serviceIntent = Intent(this, GatewayScannerService::class.java)
        stopService(serviceIntent)

        settingsManager.isScanning = false
        applyUiScanningState(false)
        unregisterBroadcastReceiver()

        Toast.makeText(this, "Gateway scanner stopped.", Toast.LENGTH_SHORT).show()
    }

    private fun applyUiScanningState(scanning: Boolean) {
        if (scanning) {
            btnToggleScan.text = "STOP GATEWAY SCANNER"
            btnToggleScan.setIconResource(android.R.drawable.ic_media_pause)
            btnToggleScan.backgroundTintList = ContextCompat.getColorStateList(this, R.color.status_red)

            tvServiceStatusBadge.text = "SCANNING"
            tvServiceStatusBadge.setTextColor(ContextCompat.getColor(this, R.color.status_green))

            etGatewayId.isEnabled = false
            etLaptopIp.isEnabled = false
            etPort.isEnabled = false
            etBeaconName.isEnabled = false
        } else {
            btnToggleScan.text = "START GATEWAY SCANNER"
            btnToggleScan.setIconResource(android.R.drawable.ic_media_play)
            btnToggleScan.backgroundTintList = ContextCompat.getColorStateList(this, R.color.primary_blue)

            tvServiceStatusBadge.text = "IDLE"
            tvServiceStatusBadge.setTextColor(ContextCompat.getColor(this, R.color.text_gray_muted))

            etGatewayId.isEnabled = true
            etLaptopIp.isEnabled = true
            etPort.isEnabled = true
            etBeaconName.isEnabled = true

            tvRssiBig.text = "-- dBm"
            tvSmoothedSub.text = " (Avg: -- dBm)"
            tvSignalQualityBadge.text = "STANDBY"
            progressBarRssi.progress = 0
            tvUpstreamStatus.text = "Upstream: Standby (Not Connected)"
        }
    }

    private fun updateRssiHud(rawRssi: Int, smoothedRssi: Int) {
        tvRssiBig.text = "$rawRssi dBm"
        tvSmoothedSub.text = " (Avg: $smoothedRssi dBm)"

        // Map RSSI (-100 dBm to -40 dBm) to 0 - 100%
        val progress = (((rawRssi + 100).toDouble() / 60.0) * 100).toInt().coerceIn(0, 100)
        progressBarRssi.progress = progress

        // Color coding by signal strength
        when {
            rawRssi >= -65 -> {
                tvSignalQualityBadge.text = "EXCELLENT (LOS)"
                tvSignalQualityBadge.setTextColor(ContextCompat.getColor(this, R.color.status_green))
                progressBarRssi.progressTintList = ColorStateList.valueOf(ContextCompat.getColor(this, R.color.status_green))
            }
            rawRssi >= -80 -> {
                tvSignalQualityBadge.text = "GOOD SIGNAL"
                tvSignalQualityBadge.setTextColor(ContextCompat.getColor(this, R.color.status_amber))
                progressBarRssi.progressTintList = ColorStateList.valueOf(ContextCompat.getColor(this, R.color.status_amber))
            }
            else -> {
                tvSignalQualityBadge.text = "WEAK / EDGE"
                tvSignalQualityBadge.setTextColor(ContextCompat.getColor(this, R.color.status_red))
                progressBarRssi.progressTintList = ColorStateList.valueOf(ContextCompat.getColor(this, R.color.status_red))
            }
        }
    }

    private fun updateCounters(detections: Int, scans: Int) {
        tvDetectionsCount.text = detections.toString()
        tvScansCount.text = scans.toString()

        val hitRate = if (scans > 0) (detections.toDouble() / scans * 100.0).coerceAtMost(100.0) else 0.0
        tvHitRate.text = String.format("%.1f%%", hitRate)
    }

    private fun updateImuTelemetry(ax: Double, ay: Double, az: Double, magnitude: Double, battery: Int) {
        tvAx.text = String.format("%+.2fg", ax)
        tvAy.text = String.format("%+.2fg", ay)
        tvAz.text = String.format("%+.2fg", az)
        tvMagnitude.text = String.format("%.2fg", magnitude)

        if (battery >= 0) {
            tvBatteryBadge.text = "BAT: $battery%"
        }
    }

    private fun updateUpstreamStatus(httpStatus: Int, latencyMs: Long) {
        if (httpStatus == 200) {
            tvUpstreamStatus.text = "Upstream: HTTP 200 OK (${latencyMs}ms)"
            tvUpstreamStatus.setTextColor(ContextCompat.getColor(this, R.color.status_green))
        } else if (httpStatus > 0) {
            tvUpstreamStatus.text = "Upstream: HTTP $httpStatus Warning (${latencyMs}ms)"
            tvUpstreamStatus.setTextColor(ContextCompat.getColor(this, R.color.status_amber))
        } else {
            tvUpstreamStatus.text = "Upstream: Offline / Connection Failed"
            tvUpstreamStatus.setTextColor(ContextCompat.getColor(this, R.color.status_red))
        }
    }

    private fun registerBroadcastReceiver() {
        if (!isReceiverRegistered) {
            val filter = IntentFilter().apply {
                addAction(GatewayScannerService.ACTION_RSSI_UPDATE)
                addAction(GatewayScannerService.ACTION_SCAN_COUNT)
            }
            if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.TIRAMISU) {
                registerReceiver(telemetryReceiver, filter, Context.RECEIVER_EXPORTED)
            } else {
                registerReceiver(telemetryReceiver, filter)
            }
            isReceiverRegistered = true
        }
    }

    private fun unregisterBroadcastReceiver() {
        if (isReceiverRegistered) {
            try {
                unregisterReceiver(telemetryReceiver)
            } catch (e: Exception) {
                Log.w(TAG, "Receiver not registered: ${e.message}")
            }
            isReceiverRegistered = false
        }
    }

    private fun checkAndRequestPermissions() {
        val permissions = mutableListOf<String>()
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.S) {
            permissions.add(Manifest.permission.BLUETOOTH_SCAN)
            permissions.add(Manifest.permission.BLUETOOTH_CONNECT)
        } else {
            permissions.add(Manifest.permission.BLUETOOTH)
            permissions.add(Manifest.permission.BLUETOOTH_ADMIN)
        }
        permissions.add(Manifest.permission.ACCESS_FINE_LOCATION)

        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.TIRAMISU) {
            permissions.add(Manifest.permission.POST_NOTIFICATIONS)
        }

        val missing = permissions.filter {
            ContextCompat.checkSelfPermission(this, it) != PackageManager.PERMISSION_GRANTED
        }

        if (missing.isNotEmpty()) {
            permissionLauncher.launch(missing.toTypedArray())
        }
    }

    override fun onResume() {
        super.onResume()
        if (settingsManager.isScanning) {
            registerBroadcastReceiver()
        }
    }

    override fun onPause() {
        super.onPause()
        unregisterBroadcastReceiver()
    }
}
