# Inventory Management Update - Colored Box Tracking

## Overview
Updated the Inventory Management system to track colored boxes (red, blue, black) with comprehensive statistics including time-based analytics.

## Changes Made

### 1. Backend Changes

#### A. Database Model Updates (`backend/app/models/inventory.py`)
- **Added `object_type` field** to `DetectedObject` model to store box color (black_box, blue_box, red_box)
- Updated `to_dict()` method to include `object_type` in API responses

#### B. Database Migration (`backend/migrate_add_object_type.py`)
- **NEW FILE**: Migration script to add `object_type` field to existing databases
- Run this to update your database: `python backend/migrate_add_object_type.py`

#### C. API Updates (`backend/app/routes/inventory_routes.py`)

**Updated `/api/inventory/warehouse-stats` endpoint:**
- Now returns color-specific detection statistics
- Returns warehouse stock levels by color
- New response structure:
  ```json
  {
    "warehouse_events": {
      "entries": 0,
      "exits": 0,
      "net_objects": 0
    },
    "detection_statistics": {
      "total_detected": 0,
      "red_boxes_detected": 0,
      "blue_boxes_detected": 0,
      "black_boxes_detected": 0
    },
    "warehouse_statistics": {
      "red_boxes_in_warehouse": 0,
      "blue_boxes_in_warehouse": 0,
      "black_boxes_in_warehouse": 0,
      "total_in_warehouse": 0
    },
    "inventory": {
      "total_items": 0,
      "mismatches": 0
    }
  }
  ```

**New `/api/inventory/general-statistics?period=day|month|year` endpoint:**
- Returns time-based box movement statistics
- Supports three time periods: day, month, year
- Shows entering/exiting boxes by color
- Calculates percentages, averages, and net changes
- Response structure:
  ```json
  {
    "period": "day",
    "period_label": "per day",
    "entering": {
      "red_boxes": 0,
      "blue_boxes": 0,
      "black_boxes": 0,
      "total": 0
    },
    "exiting": {
      "red_boxes": 0,
      "blue_boxes": 0,
      "black_boxes": 0,
      "total": 0
    },
    "statistics": {
      "total_movement": 0,
      "entering_percentage": 0,
      "exiting_percentage": 0,
      "avg_entering": 0,
      "avg_exiting": 0,
      "net_change": 0
    }
  }
  ```

**Updated object detection endpoints:**
- `/api/inventory/test-detect` now assigns random box colors for testing
- `/api/inventory/detected-objects` POST now accepts `object_type` field
- Automatically generates colored test images based on box type

### 2. Frontend Changes (`frontend/src/pages/InventoryManagement.tsx`)

#### A. Updated Top Summary Cards
- **Boxes Entered** (green) - replacing "Objects In"
- **Boxes Exited** (red) - replacing "Objects Out"
- **Stock in Warehouse** (blue) - replacing "Net Objects"

#### B. New Statistics Tab Structure

**1. Detection Statistics Section:**
- Total detected objects count
- Red boxes detected (red background)
- Blue boxes detected (blue background)
- Black boxes detected (dark background)

**2. Warehouse Statistics Section:**
- Total boxes in warehouse
- Current stock by color:
  - Red boxes in warehouse
  - Blue boxes in warehouse
  - Black boxes in warehouse

**3. General Statistics Section:**
- **Time Period Toggle**: Switch between Per Day / Per Month / Per Year
- **Boxes Entering Warehouse**:
  - By color (red, blue, black)
  - Total entering
- **Boxes Exiting Warehouse**:
  - By color (red, blue, black)
  - Total exiting
- **Movement Analytics**:
  - Total movement
  - Entering percentage
  - Exiting percentage
  - Average entering
  - Average exiting
  - Net change (positive = more entering, negative = more exiting)

## Deployment Steps

### 1. Run Database Migration
```bash
cd /home/rpi/warehouse_iot
python backend/migrate_add_object_type.py
```

### 2. Restart Backend
```bash
# If using systemd service
sudo systemctl restart warehouse-backend

# Or manually
cd backend
python run.py
```

### 3. Restart Frontend (if needed)
```bash
cd frontend
npm run dev
# or
npm run build
```

## Testing Guide

### 1. Test Object Detection
1. Navigate to Inventory Management page
2. Go to "Detected Objects" tab
3. Click "Manual Detect" or let auto-detection run
4. Check that detected objects now show colored box images (red/blue/black)

### 2. Test Detection Statistics
1. Go to "Statistics" tab
2. Verify the **Detection Statistics** section shows:
   - Total Detected Objects
   - Red Boxes Detected
   - Blue Boxes Detected
   - Black Boxes Detected

### 3. Test Warehouse Statistics
1. In the **Warehouse Statistics** section, verify:
   - Total Boxes in Warehouse
   - Red/Blue/Black boxes counts are shown
   - Numbers match the actual detected objects with "detected" or "placed" status

### 4. Test General Statistics
1. In the **General Statistics** section:
   - Click "Per Day" button - should show last 24 hours data
   - Click "Per Month" button - should show last 30 days data
   - Click "Per Year" button - should show last 365 days data
2. Verify entering/exiting sections show color-specific counts
3. Check analytics metrics are calculated correctly

### 5. Test with Real Detections
```bash
# Generate some test detections
curl -X POST http://10.136.57.165:5000/api/inventory/test-detect \
  -H "Content-Type: application/json" \
  -d '{
    "forklift_id": "forklift-001",
    "object_type": "red_box",
    "position": {"x": 100, "y": 200, "z": 10}
  }'

# Try different colors
curl -X POST http://10.136.57.165:5000/api/inventory/test-detect \
  -H "Content-Type: application/json" \
  -d '{
    "forklift_id": "forklift-001",
    "object_type": "blue_box",
    "position": {"x": 150, "y": 250, "z": 10}
  }'
```

## API Endpoints Summary

| Endpoint | Method | Purpose |
|----------|--------|---------|
| `/api/inventory/warehouse-stats` | GET | Get overall statistics including color-based detection and warehouse stats |
| `/api/inventory/general-statistics?period=day` | GET | Get time-based box movement statistics |
| `/api/inventory/detected-objects` | GET | List all detected objects with their colors |
| `/api/inventory/detected-objects` | POST | Create new detected object (include `object_type` field) |
| `/api/inventory/test-detect` | POST | Test detection endpoint (now with colored boxes) |

## Data Flow

1. **Object Detection**:
   - Camera/AI detects object → Classifies as red_box/blue_box/black_box
   - Saves to `DetectedObject` with `object_type` field
   - Status starts as "detected"

2. **Statistics Calculation**:
   - **Detection Stats**: Count all objects by type (all time)
   - **Warehouse Stats**: Count objects with status "detected" or "placed" by type (current stock)
   - **General Stats**: Count objects within time period, group by entering/exiting statuses

3. **Frontend Display**:
   - Fetches stats every 5 seconds
   - Updates all sections automatically
   - Time period changes trigger immediate re-fetch of general statistics

## Color Coding

- **Red Boxes**: `red_box` - Red highlights in UI
- **Blue Boxes**: `blue_box` - Blue highlights in UI
- **Black Boxes**: `black_box` - Dark gray/black highlights in UI

## Notes

- Existing objects in database will have `object_type = NULL` until re-detected
- The system automatically assigns random colors when using test-detect without specifying type
- Real YOLO detection model should pass detected class (black_box/blue_box/red_box) to the API
- Statistics auto-refresh every 5 seconds
- General statistics calculations consider status for entering (detected, placed) vs exiting (dispatched, picked_up)
