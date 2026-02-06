# Dual-Model AI Detection Setup Guide

## Overview
Your warehouse IoT system now supports **dual-model detection** for comprehensive object recognition:
- **PRIMARY Model**: YOLOv26n (your custom-trained model for box detection)
- **SECONDARY Model**: YOLOv8n (COCO dataset - general objects like person, laptop, scissors, etc.)

## Quick Start

### 1. Place Your Custom Model
Copy your trained `yolo26n.pt` model to the correct location:

```bash
# Copy your custom model to the yolo_models directory
cp /path/to/your/yolo26n.pt /home/rpi/warehouse_iot/backend/yolo_models/

# Verify it's there
ls -lh /home/rpi/warehouse_iot/backend/yolo_models/
```

### 2. Start the System
The system will automatically load both models:

```bash
cd /home/rpi/warehouse_iot
./start_services.sh
```

### 3. Verify Model Loading
Check the startup logs:

```
[AI] Loading PRIMARY model: yolo26n.pt (custom box detection)...
[AI] ✓ yolo26n.pt loaded with X classes: box, package, pallet, ...
[AI] Loading SECONDARY model: yolov8n.pt (general objects)...
[AI] ✓ yolov8n.pt loaded with 80 COCO classes
[AI] ✓ Dual-model detection ready (optimized for Raspberry Pi)
```

## Configuration Details

### Model Paths
- **PRIMARY**: `backend/yolo_models/yolo26n.pt`
- **SECONDARY**: `backend/yolo_models/yolov8n.pt` (auto-downloaded if missing)

### Class Filtering
Edit `backend/app/config.py` to control which objects are detected:

```python
# Primary Model: Custom YOLOv26n
PRIMARY_MODEL_CLASSES = []  # Empty = detect ALL custom classes

# Secondary Model: YOLOv8n COCO dataset
SECONDARY_MODEL_CLASSES = [
    67,  # cell phone
    63,  # laptop
    39,  # bottle
    73,  # book
    62,  # keyboard
    64,  # mouse
    76,  # scissors
    24,  # backpack
    28,  # suitcase
    0,   # person
]
```

### Detection Parameters
Both models use optimized settings for Raspberry Pi:
- **Confidence**: 0.65 (65%)
- **Input Size**: 416x416 pixels
- **IOU Threshold**: 0.45 (Non-Maximum Suppression)
- **Device**: CPU (Raspberry Pi)
- **Precision**: FP32 (full precision)

## How It Works

### 1. Dual Detection
When an image arrives:
1. PRIMARY model (YOLOv26n) runs first → detects boxes, packages, pallets
2. SECONDARY model (YOLOv8n) runs second → detects person, scissors, laptop, etc.
3. Results are merged using Non-Maximum Suppression (NMS) to remove duplicates

### 2. Detection Merging
If both models detect the same object (overlapping boxes), the system:
- Calculates IoU (Intersection over Union) between bounding boxes
- Keeps the detection with higher confidence
- Removes duplicates with IoU > 0.45

### 3. Results Format
Each detected object includes:
```json
{
    "name": "box",
    "confidence": 0.87,
    "bbox": [120, 80, 200, 150],
    "class_id": 0,
    "source": "yolo26n.pt"  // Shows which model detected it
}
```

## Customization Options

### Option 1: Use Only Custom Model (YOLOv26n)
If you only want to detect boxes and don't need general objects:

```python
# In backend/app/config.py
YOLO_MODEL_PRIMARY = 'yolo26n.pt'
YOLO_MODEL_SECONDARY = ''  # Disable secondary model
```

### Option 2: Adjust Class Filters
To detect different COCO objects, change the secondary class IDs:

```python
SECONDARY_MODEL_CLASSES = [
    0,   # person (workers)
    39,  # bottle (containers)
    # Add more COCO class IDs as needed
]
```

**COCO Class Reference**:
- 0: person, 24: backpack, 28: suitcase, 39: bottle
- 62: keyboard, 63: laptop, 64: mouse, 67: cell phone
- 73: book, 76: scissors

Full list: https://github.com/ultralytics/ultralytics/blob/main/ultralytics/cfg/datasets/coco.yaml

### Option 3: Change Detection Frequency
To reduce CPU load, process fewer images:

```python
# In backend/app/config.py
AI_PROCESS_EVERY_N = 3  # Process every 3rd image instead of every image
```

## Performance Optimization

### Expected Performance
- **Single Model (YOLOv8n)**: ~1.5-2.5s per image on Raspberry Pi 4B
- **Dual Model (YOLOv26n + YOLOv8n)**: ~3.0-4.5s per image
- **Custom Model Only**: Depends on your model's complexity

### Tips for Faster Detection
1. **Reduce input size**: `AI_INPUT_SIZE = 320` (faster but less accurate)
2. **Increase confidence**: `AI_CONFIDENCE = 0.75` (fewer false positives)
3. **Process fewer images**: `AI_PROCESS_EVERY_N = 2` or `3`
4. **Disable secondary model** if only boxes are needed

### Memory Management
The system automatically:
- Limits OpenMP threads to 2
- Runs garbage collection every 5 minutes
- Deletes old camera frames (keeps AI detections)
- Uses FP32 precision (FP16 not supported on Pi CPU)

## Troubleshooting

### Custom Model Not Loading
```
[AI] WARNING: PRIMARY model not found: /path/to/yolo26n.pt
[AI] Please ensure yolo26n.pt is placed in backend/yolo_models/
```

**Solution**: Copy your model to the correct directory:
```bash
cp /path/to/your/yolo26n.pt backend/yolo_models/
```

### Both Models Not Loading
```
[AI] ERROR: No models loaded! AI detection disabled.
```

**Check**:
1. Is `yolo26n.pt` in `backend/yolo_models/`?
2. Is internet available to download `yolov8n.pt`?
3. Are dependencies installed? `pip install ultralytics opencv-python-headless`

### Slow Detection
If detection takes >5 seconds per image:

**Solutions**:
1. Reduce input size: `AI_INPUT_SIZE = 320`
2. Process fewer images: `AI_PROCESS_EVERY_N = 3`
3. Use only one model (disable secondary)
4. Increase confidence threshold: `AI_CONFIDENCE = 0.75`

### Duplicate Detections
If you see the same object detected twice:

**Solutions**:
1. Lower IOU threshold: `AI_IOU_THRESHOLD = 0.35`
2. Check if both models detect the same class
3. Verify NMS is working (check logs for "merged X detections")

## Model Training Tips

### Custom YOLOv26n Training
If you need to retrain or fine-tune your model:

```python
from ultralytics import YOLO

# Load pre-trained base
model = YOLO('yolov8n.pt')

# Train on your dataset
model.train(
    data='boxes_dataset.yaml',  # Your dataset config
    epochs=100,
    imgsz=416,                  # Match inference size
    batch=8,                    # Adjust for your GPU
    name='yolo26n_boxes',
    device='0'                  # GPU device
)

# Export for Raspberry Pi
model.export(format='pt')      # Save as .pt file
```

### Dataset Structure
```
boxes_dataset/
├── train/
│   ├── images/
│   └── labels/
├── val/
│   ├── images/
│   └── labels/
└── boxes_dataset.yaml
```

### YAML Config Example
```yaml
path: /path/to/boxes_dataset
train: train/images
val: val/images

names:
  0: box
  1: package
  2: pallet
```

## API Response Format

### Detected Objects Endpoint
`GET /api/objects`

Response includes source information:
```json
{
  "objects": [
    {
      "id": 1,
      "object_id": "box-001",
      "name": "box",
      "confidence": 0.87,
      "detected_at": "2026-02-05T10:30:00",
      "forklift_id": "forklift_1",
      "source_model": "yolo26n.pt"
    },
    {
      "id": 2,
      "object_id": "person-001",
      "name": "person",
      "confidence": 0.92,
      "detected_at": "2026-02-05T10:30:05",
      "forklift_id": "forklift_1",
      "source_model": "yolov8n.pt"
    }
  ]
}
```

## System Requirements

### Hardware
- Raspberry Pi 4B (4GB+ RAM recommended)
- ESP32-CAM with OV3660 sensor
- microSD card (32GB+, Class 10)
- 5V 3A power supply

### Software
- Python 3.9+
- Ultralytics 8.4.10+
- OpenCV 4.13+
- PyTorch 2.0+ (compatible with ARM)
- Flask, SocketIO, Peewee

### Storage
- YOLOv26n model: ~6-15MB (depends on training)
- YOLOv8n model: 6.3MB
- Total: ~15-25MB for both models
- AI detected images: ~2-5MB per hour (auto-cleanup after 2 min)

## Next Steps

1. ✅ Place `yolo26n.pt` in `backend/yolo_models/`
2. ✅ Start the system: `./start_services.sh`
3. ✅ Check logs for successful model loading
4. ✅ Test detection with ESP32-CAM image upload
5. ✅ Monitor performance and adjust settings as needed
6. ✅ Fine-tune class filters and confidence thresholds

## Support

For issues or questions:
1. Check startup logs: `tail -f logs/backend.log`
2. Verify model files: `ls -lh backend/yolo_models/`
3. Test models individually by disabling one
4. Check CPU usage: `htop` (should be <80% during detection)

---

**System Status**: Dual-model detection ready! 🚀  
**Performance**: Optimized for Raspberry Pi 4B  
**Detection**: YOLOv26n (custom boxes) + YOLOv8n (general objects)
