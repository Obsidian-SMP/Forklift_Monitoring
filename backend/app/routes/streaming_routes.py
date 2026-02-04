"""
Server-Sent Events (SSE) Streaming Routes
Real-time position updates to frontend without WebSocket
"""

from flask import Blueprint, Response, stream_with_context, request
import json
import time
from datetime import datetime

from app.services.positioning_engine import get_positioning_engine


streaming_bp = Blueprint('streaming', __name__)


@streaming_bp.route('/positions', methods=['GET'])
def stream_positions():
    """
    SSE stream for real-time position updates
    Keeps connection open and pushes position updates as they become available
    
    Usage:
        const eventSource = new EventSource('/api/stream/positions');
        eventSource.onmessage = (event) => {
            const position = JSON.parse(event.data);
            console.log(position);
        };
    """
    def generate():
        # Send initial connection confirmation
        yield f"data: {json.dumps({'status': 'connected', 'timestamp': datetime.utcnow().isoformat()})}\n\n"
        
        engine = get_positioning_engine()
        last_position_timestamp = None
        
        while True:
            try:
                # Get latest position
                position = engine.get_latest_position()
                
                if position:
                    # Check if this is a new position (different timestamp)
                    current_timestamp = position.get('timestamp')
                    
                    if current_timestamp != last_position_timestamp:
                        # New position available, send it
                        yield f"data: {json.dumps(position)}\n\n"
                        last_position_timestamp = current_timestamp
                
                # Sleep briefly to avoid busy-waiting
                time.sleep(0.2)  # Check every 200ms
                
            except GeneratorExit:
                # Client disconnected
                break
            except Exception as e:
                # Send error to client
                error_msg = {'error': str(e), 'timestamp': datetime.utcnow().isoformat()}
                yield f"data: {json.dumps(error_msg)}\n\n"
                time.sleep(1.0)
    
    return Response(
        stream_with_context(generate()),
        mimetype='text/event-stream',
        headers={
            'Cache-Control': 'no-cache',
            'X-Accel-Buffering': 'no',  # Disable nginx buffering
            'Connection': 'keep-alive'
        }
    )


@streaming_bp.route('/positions/history', methods=['GET'])
def stream_position_history():
    """
    Stream entire position history at once (useful for initial load)
    
    Query params:
        limit: Number of recent positions to return (default: 200)
    """
    limit = int(request.args.get('limit', 200))
    
    engine = get_positioning_engine()
    history = engine.get_position_history(limit=limit)
    
    def generate():
        yield f"data: {json.dumps({'status': 'history_start', 'count': len(history)})}\n\n"
        
        for position in history:
            yield f"data: {json.dumps(position)}\n\n"
            time.sleep(0.01)  # Small delay to avoid overwhelming client
        
        yield f"data: {json.dumps({'status': 'history_complete'})}\n\n"
    
    return Response(
        stream_with_context(generate()),
        mimetype='text/event-stream',
        headers={
            'Cache-Control': 'no-cache',
            'X-Accel-Buffering': 'no'
        }
    )


@streaming_bp.route('/statistics', methods=['GET'])
def stream_statistics():
    """
    SSE stream for positioning engine statistics
    Updates every 2 seconds
    """
    def generate():
        engine = get_positioning_engine()
        
        while True:
            try:
                stats = engine.get_statistics()
                yield f"data: {json.dumps(stats)}\n\n"
                time.sleep(2.0)  # Update every 2 seconds
                
            except GeneratorExit:
                break
            except Exception as e:
                error_msg = {'error': str(e)}
                yield f"data: {json.dumps(error_msg)}\n\n"
                time.sleep(2.0)
    
    return Response(
        stream_with_context(generate()),
        mimetype='text/event-stream',
        headers={
            'Cache-Control': 'no-cache',
            'X-Accel-Buffering': 'no'
        }
    )
