Resolv Agent v1.0.0
===================

REQUIREMENTS
- Windows 10/11 (64-bit)
- Node.js 18+ (download from https://nodejs.org)
- Internet or local network access to your Resolv server

INSTALLATION
1. Download and install Node.js from https://nodejs.org if not already installed
2. Right-click install.bat and select "Run as Administrator"
3. Enter your Resolv server URL (e.g. http://192.168.1.100:3001)
4. Enter the Agent Secret from the Resolv Admin > Agent Settings page
5. The agent installs to C:\ProgramData\Resolv\Agent and starts automatically

WHAT IT DOES
- Reports hardware info (CPU, RAM, disk, GPU) every 5 minutes
- Reports software inventory, network adapters, and logged-in users
- Stays connected to the Resolv server for real-time status
- Auto-starts when you log in to Windows

LOGS
  C:\ProgramData\Resolv\Agent\agent.log

UNINSTALL
  schtasks /delete /tn "Resolv Agent" /f
  rmdir /s /q "C:\ProgramData\Resolv\Agent"
