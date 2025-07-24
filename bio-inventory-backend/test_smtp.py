#!/usr/bin/env python
"""
Simple SMTP test script to verify Gmail configuration
"""
import smtplib
from email.mime.text import MIMEText
from email.mime.multipart import MIMEMultipart

def test_gmail_connection():
    """Test Gmail SMTP connection"""
    smtp_server = "smtp.gmail.com"
    port = 587
    sender_email = "hayerlabaws@gmail.com"
    password = "luijchjhzaiadurl"  # Gmail App Password
    receiver_email = "qiyao.lin@mail.mcgill.ca"
    
    print(f"Testing SMTP connection to {smtp_server}:{port}")
    print(f"From: {sender_email}")
    print(f"To: {receiver_email}")
    
    try:
        # Create message
        message = MIMEMultipart("alternative")
        message["Subject"] = "SMTP Test from Quartzy"
        message["From"] = sender_email
        message["To"] = receiver_email
        
        # Create the HTML content
        html = """
        <html>
          <body>
            <h2>SMTP Test Successful!</h2>
            <p>This is a test email from Quartzy Bio-Inventory system.</p>
            <p>Gmail SMTP configuration is working correctly.</p>
          </body>
        </html>
        """
        
        # Turn these into plain/html MIMEText objects
        part = MIMEText(html, "html")
        message.attach(part)
        
        # Create SMTP session
        server = smtplib.SMTP(smtp_server, port)
        server.starttls()  # Enable security
        print("TLS connection established")
        
        # Login
        server.login(sender_email, password)
        print("Login successful")
        
        # Send email
        text = message.as_string()
        server.sendmail(sender_email, receiver_email, text)
        server.quit()
        
        print("✅ Email sent successfully!")
        print("Check your inbox for the test email.")
        
    except Exception as e:
        print(f"❌ Error: {e}")
        print("\nTroubleshooting tips:")
        print("1. Make sure 2-Factor Authentication is enabled on your Gmail account")
        print("2. Generate an App Password at: https://myaccount.google.com/apppasswords")
        print("3. Use the App Password instead of your regular Gmail password")
        print("4. Make sure 'Less secure app access' is NOT needed (deprecated)")

if __name__ == "__main__":
    test_gmail_connection()