#!/bin/bash
# Quick Model Deployment Script
# Deploys your custom YOLOv26n model to the warehouse IoT system

echo "=============================================="
echo "YOLOv26n Custom Model Deployment"
echo "=============================================="
echo ""

# Check if model file is provided
if [ -z "$1" ]; then
    echo "Usage: ./deploy_model.sh /path/to/yolo26n.pt"
    echo ""
    echo "Example:"
    echo "  ./deploy_model.sh ~/Downloads/yolo26n.pt"
    echo "  ./deploy_model.sh /media/usb/trained_models/yolo26n.pt"
    echo ""
    exit 1
fi

MODEL_PATH="$1"
TARGET_DIR="./backend/yolo_models"
TARGET_FILE="$TARGET_DIR/yolo26n.pt"

# Check if source model exists
if [ ! -f "$MODEL_PATH" ]; then
    echo "❌ ERROR: Model file not found: $MODEL_PATH"
    exit 1
fi

# Get model file size
MODEL_SIZE=$(du -h "$MODEL_PATH" | cut -f1)
echo "📦 Source model: $MODEL_PATH ($MODEL_SIZE)"

# Create target directory if it doesn't exist
mkdir -p "$TARGET_DIR"

# Backup existing model if present
if [ -f "$TARGET_FILE" ]; then
    BACKUP_FILE="$TARGET_DIR/yolo26n.pt.backup.$(date +%Y%m%d_%H%M%S)"
    echo "💾 Backing up existing model to: $BACKUP_FILE"
    mv "$TARGET_FILE" "$BACKUP_FILE"
fi

# Copy new model
echo "📥 Copying model to: $TARGET_FILE"
cp "$MODEL_PATH" "$TARGET_FILE"

# Verify copy
if [ -f "$TARGET_FILE" ]; then
    TARGET_SIZE=$(du -h "$TARGET_FILE" | cut -f1)
    echo "✅ Model deployed successfully! ($TARGET_SIZE)"
    echo ""
    echo "📋 Model Information:"
    ls -lh "$TARGET_FILE"
    echo ""
    
    # Try to get model info using Python
    if command -v python3 &> /dev/null; then
        echo "🔍 Verifying model with ultralytics..."
        python3 << EOF
try:
    from ultralytics import YOLO
    model = YOLO('$TARGET_FILE')
    print(f"✅ Model loaded successfully!")
    print(f"📊 Classes: {len(model.names)}")
    print(f"📝 Class names: {', '.join(list(model.names.values()))}")
except Exception as e:
    print(f"⚠️  Could not load model: {e}")
    print("   (This is okay - the backend will try to load it)")
EOF
    fi
    
    echo ""
    echo "=============================================="
    echo "✅ Deployment Complete!"
    echo "=============================================="
    echo ""
    echo "Next steps:"
    echo "1. Review configuration in backend/app/config.py"
    echo "2. Start the system: ./start_services.sh"
    echo "3. Check logs: tail -f logs/backend.log"
    echo ""
    echo "The system will use:"
    echo "  PRIMARY:   yolo26n.pt (custom boxes)"
    echo "  SECONDARY: yolov8n.pt (general objects)"
    echo ""
else
    echo "❌ ERROR: Failed to copy model!"
    exit 1
fi
