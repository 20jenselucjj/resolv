-- Software Package Library for remote deployment

CREATE TABLE IF NOT EXISTS software_packages (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  name VARCHAR(200) NOT NULL,
  version VARCHAR(100),
  description TEXT,
  publisher VARCHAR(200),
  category VARCHAR(100) NOT NULL DEFAULT 'general',
  -- Installation
  installer_url TEXT,
  install_command TEXT NOT NULL,
  uninstall_command TEXT,
  install_context VARCHAR(20) NOT NULL DEFAULT 'system' CHECK (install_context IN ('system', 'user')),
  -- Metadata
  supported_os VARCHAR(50) NOT NULL DEFAULT 'windows',
  architecture VARCHAR(20) DEFAULT 'x64' CHECK (architecture IN ('x64', 'x86', 'arm64', 'any')),
  file_size_bytes BIGINT,
  icon_url TEXT,
  homepage_url TEXT,
  -- Tracking
  is_active BOOLEAN NOT NULL DEFAULT true,
  deploy_count INTEGER NOT NULL DEFAULT 0,
  created_by UUID REFERENCES users(id) ON DELETE SET NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_software_packages_category ON software_packages (category);
CREATE INDEX IF NOT EXISTS idx_software_packages_active ON software_packages (is_active);

-- Software deployment history (tracks each deploy attempt)
CREATE TABLE IF NOT EXISTS software_deployments (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  package_id UUID NOT NULL REFERENCES software_packages(id) ON DELETE CASCADE,
  asset_id UUID NOT NULL REFERENCES assets(id) ON DELETE CASCADE,
  command_id UUID REFERENCES agent_commands(id) ON DELETE SET NULL,
  action VARCHAR(20) NOT NULL DEFAULT 'install' CHECK (action IN ('install', 'uninstall', 'upgrade')),
  status VARCHAR(20) NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'deployed', 'completed', 'failed', 'cancelled')),
  deployed_by UUID REFERENCES users(id) ON DELETE SET NULL,
  deployed_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  completed_at TIMESTAMPTZ,
  result TEXT,
  error_message TEXT
);

CREATE INDEX IF NOT EXISTS idx_software_deployments_asset ON software_deployments (asset_id);
CREATE INDEX IF NOT EXISTS idx_software_deployments_package ON software_deployments (package_id);

-- Seed common software packages
INSERT INTO software_packages (name, version, description, publisher, category, install_command, uninstall_command, supported_os, architecture) VALUES
('Google Chrome', 'latest', 'Fast, secure web browser', 'Google LLC', 'browsers', 'winget install --id Google.Chrome --accept-source-agreements --accept-package-agreements --silent', 'winget uninstall --id Google.Chrome --silent', 'windows', 'x64'),
('Mozilla Firefox', 'latest', 'Free web browser', 'Mozilla', 'browsers', 'winget install --id Mozilla.Firefox --accept-source-agreements --accept-package-agreements --silent', 'winget uninstall --id Mozilla.Firefox --silent', 'windows', 'x64'),
('Microsoft Edge', 'latest', 'Microsoft web browser', 'Microsoft', 'browsers', 'winget install --id Microsoft.Edge --accept-source-agreements --accept-package-agreements --silent', '', 'windows', 'x64'),
('7-Zip', 'latest', 'File archiver with high compression ratio', 'Igor Pavlov', 'utilities', 'winget install --id 7zip.7zip --accept-source-agreements --accept-package-agreements --silent', 'winget uninstall --id 7zip.7zip --silent', 'windows', 'x64'),
('Notepad++', 'latest', 'Source code editor', 'Don Ho', 'utilities', 'winget install --id Notepad++.Notepad++ --accept-source-agreements --accept-package-agreements --silent', 'winget uninstall --id Notepad++.Notepad++ --silent', 'windows', 'x64'),
('Visual Studio Code', 'latest', 'Code editor', 'Microsoft', 'development', 'winget install --id Microsoft.VisualStudioCode --accept-source-agreements --accept-package-agreements --silent', 'winget uninstall --id Microsoft.VisualStudioCode --silent', 'windows', 'x64'),
('Git', 'latest', 'Distributed version control system', 'The Git Project', 'development', 'winget install --id Git.Git --accept-source-agreements --accept-package-agreements --silent', 'winget uninstall --id Git.Git --silent', 'windows', 'x64'),
('Node.js LTS', 'latest', 'JavaScript runtime', 'Node.js Foundation', 'development', 'winget install --id OpenJS.NodeJS.LTS --accept-source-agreements --accept-package-agreements --silent', 'winget uninstall --id OpenJS.NodeJS.LTS --silent', 'windows', 'x64'),
('Python 3', 'latest', 'Programming language', 'Python Software Foundation', 'development', 'winget install --id Python.Python.3 --accept-source-agreements --accept-package-agreements --silent', 'winget uninstall --id Python.Python.3 --silent', 'windows', 'x64'),
('VLC Media Player', 'latest', 'Multimedia player', 'VideoLAN', 'media', 'winget install --id VideoLAN.VLC --accept-source-agreements --accept-package-agreements --silent', 'winget uninstall --id VideoLAN.VLC --silent', 'windows', 'x64'),
('Adobe Acrobat Reader', 'latest', 'PDF reader', 'Adobe', 'productivity', 'winget install --id Adobe.Acrobat.Reader.64-bit --accept-source-agreements --accept-package-agreements --silent', 'winget uninstall --id Adobe.Acrobat.Reader.64-bit --silent', 'windows', 'x64'),
('Microsoft Teams', 'latest', 'Team collaboration', 'Microsoft', 'productivity', 'winget install --id Microsoft.Teams --accept-source-agreements --accept-package-agreements --silent', 'winget uninstall --id Microsoft.Teams --silent', 'windows', 'x64'),
('Slack', 'latest', 'Business messaging', 'Slack Technologies', 'productivity', 'winget install --id SlackTechnologies.Slack --accept-source-agreements --accept-package-agreements --silent', 'winget uninstall --id SlackTechnologies.Slack --silent', 'windows', 'x64'),
('Zoom', 'latest', 'Video communications', 'Zoom', 'productivity', 'winget install --id Zoom.Zoom --accept-source-agreements --accept-package-agreements --silent', 'winget uninstall --id Zoom.Zoom --silent', 'windows', 'x64'),
('WinRAR', 'latest', 'File compression tool', 'win.rar GmbH', 'utilities', 'winget install --id RARLab.WinRAR --accept-source-agreements --accept-package-agreements --silent', 'winget uninstall --id RARLab.WinRAR --silent', 'windows', 'x64'),
('PuTTY', 'latest', 'SSH and telnet client', 'Simon Tatham', 'utilities', 'winget install --id PuTTY.PuTTY --accept-source-agreements --accept-package-agreements --silent', 'winget uninstall --id PuTTY.PuTTY --silent', 'windows', 'x64'),
('Sysinternals Suite', 'latest', 'Windows sysadmin tools', 'Microsoft', 'utilities', 'winget install --id Microsoft.SysinternalsSuite --accept-source-agreements --accept-package-agreements --silent', 'winget uninstall --id Microsoft.SysinternalsSuite --silent', 'windows', 'x64'),
('PowerToys', 'latest', 'Windows productivity utilities', 'Microsoft', 'utilities', 'winget install --id Microsoft.PowerToys --accept-source-agreements --accept-package-agreements --silent', 'winget uninstall --id Microsoft.PowerToys --silent', 'windows', 'x64'),
('Windows Terminal', 'latest', 'Modern terminal application', 'Microsoft', 'utilities', 'winget install --id Microsoft.WindowsTerminal --accept-source-agreements --accept-package-agreements --silent', 'winget uninstall --id Microsoft.WindowsTerminal --silent', 'windows', 'x64'),
('Greenshot', 'latest', 'Screenshot tool', 'Greenshot', 'utilities', 'winget install --id Greenshot.Greenshot --accept-source-agreements --accept-package-agreements --silent', 'winget uninstall --id Greenshot.Greenshot --silent', 'windows', 'x64')
ON CONFLICT DO NOTHING;
