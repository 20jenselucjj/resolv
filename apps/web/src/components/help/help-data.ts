// ─── Resolv Documentation Content ────────────────────────────────────────
// Hierarchical documentation data covering all platform features.
// Each section has an id, title, icon, and array of articles.
// Articles support markdown-like content, related links, and tags.

// ─── Role-based access control ───────────────────────────────────────────
export type DocRole = 'admin' | 'manager' | 'agent' | 'user' | 'readonly';

/** Role hierarchy: lower index = higher privilege */
export const ROLE_HIERARCHY: Record<DocRole, number> = {
  admin: 0,
  manager: 1,
  agent: 2,
  user: 3,
  readonly: 4,
};

/** Check if a user's role has access (user can access content at or above their level) */
export function canAccess(userRole: string | undefined, minRole?: DocRole): boolean {
  if (!minRole) return true; // no restriction
  if (!userRole) return false;
  const userLevel = ROLE_HIERARCHY[userRole as DocRole];
  const minLevel = ROLE_HIERARCHY[minRole];
  if (userLevel === undefined) return false;
  return userLevel <= minLevel;
}

export interface DocArticle {
  id: string;
  title: string;
  description: string;
  content: string; // Rich text with HTML-like markup
  /** Minimum role required to view this article (inherits from section if not set) */
  minRole?: DocRole;
  relatedLinks?: { title: string; href: string }[];
  tags?: string[];
  appLink?: { title: string; href: string };
}

export interface DocSection {
  id: string;
  title: string;
  icon: string;
  description: string;
  /** Minimum role required to view this section */
  minRole?: DocRole;
  articles: DocArticle[];
}

export const docSections: DocSection[] = [
  // ═══════════════════════════════════════════════════════════════════════
  // GETTING STARTED
  // ═══════════════════════════════════════════════════════════════════════
  {
    id: 'getting-started',
    title: 'Getting Started',
    icon: 'Rocket',
    description: 'New to Resolv? Start here to learn the basics.',
    articles: [
      {
        id: 'what-is-resolv',
        title: 'What is Resolv?',
        description: 'Platform overview and core concepts.',
        content: `
          <h3>Platform Overview</h3>
          <p>Resolv is a comprehensive IT Service Management (ITSM) platform that helps organizations manage their IT operations efficiently. Built with modern web technologies, it provides a complete suite of tools for ticket management, asset tracking, change management, and more.</p>

          <h3>Core Capabilities</h3>
          <ul>
            <li><strong>Ticket Management</strong> — Full lifecycle management for incidents, service requests, and support tickets with SLA tracking, comments, attachments, and bulk operations.</li>
            <li><strong>ITSM Modules</strong> — Complete Change Management, Problem Management, and Incident Management workflows with approval gates and post-implementation reviews.</li>
            <li><strong>Asset Management</strong> — Automated agent-based inventory discovery, hardware/software tracking, license compliance, and CMDB integration.</li>
            <li><strong>Knowledge Base</strong> — Centralized article management with categories, attachments, ratings, and AI-powered RAG integration.</li>
            <li><strong>Service Catalog</strong> — Curated service offerings with custom request forms, approval workflows, and fulfillment automation.</li>
            <li><strong>AI Assistant</strong> — Dual-mode AI assistant (Agent + Portal) with function calling, RAG context, and configurable behavior.</li>
            <li><strong>Reports & Analytics</strong> — Rich dashboards, custom reports, SLA tracking, agent performance metrics, and scheduled exports.</li>
          </ul>

          <h3>Architecture</h3>
          <p>Resolv follows a modern client-server architecture:</p>
          <ul>
            <li><strong>Frontend:</strong> Next.js 16 (App Router), React 19, Tailwind CSS 4, Zustand 5 for state management</li>
            <li><strong>Backend:</strong> Fastify 5 API server with TypeScript, PostgreSQL database</li>
            <li><strong>Real-time:</strong> Socket.IO for live updates, presence tracking, and typing indicators</li>
            <li><strong>Agent:</strong> Windows service for automated asset discovery and remote management</li>
          </ul>

          <h3>User Roles</h3>
          <p>Resolv supports five roles with graduated permissions:</p>
          <table>
            <tr><th>Role</th><th>Description</th></tr>
            <tr><td><strong>Admin</strong></td><td>Full platform access — all features, all settings, all data</td></tr>
            <tr><td><strong>Manager</strong></td><td>Mid-level management — user management, reports, SLA, notifications</td></tr>
            <tr><td><strong>Agent</strong></td><td>Frontline support — tickets, assets, ITSM modules, knowledge base</td></tr>
            <tr><td><strong>User</strong></td><td>End-user — own tickets, self-service portal, knowledge base browsing</td></tr>
            <tr><td><strong>Readonly</strong></td><td>View-only access — audit log, tickets, reports</td></tr>
          </table>
        `,
        tags: ['overview', 'intro', 'basics'],
        appLink: { title: 'Go to Dashboard', href: '/dashboard' },
      },
      {
        id: 'quick-start',
        title: 'Quick Start Guide',
        description: 'Get up and running in 10 minutes.',
        content: `
          <h3>1. Log In</h3>
          <p>Navigate to your Resolv instance URL and log in with your credentials. If your organization has SSO enabled, you can use your corporate account.</p>
          <p><strong>URL:</strong> <code>https://your-instance.resolv.com</code></p>

          <h3>2. Explore the Dashboard</h3>
          <p>After logging in, you'll land on the dashboard. The sidebar on the left provides navigation to all modules. Use <kbd>C</kbd> to quickly create a new ticket, or <kbd>⌘K</kbd> (<kbd>Ctrl+K</kbd>) to open the command palette for quick navigation.</p>

          <h3>3. Create Your First Ticket</h3>
          <p>Click <strong>"New Ticket"</strong> in the sidebar or press <kbd>C</kbd>. Fill in the title, description, select a category, and choose the priority. Submit to create the ticket and notify the support team.</p>

          <h3>4. Explore the Self-Service Portal</h3>
          <p>If you're an end-user, the Self-Service Portal (<strong>My Workspace → Self Service</strong>) gives you AI-powered support, service catalog browsing, and quick access to your tickets.</p>

          <h3>5. Customize Your Profile</h3>
          <p>Click the <strong>Settings</strong> gear icon (bottom of sidebar) to update your profile, notification preferences, password, and default views.</p>

          <h3>6. Use the AI Assistant</h3>
          <p>Click the <strong>"Ask AI"</strong> button in the sidebar or use <kbd>⌘J</kbd> (<kbd>Ctrl+J</kbd>) to open the AI assistant. You can ask questions about your tickets, search the knowledge base, or get help creating tickets.</p>
        `,
        tags: ['quickstart', 'onboarding', 'first-steps'],
      },
      {
        id: 'keyboard-shortcuts',
        title: 'Keyboard Shortcuts',
        description: 'Learn the keyboard shortcuts to navigate faster.',
        content: `
          <h3>Global Shortcuts</h3>
          <table>
            <tr><th>Shortcut</th><th>Action</th></tr>
            <tr><td><kbd>C</kbd></td><td>Open New Ticket panel (when not in an input field)</td></tr>
            <tr><td><kbd>⌘K</kbd> / <kbd>Ctrl+K</kbd></td><td>Open Command Palette (global search and navigation)</td></tr>
            <tr><td><kbd>⌘J</kbd> / <kbd>Ctrl+J</kbd></td><td>Toggle AI Assistant panel</td></tr>
            <tr><td><kbd>Esc</kbd></td><td>Close panels, modals, or dismiss notifications</td></tr>
          </table>

          <h3>Tips</h3>
          <ul>
            <li>The Command Palette (<kbd>⌘K</kbd>) searches across tickets, assets, knowledge base articles, and users simultaneously.</li>
            <li>You can also navigate to any page by typing its name in the Command Palette (e.g., "Settings", "Admin", "Tickets").</li>
            <li>Use <kbd>Tab</kbd> and <kbd>Shift+Tab</kbd> to navigate between form fields.</li>
          </ul>
        `,
        tags: ['shortcuts', 'keyboard', 'navigation'],
      },
    ],
  },

  // ═══════════════════════════════════════════════════════════════════════
  // TICKET MANAGEMENT
  // ═══════════════════════════════════════════════════════════════════════
  {
    id: 'tickets',
    title: 'Ticket Management',
    icon: 'Ticket',
    description: 'Manage incidents, service requests, and support tickets.',
    articles: [
      { id: 'tickets-overview',
        title: 'Tickets Overview',
        description: 'Understanding the ticket system.',
        content: `
          <h3>What is a Ticket?</h3>
          <p>A ticket is the core unit of work in Resolv. It represents an issue, request, or task that needs to be tracked and resolved. Tickets follow a lifecycle from creation through resolution and closure.</p>

          <h3>Ticket Types</h3>
          <ul>
            <li><strong>Incident</strong> — An unplanned interruption or reduction in service quality (e.g., "Email server down", "Can't connect to VPN").</li>
            <li><strong>Service Request</strong> — A pre-defined request for standard service (e.g., "New employee account setup", "Software installation").</li>
            <li><strong>Problem</strong> — The underlying cause of one or more incidents (linked to Problem Management).</li>
            <li><strong>Change</strong> — A planned modification to IT infrastructure (linked to Change Management).</li>
          </ul>

          <h3>Ticket Statuses</h3>
          <table>
            <tr><th>Status</th><th>Description</th></tr>
            <tr><td><strong>Open</strong></td><td>Ticket has been created and is awaiting assignment</td></tr>
            <tr><td><strong>In Progress</strong></td><td>Ticket is actively being worked on</td></tr>
            <tr><td><strong>Waiting</strong></td><td>Waiting on customer response or third-party action</td></tr>
            <tr><td><strong>Resolved</strong></td><td>Solution has been applied, pending confirmation</td></tr>
            <tr><td><strong>Closed</strong></td><td>Ticket is complete and confirmed</td></tr>
          </table>

          <h3>Priorities</h3>
          <p>Priorities range from <span style="color:#22c55e">Low</span> → <span style="color:#eab308">Medium</span> → <span style="color:#f97316">High</span> → <span style="color:#ef4444">Critical</span>. Priority determines SLA targets and escalation paths.</p>
        `,
        tags: ['tickets', 'overview', 'basics'],
        appLink: { title: 'View Tickets', href: '/dashboard/tickets' },
      },
      {
        id: 'tickets-create',
        title: 'Creating Tickets',
        description: 'Create tickets from various entry points.',
        content: `
          <h3>Ways to Create a Ticket</h3>

          <h4>1. Quick Create (New Ticket Panel)</h4>
          <p>Press <kbd>C</kbd> or click <strong>"New Ticket"</strong> in the sidebar. This opens a slide-up panel where you can:</p>
          <ul>
            <li>Select a template (pre-fills fields for common scenarios)</li>
            <li>Enter title and description (rich text with full WYSIWYG editor)</li>
            <li>Choose type (Incident, Service Request, Problem, Change)</li>
            <li>Select category, priority, and assignee</li>
            <li>Add tags and attachments (drag & drop supported)</li>
            <li>Set due date and custom field values</li>
          </ul>
          <p>Drafts are auto-saved locally so you won't lose work if you navigate away.</p>

          <h4>2. From the Tickets Page</h4>
          <p>Navigate to <strong>Tickets</strong> and click the <strong>"New Ticket"</strong> button in the header.</p>

          <h4>3. From the Self-Service Portal</h4>
          <p>End-users can create tickets via the <strong>Self-Service Portal</strong>. The AI assistant in the portal can also create tickets on your behalf through natural language requests like "I need a new laptop" or "My email isn't working".</p>

          <h4>4. Via Email</h4>
          <p>If email integration is configured, sending an email to the configured inbox automatically creates a ticket. The subject becomes the title, and the body becomes the description.</p>

          <h4>5. Via Service Catalog</h4>
          <p>Browsing the Service Catalog and submitting a request form creates a ticket (or approval request, depending on the item configuration).</p>

          <h3>Ticket Templates</h3>
          <p>Templates help standardize ticket creation for common scenarios. Admins can create templates that pre-fill fields like category, priority, custom fields, and description. When creating a ticket, select a template to get started quickly.</p>
        `,
        tags: ['create', 'new-ticket', 'templates'],
        appLink: { title: 'Create Ticket', href: '/dashboard/tickets?new=1' },
      },
      {
        id: 'tickets-manage',
        title: 'Managing Tickets',
        description: 'View, filter, sort, and manage your ticket queue.',
        content: `
          <h3>The Ticket List</h3>
          <p>The ticket list page (<strong>Tickets</strong> in the sidebar) shows all tickets with powerful filtering and sorting options.</p>

          <h3>Views & Filters</h3>
          <ul>
            <li><strong>Views Bar</strong> — Quickly switch between All Tickets, My Tickets, Unassigned, and saved custom views</li>
            <li><strong>Status Filter</strong> — Filter by Open, In Progress, Waiting, Resolved, or Closed</li>
            <li><strong>Priority Filter</strong> — Filter by Low, Medium, High, or Critical</li>
            <li><strong>Type Filter</strong> — Filter by incident, service request, problem, or change</li>
            <li><strong>Search</strong> — Full-text search across ticket title, description, and comments</li>
            <li><strong>Advanced Filters</strong> — Filter by category, assignee, tags, date range, and more</li>
            <li><strong>Saved Filters</strong> — Save your filter configuration as a custom view for quick access</li>
          </ul>

          <h3>Sorting</h3>
          <p>Click column headers to sort by number, priority, status, created date, due date, or assignee. Sort direction toggles between ascending and descending.</p>

          <h3>Density Options</h3>
          <p>Toggle between <strong>Spacious</strong> and <strong>Compact</strong> view modes in Settings to control how much information fits on screen.</p>

          <h3>Bulk Operations</h3>
          <p>Select multiple tickets using the checkboxes to perform batch actions:</p>
          <ul>
            <li><strong>Bulk Assign</strong> — Assign multiple tickets to an agent at once</li>
            <li><strong>Bulk Status Change</strong> — Change status for multiple tickets (e.g., resolve all at once)</li>
            <li><strong>Bulk Priority</strong> — Re-prioritize multiple tickets</li>
            <li><strong>Bulk Delete</strong> — Delete multiple tickets (requires permission)</li>
            <li><strong>Bulk Close</strong> — Close multiple resolved tickets with a single note</li>
          </ul>
        `,
        tags: ['manage', 'filter', 'bulk', 'sort', 'view'],
        appLink: { title: 'Manage Tickets', href: '/dashboard/tickets' },
      },
      {
        id: 'tickets-detail',
        title: 'Ticket Detail Page',
        description: 'Everything you can do on a single ticket.',
        content: `
          <h3>Ticket Detail Overview</h3>
          <p>Click any ticket in the list to open its detail page. This is where all ticket activity happens.</p>

          <h3>Sections</h3>
          <ul>
            <li><strong>Header</strong> — Ticket number, title, status badge, priority badge, and quick-edit controls</li>
            <li><strong>Properties Panel</strong> — Assignee, category, type, SLA status, dates, tags, and custom fields</li>
            <li><strong>Description</strong> — The original ticket description with rich text rendering</li>
            <li><strong>Comments</strong> — Threaded conversation with support for internal notes</li>
            <li><strong>Attachments</strong> — Files attached to the ticket, with inline preview and download</li>
            <li><strong>Activity Log</strong> — Immutable audit trail of all changes to the ticket</li>
            <li><strong>Related Items</strong> — Linked problems, changes, and assets</li>
          </ul>

          <h3>Updating a Ticket</h3>
          <p>You can update a ticket's title, description, status, priority, assignee, category, tags, and custom fields directly from the detail page. Status changes are logged in the activity log.</p>

          <h3>Comments & Internal Notes</h3>
          <p>Comments support:</p>
          <ul>
            <li><strong>Threaded replies</strong> — Reply to specific comments using parent_id threading</li>
            <li><strong>Rich text</strong> — Full WYSIWYG editor with formatting, lists, and links</li>
            <li><strong>Internal notes</strong> — Toggle "Internal" to make a comment visible only to agents/admins</li>
            <li><strong>Editing</strong> — Edit your own comment within 15 minutes; agents/admins can edit any comment</li>
            <li><strong>Attachments</strong> — Add files to any comment</li>
            <li><strong>@mentions</strong> — Mention other users to notify them (coming soon)</li>
          </ul>

          <h3>SLA Tracking</h3>
          <p>When an SLA policy is applied, the ticket shows real-time SLA status:</p>
          <ul>
            <li>First response time target and elapsed time</li>
            <li>Resolution time target and elapsed time</li>
            <li>Breach indicator if SLA is at risk or breached</li>
            <li>Business hours and holiday exclusions are respected</li>
          </ul>
        `,
        tags: ['detail', 'comments', 'sla', 'activity'],
        appLink: { title: 'View Ticket', href: '/dashboard/tickets' },
      },
      {
        id: 'tickets-merge',
        title: 'Merging Tickets',
        description: 'Combine duplicate tickets into a single parent ticket.',
        minRole: 'agent',
        content: `
          <h3>When to Merge</h3>
          <p>When multiple tickets report the same issue or are closely related, you can merge them into a single parent ticket. This keeps the conversation consolidated and prevents redundant work.</p>

          <h3>How to Merge</h3>
          <ol>
            <li>Open the ticket that should be the <strong>parent</strong> (the one that stays open)</li>
            <li>Use the merge option in the ticket actions</li>
            <li>Select the child ticket(s) to merge into this one</li>
            <li>Optionally provide a merge reason</li>
          </ol>
          <p>After merging, child tickets are automatically closed and linked to the parent. All comments and activity remain visible on the child tickets, but new activity should go on the parent.</p>

          <h3>Notes</h3>
          <ul>
            <li>Merging is irreversible without database intervention</li>
            <li>The parent ticket's SLA continues to be tracked independently</li>
            <li>Merged tickets show a banner indicating they've been merged</li>
          </ul>
        `,
        tags: ['merge', 'duplicate', 'consolidate'],
      },
      {
        id: 'tickets-sla',
        title: 'SLA Policies',
        description: 'Service Level Agreement configuration and tracking.',
        minRole: 'agent',
        content: `
          <h3>What are SLA Policies?</h3>
          <p>SLA (Service Level Agreement) policies define expected response and resolution times based on ticket priority. They help ensure the support team meets service commitments.</p>

          <h3>How Policies Work</h3>
          <ul>
            <li>Each policy targets one or more ticket priorities</li>
            <li>Policies define <strong>first response time</strong> and <strong>resolution time</strong> targets</li>
            <li>Business hours and holidays are respected when calculating elapsed time</li>
            <li>Tickets show real-time SLA progress and breach warnings</li>
          </ul>

          <h3>Configuration</h3>
          <p>Admins can configure SLA policies in <strong>Admin → SLA Policies</strong>. For each policy:</p>
          <ul>
            <li>Set target response time (e.g., 1 hour for critical)</li>
            <li>Set target resolution time (e.g., 4 hours for critical, 72 hours for low)</li>
            <li>Configure business hours per day of week</li>
            <li>Add holiday exclusions for your region</li>
          </ul>
        `,
        tags: ['sla', 'policy', 'service-level'],
        appLink: { title: 'SLA Configuration', href: '/dashboard/admin?tab=sla-hours' },
      },
    ],
  },

  // ═══════════════════════════════════════════════════════════════════════
  // KNOWLEDGE BASE
  // ═══════════════════════════════════════════════════════════════════════
  {
    id: 'knowledge',
    title: 'Knowledge Base',
    icon: 'BookOpen',
    description: 'Create, manage, and share knowledge articles.',
    articles: [
      {
        id: 'kb-overview',
        title: 'Knowledge Base Overview',
        description: 'Understanding the knowledge management system.',
        content: `
          <h3>What is the Knowledge Base?</h3>
          <p>The Knowledge Base is a centralized repository for articles, guides, and documentation. It serves as a self-help resource for end-users and a reference library for agents.</p>

          <h3>Features</h3>
          <ul>
            <li><strong>Articles</strong> — Rich text content with formatting, images, and attachments</li>
            <li><strong>Categories</strong> — Hierarchical organization with color coding and icons</li>
            <li><strong>Search</strong> — Full-text search across all articles</li>
            <li><strong>Ratings</strong> — Users can mark articles as helpful or not helpful</li>
            <li><strong>AI Sync</strong> — Articles can be synced to the AI RAG knowledge base for AI-powered answers</li>
            <li><strong>Attachments</strong> — Files can be attached to articles for download</li>
            <li><strong>Version History</strong> — Track changes to articles over time</li>
          </ul>
        `,
        tags: ['kb', 'knowledge', 'articles'],
        appLink: { title: 'Browse Knowledge Base', href: '/dashboard/knowledge' },
      },
      {
        id: 'kb-create',
        title: 'Creating & Managing Articles',
        description: 'Write, edit, and organize knowledge articles.',
        minRole: 'agent',
        content: `
          <h3>Creating an Article</h3>
          <ol>
            <li>Navigate to <strong>Knowledge Base</strong> in the sidebar</li>
            <li>Click <strong>"New Article"</strong></li>
            <li>Enter a title and slug (URL-friendly identifier)</li>
            <li>Write the article body using the rich text editor</li>
            <li>Select a category and add tags for discoverability</li>
            <li>Set status to Published, Draft, or Archived</li>
            <li>Add attachments if needed</li>
            <li>Click <strong>"Save"</strong> to publish</li>
          </ol>

          <h3>Managing Articles</h3>
          <ul>
            <li><strong>Edit</strong> — Click the edit icon on any article you have permission to modify</li>
            <li><strong>Archive</strong> — Soft-deletes the article (can be restored by an admin)</li>
            <li><strong>Categories</strong> — Organize articles into hierarchical categories with colors and icons</li>
          </ul>

          <h3>Best Practices</h3>
          <ul>
            <li>Use clear, descriptive titles</li>
            <li>Include step-by-step instructions for procedures</li>
            <li>Add screenshots or diagrams where helpful</li>
            <li>Tag articles with relevant keywords for better search</li>
            <li>Link to related articles and resources</li>
            <li>Sync high-value articles to AI for RAG-powered answers</li>
          </ul>
        `,
        tags: ['create', 'edit', 'article', 'write'],
        appLink: { title: 'New Article', href: '/dashboard/knowledge/new' },
      },
      {
        id: 'kb-ai-sync',
        title: 'AI Sync',
        description: 'Sync articles to the AI knowledge base for RAG.',
        minRole: 'agent',
        content: `
          <h3>What is AI Sync?</h3>
          <p>AI Sync takes your knowledge articles and processes them into the AI's RAG (Retrieval-Augmented Generation) knowledge base. This allows the AI Assistant to answer questions based on your organization's documentation.</p>

          <h3>How It Works</h3>
          <ol>
            <li>An admin or agent with permission clicks <strong>"Sync to AI"</strong> on an article</li>
            <li>The article content is chunked and embedded into the AI vector database</li>
            <li>When users ask the AI Assistant questions, it retrieves relevant chunks</li>
            <li>The AI generates answers grounded in your documentation</li>
          </ol>

          <h3>Best Practices</h3>
          <ul>
            <li>Sync articles that answer common questions</li>
            <li>Keep synced articles up to date — outdated information leads to incorrect AI responses</li>
            <li>Review and reprocess articles when significant changes are made</li>
          </ul>
        `,
        tags: ['ai', 'sync', 'rag', 'knowledge'],
      },
    ],
  },

  // ═══════════════════════════════════════════════════════════════════════
  // ASSET MANAGEMENT
  // ═══════════════════════════════════════════════════════════════════════
  {
    id: 'assets',
    title: 'Asset Management',
    icon: 'Monitor',
    description: 'Track hardware, software, and IT assets across your organization.',
    articles: [
      {
        id: 'assets-overview',
        title: 'Assets Overview',
        description: 'Understanding the asset management system.',
        content: `
          <h3>What is Asset Management?</h3>
          <p>Resolv's asset management module provides a complete inventory of all IT assets in your organization. It combines manual asset tracking with automated agent-based discovery for real-time visibility.</p>

          <h3>Asset Types</h3>
          <ul>
            <li><strong>Workstations</strong> — Desktops, laptops, and thin clients</li>
            <li><strong>Servers</strong> — Physical and virtual servers</li>
            <li><strong>Network Devices</strong> — Switches, routers, firewalls, access points</li>
            <li><strong>Mobile Devices</strong> — Smartphones and tablets</li>
            <li><strong>Peripherals</strong> — Printers, scanners, monitors</li>
            <li><strong>Virtual Machines</strong> — VM instances across hypervisors</li>
            <li><strong>Other</strong> — Custom asset types as needed</li>
          </ul>

          <h3>Key Features</h3>
          <ul>
            <li><strong>Automated Discovery</strong> — The Resolv Agent (Windows service) automatically discovers assets and reports hardware/software inventory</li>
            <li><strong>Hardware Tracking</strong> — CPU, RAM, disk, GPU, BIOS, serial numbers, and more</li>
            <li><strong>Software Inventory</strong> — Complete list of installed software with versions and publishers</li>
            <li><strong>Asset Groups</strong> — Logical groupings with auto-join rules based on asset attributes</li>
            <li><strong>Lifecycle Management</strong> — Track asset status (active, maintenance, retired, lost/stolen)</li>
            <li><strong>Relationship Mapping</strong> — Link assets to tickets, changes, problems, and CIs</li>
            <li><strong>Activity Log</strong> — Complete audit trail for every asset</li>
          </ul>
        `,
        tags: ['asset', 'inventory', 'overview'],
        appLink: { title: 'View Assets', href: '/dashboard/assets' },
      },
      {
        id: 'assets-agent',
        title: 'Agent Installation & Discovery',
        description: 'Install the Resolv Agent for automatic asset discovery.',
        minRole: 'admin',
        content: `
          <h3>What is the Resolv Agent?</h3>
          <p>The Resolv Agent is a lightweight Windows service that runs on endpoints and automatically reports system inventory to the Resolv server. It provides real-time visibility into hardware, software, and system health.</p>

          <h3>Installation</h3>
          <ol>
            <li>Navigate to <strong>Admin → Agent Settings</strong> to get your organization's agent secret key</li>
            <li>Download the agent installer from <strong>Assets → Agent Download</strong></li>
            <li>Run the installer on the target machine (Administrator privileges required)</li>
            <li>The agent registers itself with the server and begins reporting inventory within 30 seconds</li>
          </ol>
          <p>Alternatively, you can deploy the agent via Group Policy or your existing software deployment tool for bulk installation.</p>

          <h3>What the Agent Reports</h3>
          <p>On every check-in (default: every 5 minutes), the agent sends:</p>
          <ul>
            <li>System identity (hostname, domain, serial number, fingerprint)</li>
            <li>Hardware specs (CPU, RAM, disks, GPU, motherboard, BIOS)</li>
            <li>Network adapters (IP/MAC addresses, speed, status)</li>
            <li>Installed software (from both 64-bit and 32-bit registry paths)</li>
            <li>Active user sessions</li>
            <li>BitLocker encryption status per drive</li>
            <li>Battery health and stats (for laptops)</li>
            <li>USB device history (new/removed devices)</li>
          </ul>

          <h3>Heartbeat</h3>
          <p>The agent sends a lightweight heartbeat every 30 seconds to signal liveness. The server uses this to:</p>
          <ul>
            <li>Track agent online/offline status</li>
            <li>Send real-time commands (scripts, reboots, software installs)</li>
            <li>Check for available updates</li>
          </ul>

          <h3>Auto-Update</h3>
          <p>When a new agent version is released, the server notifies the agent on the next heartbeat. The agent automatically downloads, verifies, and installs the update with zero downtime.</p>
        `,
        tags: ['agent', 'installation', 'discovery', 'windows'],
        appLink: { title: 'Agent Settings', href: '/dashboard/admin?tab=agent-settings' },
      },
      {
        id: 'assets-groups',
        title: 'Asset Groups & Auto-Join Rules',
        description: 'Organize assets into logical groups with automatic membership.',
        minRole: 'agent',
        content: `
          <h3>Asset Groups</h3>
          <p>Asset groups allow you to organize assets into logical collections for easier management. For example: "Sales Department Laptops", "Production Servers", "Remote Workers".</p>

          <h3>Auto-Join Rules</h3>
          <p>Instead of manually assigning assets to groups, you can create auto-join rules that automatically add matching assets. Rules can match on:</p>
          <ul>
            <li>Hostname pattern (e.g., <code>SALES-*</code>)</li>
            <li>Operating system</li>
            <li>IP address range</li>
            <li>Domain membership</li>
            <li>Installed software</li>
            <li>Custom fields</li>
          </ul>
          <p>When an asset checks in or is updated, the auto-join rules are evaluated and the asset is assigned to matching groups automatically.</p>

          <h3>Applying Rules</h3>
          <ul>
            <li><strong>Single Asset</strong> — Apply rules to one asset from its detail page</li>
            <li><strong>All Assets</strong> — Apply rules to all assets from the Asset Groups settings</li>
          </ul>
        `,
        tags: ['groups', 'auto-join', 'organization'],
        appLink: { title: 'Manage Assets', href: '/dashboard/assets' },
      },
    ],
  },

  // ═══════════════════════════════════════════════════════════════════════
  // CHANGE MANAGEMENT
  // ═══════════════════════════════════════════════════════════════════════
  {
    id: 'changes',
    title: 'Change Management',
    icon: 'GitBranch',
    description: 'Plan, approve, and implement changes with control.',
    minRole: 'agent',
    articles: [
      {
        id: 'changes-overview',
        title: 'Change Management Overview',
        description: 'Understanding the change management process.',
        content: `
          <h3>What is Change Management?</h3>
          <p>Change Management is a structured process for making changes to IT infrastructure in a controlled manner, minimizing risk and ensuring proper review and approval.</p>

          <h3>Change Types</h3>
          <table>
            <tr><th>Type</th><th>Risk</th><th>Approval</th><th>Example</th></tr>
            <tr><td><strong>Standard</strong></td><td>Low</td><td>Pre-approved (auto-approve on submit)</td><td>Password reset, user account creation</td></tr>
            <tr><td><strong>Normal</strong></td><td>Medium</td><td>Requires CAB approval</td><td>Server patching, software upgrade</td></tr>
            <tr><td><strong>Emergency</strong></td><td>High</td><td>Expedited review</td><td>Security vulnerability patch, outage fix</td></tr>
          </table>

          <h3>Lifecycle</h3>
          <ol>
            <li><strong>Draft</strong> — Change is being planned and documented</li>
            <li><strong>Under Review</strong> — Submitted for approval</li>
            <li><strong>Approved</strong> — Approved for implementation</li>
            <li><strong>Implementation</strong> — Change is being implemented</li>
            <li><strong>Completed</strong> — Implementation finished, PIR may be needed</li>
            <li><strong>Rolled Back</strong> — Change was rolled back (requires reason)</li>
            <li><strong>Cancelled</strong> — Change was cancelled</li>
          </ol>

          <h3>Key Features</h3>
          <ul>
            <li><strong>CAB Review</strong> — Configurable Change Advisory Board review process</li>
            <li><strong>CI Impact Analysis</strong> — See which configuration items are affected</li>
            <li><strong>Schedule & Calendar</strong> — Plan changes on a shared calendar view</li>
            <li><strong>Post-Implementation Review (PIR)</strong> — Review success/failure after completion</li>
            <li><strong>Rollback Plan</strong> — Document how to reverse the change if needed</li>
            <li><strong>Linked Tickets</strong> — Auto-create implementation tickets when approved</li>
          </ul>
        `,
        tags: ['change', 'overview', 'cab', 'itil'],
        appLink: { title: 'View Changes', href: '/dashboard/changes' },
      },
      {
        id: 'changes-create',
        title: 'Creating & Managing Changes',
        description: 'Create change requests and manage their lifecycle.',
        content: `
          <h3>Creating a Change</h3>
          <ol>
            <li>Navigate to <strong>Changes</strong> in the sidebar</li>
            <li>Click <strong>"New Change"</strong></li>
            <li>Select change type (Standard / Normal / Emergency)</li>
            <li>Fill in the change details: title, description, risk level, and scope</li>
            <li>Set the planned start and end dates</li>
            <li>Add the implementation plan, rollback plan, and test plan</li>
            <li>Link affected CIs (Configuration Items) for impact analysis</li>
            <li>Submit for review</li>
          </ol>

          <h3>Submitting for Review</h3>
          <ul>
            <li><strong>Standard</strong> — Auto-approved on submit</li>
            <li><strong>Normal</strong> — Routes to CAB for approval (creates an approval request)</li>
            <li><strong>Emergency</strong> — Flagged for expedited review</li>
          </ul>

          <h3>Post-Approval</h3>
          <p>Once approved:</p>
          <ol>
            <li>Start implementation when ready</li>
            <li>Mark the change as completed when done</li>
            <li>Complete the Post-Implementation Review (PIR) if required</li>
            <li>If something goes wrong, use the rollback option</li>
          </ol>

          <h3>Calendar View</h3>
          <p>The calendar view shows all planned changes on a timeline, making it easy to spot scheduling conflicts and plan maintenance windows.</p>
        `,
        tags: ['create', 'manage', 'approve', 'implement'],
        appLink: { title: 'Create Change', href: '/dashboard/changes' },
      },
    ],
  },

  // ═══════════════════════════════════════════════════════════════════════
  // PROBLEM MANAGEMENT
  // ═══════════════════════════════════════════════════════════════════════
  {
    id: 'problems',
    title: 'Problem Management',
    icon: 'AlertTriangle',
    description: 'Identify root causes and prevent recurring incidents.',
    minRole: 'agent',
    articles: [
      {
        id: 'problems-overview',
        title: 'Problem Management Overview',
        description: 'Understanding the problem management process.',
        content: `
          <h3>What is Problem Management?</h3>
          <p>Problem Management focuses on identifying the underlying root causes of incidents and preventing them from recurring. It's the proactive counterpart to incident management.</p>

          <h3>Key Concepts</h3>
          <ul>
            <li><strong>Problem</strong> — The unknown cause of one or more incidents</li>
            <li><strong>Known Error</strong> — A problem where the root cause is identified and a workaround exists</li>
            <li><strong>Workaround</strong> — A temporary fix that reduces or eliminates impact</li>
            <li><strong>Root Cause</strong> — The underlying cause that needs to be addressed permanently</li>
          </ul>

          <h3>Lifecycle</h3>
          <ol>
            <li><strong>Identified</strong> — Problem is identified (from incident analysis or proactive detection)</li>
            <li><strong>Under Investigation</strong> — Root cause analysis is in progress</li>
            <li><strong>Known Error</strong> — Root cause found, workaround available</li>
            <li><strong>Resolved</strong> — Permanent fix has been implemented</li>
            <li><strong>Closed</strong> — Problem is complete</li>
          </ol>

          <h3>Linking Incidents</h3>
          <p>You can link multiple incidents (tickets) to a problem with relationship types:</p>
          <ul>
            <li><strong>Caused By</strong> — The incident was caused by this problem</li>
            <li><strong>Related To</strong> — The incident is related to this problem</li>
            <li><strong>Contributing</strong> — The incident contributed to the problem</li>
          </ul>
        `,
        tags: ['problem', 'root-cause', 'known-error'],
        appLink: { title: 'View Problems', href: '/dashboard/problems' },
      },
    ],
  },

  // ═══════════════════════════════════════════════════════════════════════
  // SERVICE CATALOG
  // ═══════════════════════════════════════════════════════════════════════
  {
    id: 'service-catalog',
    title: 'Service Catalog',
    icon: 'LayoutGrid',
    description: 'Curated service offerings with request fulfillment.',
    articles: [
      {
        id: 'catalog-overview',
        title: 'Service Catalog Overview',
        description: 'Understanding the service catalog.',
        content: `
          <h3>What is the Service Catalog?</h3>
          <p>The Service Catalog is a curated collection of IT services that end-users can request. It provides a self-service experience for common requests like software installation, account access, and hardware provisioning.</p>

          <h3>Components</h3>
          <ul>
            <li><strong>Catalog Categories</strong> — Group related services (e.g., "Software Requests", "Hardware Provisioning")</li>
            <li><strong>Catalog Items</strong> — Individual services with descriptions, forms, and fulfillment rules</li>
            <li><strong>Request Forms</strong> — Custom forms with various field types (text, dropdown, file upload, etc.)</li>
            <li><strong>Fulfillment</strong> — Each item can create a ticket, trigger an approval, or be fully automated</li>
          </ul>

          <h3>How Users Request Services</h3>
          <ol>
            <li>End-users browse the catalog from the Self-Service Portal</li>
            <li>They select a service item and fill in the request form</li>
            <li>Depending on configuration, this may:</li>
            <ul>
              <li>Create a ticket for the support team</li>
              <li>Create an approval request that routes to the appropriate approver</li>
              <li>Be fulfilled automatically</li>
            </ul>
            <li>The user can track the status of their request</li>
          </ol>
        `,
        tags: ['catalog', 'service', 'request'],
        appLink: { title: 'Open Service Catalog', href: '/dashboard/portal' },
      },
    ],
  },

  // ═══════════════════════════════════════════════════════════════════════
  // APPROVALS
  // ═══════════════════════════════════════════════════════════════════════
  {
    id: 'approvals',
    title: 'Approvals',
    icon: 'CheckSquare',
    description: 'Multi-step approval workflows for ITSM processes.',
    minRole: 'agent',
    articles: [
      {
        id: 'approvals-overview',
        title: 'Approval Workflows',
        description: 'Understanding the approval system.',
        content: `
          <h3>What are Approval Workflows?</h3>
          <p>Approval workflows allow organizations to define multi-step approval processes for changes, service requests, and other ITSM activities. Approvals ensure that the right people review and authorize actions before they're executed.</p>

          <h3>How Approvals Work</h3>
          <ol>
            <li>An approval request is created (e.g., from a change request or catalog item)</li>
            <li>The request routes through one or more approval steps</li>
            <li>Each step can be assigned to a specific user, role, or manager of the requester</li>
            <li>Approvers can approve, deny (with reason), or reassign</li>
            <li>If any step is denied, the entire request is denied</li>
            <li>Once all steps are approved, the request is fulfilled</li>
          </ol>

          <h3>Routing Rules</h3>
          <p>Admins can configure automatic routing rules that determine who should approve based on:</p>
          <ul>
            <li>Ticket category</li>
            <li>Change type and risk level</li>
            <li>Requester's department</li>
            <li>Asset group</li>
            <li>Custom field values</li>
          </ul>

          <h3>Approval Requests Page</h3>
          <p>The <strong>Approvals</strong> page in the sidebar shows all approval requests. You can filter by status (Pending, Approved, Denied), view details, and take action directly from the list.</p>
        `,
        tags: ['approval', 'workflow', 'routing'],
        appLink: { title: 'View Approvals', href: '/dashboard/approvals' },
      },
    ],
  },

  // ═══════════════════════════════════════════════════════════════════════
  // AI ASSISTANT
  // ═══════════════════════════════════════════════════════════════════════
  {
    id: 'ai-assistant',
    title: 'AI Assistant',
    icon: 'Sparkles',
    description: 'Intelligent AI-powered support for agents and end-users.',
    articles: [
      {
        id: 'ai-overview',
        title: 'AI Assistant Overview',
        description: 'Understanding the dual-mode AI assistant.',
        content: `
          <h3>What is the AI Assistant?</h3>
          <p>The AI Assistant is a powerful tool that uses large language models to help users and agents work more efficiently. It has two modes: <strong>Portal Mode</strong> (for end-users) and <strong>Agent Mode</strong> (for support staff).</p>

          <h3>Accessing the AI Assistant</h3>
          <ul>
            <li>Click the <strong>"Ask AI"</strong> button in the sidebar</li>
            <li>Press <kbd>⌘J</kbd> / <kbd>Ctrl+J</kbd> to toggle the panel</li>
            <li>Use the AI chat in the Self-Service Portal (end-user mode)</li>
          </ul>

          <h3>Capabilities (Agent Mode)</h3>
          <ul>
            <li>Search and retrieve tickets by description, ID, or filters</li>
            <li>Get full ticket details including comments and activity</li>
            <li>Create new tickets from natural language descriptions</li>
            <li>Update ticket status, priority, and assignment</li>
            <li>Search the knowledge base for relevant articles</li>
            <li>Search for users and user details</li>
            <li>Add comments and attachments to tickets</li>
            <li>Get platform statistics</li>
          </ul>

          <h3>Capabilities (Portal Mode)</h3>
          <ul>
            <li>Search and view the user's own tickets</li>
            <li>Create tickets from natural language</li>
            <li>Search the knowledge base</li>
            <li>Get personalized statistics</li>
            <li>Search for support staff</li>
            <li>Add comments to tickets</li>
          </ul>

          <h3>RAG Knowledge</h3>
          <p>The AI Assistant can be enhanced with RAG (Retrieval-Augmented Generation) by syncing knowledge articles, uploading documents, and creating Q&A pairs. This allows the AI to answer questions based on your organization's specific knowledge base.</p>
        `,
        tags: ['ai', 'assistant', 'chat', 'help'],
        appLink: { title: 'Open AI Assistant', href: '/dashboard' },
      },
      {
        id: 'ai-config',
        title: 'AI Configuration',
        description: 'Configure the AI provider, model, and behavior.',
        minRole: 'admin',
        content: `
          <h3>AI Provider Setup</h3>
          <p>Admins can configure the AI integration in <strong>Admin → AI Configuration</strong>:</p>

          <h4>Provider & Model</h4>
          <ul>
            <li>Select the AI provider (e.g., Anthropic Claude, OpenAI, etc.)</li>
            <li>Choose the model (e.g., Claude 3 Sonnet, Claude 3 Haiku)</li>
            <li>Configure API credentials</li>
          </ul>

          <h4>Behavior Configuration</h4>
          <ul>
            <li><strong>System Prompt</strong> — Customize the AI's personality and behavior guidelines</li>
            <li><strong>Agent Tools</strong> — Enable/disable specific tools available to the AI</li>
            <li><strong>Portal Tools</strong> — Control what portal users can ask the AI to do</li>
            <li><strong>Temperature</strong> — Control response creativity vs. precision</li>
            <li><strong>Max Tokens</strong> — Set maximum response length</li>
          </ul>

          <h4>RAG Configuration</h4>
          <ul>
            <li><strong>Strategy</strong> — How relevant content is retrieved and presented to the AI</li>
            <li><strong>Chunking</strong> — How documents are split into searchable chunks</li>
            <li><strong>Similarity Threshold</strong> — Minimum relevance score for retrieved content</li>
          </ul>

          <h3>AI Training</h3>
          <p>In <strong>Admin → AI Training</strong>, you can manage the RAG knowledge base:</p>
          <ul>
            <li><strong>Upload Documents</strong> — Upload PDF, Word, or text files as knowledge sources</li>
            <li><strong>URL Sources</strong> — Add web pages as knowledge sources</li>
            <li><strong>Manual Q&A</strong> — Create question-and-answer pairs directly</li>
            <li><strong>Knowledge Sync</strong> — Auto-sync knowledge base articles to the AI</li>
            <li><strong>Test & Evaluate</strong> — Test RAG retrieval to verify quality</li>
          </ul>
        `,
        tags: ['ai', 'config', 'provider', 'rag', 'training'],
        appLink: { title: 'AI Configuration', href: '/dashboard/admin?tab=ai' },
      },
    ],
  },

  // ═══════════════════════════════════════════════════════════════════════
  // REPORTS & ANALYTICS
  // ═══════════════════════════════════════════════════════════════════════
  {
    id: 'analytics',
    title: 'Reports & Analytics',
    icon: 'BarChart',
    description: 'Dashboards, reports, and data-driven insights.',
    minRole: 'manager',
    articles: [
      {
        id: 'analytics-overview',
        title: 'Analytics Overview',
        description: 'Understanding the reporting and analytics capabilities.',
        content: `
          <h3>What's Available?</h3>
          <p>The Analytics module provides comprehensive reporting across all ITSM modules. Access it from <strong>Administration → Analytics</strong> (admin only).</p>

          <h3>Dashboard Sections</h3>
          <ul>
            <li><strong>Overview</strong> — High-level KPIs: ticket volume, resolution rate, SLA compliance, CSAT score</li>
            <li><strong>Operational</strong> — Agent performance, response times, backlog analysis</li>
            <li><strong>Service Level</strong> — SLA breach analysis, response time trends, priority distribution</li>
            <li><strong>Matrix</strong> — Cross-filtered views comparing multiple dimensions</li>
            <li><strong>ITSM Modules</strong> — Change, problem, and major incident metrics</li>
            <li><strong>Knowledge & AI</strong> — Article views, helpfulness ratings, RAG usage stats</li>
            <li><strong>Assets & Licenses</strong> — Asset count trends, software compliance, OS distribution</li>
            <li><strong>Benchmarks</strong> — Compare performance against industry benchmarks</li>
            <li><strong>Reports</strong> — Create and save custom reports</li>
            <li><strong>Pinboard</strong> — Pin important metrics for quick reference</li>
          </ul>

          <h3>Custom Reports</h3>
          <p>Create custom reports by selecting:</p>
          <ul>
            <li>Report type (ticket summary, agent performance, SLA compliance, category breakdown)</li>
            <li>Date range and filters</li>
            <li>Grouping and aggregation</li>
            <li>Visualization type (table, bar chart, line chart, donut chart)</li>
          </ul>

          <h3>Exporting</h3>
          <p>Reports can be exported to:</p>
          <ul>
            <li><strong>CSV</strong> — For spreadsheet analysis</li>
            <li><strong>Excel</strong> — Formatted Excel workbook with charts</li>
          </ul>

          <h3>Scheduled Reports</h3>
          <p>Set up recurring report delivery via email. Configure frequency (daily, weekly, monthly) and recipients.</p>
        `,
        tags: ['analytics', 'reports', 'dashboard', 'metrics'],
        appLink: { title: 'Open Analytics', href: '/dashboard/analytics' },
      },
    ],
  },

  // ═══════════════════════════════════════════════════════════════════════
  // ADMINISTRATION
  // ═══════════════════════════════════════════════════════════════════════
  {
    id: 'admin',
    title: 'Administration',
    icon: 'Shield',
    description: 'System configuration, user management, and settings.',
    articles: [
      {
        id: 'admin-overview',
        title: 'Admin Panel Overview',
        description: 'Navigating the administration interface.',
        content: `
          <h3>Accessing Admin</h3>
          <p>The Admin panel is available to users with the <strong>admin</strong> role. Navigate via <strong>Administration → Admin</strong> in the sidebar.</p>
          <p>The Admin panel is organized into tabs covering all configurable aspects of the platform. Below are the key sections.</p>
        `,
        tags: ['admin', 'settings', 'configuration'],
        appLink: { title: 'Open Admin Panel', href: '/dashboard/admin' },
      },
      {
        id: 'admin-users',
        title: 'Users & Roles',
        description: 'Managing users, roles, and permissions.',
        content: `
          <h3>User Management</h3>
          <ul>
            <li><strong>Create Users</strong> — Add users manually or use the invite feature to send setup emails</li>
            <li><strong>Edit Users</strong> — Update name, email, department, phone, and role</li>
            <li><strong>Lock/Unlock</strong> — Temporarily disable or re-enable user accounts</li>
            <li><strong>Delete Users</strong> — Permanently remove user accounts</li>
            <li><strong>Password Management</strong> — Force password change or generate temporary passwords</li>
          </ul>

          <h3>Roles & Permissions</h3>
          <p>Resolv uses a granular permission system with roles. Each role has a set of permissions that control access to features:</p>
          <table>
            <tr><th>Permission</th><th>Description</th></tr>
            <tr><td><code>manage_users</code></td><td>Create, edit, lock/unlock, and delete users</td></tr>
            <tr><td><code>manage_roles</code></td><td>Configure role permissions and assignment rules</td></tr>
            <tr><td><code>view_all_tickets</code></td><td>View tickets not assigned to self</td></tr>
            <tr><td><code>delete_tickets</code></td><td>Delete tickets permanently</td></tr>
            <tr><td><code>assign_tickets</code></td><td>Assign tickets to agents, perform bulk operations</td></tr>
            <tr><td><code>manage_categories</code></td><td>Create, edit, and delete categories</td></tr>
            <tr><td><code>manage_custom_fields</code></td><td>Create and manage custom field definitions</td></tr>
            <tr><td><code>manage_sla</code></td><td>Configure SLA policies, business hours, and holidays</td></tr>
            <tr><td><code>manage_knowledge</code></td><td>Create and edit knowledge articles</td></tr>
            <tr><td><code>delete_knowledge</code></td><td>Archive (soft-delete) knowledge articles</td></tr>
            <tr><td><code>manage_assets</code></td><td>Create, edit, and delete assets and asset groups</td></tr>
            <tr><td><code>manage_problems</code></td><td>Create and manage problem records</td></tr>
            <tr><td><code>delete_problems</code></td><td>Delete problem records permanently</td></tr>
            <tr><td><code>view_problems</code></td><td>View problem records</td></tr>
            <tr><td><code>manage_changes</code></td><td>Create and manage change requests</td></tr>
            <tr><td><code>delete_changes</code></td><td>Delete draft change requests</td></tr>
            <tr><td><code>create_changes</code></td><td>Create new change requests</td></tr>
            <tr><td><code>approve_changes</code></td><td>Approve or reject change requests</td></tr>
            <tr><td><code>view_changes</code></td><td>View change requests</td></tr>
            <tr><td><code>manage_major_incidents</code></td><td>Declare and manage major incidents</td></tr>
            <tr><td><code>manage_ai_config</code></td><td>Configure AI provider, model, tools, and behavior</td></tr>
            <tr><td><code>manage_classification</code></td><td>Create and manage auto-classification rules</td></tr>
            <tr><td><code>manage_settings</code></td><td>Modify system settings and platform configuration</td></tr>
            <tr><td><code>view_audit_log</code></td><td>View the immutable audit trail</td></tr>
            <tr><td><code>manage_reports</code></td><td>Create, manage, schedule, and export reports</td></tr>
            <tr><td><code>manage_automation</code></td><td>Manage scripts, auto-reply rules, and automation</td></tr>
            <tr><td><code>manage_workflows</code></td><td>Create and manage visual workflow definitions</td></tr>
            <tr><td><code>manage_email_accounts</code></td><td>Configure SMTP/IMAP email accounts</td></tr>
            <tr><td><code>manage_email_templates</code></td><td>Create and edit email notification templates</td></tr>
            <tr><td><code>manage_notification_settings</code></td><td>Configure global notification settings</td></tr>
            <tr><td><code>manage_integrations</code></td><td>Manage webhooks, SSO, and other integrations</td></tr>
            <tr><td><code>manage_webhooks</code></td><td>Create, edit, and manage webhook endpoints</td></tr>
            <tr><td><code>manage_directory_sync</code></td><td>Configure Google Workspace and Azure AD sync</td></tr>
            <tr><td><code>manage_catalog</code></td><td>Create and manage service catalog items</td></tr>
            <tr><td><code>delete_catalog</code></td><td>Delete service catalog items</td></tr>
            <tr><td><code>create_approvals</code></td><td>Create approval requests and routing rules</td></tr>
            <tr><td><code>manage_licenses</code></td><td>Create and manage software license records</td></tr>
            <tr><td><code>delete_licenses</code></td><td>Delete software license records</td></tr>
            <tr><td><code>manage_cmdb</code></td><td>Create and manage configuration items and CI relationships</td></tr>
            <tr><td><code>manage_agent_settings</code></td><td>Configure agent secret, versions, and rollout settings</td></tr>
            <tr><td><code>manage_canned_responses</code></td><td>Create and manage canned response templates</td></tr>
          </table>
          <p>Admins automatically have all permissions. Custom roles can be configured for granular access control.</p>

          <h3>Role Assignment Rules</h3>
          <p>Automatically assign roles to users based on attributes like email domain, department, or directory sync group membership.</p>
        `,
        tags: ['users', 'roles', 'permissions', 'admin'],
        appLink: { title: 'User Management', href: '/dashboard/admin?tab=users' },
      },
      {
        id: 'admin-settings',
        title: 'System Settings',
        description: 'Global platform configuration.',
        content: `
          <h3>General Settings</h3>
          <ul>
            <li><strong>Instance Name</strong> — Your organization's Resolv instance name</li>
            <li><strong>Logo</strong> — Custom logo for the login page and portal</li>
            <li><strong>Maintenance Mode</strong> — Enable to show a maintenance page to users (admins can still access)</li>
            <li><strong>Agent Secret Key</strong> — Regenerate the shared secret for agent registration</li>
          </ul>

          <h3>Security</h3>
          <ul>
            <li><strong>Authentication</strong> — Configure password policies, account lockout thresholds, and login modes</li>
            <li><strong>SSO</strong> — Configure Single Sign-On providers (Google OAuth, custom SAML/OIDC)</li>
            <li><strong>Emergency Bypass</strong> — Generate bypass keys for when SSO is unavailable</li>
          </ul>

          <h3>Audit Log</h3>
          <p>The audit log provides an immutable record of all actions performed in the platform. Each entry includes the user, action, timestamp, and JSON diff of changes. Use the search and filter options to find specific events.</p>

          <h3>Email Templates</h3>
          <p>Customize the email templates used for various notifications (ticket created, assigned, resolved, etc.). Templates support variables like <code>{{ticket.title}}</code>, <code>{{user.name}}</code>, etc.</p>
        `,
        tags: ['settings', 'system', 'security', 'audit'],
        appLink: { title: 'System Settings', href: '/dashboard/admin?tab=settings' },
      },
      {
        id: 'admin-email',
        title: 'Email Configuration',
        description: 'Configure SMTP, IMAP, inbound email, and auto-reply.',
        content: `
          <h3>SMTP Configuration</h3>
          <p>Configure outbound email settings for sending notifications, alerts, and reports:</p>
          <ul>
            <li>SMTP server hostname and port</li>
            <li>Authentication credentials (username/password)</li>
            <li>Sender name and email address</li>
            <li>TLS/SSL encryption settings</li>
          </ul>
          <p>Use the <strong>Test Connection</strong> feature to verify your SMTP settings before saving.</p>

          <h3>IMAP / Email Accounts</h3>
          <p>Configure inbound email accounts for receiving and processing emails:</p>
          <ul>
            <li>IMAP server settings</li>
            <li>Polling interval</li>
            <li>Folder to monitor (e.g., INBOX)</li>
            <li>Email processing rules</li>
          </ul>

          <h3>Inbound Email Parsing</h3>
          <p>Resolv supports receiving emails via SendGrid Inbound Parse and Mailgun webhooks. When an email is received:</p>
          <ul>
            <li>If it replies to an existing ticket, the reply is added as a comment</li>
            <li>If it's a new email to a configured address, a new ticket is created</li>
          </ul>

          <h3>Auto-Reply Rules</h3>
          <p>Configure automatic replies based on conditions:</p>
          <ul>
            <li>Match on subject keywords, sender domain, or email content</li>
            <li>Send predefined reply templates</li>
            <li>Set ticket priority and category based on content</li>
          </ul>

          <h3>Gmail Push</h3>
          <p>Google Workspace users can configure Gmail push notifications for real-time email processing using Google Pub/Sub.</p>
        `,
        tags: ['email', 'smtp', 'imap', 'inbound'],
        appLink: { title: 'Email Settings', href: '/dashboard/admin?tab=email' },
      },
      {
        id: 'admin-workflows',
        title: 'Workflow Designer',
        description: 'Visual automation workflow builder.',
        content: `
          <h3>What is the Workflow Designer?</h3>
          <p>The Workflow Designer allows admins to create visual automation workflows using a drag-and-drop interface. Automate repetitive tasks, enforce business rules, and trigger actions based on events.</p>

          <h3>Workflow Components</h3>
          <ul>
            <li><strong>Triggers</strong> — What starts the workflow (e.g., ticket created, status changed, comment added)</li>
            <li><strong>Conditions</strong> — Logical conditions that must be met (e.g., priority is Critical, category is Networking)</li>
            <li><strong>Actions</strong> — What happens when the workflow runs (e.g., assign to team, send email, update field, create sub-ticket)</li>
          </ul>

          <h3>Example Workflows</h3>
          <ul>
            <li>Auto-assign high-priority tickets to the senior agent</li>
            <li>Send email notification when SLA is at risk</li>
            <li>Automatically tag tickets from VIP users</li>
            <li>Escalate unresolved tickets after 24 hours</li>
            <li>Create a problem record when 3+ related incidents are logged</li>
          </ul>

          <h3>Testing Workflows</h3>
          <p>Use the <strong>Test</strong> feature to simulate workflow execution with sample data before activating it.</p>
        `,
        tags: ['workflow', 'automation', 'designer'],
        appLink: { title: 'Workflow Designer', href: '/dashboard/admin?tab=workflow-designer' },
      },
      {
        id: 'admin-integrations',
        title: 'Integrations',
        description: 'Webhooks, SSO, directory sync, and more.',
        content: `
          <h3>Webhooks</h3>
          <p>Webhooks allow Resolv to send HTTP callbacks to external systems when events occur. Configure webhooks to:</p>
          <ul>
            <li>Send ticket data to your chat platform (Slack, Teams, etc.)</li>
            <li>Sync data with external systems</li>
            <li>Trigger CI/CD pipelines on change approval</li>
            <li>Integrate with monitoring tools</li>
          </ul>
          <p>Webhooks support secret-based signing for security and include delivery logs for troubleshooting. Failed deliveries can be retried manually.</p>

          <h3>SSO / Single Sign-On</h3>
          <p>Resolv supports multiple SSO providers:</p>
          <ul>
            <li><strong>Google OAuth</strong> — Standard OAuth 2.0 login with Google Workspace accounts</li>
            <li><strong>Custom SSO</strong> — Generic OAuth 2.0 / OIDC providers</li>
            <li>Multiple providers can be configured simultaneously</li>
          </ul>

          <h3>Directory Sync</h3>
          <p>Synchronize users and groups from your directory service:</p>
          <ul>
            <li><strong>Google Workspace Directory Sync</strong> — Sync users and groups from Google Workspace</li>
            <li><strong>Azure AD Sync</strong> — Sync users and groups from Microsoft Azure Active Directory</li>
            <li>Automatic periodic sync with manual trigger option</li>
            <li>Configurable field mapping and role assignment rules</li>
            <li>Detailed sync logs for troubleshooting</li>
          </ul>
        `,
        tags: ['webhooks', 'sso', 'directory-sync', 'integration'],
        appLink: { title: 'Integration Settings', href: '/dashboard/admin?tab=webhooks' },
      },
      {
        id: 'admin-other',
        title: 'Other Admin Settings',
        description: 'Categories, custom fields, canned responses, and more.',
        content: `
          <h3>Categories</h3>
          <p>Organize tickets and knowledge articles with a flexible hierarchical category system. Each category can have a color, icon, description, and parent relationship.</p>

          <h3>Custom Fields</h3>
          <p>Extend the data model with custom fields. Supported field types:</p>
          <ul>
            <li>Text, Text Area, Rich Text</li>
            <li>Number, Date, DateTime</li>
            <li>Dropdown, Multi-Select</li>
            <li>Checkbox, Radio Button</li>
            <li>User, Asset, Category picker</li>
          </ul>
          <p>Custom fields can be added to tickets and assets. They appear on create/edit forms and detail views.</p>

          <h3>Ticket Statuses</h3>
          <p>Customize the status values and their order. Each status can have a color, description, and type filter.</p>

          <h3>Canned Responses</h3>
          <p>Create pre-written responses for common scenarios. Agents can quickly insert canned responses when commenting on tickets, saving time and ensuring consistency.</p>

          <h3>Working Hours & Holidays</h3>
          <p>Configure business hours per day of the week and holiday exclusions. These are used for SLA calculations and scheduling.</p>

          <h3>Notification Settings</h3>
          <p>Configure which events trigger notifications and how they're delivered (in-app, email, or both).</p>

          <h3>Portal Customization</h3>
          <p>Customize the look and feel of the Self-Service Portal, including branding, welcome message, and featured services.</p>

          <h3>Classification Rules</h3>
          <p>Auto-classify tickets based on content matching. Rules can set category, priority, type, and tags based on keywords in the title or description.</p>

          <h3>Backup & Restore</h3>
          <p>Manage database backup configuration and trigger manual backups.</p>
        `,
        tags: ['categories', 'fields', 'canned', 'classification'],
        appLink: { title: 'All Settings', href: '/dashboard/admin' },
      },
    ],
  },

  // ═══════════════════════════════════════════════════════════════════════
  // USER SETTINGS
  // ═══════════════════════════════════════════════════════════════════════
  {
    id: 'user-settings',
    title: 'User Settings',
    icon: 'Settings',
    description: 'Manage your profile, notifications, and preferences.',
    articles: [
      {
        id: 'settings-profile',
        title: 'Profile & Preferences',
        description: 'Update your personal information and app preferences.',
        content: `
          <h3>Profile</h3>
          <p>Access your settings by clicking the <strong>gear icon</strong> at the bottom of the sidebar. Here you can update:</p>
          <ul>
            <li><strong>Name</strong> — Your display name</li>
            <li><strong>Email</strong> — Your email address (admins can change this; users may need admin help)</li>
            <li><strong>Department</strong> — Your department or team</li>
            <li><strong>Phone</strong> — Your contact number</li>
            <li><strong>Avatar</strong> — Profile picture (upload support coming soon)</li>
          </ul>

          <h3>Notification Preferences</h3>
          <p>Control which notifications you receive:</p>
          <ul>
            <li><strong>Pop-up Notifications</strong> — Toggle in-app browser notifications on/off</li>
            <li><strong>Email Notifications</strong> — Choose which events trigger email alerts:
              <ul>
                <li>Ticket assigned to you</li>
                <li>Ticket updated</li>
                <li>SLA breach warning</li>
                <li>New comment on your ticket</li>
                <li>Ticket resolved</li>
              </ul>
            </li>
          </ul>

          <h3>Security</h3>
          <ul>
            <li><strong>Change Password</strong> — Update your current password (requires current password)</li>
            <li><strong>Active Sessions</strong> — View and manage active login sessions</li>
            <li><strong>Sign Out All Sessions</strong> — Force logout from all devices</li>
          </ul>

          <h3>Appearance & Localization</h3>
          <ul>
            <li><strong>Language</strong> — Choose your preferred language (English, Spanish, French, German, Portuguese)</li>
            <li><strong>Timezone</strong> — Set your local timezone for date/time display</li>
            <li><strong>Theme</strong> — Dark mode only (for consistency)</li>
          </ul>

          <h3>Default Views</h3>
          <ul>
            <li><strong>Default Ticket View</strong> — Choose between All Tickets, My Tickets, or Unassigned</li>
            <li><strong>Default Sort Order</strong> — Newest first, priority, or due date</li>
            <li><strong>Density</strong> — Spacious or compact list view</li>
          </ul>
        `,
        tags: ['profile', 'settings', 'preferences', 'password'],
        appLink: { title: 'Open Settings', href: '/dashboard/settings' },
      },
    ],
  },

  // ═══════════════════════════════════════════════════════════════════════
  // AGENT (WINDOWS SERVICE)
  // ═══════════════════════════════════════════════════════════════════════
  {
    id: 'agent',
    title: 'Windows Agent',
    icon: 'Terminal',
    description: 'Install, configure, and manage the Resolv Windows Agent.',
    articles: [
      {
        id: 'agent-overview',
        title: 'Agent Overview',
        description: 'Understanding the Resolv Windows Agent.',
        content: `
          <h3>What is the Resolv Agent?</h3>
          <p>The Resolv Agent is a lightweight Windows service that runs on managed endpoints. It provides automated inventory discovery, real-time health monitoring, and remote management capabilities.</p>

          <h3>Features</h3>
          <ul>
            <li><strong>Auto-Discovery</strong> — Automatically detects and reports hardware and software inventory</li>
            <li><strong>Heartbeat Monitoring</strong> — 30-second liveness checks</li>
            <li><strong>Remote Commands</strong> — Execute scripts, install/uninstall software, control services, reboot/shutdown</li>
            <li><strong>Auto-Update</strong> — Seamlessly updates itself when a new version is released</li>
            <li><strong>Real-Time Communication</strong> — Persistent Socket.IO connection for instant commands</li>
          </ul>
        `,
        tags: ['agent', 'windows', 'service'],
      },
      {
        id: 'agent-install',
        title: 'Installation & Deployment',
        description: 'Install the agent on Windows endpoints.',
        content: `
          <h3>System Requirements</h3>
          <ul>
            <li>Windows 10/11 or Windows Server 2016+</li>
            <li>Administrator privileges for installation</li>
            <li>Network access to the Resolv server</li>
          </ul>

          <h3>Installation Methods</h3>

          <h4>1. Direct Download (from Resolv Web UI)</h4>
          <ol>
            <li>Go to <strong>Assets → Download Agent</strong> (or <strong>Admin → Agent Settings</strong>)</li>
            <li>Click <strong>Download Agent Installer</strong></li>
            <li>Run the downloaded <code>ResolvAgent.exe</code> on the target machine</li>
            <li>The agent will self-install as a Windows service</li>
          </ol>

          <h4>2. Bulk Deployment</h4>
          <p>For organization-wide deployment, use your existing software deployment tool (Group Policy, SCCM, Intune, etc.) to distribute and execute the installer.</p>

          <h4>3. Manual Installation</h4>
          <p>Copy the <code>ResolvAgent.exe</code> to the target machine, create a <code>config.json</code> with the appropriate settings, and run from an elevated command prompt. The agent will detect the config file and install itself.</p>

          <h3>What Gets Installed</h3>
          <ul>
            <li>Agent binary at <code>%ProgramData%\\Resolv\\Agent\\ResolvAgent.exe</code></li>
            <li>NSSM (Non-Sucking Service Manager) for service management</li>
            <li>Configuration at <code>%ProgramData%\\Resolv\\Agent\\config.json</code></li>
            <li>Windows service named <code>ResolvAgent</code></li>
            <li>Add/Remove Programs entry for easy uninstallation</li>
          </ul>

          <h3>Uninstallation</h3>
          <p>Run <code>ResolvAgent.exe --uninstall</code> from an elevated command prompt. This will:</p>
          <ul>
            <li>Stop and remove the Windows service</li>
            <li>Delete all agent files from ProgramData</li>
            <li>Remove the Add/Remove Programs entry</li>
          </ul>
        `,
        tags: ['install', 'deploy', 'setup', 'windows'],
      },
      {
        id: 'agent-commands',
        title: 'Remote Commands',
        description: 'Execute commands on managed endpoints.',
        content: `
          <h3>Remote Command Types</h3>
          <p>From the asset detail page, you can send the following commands to any agent-managed endpoint:</p>

          <table>
            <tr><th>Command</th><th>Description</th></tr>
            <tr><td><code>run_script</code></td><td>Execute PowerShell or batch scripts on the remote machine</td></tr>
            <tr><td><code>install_software</code></td><td>Download and install software (MSI/exe/winget)</td></tr>
            <tr><td><code>uninstall_software</code></td><td>Uninstall software by finding the uninstall string in registry</td></tr>
            <tr><td><code>restart_service</code></td><td>Restart a Windows service</td></tr>
            <tr><td><code>stop_service</code></td><td>Stop a Windows service</td></tr>
            <tr><td><code>start_service</code></td><td>Start a Windows service</td></tr>
            <tr><td><code>collect_logs</code></td><td>Collect Windows Event Log entries with filters</td></tr>
            <tr><td><code>reboot</code></td><td>Reboot the remote machine</td></tr>
            <tr><td><code>shutdown</code></td><td>Shut down the remote machine</td></tr>
          </table>

          <h3>Command Lifecycle</h3>
          <ol>
            <li>Admin/agent sends a command from the asset detail page</li>
            <li>Command is queued on the server</li>
            <li>Agent polls for pending commands on its next heartbeat</li>
            <li>Agent executes the command and reports results</li>
            <li>Result appears in the asset activity log</li>
          </ol>
        `,
        tags: ['commands', 'remote', 'powershell'],
      },
      {
        id: 'agent-auto-update',
        title: 'Agent Auto-Update',
        description: 'How agent updates work and how to ship updates.',
        content: `
          <h3>How Auto-Update Works</h3>
          <ol>
            <li>An admin registers a new agent version in <strong>Admin → Agent Versions</strong></li>
            <li>On the next heartbeat (within 30 seconds), the server tells the agent an update is available</li>
            <li>The agent downloads the new binary, verifies the SHA-256 checksum, and replaces itself</li>
            <li>The service restarts with zero manual intervention</li>
          </ol>

          <h3>Shipping a New Agent Version</h3>
          <ol>
            <li>Update the version number in <code>package.json</code> and <code>agent.js</code></li>
            <li>Run the build: <code>npm run build</code></li>
            <li>Compute the SHA-256 checksum (use Node.js, not PowerShell):
              <pre><code>node -e "console.log(require('crypto').createHash('sha256').update(require('fs').readFileSync('dist/ResolvAgent.exe')).digest('hex'))"</code></pre>
            </li>
            <li>Create a database migration to register the new version with <code>is_latest = true</code></li>
            <li>Run the migration — agents auto-update within 30 seconds</li>
          </ol>

          <div class="note">
            <strong>⚠️ Important:</strong> The checksum must be <strong>lowercase</strong> hex. PowerShell's <code>Get-FileHash</code> returns uppercase, which will cause the update to fail. Always use Node.js to compute checksums.
          </div>

          <h3>Rollout Control</h3>
          <p>Use the <code>rollout_percentage</code> field to gradually roll out updates (e.g., 10% → 50% → 100%) to catch issues early.</p>
        `,
        tags: ['update', 'auto-update', 'rollout', 'version'],
      },
    ],
  },

  // ═══════════════════════════════════════════════════════════════════════
  // FAQ & TROUBLESHOOTING
  // ═══════════════════════════════════════════════════════════════════════
  {
    id: 'faq',
    title: 'FAQ & Troubleshooting',
    icon: 'HelpCircle',
    description: 'Frequently asked questions and common solutions.',
    articles: [
      {
        id: 'faq-general',
        title: 'General FAQ',
        description: 'Common questions about using Resolv.',
        content: `
          <h3>How do I reset my password?</h3>
          <p>On the login page, click <strong>"Forgot Password"</strong> and enter your email address. You'll receive a password reset link. If you don't receive the email, contact your administrator.</p>

          <h3>I can't log in — what should I do?</h3>
          <ul>
            <li>Check that you're using the correct URL for your organization's Resolv instance</li>
            <li>Try the "Forgot Password" option</li>
            <li>If using SSO, contact your IT team to verify SSO is configured correctly</li>
            <li>Contact your administrator to check if your account is locked or disabled</li>
          </ul>

          <h3>How do I change my email address?</h3>
          <p>Go to <strong>Settings → Profile</strong>. If you're a regular user, you may need to ask an admin to change your email. Admins can change their own email directly.</p>

          <h3>What's the difference between an Incident and a Service Request?</h3>
          <p><strong>Incident</strong>: An unplanned event that disrupts service (e.g., "Can't access email"). <strong>Service Request</strong>: A pre-defined request for standard service (e.g., "I need a new monitor"). Incidents are unplanned; service requests are part of normal operations.</p>

          <h3>How do I get notified about ticket updates?</h3>
          <p>Configure your notification preferences in <strong>Settings → Notifications</strong>. You can enable in-app pop-ups and email notifications for various ticket events.</p>

          <h3>Can I use Resolv on mobile?</h3>
          <p>Resolv is a web application accessible from any modern browser on desktop or mobile. The interface is responsive and works on tablets and phones. There is currently no native mobile app.</p>
        `,
        tags: ['faq', 'general', 'password', 'login'],
      },
      {
        id: 'faq-agent',
        title: 'Agent Troubleshooting',
        description: 'Common issues with the Windows Agent.',
        content: `
          <h3>Agent is showing as offline</h3>
          <ul>
            <li>Check that the Windows service is running: <code>Get-Service ResolvAgent</code></li>
            <li>Verify network connectivity to the Resolv server</li>
            <li>Check the agent logs in <code>%ProgramData%\\Resolv\\Agent\\</code></li>
            <li>Restart the service: <code>Restart-Service ResolvAgent</code></li>
          </ul>

          <h3>Agent won't install</h3>
          <ul>
            <li>Make sure you're running as Administrator</li>
            <li>Check that the agent secret is correct</li>
            <li>Verify the server URL is accessible from the target machine</li>
            <li>Check for antivirus or security software blocking the installation</li>
          </ul>

          <h3>Auto-update failed</h3>
          <ul>
            <li>This is usually caused by a mismatched SHA-256 checksum</li>
            <li>Ensure the checksum in the database is <strong>lowercase</strong> hex</li>
            <li>Verify the update URL is accessible from the target machine</li>
            <li>Check that the rollout percentage includes this machine</li>
          </ul>

          <h3>Agent not reporting inventory</h3>
          <ul>
            <li>Check that the agent service is running</li>
            <li>Verify the check-in interval setting</li>
            <li>Check for errors in the agent logs</li>
            <li>Force a check-in from the server (asset detail page or admin panel)</li>
          </ul>
        `,
        tags: ['faq', 'agent', 'troubleshooting', 'offline'],
      },
    ],
  },
];

// ─── Helper: search across all documentation ──────────────────────────────
export interface SearchResult {
  sectionId: string;
  sectionTitle: string;
  sectionIcon: string;
  articleId: string;
  articleTitle: string;
  description: string;
  excerpt: string;
}

export function searchDocs(query: string, userRole?: string): SearchResult[] {
  if (!query || query.length < 2) return [];

  const q = query.toLowerCase();
  const results: SearchResult[] = [];

  for (const section of docSections) {
    // Skip sections this role can't access
    if (!canAccess(userRole, section.minRole)) continue;
    for (const article of section.articles) {
      // Skip articles this role can't access
      if (!canAccess(userRole, article.minRole)) continue;

      const inTitle = article.title.toLowerCase().includes(q);
      const inDesc = article.description.toLowerCase().includes(q);
      const inContent = article.content.toLowerCase().includes(q);
      const inTags = (article.tags || []).some(t => t.toLowerCase().includes(q));

      if (inTitle || inDesc || inContent || inTags) {
        // Extract a relevant excerpt from content
        let excerpt = '';
        if (inContent) {
          const idx = article.content.toLowerCase().indexOf(q);
          const start = Math.max(0, idx - 60);
          const end = Math.min(article.content.length, idx + q.length + 100);
          excerpt = (start > 0 ? '…' : '') +
            article.content.slice(start, end).replace(/<[^>]+>/g, ' ').trim() +
            (end < article.content.length ? '…' : '');
        } else {
          excerpt = article.description;
        }

        results.push({
          sectionId: section.id,
          sectionTitle: section.title,
          sectionIcon: section.icon,
          articleId: article.id,
          articleTitle: article.title,
          description: article.description,
          excerpt: excerpt.slice(0, 200),
        });
      }
    }
  }

  return results;
}
