#!/usr/bin/env python3
"""
Dual-Model Configuration Validator
Checks if both YOLO models are correctly configured and loadable
"""
import os
import sys

def check_model_file(model_path, model_name):
    """Check if model file exists and get info"""
    print(f"\n{'='*60}")
    print(f"Checking {model_name}")
    print('='*60)
    
    if not os.path.exists(model_path):
        print(f"❌ NOT FOUND: {model_path}")
        print(f"   Please place {model_name} in backend/yolo_models/")
        return False
    
    file_size = os.path.getsize(model_path) / (1024 * 1024)  # MB
    print(f"✅ FOUND: {model_path}")
    print(f"📦 Size: {file_size:.2f} MB")
    
    # Try to load model
    try:
        from ultralytics import YOLO
        print(f"🔄 Loading model...")
        model = YOLO(model_path)
        classes = list(model.names.values())
        print(f"✅ Loaded successfully!")
        print(f"📊 Classes: {len(classes)}")
        print(f"📝 Class names: {', '.join(classes[:10])}")
        if len(classes) > 10:
            print(f"   ... and {len(classes) - 10} more classes")
        return True
    except ImportError:
        print("⚠️  Ultralytics not installed - cannot validate model")
        print("   Install with: pip install ultralytics --break-system-packages")
        return None
    except Exception as e:
        print(f"❌ Failed to load: {e}")
        return False

def check_config():
    """Check configuration settings"""
    print(f"\n{'='*60}")
    print("Checking Configuration")
    print('='*60)
    
    try:
        sys.path.insert(0, os.path.join(os.path.dirname(__file__), 'backend'))
        from app.config import Config
        
        print(f"✅ Config loaded successfully")
        print(f"\nModel Settings:")
        print(f"  PRIMARY:   {Config.YOLO_MODEL_PRIMARY}")
        print(f"  SECONDARY: {Config.YOLO_MODEL_SECONDARY}")
        print(f"\nDetection Settings:")
        print(f"  Confidence: {Config.AI_CONFIDENCE}")
        print(f"  Input Size: {Config.AI_INPUT_SIZE}x{Config.AI_INPUT_SIZE}")
        print(f"  IOU Threshold: {Config.AI_IOU_THRESHOLD}")
        print(f"  Process Every: {Config.AI_PROCESS_EVERY_N} image(s)")
        
        if hasattr(Config, 'PRIMARY_MODEL_CLASSES'):
            pmc = Config.PRIMARY_MODEL_CLASSES
            print(f"\nPrimary Model Classes: {pmc if pmc else 'ALL (no filter)'}")
        
        if hasattr(Config, 'SECONDARY_MODEL_CLASSES'):
            smc = Config.SECONDARY_MODEL_CLASSES
            print(f"Secondary Model Classes: {len(smc)} filtered classes")
            
        return True
    except Exception as e:
        print(f"❌ Failed to load config: {e}")
        return False

def main():
    print("="*60)
    print("🔍 Dual-Model Setup Validator")
    print("="*60)
    
    # Get base directory
    base_dir = os.path.dirname(os.path.abspath(__file__))
    yolo_dir = os.path.join(base_dir, 'backend', 'yolo_models')
    
    # Check if yolo_models directory exists
    if not os.path.exists(yolo_dir):
        print(f"\n❌ Directory not found: {yolo_dir}")
        print(f"   Creating directory...")
        os.makedirs(yolo_dir, exist_ok=True)
        print(f"✅ Directory created")
    
    # Check both models
    primary_path = os.path.join(yolo_dir, 'yolo26n.pt')
    secondary_path = os.path.join(yolo_dir, 'yolov8n.pt')
    
    primary_ok = check_model_file(primary_path, 'yolo26n.pt (PRIMARY - custom)')
    secondary_ok = check_model_file(secondary_path, 'yolov8n.pt (SECONDARY - COCO)')
    
    # Check config
    config_ok = check_config()
    
    # Summary
    print(f"\n{'='*60}")
    print("📋 Validation Summary")
    print('='*60)
    
    if primary_ok is False:
        print("❌ PRIMARY model (yolo26n.pt): NOT READY")
        print("   Action: Copy your custom model to backend/yolo_models/")
        print("   Command: ./deploy_model.sh /path/to/yolo26n.pt")
    elif primary_ok is None:
        print("⚠️  PRIMARY model (yolo26n.pt): FOUND (not validated)")
    else:
        print("✅ PRIMARY model (yolo26n.pt): READY")
    
    if secondary_ok is False:
        print("❌ SECONDARY model (yolov8n.pt): NOT READY")
        print("   Action: Will auto-download on first run")
    elif secondary_ok is None:
        print("⚠️  SECONDARY model (yolov8n.pt): FOUND (not validated)")
    else:
        print("✅ SECONDARY model (yolov8n.pt): READY")
    
    if config_ok:
        print("✅ Configuration: VALID")
    else:
        print("❌ Configuration: INVALID")
    
    print("\n" + "="*60)
    
    # Overall status
    if primary_ok and config_ok:
        print("🎉 System is READY for dual-model detection!")
        print("\nNext steps:")
        print("  1. Start the system: ./start_services.sh")
        print("  2. Check logs: tail -f logs/backend.log")
        print("  3. Test detection with ESP32-CAM")
        return 0
    elif primary_ok is None:
        print("⚠️  System MIGHT work (dependencies not verified)")
        print("\nRecommended:")
        print("  1. Install ultralytics: pip install ultralytics --break-system-packages")
        print("  2. Re-run this validator: python3 validate_dual_model.py")
        return 0
    else:
        print("❌ System NOT READY")
        print("\nRequired actions:")
        if not primary_ok:
            print("  1. Deploy your custom model: ./deploy_model.sh /path/to/yolo26n.pt")
        if not config_ok:
            print("  2. Fix configuration in backend/app/config.py")
        return 1

if __name__ == '__main__':
    sys.exit(main())
