import os
import smtplib
from email.mime.text import MIMEText
from email.mime.multipart import MIMEMultipart

FROM = os.environ["EMAIL_FROM"]
PASSWORD = os.environ["EMAIL_PASSWORD"]
TO = os.environ["EMAIL_TO"]
SMTP_SERVER = os.environ["EMAIL_SMTP_SERVER"]
SMTP_PORT = int(os.environ["EMAIL_SMTP_PORT"])

msg = MIMEMultipart()
msg["From"] = FROM
msg["To"] = TO
msg["Subject"] = "[Test] GitHub Actions 邮件测试成功！"

body = f"""✅ 邮件发送成功！
- 发件人: {FROM}
- 收件人: {TO}
- 仓库: {os.environ.get('GITHUB_REPOSITORY', 'N/A')}
"""
msg.attach(MIMEText(body, "plain", "utf-8"))

if SMTP_PORT == 465:
    server = smtplib.SMTP_SSL(SMTP_SERVER, SMTP_PORT)
else:
    server = smtplib.SMTP(SMTP_SERVER, SMTP_PORT)
    server.starttls()

server.login(FROM, PASSWORD)
server.sendmail(FROM, TO, msg.as_string())
server.quit()

print("📧 邮件已发送")
