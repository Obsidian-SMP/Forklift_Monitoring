"""
Notification Service
Handles sending notifications via SMS, WhatsApp, and Email
"""

import os
import smtplib
from email.mime.text import MIMEText
from email.mime.multipart import MIMEMultipart
from typing import List, Dict, Optional
from datetime import datetime
import logging

logger = logging.getLogger(__name__)

class NotificationService:
    """Service for sending notifications via multiple channels"""
    
    def __init__(self):
        """Initialize notification service with credentials from environment"""
        # Twilio Configuration
        self.twilio_account_sid = os.getenv('TWILIO_ACCOUNT_SID')
        self.twilio_auth_token = os.getenv('TWILIO_AUTH_TOKEN')
        self.twilio_whatsapp_from = os.getenv('TWILIO_WHATSAPP_FROM', 'whatsapp:+14155238886')
        self.twilio_phone_from = os.getenv('TWILIO_PHONE_FROM', '+14155238886')
        
        # SMTP Configuration
        self.smtp_host = os.getenv('SMTP_HOST', 'smtp.gmail.com')
        self.smtp_port = int(os.getenv('SMTP_PORT', '587'))
        self.smtp_email = os.getenv('SMTP_EMAIL')
        self.smtp_password = os.getenv('SMTP_PASSWORD')
        self.smtp_from_name = os.getenv('SMTP_FROM_NAME', 'Warehouse IoT System')
        
        # Initialize Twilio client
        self.twilio_client = None
        if self.twilio_account_sid and self.twilio_auth_token:
            try:
                from twilio.rest import Client
                self.twilio_client = Client(self.twilio_account_sid, self.twilio_auth_token)
                logger.info("✅ Twilio client initialized successfully")
            except ImportError:
                logger.error("❌ Twilio package not installed. Run: pip install twilio")
            except Exception as e:
                logger.error(f"❌ Failed to initialize Twilio client: {e}")
        else:
            logger.warning("⚠️ Twilio credentials not found in environment")
    
    def send_sms(self, to: str, message: str) -> Dict[str, any]:
        """
        Send SMS notification via Twilio
        
        Args:
            to: Phone number in E.164 format (e.g., +919916570764)
            message: Message content
            
        Returns:
            Dict with status and message_sid or error
        """
        if not self.twilio_client:
            error = "Twilio client not initialized"
            logger.error(f"❌ SMS: {error}")
            return {'success': False, 'error': error}
        
        try:
            # Ensure phone number has + prefix
            if not to.startswith('+'):
                to = '+' + to.lstrip('+')
            
            sms = self.twilio_client.messages.create(
                from_=self.twilio_phone_from,
                body=message,
                to=to
            )
            
            logger.info(f"✅ SMS sent successfully to {to}: {sms.sid}")
            return {
                'success': True,
                'message_sid': sms.sid,
                'to': to,
                'timestamp': datetime.utcnow().isoformat()
            }
            
        except Exception as e:
            error = str(e)
            logger.error(f"❌ Failed to send SMS to {to}: {error}")
            return {'success': False, 'error': error, 'to': to}
    
    def send_whatsapp(self, to: str, message: str) -> Dict[str, any]:
        """
        Send WhatsApp message via Twilio
        
        Args:
            to: Phone number with whatsapp: prefix (e.g., whatsapp:+919916570764)
            message: Message content
            
        Returns:
            Dict with status and message_sid or error
        """
        if not self.twilio_client:
            error = "Twilio client not initialized"
            logger.error(f"❌ WhatsApp: {error}")
            return {'success': False, 'error': error}
        
        try:
            # Ensure WhatsApp format
            if not to.startswith('whatsapp:'):
                # If it's a plain number, add whatsapp: prefix
                if not to.startswith('+'):
                    to = '+' + to.lstrip('+')
                to = f'whatsapp:{to}'
            
            whatsapp = self.twilio_client.messages.create(
                from_=self.twilio_whatsapp_from,
                body=message,
                to=to
            )
            
            logger.info(f"✅ WhatsApp sent successfully to {to}: {whatsapp.sid}")
            return {
                'success': True,
                'message_sid': whatsapp.sid,
                'to': to,
                'timestamp': datetime.utcnow().isoformat()
            }
            
        except Exception as e:
            error = str(e)
            logger.error(f"❌ Failed to send WhatsApp to {to}: {error}")
            return {'success': False, 'error': error, 'to': to}
    
    def send_email(self, to: str, subject: str, body: str, html: bool = False) -> Dict[str, any]:
        """
        Send email notification via SMTP
        
        Args:
            to: Email address
            subject: Email subject
            body: Email body content
            html: Whether body is HTML (default: False for plain text)
            
        Returns:
            Dict with status and details or error
        """
        if not self.smtp_email or not self.smtp_password:
            error = "SMTP credentials not configured"
            logger.error(f"❌ Email: {error}")
            return {'success': False, 'error': error}
        
        try:
            # Create message
            msg = MIMEMultipart('alternative')
            msg['From'] = f"{self.smtp_from_name} <{self.smtp_email}>"
            msg['To'] = to
            msg['Subject'] = subject
            msg['Date'] = datetime.utcnow().strftime('%a, %d %b %Y %H:%M:%S +0000')
            
            # Attach body
            mime_type = 'html' if html else 'plain'
            msg.attach(MIMEText(body, mime_type))
            
            # Connect to SMTP server and send
            with smtplib.SMTP(self.smtp_host, self.smtp_port) as server:
                server.starttls()
                server.login(self.smtp_email, self.smtp_password)
                server.send_message(msg)
            
            logger.info(f"✅ Email sent successfully to {to}")
            return {
                'success': True,
                'to': to,
                'subject': subject,
                'timestamp': datetime.utcnow().isoformat()
            }
            
        except Exception as e:
            error = str(e)
            logger.error(f"❌ Failed to send email to {to}: {error}")
            return {'success': False, 'error': error, 'to': to}
    
    def send_alert_notification(
        self, 
        alert_data: Dict,
        settings: Dict,
        force_channels: Optional[List[str]] = None
    ) -> Dict[str, any]:
        """
        Send alert notification through configured channels
        
        Args:
            alert_data: Alert information (type, severity, message, etc.)
            settings: Notification settings (channels, recipients)
            force_channels: Override channels for testing (optional)
            
        Returns:
            Dict with results for each channel
        """
        results = {}
        alert_type = alert_data.get('type', 'unknown')
        severity = alert_data.get('severity', 'info')
        message = alert_data.get('message', 'Alert notification')
        
        # Determine which channels to use
        enabled_channels = settings.get('notification_channels', {})
        channels_to_use = force_channels if force_channels else []
        
        if not force_channels:
            # Determine channels based on severity
            if severity in ['info', 'low']:
                # Low priority: Email only
                if enabled_channels.get('email', False):
                    channels_to_use.append('email')
            elif severity == 'medium':
                # Medium priority: WhatsApp + Email
                if enabled_channels.get('whatsapp', False):
                    channels_to_use.append('whatsapp')
                if enabled_channels.get('email', False):
                    channels_to_use.append('email')
            else:  # high, critical
                # High priority: All channels (SMS + WhatsApp + Email)
                if enabled_channels.get('sms', False):
                    channels_to_use.append('sms')
                if enabled_channels.get('whatsapp', False):
                    channels_to_use.append('whatsapp')
                if enabled_channels.get('email', False):
                    channels_to_use.append('email')
        
        # Get recipients
        recipients = settings.get('notification_recipients', {})
        
        # Format alert message
        timestamp = alert_data.get('timestamp', datetime.utcnow().isoformat())
        
        # Plain text version for SMS/WhatsApp
        formatted_message = f"🚨 Warehouse Alert\n\n" \
                          f"Type: {alert_type}\n" \
                          f"Severity: {severity.upper()}\n" \
                          f"Message: {message}\n" \
                          f"Time: {timestamp}\n"
        
        # HTML email version with better formatting
        severity_colors = {
            'info': '#3B82F6',      # Blue
            'low': '#10B981',       # Green
            'medium': '#F59E0B',    # Amber
            'high': '#EF4444',      # Red
            'critical': '#DC2626'   # Dark Red
        }
        severity_color = severity_colors.get(severity.lower(), '#6B7280')
        
        html_email = f"""
        <!DOCTYPE html>
        <html>
        <head>
            <meta charset="UTF-8">
            <meta name="viewport" content="width=device-width, initial-scale=1.0">
        </head>
        <body style="margin: 0; padding: 0; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, 'Helvetica Neue', Arial, sans-serif; background-color: #f3f4f6;">
            <table width="100%" cellpadding="0" cellspacing="0" style="background-color: #f3f4f6; padding: 20px;">
                <tr>
                    <td align="center">
                        <table width="600" cellpadding="0" cellspacing="0" style="background-color: #ffffff; border-radius: 8px; box-shadow: 0 2px 8px rgba(0,0,0,0.1); overflow: hidden;">
                            <!-- Header -->
                            <tr>
                                <td style="background-color: {severity_color}; padding: 24px; text-align: center;">
                                    <h1 style="margin: 0; color: #ffffff; font-size: 24px; font-weight: 600;">
                                        🚨 Warehouse Alert
                                    </h1>
                                </td>
                            </tr>
                            
                            <!-- Content -->
                            <tr>
                                <td style="padding: 32px;">
                                    <table width="100%" cellpadding="0" cellspacing="0">
                                        <tr>
                                            <td style="padding-bottom: 16px;">
                                                <div style="background-color: {severity_color}; color: #ffffff; display: inline-block; padding: 6px 12px; border-radius: 4px; font-size: 12px; font-weight: 600; text-transform: uppercase;">
                                                    {severity.upper()}
                                                </div>
                                            </td>
                                        </tr>
                                        
                                        <tr>
                                            <td style="padding-bottom: 20px; border-bottom: 1px solid #e5e7eb;">
                                                <p style="margin: 0; font-size: 18px; color: #111827; font-weight: 500;">
                                                    {message}
                                                </p>
                                            </td>
                                        </tr>
                                        
                                        <tr>
                                            <td style="padding-top: 20px;">
                                                <table width="100%" cellpadding="0" cellspacing="0">
                                                    <tr>
                                                        <td style="padding: 12px 0; border-bottom: 1px solid #f3f4f6;">
                                                            <span style="color: #6B7280; font-size: 14px; font-weight: 500;">Alert Type:</span>
                                                            <span style="color: #111827; font-size: 14px; float: right;">{alert_type}</span>
                                                        </td>
                                                    </tr>
                                                    <tr>
                                                        <td style="padding: 12px 0;">
                                                            <span style="color: #6B7280; font-size: 14px; font-weight: 500;">Timestamp:</span>
                                                            <span style="color: #111827; font-size: 14px; float: right;">{timestamp}</span>
                                                        </td>
                                                    </tr>
                                                </table>
                                            </td>
                                        </tr>
                                    </table>
                                </td>
                            </tr>
                            
                            <!-- Footer -->
                            <tr>
                                <td style="background-color: #f9fafb; padding: 20px; text-align: center; border-top: 1px solid #e5e7eb;">
                                    <p style="margin: 0; color: #6B7280; font-size: 12px;">
                                        Warehouse IoT Monitoring System
                                    </p>
                                </td>
                            </tr>
                        </table>
                    </td>
                </tr>
            </table>
        </body>
        </html>
        """
        
        # Send through each channel
        if 'email' in channels_to_use:
            email_list = recipients.get('email', [])
            if not email_list:
                logger.warning("⚠️ No email recipients configured in settings")
                
            for email in email_list[:3]:  # Limit to 3 recipients
                subject = f"[{severity.upper()}] Warehouse Alert: {alert_type}"
                result = self.send_email(email, subject, html_email, html=True)
                results[f'email_{email}'] = result
        
        if 'whatsapp' in channels_to_use:
            phone_list = recipients.get('sms', [])  # Use SMS list for WhatsApp
            if not phone_list:
                logger.warning("⚠️ No WhatsApp/SMS recipients configured in settings")
                
            for phone in phone_list[:2]:  # Limit to 2 recipients
                result = self.send_whatsapp(phone, formatted_message)
                results[f'whatsapp_{phone}'] = result
        
        if 'sms' in channels_to_use:
            phone_list = recipients.get('sms', [])
            if not phone_list:
                logger.warning("⚠️ No SMS recipients configured in settings")
                
            for phone in phone_list[:2]:  # Limit to 2 recipients
                # For SMS, shorten the message
                sms_message = f"🚨 {severity.upper()}: {message[:100]}"
                result = self.send_sms(phone, sms_message)
                results[f'sms_{phone}'] = result
        
        # Summary
        success_count = sum(1 for r in results.values() if r.get('success', False))
        total_count = len(results)
        
        return {
            'alert_type': alert_type,
            'severity': severity,
            'channels_used': channels_to_use,
            'results': results,
            'success_count': success_count,
            'total_count': total_count,
            'all_success': success_count == total_count,
            'timestamp': datetime.utcnow().isoformat()
        }


# Global instance
notification_service = NotificationService()
