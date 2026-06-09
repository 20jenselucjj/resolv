# ITSM Reporting & Analytics: Competitive Research

> **Objective:** Document how leading ITSM platforms handle reporting and analytics to identify best-in-class patterns worth adopting.
>
> **Date:** 2026-06-09
> **Researched Platforms:** ServiceNow, Jira Service Management, Freshservice, Zendesk Explore, BMC Helix, Ivanti

---

## Table of Contents

1. [ServiceNow — Performance Analytics & Platform Analytics](#1-servicenow)
2. [Jira Service Management — Dashboards, Reports & Insights](#2-jira-service-management)
3. [Freshservice — Analytics, SLA Tracking & Freddy AI](#3-freshservice)
4. [Zendesk Explore — Analytics & Reporting](#4-zendesk-explore)
5. [BMC Helix — Dashboards & Smart Reporting](#5-bmc-helix)
6. [Ivanti Neurons for ITSM — Analytics & AI Dashboards](#6-ivanti)
7. [Cross-Platform Comparison Matrix](#7-cross-platform-comparison)
8. [Key Findings & Recommendations](#8-key-findings--recommendations)

---

## 1. ServiceNow

### Architecture Overview

ServiceNow has three tiers of reporting capability:

| Tier | Name | License | Purpose |
|------|------|---------|---------|
| **Base** | Reporting | Included (being deprecated) | Basic charts/tables from current data |
| **Modern** | Platform Analytics | Included | Modern UI layer, data visualizations, replaces Reporting |
| **Premium** | Performance Analytics (PA) | Paid add-on | Historical KPIs, forecasting, thresholds, scorecards |

**Key evolution:** Starting with the Australia release (2026), Platform Analytics becomes the default, and Performance Analytics capabilities (indicators, breakdowns, data collection jobs) are migrated under "Platform Analytics Administration." The Core UI dashboards/reports are deprecated.

### Key Report Types

- **Incident Management:** Open/closed incident volume, MTTR, reassignment count, backlog growth, priority distribution, ageing incidents
- **SLA Compliance:** SLA breach rate, SLA achievement %, at-risk items, trend by SLA policy
- **Change Management:** Change volume by type/risk, change failure rate, mean time to deploy, lead time
- **Problem Management:** Problem investigation count, known errors, recurring incident clusters
- **CSAT:** Customer satisfaction scores, survey response rates
- **Agent Performance:** Workload distribution, resolution time by agent, reassignment counts
- **Asset Management:** Inventory counts, lifecycle status, cost metrics
- **Service Catalog:** Request fulfillment rates, catalog item popularity

### Chart Types & Visualization Patterns

ServiceNow PA offers extensive visualization types:

| Category | Chart Types |
|----------|-------------|
| **Comparisons** | Column (grouped/stacked), Bar, Pie, Donut/Semi-Donut, Bubble |
| **Trends** | Line, Area (grouped/stacked), Time Series |
| **Progress** | Dial (goal progress), Indicator Scorecard (value + change + target + trend) |
| **Distribution** | Scatter, Boxplot, Heat Map, Geomap |
| **Tabular** | List (simple), Pivot Table, Scorecard |
| **Special** | Indicator scorecard (latest value, change since last period, target, trend line) |

**Best-in-class pattern:** The **Indicator Scorecard** — shows 4 data points simultaneously: current value, period-over-period change, target attainment, and trend direction. This is a highly effective operational metric widget.

### Export Capabilities

| Format | Report Export | Dashboard Export |
|--------|-------------|------------------|
| PDF | ✅ Yes | ✅ Yes |
| PPT | ❌ No | ✅ Yes |
| Excel/CSV | ✅ Yes | ❌ No (reports only) |
| Image | ✅ Yes | ✅ Yes (screenshot) |

- **Scheduled reports:** Configurable frequency (daily/weekly/monthly), time zone aware, email delivery with PDF/CSV/Excel attachments
- **Dashboard export:** Limited to PPT and PDF natively; individual report data can be exported as Excel/CSV
- **Note:** No native "export entire dashboard to Excel" — requires manual workaround or API-based extraction

### Data Integration

- **Bring Your Own Data:** Supports blending ServiceNow data with Excel worksheets or JDBC data sources
- **Integration with BI tools:** Common practice to export ServiceNow data to Power BI, Tableau, Yellowfin for advanced analytics
- **REST APIs:** Full API access for custom data extraction

### Dashboard Customization

- Role-based dashboards (executives vs. operational staff get different views)
- Duplicate standard dashboards to create custom versions
- Drag-and-drop layout editing with grid-based resizing
- Multi-tab dashboards
- In-form analytics (embed KPIs directly within record forms)
- **Spotlight:** AI-powered feature that ranks tasks/records based on business priorities

### Real-time vs. Historical

| Aspect | Standard Reporting | Performance Analytics |
|--------|-------------------|---------------------|
| Data view | Current snapshot | Historical trends & patterns |
| Real-time | Must refresh | Live dashboards |
| Forecasting | Not available | Built-in (time series forecasting) |
| Threshold alerts | Basic | Advanced with anomaly detection |

### AI/ML Capabilities

- **KPI Signals:** Automatic anomaly detection — alerts when KPI values hit highs, lows, or predefined limits
- **Forecasting:** Predictive analytics using historical data (e.g., predict incident volumes, SLA breaches)
- **Text analytics:** Extract insights from unstructured fields (comments, descriptions)
- **Predictive trending:** Regression band visualization to spot seasonal patterns
- **Limitations:** Basic compared to dedicated BI tools; no advanced ML modeling without third-party integration

### KPIs & Metrics Tracked

**Pre-built KPIs (600+):** Incident open/closed/resolved counts, SLA compliance %, MTTR, MTBF, backlog volume, reassignment rate, CSAT score, change success rate, change failure rate, request fulfillment time, asset utilization, knowledge article effectiveness.

### UX Patterns

- **Drill-down:** Click from high-level KPI → breakdown by category → individual records
- **Breakdowns:** Segment indicators by dimension (priority, assignment group, region, category)
- **Date ranges:** Configurable time periods with relative and absolute options
- **Filters:** Global dashboard-level filters + per-widget filters
- **Analytics Hub:** Immersive studio for KPI analysis with trends, forecasts, breakdowns, annotations
- **Mobile access:** View dashboards and respond to alerts on mobile

### Collaboration Features

- **Sharing:** Report/dashboard sharing with individuals, groups, or "Everyone"
- **Scheduling:** Automated email delivery of reports on recurring schedules
- **Annotations:** Add context/decisions directly within data visualizations
- **Role-based access:** Permissions controlled via user roles and ACLs

---

## 2. Jira Service Management

### Architecture Overview

JSM's reporting has three layers:

| Tier | Name | Availability |
|------|------|-------------|
| **Base** | Space/Project Reports | All plans |
| **Standard** | Dashboards (gadgets) | All plans |
| **Enterprise** | Atlassian Analytics | Cloud Enterprise plans only |

Atlassian Analytics is powered by the **Atlassian Data Lake** — all Atlassian tool data in one queryable location, enabling cross-product reporting.

### Key Report Types (as of 2025-2026)

**Default space/project reports:**
- Created vs. Resolved (request volume comparison)
- Time to Resolution (by type/priority)
- SLA Met vs. Breached
- SLA Success Rate
- Customer Satisfaction (average rating + breakdowns)
- Workload Distribution (by agent/team)
- Backlog Growth
- First Contact Resolution
- Incident Reports by Priority
- Resolution by Component
- Article Usage / Article Effectiveness
- Requests Created per Channel
- Change by Type (standard/normal/emergency)
- Time to Approve Normal Change

**New Summary Page metrics (2026, Premium/Enterprise):**
- Work item trends (open, resolved, incoming by priority/status/team/request type)
- SLA performance (achievement rates, breaches, at-risk items)
- CSAT (by agent, team, priority, request type)
- Backlog growth trends
- Agent workload distribution
- First contact resolution rates

### Chart Types & Visualization

- **OOTB:** Bar charts (vertical/horizontal/stacked), Pie charts, Line charts, Single value
- **Dashboards (gadgets):** Created vs. Resolved Chart, Average Age Chart, Resolution Time, Time to First Response, Recently Created Chart, Time Since Chart, Pie Chart, Issue Statistics, Two Dimensional Filter Statistics, Bubble Chart, Heat Map, Filter Counts, Workload Pie Chart, Sprint Burndown
- **Atlassian Analytics (Enterprise):** visualSQL builder for custom charts; 20+ visualization types
- **Format templates:** 18 pre-built templates for quick metric visualization

### Export Capabilities

| Format | Reports | Dashboards | Gadgets |
|--------|---------|-----------|---------|
| PDF | ✅ (print) | ✅ (via 3rd party) | ✅ (per gadget) |
| Excel/CSV | ✅ (CSV export) | ❌ Not natively | ✅ (Rich Filter → CSV) |
| Image | ❌ | ❌ | ❌ |

- **Scheduled reports:** Automation rules can export data on a schedule
- **Dashboard export to PDF:** Requires marketplace apps like Better PDF Exporter
- **CSV/Excel export:** Available at the gadget level (Rich Filter gadget) but not full dashboard
- **API access:** REST API for full programmatic data extraction
- **BI Connectors:** Marketplace offers connectors for Power BI, Tableau, Oracle Analytics, SAP Analytics Cloud

### Data Integration

- **Atlassian Data Lake (Enterprise):** Houses data from all Atlassian tools in one place
- **Custom data sources:** Can also connect Snowflake, Amazon Redshift, Microsoft SQL Server
- **3rd party apps:** Marketplace has extensive app ecosystem for extending reporting
- **BI tool connectors:** Power BI Connector, Tableau Connector, SQL Connector (Alpha Serve)

### Dashboard Customization

- **Space Summary Page (new, 2026):** Fully customizable with resize/move/organize, tabs, access controls
- **Pre-built dashboard templates:** Change Management Overview, Incident Management Overview, Request Management Overview, Service Desk Scorecards
- **Role-based views:** Different dashboards for agents, managers, admins
- **Multi-project dashboards:** Gadgets can aggregate across projects
- **Filters:** Chart-level filters, dashboard-level global filters (date range, assignee, work type, status, priority)
- **Templates & natural language:** Create charts from templates or via Rovo AI natural language prompts

### Real-time vs. Historical

- Dashboards provide **near-live** data (real-time updates within minutes)
- **Analytics app** pulls from Data Lake with periodic refresh
- Standard reports are point-in-time but refreshed on page load
- No true sub-minute real-time capability natively

### AI/ML Capabilities

- **Rovo AI:**
  - Natural language chart generation ("show me work items grouped by priority")
  - AI-assisted insights that surface trends, anomalies, patterns
  - Automated pattern detection (e.g., "this request category is receiving high volume")
  - Follow-up prompts for deeper exploration
- **Virtual agent dashboard:** AI-generated performance stats, knowledge gap identification
- **AI-generated summaries:** Request overviews with recommended next steps
- **Incident insights:** Automated alert grouping, change risk assessment, similar incident history, suggested responders
- **Agentic AI (Rovo Agents):** During incidents, can probe third-party sources for root cause, suggest playbooks

### KPIs & Metrics

- Request volume (created vs. resolved), SLA compliance rate, satisfaction rating, resolution rate, % reopened tickets, MTTR (response/resolution), FCR, backlog size, agent workload, change lead time, change failure rate, deployment frequency, incident frequency

### UX Patterns

- **Tabs:** Separate views for different workflows (incidents, changes, requests)
- **Global filters:** Top-of-page date range, assignee, work type, status, priority
- **Drill-down:** Click data points to see underlying issues
- **Default filter values:** Admins can set defaults for team landing page
- **JQL (Jira Query Language):** Power users can create custom series/views with advanced filtering
- **Presentation mode:** Some dashboard types support slideshow presentation

### Collaboration Features

- **Sharing:** Share dashboards with users/groups; public links available via marketplace apps
- **Scheduling:** Automation rules can email reports on schedule
- **Embedded reporting:** Atlassian Analytics dashboards embeddable in Confluence pages, Atlas tickets, Trello cards
- **Customer portal sharing:** Limited OOTB; requires marketplace apps for external sharing
- **Access control:** View/edit permissions per tab on Summary page

---

## 3. Freshservice

### Architecture Overview

Freshservice Analytics is built into the platform with three key layers:

| Feature | Availability | Description |
|---------|-------------|-------------|
| **Analytics Pro** | Pro/Enterprise | Full report builder with widgets |
| **Freddy AI Insights** | Enterprise | AI-powered anomaly detection, root cause analysis |
| **Executive Insights** | Enterprise | CXO-level strategic analytics across workspaces |
| **Custom Metrics/Attributes** | Pro/Enterprise | Define custom KPIs using formulas |

### Key Report Types

- **SLA Reports:** Resolution SLA violated tickets, first response SLA, tickets within/beyond SLA
- **Incident Trends:** Ticket volume over time, by priority/category/group
- **Agent Performance:** Resolution time by agent, response time, first response time, agent workload
- **CSAT/Survey Scores:** Survey score averages, trends
- **Backlog Analysis:** Ageing tickets, unassigned tickets, unresolved tickets
- **Problem Management:** Problem investigation stats, known errors
- **Change Management:** Change volume, success/failure rates
- **Asset Management:** Asset lifecycle, inventory counts
- **Reopened Tickets:** Reopen rate and patterns
- **Channel Analysis:** Tickets by source (email, portal, chat, phone)

### Chart Types & Visualization

Freshservice Analytics Pro supports multiple widget types including bar, column, line, pie, area, funnel, metric tiles, pivot tables, and data tables. The gallery offers popular widget templates plus ability to create from scratch.

### Export Capabilities

| Format | Reports | Widgets | Scheduled |
|--------|---------|---------|-----------|
| PDF | ✅ Yes | ✅ Yes (graph + tabular) | ✅ Yes |
| CSV | ✅ Yes | ✅ Yes (tabular data) | ✅ Yes |
| Excel | ✅ Yes | ❌ | ✅ Yes |

- **Scheduling:** Daily/weekly/monthly delivery, configurable days of week, time zone aware
- **Scheduled Data Export (BI integration):** Full database-level exports via email or API URL for Power BI/other BI tools
- **Export options per widget:** CSV of tabular data, PDF of graph, PDF of graph + tabular data combo
- **Recipients:** Can include users without Freshservice accounts (external stakeholders)

### Data Integration

- **Scheduled Data Export API:** Direct API URL for BI tools to auto-fetch data
- **Custom Metrics & Attributes:** Formula-based (arithmetic, logical, date, string functions) on existing metrics
- **Modules exported:** Tickets, Problems, Changes, Releases, Tasks, Assets, Users, Groups, Survey Questions, Virtual Agent

### Dashboard Customization

- **Report-level customization:** Multi-widget report pages with grid layout
- **Widget types:** Chart, metric, text, image
- **Filters:** Global report filters + per-widget filters
- **Presentation mode:** Slideshow with configurable timing (5/10/15/30/60 sec), pause, skip
- **Bookmarks:** Save dashboard filter states
- **Instant Navigator:** Quick search and access across all reports

### Real-time vs. Historical

- **Freddy AI Insights:** Generated daily or weekly (not real-time)
- **Executive Insights:** Daily/weekly cadence, not real-time
- **Analytics Pro reports:** Near real-time (pulls from current data)
- Standard reporting dashboards show current data on load

### AI/ML Capabilities (Freddy AI)

**Freddy AI Insights** (Enterprise) is the most differentiated AI capability across all researched platforms:

**Proactive Insight Types:**
1. **Majority:** "80% of ITOps team's SLA-violated tickets are from Hardware category"
2. **Outlier:** Detects unusually large/small values in a timeframe
3. **Spike/Drop:** "15% spike was observed in ITOps Average Resolution Time"
4. **Longest Increase/Decrease:** Sustained growth or drop periods
5. **Change:** Point-to-point metric movement tracking
6. **Trend:** Upward/downward movement detection

**Root Cause Analysis:**
- Tree map visualization of contributing factors
- Natural language summary of root causes
- Recommended actions

**Executive Insights:**
- Aggregated view across workspaces
- "What Went Well" / "Area of Concern" AI-generated callouts
- Top 5 Trending Issues with % change
- Bottom/top performer breakdowns by agent group and individual agent
- Show Root Cause button for deep RCA

**Conversational Insights:**
- Natural language queries (e.g., "Show me the top four agents with the highest resolution time")
- Real-time chart generation from plain English

**Metrics supported for AI Insights:**
- Resolution SLA Violated Tickets
- First Response SLA Violated Tickets
- Average Resolution Time
- Average Response Time
- Ticket volume metrics

### KPIs & Metrics

Comprehensive metric library organized by module:

**Tickets:** # Tickets, Resolution Time (Bhrs/Chrs), First Response Time (Bhrs/Chrs), Response Time, Reopen Count, Agent Reply Count, Public Notes Count, Escalation Count, Survey Score, Task Count, Overall Time Spent

**SLA:** Resolution SLA violated, First Response SLA violated, Tickets within SLA, SLA breach elapsed time

**Agents:** Agent workload, Agent Time Spent, First Response Compliance, Resolution Compliance

### UX Patterns

- **Instant Navigator:** Hamburger menu for quick report search/filter/sort
- **Cleaner UI (updated):** Minimalist top nav, contextual side panels
- **Drill-down from report page:** Click to view underlying data without opening separate widget
- **Widget expansion:** View widgets full-screen from report page
- **Single-click editing:** Edit widget in side panel while viewing report
- **Gallery:** Browse pre-built widget templates
- **Filtered views:** Personalized, persistent views across sessions

### Collaboration Features

- **Sharing:** Share reports with specific users (view/edit/manage permissions)
- **Private by default:** Reports are private until explicitly shared
- **Scheduling:** Email PDF/CSV/XLS to internal and external recipients
- **Presentation mode:** Slideshow for team reviews
- **Public/private reports:** Toggle visibility

---

## 4. Zendesk Explore

### Architecture Overview

| Tier | Name | Key Features |
|------|------|-------------|
| **Standard** | Explore (included in Suite) | Prebuilt dashboards, basic reports |
| **Professional** | Explore Pro | Custom dashboards, reports, 500+ config options |
| **Enterprise** | Explore Enterprise | Advanced sharing, end-user scheduling, brand permissions |

Zendesk is transitioning to a **new dashboard builder** (released Nov 2024) with legacy builder available until Dec 2026.

### Key Report Types

**Prebuilt dashboards cover:**
- **Support:** Ticket volume, agent activity, SLA performance, CSAT, backlog history
- **Talk:** Call volume, duration, agent talk time, call abandonment
- **Chat/Messaging:** Chat volume, wait times, agent occupancy
- **Guide:** Knowledge base article views, search analytics, article effectiveness
- **AI/Copilot:** AI agent performance, automated resolution rates, deflection metrics
- **Real-time monitoring:** Incoming tickets, ticket progress, agent productivity (live dashboards)

**Recipe library (community-contributed report templates):**
- Time tracking & efficiency
- Customer satisfaction
- Agent productivity
- Omnichannel routing performance
- Custom tickets field reports
- Article effectiveness

### Chart Types & Visualization

**20+ visualization types:**
- **Trend comparisons:** Line, area, stepped line, dual-axis
- **Metric comparisons:** Bar, column, stacked, waterfall, bullet
- **Category comparisons:** Pie, donut, treemap, word cloud
- **Value-to-total:** Stacked percentage, ring, gauge
- **Workflow:** Funnel, Sankey
- **Tabular:** Pivot table, data table, heatmap table
- **Special:** Scatter, bubble, geo map, single value/metric tile

**Intelligent visualization selector:** Auto-selects optimum chart type based on data structure.

### Export Capabilities

| Format | Reports | Dashboard Tabs | Scheduled |
|--------|---------|---------------|-----------|
| CSV | ✅ Yes | ✅ Yes | ✅ Yes (.zip) |
| Excel | ✅ Yes | ✅ Yes (multi-tab) | ✅ Yes (.xlsx) |
| PDF | ✅ Yes | ✅ Yes | ✅ Yes (single PDF, all tabs) |
| PNG | ✅ Yes (image) | ✅ Yes | ✅ Yes |
| ZIP | ❌ | ✅ (multiple CSVs) | ✅ (for CSV) |

- **Scheduled delivery:** Frequency configurable, up to 12 months duration
- **Attachment limit:** 25 MB (splits into multiple emails if exceeded)
- **End-user scheduling:** Enterprise plan can schedule to external customers
- **Embedded dashboards:** OOTB support (unlike most competitors)

### Data Integration

- **Datasets by product:** Support, Talk, Chat, Messaging, Guide, Copilot, AI
- **SQL filtering:** Advanced users can use SQL to filter reports
- **Custom metrics & attributes:** Formula-based custom calculations
- **No built-in BYO data** (limited to Zendesk product data)
- **Scheduled Data Exports:** API-based extraction for BI tools

### Dashboard Customization

**New dashboard builder features:**
- **Templates:** Speed up dashboard creation
- **Tabs:** Multi-tab dashboards
- **Interactive components:** Time filter, data filter, change metric, change attribute widgets
- **Dynamic restrictions:** Dashboard adapts based on logged-in user (agent sees own metrics only)
- **Static restrictions:** Filter by team, location, brand
- **Bookmarks:** Save filtered view states
- **Text, images, GIFs, shapes:** Rich annotation support
- **Role-based per dashboard:** Granular access control

**Best-in-class feature:** **Dashboard Restrictions** — create a single dashboard template that dynamically shows different data to different users based on role, group, or brand. Eliminates dashboard duplication.

### Real-time vs. Historical

- **Real-time monitoring dashboards:** Live agent status, incoming tickets, ticket progress, agent productivity (dedicated real-time views)
- **Standard dashboards:** Hourly data refresh (Enterprise: configurable)
- **Scheduled dashboards:** Data snapshot at time of generation
- **Limitation:** Real-time views are limited to specific dashboard types

### AI/ML Capabilities

- **AI-powered quick reports:** Create reports via natural language (AI agent for report building)
- **Forecasting:** Holt-Winters forecasting model; "What if" analysis
- **Intelligent triage dashboard:** AI-driven ticket routing insights
- **Copilot analytics:** AI agent performance metrics and dashboards
- **Trend line analysis:** Advanced trend line with statistical models
- **No anomaly detection** natively (compared to Freshservice Freddy AI)

### KPIs & Metrics

**Rich metrics library per dataset:**
- **Support:** Ticket count, resolution time, first reply time, full resolution time, reopen rate, SLA breach count, CSAT score, agent touches, group/assignee workload
- **Talk:** Call count, talk time, hold time, abandonment rate, wait time
- **Chat/Messaging:** Conversation count, response time, agent occupancy
- **Guide:** Article views, search count, search results clicked, votes
- **AI:** Copilot interactions, deflection rate, automated resolution count

### UX Patterns

- **Drag-and-drop chart builder:** Simple drag-and-drop report creation
- **Datatips:** Hover-over information on chart elements
- **Drill-in:** Click chart elements to refine/re-filter the view
- **Metric/attribute toggles:** Interactive "change metric" / "change attribute" widgets
- **Filter linking:** Dashboard-level filters can be linked across tabs
- **Exclude from filters:** Ability to exclude individual reports from global filters
- **Grid layout:** Snap-to-grid for precise widget arrangement
- **Live data components:** Special widgets for real-time data streams

### Collaboration Features

- **Sharing:** Share with individuals, groups, or public links (external sharing)
- **Scheduling:** Email delivery on recurring basis; Enterprise can send to end users
- **Embedded dashboards:** Embed in websites/external portals
- **Bookmarks:** Save and share filtered dashboard states
- **Dashboard activity log:** Audit trail of changes
- **Version control:** Track dashboard changes over time
- **Collaboration comments:** Not natively supported in dashboards (unlike Freshservice)

---

## 5. BMC Helix

### Architecture Overview

BMC Helix has been consolidating its reporting stack:

| Legacy | Current | Direction |
|--------|---------|-----------|
| BIRT (Business Intelligence & Reporting Tools) | **BMC Helix Dashboards** (Grafana-based) | BIRT EOL November 2025 |
| Smart Reporting (Yellowfin-based) | BMC Helix Dashboards | Migrating |
| SAP Business Objects / BMC Analytics | BMC Helix Dashboards | Already obsolete |

**BMC Helix Dashboards** is the unified reporting solution, based on Grafana technology, serving all BMC Helix products (ITSM, AIOps, CMDB, Digital Workplace, etc.).

### Key Report Types

**OOTB Dashboards:**
- **Count of ITSM Tickets and Requests:** Incidents, change requests, service requests, problem investigations, known errors, work orders, releases, purchase requests — all by priority/status with 12-month trends
- **Proactive Problem Management Advanced Analytics:** Incident volume by assigned group, service CI, operational categorization, product categorization
- **ITSM Insights Dashboard:** Problem investigations, job executions, parent relationships, clusters with most incidents
- **Change Calendar:** Calendar view of change requests
- **Service Level Management:** SLA compliance metrics

**BIRT/Smart Reporting (legacy):**
- Incident Management KPIs (MTTR)
- Change Management KPIs
- Custom cross-application reports

### Chart Types & Visualization

Built on **Grafana** — provides industry-standard visualization options:
- Bar charts (vertical/horizontal), pie charts, line/area charts, stat panels, gauges, tables, heat maps, geographic maps
- **BMC Table plugin:** Enhanced with column hide/show, word wrap, aggregate functions (mean, median, min, max), barcode generation, footer totals
- **Calendar plugin:** Day/week/month/year views for event data
- **Cross-Tab plugin:** Pivot table support
- **Numeric Display → Stat:** Legacy numeric displays convert to stat panels

### Export Capabilities

| Format | Panels | Dashboards | Scheduled |
|--------|--------|-----------|-----------|
| PDF | ✅ Yes | ✅ Yes | ✅ Yes |
| CSV | ✅ Yes | ✅ Yes | ✅ Yes |
| Excel | ✅ Yes | ✅ Yes | ✅ Yes |
| Image | ✅ (PNG) | ✅ | ❌ |

- **PDF export enhancements:** Recent improvements for tabular reports in PDF
- **Scheduling:** Recurring email delivery with configurable format
- **Broadcast scheduling:** Legacy scheduled reports migrate with broadcast list data

### Data Integration

- **Visual Query Builder:** Drag-and-drop query builder for creating data sources
- **Multiple data sources:** BMC Helix ITSM, CMDB, Digital Workplace, AIOps, Vulnerability Resolver + external via Grafana connectors
- **Global constraints:** Admin-defined conditions applied to every query (e.g., "company = X")
- **Semantic layer:** Enriched field metadata for AI query understanding
- **Cross-solution dashboards:** Combine data from multiple BMC Helix products in one dashboard

### Dashboard Customization

- **OOTB dashboards:** Pre-built for ITSM, CMDB, Digital Workplace, AIOps
- **Role-based access control:** Admin, Editor, Viewer + custom roles with granular permissions
- **Multi-tenant/MSP support:** Single dashboard with subtenant data isolation
- **Variables:** Configurable filter variables at dashboard level
- **Inline filtering:** Column-level filter on table results
- **Global constraints:** Organizations can enforce data-scoping rules on all reports

### Real-time vs. Historical

- Depends on data source configuration
- Some dashboards support near-real-time (AIOps, monitoring data)
- Scheduled snapshots for historical analysis
- BIRT KPIs had flashboard-based historical capture (MTTR)

### AI/ML Capabilities

**HelixGPT Insight Finder** (25.2+):

- Natural language → dashboard generation ("Show me incidents by priority")
- Supports ITSM, CMDB, Digital Workplace, AIOps, Vulnerability Resolver
- AI determines best visualization format
- Follow-up prompts for refinement ("Add Company and Site, keep existing columns")
- Streaming support (25.3+): Real-time status during processing
- Context-aware: Remembers previous query context
- Suggested follow-up prompts for deeper analysis

**Example prompts:**
- "Analyze the top 3 trends in incident volume this week"
- "Show me the count of changes by assigned group and risk level"
- "Show me incidents where responded on same day as submitted"
- "How many incidents are open for more than a week but less than two weeks?"

**Limitations:** Insight Finder dashboards may not support all manual dashboard features.

### KPIs & Metrics

- Incident volume, MTTR, change success rate, change failure rate, SLA compliance %, problem investigation count, known errors, CMDB CI counts, service availability, asset lifecycle counts

### UX Patterns

- **Visual Query Builder:** Drag-and-drop field selection with live preview
- **Global constraints:** Automatic data scoping per organization
- **BMC Table plugin features:** Column hide/show, aggregate footer, barcode generation, inline filtering
- **Multi-panel dashboards:** Grafana grid layout
- **Dashboard variables:** Templated filters for dynamic dashboard views

### Collaboration Features

- **Role-based access:** Granular custom roles (admin/editor/viewer + custom)
- **Dashboard sharing:** Share with roles/groups
- **Scheduled exports:** Email delivery with format selection
- **Managed service provider (MSP) support:** Subtenant data isolation in shared dashboards
- **Migration tool:** From Smart Reporting to Helix Dashboards with folder structure preservation

---

## 6. Ivanti

### Architecture Overview

Ivanti Neurons for ITSM uses **Analytic Metrics** and **Dashboards (V2)** as its reporting framework:

| Feature | Availability |
|---------|-------------|
| **Analytic Metrics (Legacy)** | All tiers |
| **Dashboard V2** | All tiers, recommended |
| **Neurons AI** | Premium/Enterprise (2024.2+) |
| **Third-party BI integration** | All tiers |

Ivanti is deprecating older dashboard versions in favor of **Dashboard V2** with AI capabilities.

### Key Report Types

**OOTB Default Dashboards:**
- Service Desk Analyst/Manager dashboards
- Incident Survey dashboards
- Configuration Management dashboards
- Change Enablement dashboards
- Problem Management dashboards
- Release Management dashboards
- Asset/Inventory Management dashboards
- Knowledge Management dashboards
- Portfolio/Project Management dashboards
- Cost Management dashboards
- Call Log dashboards
- Service Consumption Analytics

**Metrics available:**
- Incident counts by priority/status/group/owner
- SLA compliance %
- Service availability (reliability, maintainability, AST, uptime)
- Survey satisfaction rates
- Asset counts by type/vendor/status
- Change volume by type
- Cost analytics (ITFM): budget vs. actual, trending, consumption
- Business value metrics

### Chart Types & Visualization

**10 chart types supported:**
- Vertical Bar, Horizontal Bar, Stacked Bar, Line, Pie, Donut, Area, Gauge, Table, Single Value (Stat)
- Multiple series support: Compare data from multiple sources/objects on one chart
- **Sparklines:** Trend visualization in cluster/table views

### Export Capabilities

| Format | Charts | Dashboards | Scheduled |
|--------|--------|-----------|-----------|
| Image (PNG) | ✅ Save as Image | ✅ | ❌ |
| PDF | ❌ (export to Image only) | ❌ | ❌ |
| CSV/Excel | ❌ | ❌ | ❌ |

- **Export limitations:** Only "Save as Image" is natively supported
- **Third-party BI integration:** For advanced export/reporting, export data to external BI tools
- **Neurons AI widgets:** Quick export to image for use in presentations

### Data Integration

- **Business Objects (BO):** All ITSM data objects available as data sources
- **Saved searches:** Saved search results can be used as data sources
- **Multiple data sources per chart:** Split series from different BOs
- **Third-party BI integration:** Export ITSM data to external BI tools
- **REST API:** GetBusinessObjectMetadata API for programmatic access

### Dashboard Customization

- **Dashboard V2:** Modern drag-and-drop interface
- **Role-based dashboards:** Configure viewers per role; publish to specific roles
- **Global Dashboard Filters** (2025.3+): Cross-dashboard filtering
- **Widget types:** Charts, pivot tables, tree views, metric tiles
- **Role-aware publishing:** Default viewers per role setting
- **Personalization:** Users can pin, clone, resize components

### Real-time vs. Historical

- **Real-time:** Access real-time transaction data from operational activities
- **Historical metrics:** Track data over specified time periods (trend data collection with configurable start dates)
- **Refresh interval:** Analytic Metrics dashboards update every 60 minutes (not configurable)
- **Threshold-based alerts:** Visual cues when KPIs exceed defined limits

### AI/ML Capabilities

**Neurons AI (2024.2+, Premium/Enterprise):**

- **Natural language widget creation:** "Show all service requests grouped by status" → auto-generates chart
- **Best-fit visualization:** AI selects optimum chart type (pie, bar, line, or table)
- **Post-generation editing:** Change widget type, refresh data, toggle legend, export to image
- **AI Configuration Hub:** Central toggle for all AI features; includes AI performance indicators (articles generated, tracking over 7d/1mo/1yr)

**Sample prompts:**
- "Show me all changes where status is 'Logged' and type is 'Major'"
- "I want to see all change records grouped by priority, ordered in descending"
- "Show me all incidents created between 1st January and 1st June 2011"
- "Show me top 5 changes by category"

**Limitations:**
- Prompts must reference Business Object names and field names
- Only works with ITSM data
- AI requires Premium/Enterprise license

### KPIs & Metrics

**Service Management:** Incident count, MTTR, SLA compliance, reassignment rate, survey score, backlog size
**Availability:** Actual availability %, reliability, maintainability, total down time, AST (Agreed Service Time), target availability %
**Cost:** Budget vs. actual, cost savings, consumption trends
**ITFM:** Cost analytics, trending, budget variance
**Configuration:** CI count by type/status, software inventory by vendor

### UX Patterns

- **Dashboard V2:** Modern responsive grid layout
- **Global Dashboard Filters:** Filter across all dashboard widgets
- **Role-aware defaults:** Different default views per role
- **Split Series:** Compare multiple data sources on one chart
- **Drill-down:** Click chart elements to view underlying detail data
- **Hide null/zero values:** Toggle to simplify visualizations
- **Action triggers:** Configure actions when metric conditions are met

### Collaboration Features

- **Role-based publishing:** Publish dashboards to specific roles
- **Save as Image:** Quick sharing for presentations
- **Personal dashboards:** Users can create private dashboards
- **AI Configuration Hub:** Central management of AI features with usage metrics
- **Limited sharing:** No native scheduled email delivery or external sharing (relies on BI tool integration)

---

## 7. Cross-Platform Comparison Matrix

### Core Capabilities

| Capability | ServiceNow | Jira SM | Freshservice | Zendesk Explore | BMC Helix | Ivanti |
|---|---|---|---|---|---|---|
| **Pre-built ITSM reports** | 600+ KPIs | 15+ default | Extensive library | Extensive library | OOTB dashboards | Role-specific defaults |
| **Custom report builder** | ✅ | ✅ (JQL) | ✅ (Analytics Pro) | ✅ | ✅ (VQB) | ✅ (Analytic Metrics) |
| **Natural language AI** | ❌ (No native) | ✅ (Rovo) | ✅ (Freddy AI) | ✅ (Quick reports) | ✅ (HelixGPT) | ✅ (Neurons AI) |
| **Dashboard builder** | Platform Analytics | Gadgets/Summary | Widget-based | New builder | Grafana-based | Dashboard V2 |
| **Multi-source data** | JDBC, Excel | Data Lake | API export | Zendesk only | Grafana connectors | Saved searches |
| **Mobile access** | ✅ | ✅ | ✅ | ✅ | Limited | Limited |

### Export & Delivery

| Capability | ServiceNow | Jira SM | Freshservice | Zendesk Explore | BMC Helix | Ivanti |
|---|---|---|---|---|---|---|
| **PDF export** | ✅ | ⚠️ (3rd party) | ✅ | ✅ | ✅ | ❌ (Image only) |
| **Excel export** | ✅ (per report) | ❌ (Dashboard) | ✅ | ✅ | ✅ | ❌ |
| **CSV export** | ✅ | ✅ (per gadget) | ✅ | ✅ | ✅ | ❌ |
| **Scheduled delivery** | ✅ | ⚠️ (automation) | ✅ (email+API) | ✅ | ✅ | ❌ |
| **External sharing** | ❌ | ⚠️ (marketplace) | ✅ (email) | ✅ (public links) | ❌ | ❌ |
| **BI tool integration** | Manual/API | Connectors | API URL | Manual/API | Grafana | 3rd party |

### AI/ML Capabilities

| Capability | ServiceNow | Jira SM | Freshservice | Zendesk Explore | BMC Helix | Ivanti |
|---|---|---|---|---|---|---|
| **Anomaly detection** | ⚠️ (KPI Signals) | ⚠️ (Rovo patterns) | ✅ (Freddy AI) | ❌ | ❌ | ❌ |
| **Forecasting** | ✅ (time series) | ❌ | ❌ | ✅ (Holt-Winters) | ❌ | ❌ |
| **Root cause analysis** | ❌ | ⚠️ (Rovo agent) | ✅ (Tree map + NLP) | ❌ | ❌ | ❌ |
| **NL chart creation** | ❌ | ✅ (Rovo) | ✅ (Ask Freddy) | ✅ (Quick reports) | ✅ (HelixGPT) | ✅ (Neurons AI) |
| **Proactive insights** | ⚠️ (threshold alerts) | ✅ (AI insights) | ✅ (Trend detection) | ❌ | ❌ | ❌ |

### Dashboard Interactivity

| Capability | ServiceNow | Jira SM | Freshservice | Zendesk Explore | BMC Helix | Ivanti |
|---|---|---|---|---|---|---|
| **Drill-down** | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ |
| **Global filters** | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ (2025.3+) |
| **Multi-tab** | ✅ | ✅ | ✅ | ✅ | ✅ | ❌ |
| **Role-based views** | ✅ | ✅ | ✅ | ✅ (Dynamic) | ✅ | ✅ |
| **Embedded in forms** | ✅ (In-form) | ❌ | ❌ | ❌ | ❌ | ❌ |
| **Annotations** | ✅ | ❌ | ❌ | ❌ | ❌ | ❌ |

---

## 8. Key Findings & Recommendations

### Best-in-Class Patterns Worth Adopting

#### 1. AI-Powered Anomaly Detection (Freshservice model)

**What they do:** Freddy AI proactively surfaces trends, outliers, spikes, and root causes without the user asking. It categorizes insights by type (Majority, Outlier, Spike/Drop, Trend) and color-codes by criticality.

**Why it's best:** Unlike other platforms where AI requires a prompt (Jira Rovo, BMC HelixGPT, Ivanti Neurons), Freshservice's Freddy AI actively monitors and pushes insights. This "proactive AI" model reduces time-to-discovery for emerging issues.

**What to adopt:**
- Background analysis job that detects metric anomalies (spikes, drops, outliers)
- Categorized insight cards with criticality color-coding
- Root cause tree map visualization
- "What Went Well" / "Area of Concern" summary callouts
- Natural language drill-down from insights

#### 2. Dashboard Restrictions / Dynamic Data Scoping (Zendesk model)

**What they do:** Zendesk's dashboard restrictions let you create one dashboard template that dynamically shows different data based on the logged-in user's role, group, or brand. An agent sees only their own metrics; a manager sees their team's metrics.

**Why it's best:** Eliminates dashboard duplication. Instead of creating 50 dashboards for 50 teams, create 1 dashboard that adapts. Reduces maintenance overhead significantly.

**What to adopt:**
- User-scoped data filters (agent sees own metrics, manager sees team, admin sees all)
- Role-based default dashboard views
- Static restrictions for organizational scoping (by team, location, department)
- One dashboard template → personalized experience per viewer

#### 3. Indicator Scorecard (ServiceNow model)

**What they do:** The Indicator Scorecard widget shows 4 data points simultaneously: latest value, period-over-period change, target attainment, and trend line. It tells the complete story of a KPI in a single glance.

**Why it's best:** Operational reporting needs quick answers. The scorecard pattern answers "Where are we now?", "Are we improving?", "Are we hitting targets?", and "Which direction are we heading?" — all at once.

**What to adopt:**
- Metric widgets that combine: current value + % change + target progress + trend arrow
- Color-coded thresholds (green/amber/red)
- Sparkline trend mini-charts in table views
- Period-over-period comparison auto-calculation

#### 4. Scheduled Data Export via API (Freshservice model)

**What they do:** Freshservice provides a direct API URL for scheduled data exports that BI tools can auto-fetch. This creates a clean integration path without requiring custom ETL.

**Why it's best:** Native API-based data export is simpler and more maintainable than custom ETL scripts. Supports Power BI, Tableau, and other BI tools directly.

**What to adopt:**
- HTTP endpoints that serve scheduled data extracts in CSV/JSON
- API-key authenticated access for BI tools
- Configurable scheduling and field selection
- Manual download fallback for failed fetches

#### 5. Interactive Dashboard Components (Zendesk model)

**What they do:** Zendesk's new dashboard builder includes interactive widgets like "Change Metric," "Change Attribute," and "Data Filter" — allowing end-users to customize their view without editing the dashboard.

**Why it's best:** Empowers consumers to explore data without needing dashboard edit permissions or training on the report builder.

**What to adopt:**
- Dropdown widgets that let users swap metrics/attributes without editing the report
- Dynamic filters that can be excluded from specific reports
- Bookmark/save filter state for each user
- Shareable filtered view URLs

#### 6. Executive Dashboard with AI Narratives (Freshservice model)

**What they do:** Freshservice's Executive Insights include AI-generated narrative summaries alongside charts: "What Went Well," "Area of Concern," "Top 5 Trending Issues" with % change.

**Why it's best:** Executives want answers, not chart-junk. AI narratives translate data into actionable insights. The combination of KPI tiles + trend charts + AI summary + root cause is the ideal executive layout.

**What to adopt:**
- KPI summary row at top (total tickets, avg resolution time, CSAT, SLA compliance)
- AI-generated "What Went Well" / "Area of Concern" callouts
- Ranked list of top trending issues with % change
- One-click root cause drill-down
- Conversational Q&A for follow-up questions

#### 7. Multi-Tenant / MSP Dashboards (BMC Helix model)

**What they do:** BMC Helix Dashboards support building one dashboard that shows subtenant-isolated data for managed service providers.

**Why it's best:** Critical for multi-tenant architectures where different customers/organizations need their own data view from shared infrastructure.

**What to adopt:**
- Tenant-scoped data sources that filter by organization ID
- Dashboard variable for tenant selection (admin sees all, others see own)
- Row-level security on data queries

### Gaps & Anti-Patterns to Avoid

| Anti-Pattern | Example | Alternative |
|-------------|---------|-------------|
| **No native dashboard export** | Ivanti (image-only), Jira (needs 3rd party) | Support at minimum PDF + CSV export |
| **Separate paid module for trends** | ServiceNow PA (premium licensing for historical data) | Include historical trend analysis in base tier |
| **No external sharing** | ServiceNow, BMC Helix, Ivanti | Support public links for stakeholder access |
| **Only 60-min refresh** | Ivanti Analytic Metrics | Support configurable refresh intervals |
| **Legendary BIRT complexity** | BMC BIRT (being deprecated) | Start fresh with modern visualization framework |
| **Dashboard ≠ Report export formats** | ServiceNow (dashboards export PPT/PDF only, reports do Excel) | Consistent export options everywhere |

### Prioritized Adoption List for Resolv

Based on research, these features would deliver highest value for a new ITSM platform:

| Priority | Feature | Source | Effort | Value |
|----------|---------|--------|--------|-------|
| **P1** | **Indicator Scorecard widget** (value + change + target + trend) | ServiceNow | Medium | High |
| **P1** | **Anomaly detection + proactive insights** | Freshservice | High | Very High |
| **P2** | **Dynamic dashboard restrictions** (one dashboard → personalized) | Zendesk | Medium | High |
| **P2** | **Interactive dashboard components** (change metric/attribute dropdowns) | Zendesk | Medium | High |
| **P2** | **Scheduled export API for BI tools** | Freshservice | Medium | High |
| **P3** | **Executive overview with AI narratives** | Freshservice | High | High |
| **P3** | **Natural language chart creation** | Multiple sources | Very High | Medium |
| **P3** | **Multi-tenant data isolation** | BMC Helix | High | Medium (depends on architecture) |
| **P4** | **Role-based dashboard defaults** | All platforms | Low | Medium |
| **P4** | **External sharing with public links** | Zendesk | Low | Medium |
| **P4** | **Drill-down from KPI to individual records** | All platforms | Medium | High |
| **P4** | **Presentation mode for reporting** | Freshservice | Low | Low |

---

## Sources

- ServiceNow: `servicenow.com/products/performance-analytics`, ServiceNow Community (Performance Analytics, Platform Analytics)
- Jira Service Management: `support.atlassian.com/jira-service-management-cloud`, Atlassian Community, `atlassian.com/analytics`
- Freshservice: `support.freshservice.com` (Analytics Pro, Freddy AI Insights, Executive Insights, SLA Management)
- Zendesk Explore: `support.zendesk.com` (Dashboard builder, Scheduling, Sharing, Recipes, Dataset references)
- BMC Helix: `docs.bmc.com` (Helix Dashboards, HelixGPT Insight Finder, Smart Reporting migration, ITSM dashboards)
- Ivanti: `help.ivanti.com` (Analytic Metrics, Dashboard V2, Neurons AI, Default Dashboards)
