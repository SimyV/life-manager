// Generate all 45 toolkit diagrams via the Miro API
const R2_URL = 'https://r2.bashai.io';
const R2_SECRET = 'f60350db4573f75632476ab1e039a67515a6c5240fc8c6dd4d9319fe80bef146';
const MIRO_TEAM_ID = '3458764661111748896';

const meeting = {
  title: 'Diagram Toolkit Generation',
  date: '2026-02-25',
  participants: ['Simon Lobascher'],
  keyPoints: ['Generating canonical diagram examples for each architecture discipline'],
  decisions: [],
  actionItems: [],
  nextSteps: []
};

// All 45 diagrams with carefully crafted prompts that trigger the correct worker type
const diagrams = [
  // === 1. UML ===
  { id: 1, discipline: 'UML', name: 'Class Diagram', prompt: 'UML class diagram showing an e-commerce domain model with classes: Customer (name, email, address), Order (orderId, date, status, total), OrderItem (quantity, price), Product (name, sku, price, stock), Category (name, description). Show inheritance, composition and association relationships with cardinality.' },
  { id: 2, discipline: 'UML', name: 'Sequence Diagram', prompt: 'UML sequence diagram showing OAuth 2.0 login flow between User, Browser, Auth Server, Resource Server, and Database. Show the authorization code grant: user clicks login, redirect to auth server, user authenticates, auth code returned, browser exchanges code for token, token validated, user profile returned.' },
  { id: 3, discipline: 'UML', name: 'Activity Diagram', prompt: 'Swim lane activity diagram for employee onboarding process with lanes for HR Department, IT Department, Hiring Manager, New Employee. Show steps: offer accepted, background check, create accounts, assign equipment, orientation day, team introduction, first week review. Include decision points for background check pass/fail.' },
  { id: 4, discipline: 'UML', name: 'Use Case Diagram', prompt: 'C4 context diagram showing a Hospital Management System with actors: Patient, Doctor, Nurse, Admin, Insurance Provider, Lab System, Pharmacy System. Show the primary system in the centre with connections to each actor labelled with their key interactions.' },
  { id: 5, discipline: 'UML', name: 'Component Diagram', prompt: 'Application architecture diagram showing software components for a microservices e-commerce platform: API Gateway, User Service, Product Catalogue, Order Service, Payment Service, Notification Service, Inventory Service. Group by tier: Frontend, API, Backend Services, Data Layer.' },

  // === 2. Enterprise Architecture ===
  { id: 6, discipline: 'Enterprise Architecture', name: 'Business Capability Map', prompt: 'Business capability map for a manufacturing company with domains: Strategic Management (corporate planning, M&A, performance reporting), Product Development (R&D, formulation, testing, compliance), Supply Chain (procurement, manufacturing, logistics, warehousing), Sales & Marketing (brand management, channel management, pricing), Customer Service (order management, technical support, returns), Finance (accounting, treasury, tax), HR (recruitment, talent development, payroll), IT (infrastructure, application management, cybersecurity). Colour-code by maturity: green for mature, amber for developing, red for gaps.' },
  { id: 7, discipline: 'Enterprise Architecture', name: 'Application Portfolio Map', prompt: 'Application architecture diagram showing application portfolio for a paint manufacturing company grouped by business domain: ERP (SAP S4HANA), CRM (Salesforce), E-commerce (Shopify Plus), Supply Chain (Blue Yonder), Manufacturing (Aveva MES), Quality (LIMS), Finance (SAP FI/CO), HR (SuccessFactors), Analytics (Power BI, Snowflake), Integration (MuleSoft).' },
  { id: 8, discipline: 'Enterprise Architecture', name: 'Technology Reference Model', prompt: 'Application architecture diagram showing technology reference model with layers: Infrastructure (AWS, Azure, VMware, Cisco), Platform Services (Kubernetes, Terraform, Jenkins), Application Services (Java Spring, React, Node.js, Python), Data Services (PostgreSQL, MongoDB, Snowflake, Kafka), Integration (MuleSoft, API Gateway, Event Bridge), Security (Okta, CrowdStrike, Vault).' },
  { id: 9, discipline: 'Enterprise Architecture', name: 'ArchiMate Layered View', prompt: 'Application architecture diagram showing ArchiMate layered view for a retail company. Business Layer: Customer Ordering process, Product Management, Inventory Management. Application Layer: Web Portal, Order Management System, Inventory System, CRM. Technology Layer: Cloud Hosting (AWS), Database Cluster, CDN, API Gateway. Show serving and realisation relationships between layers.' },
  { id: 10, discipline: 'Enterprise Architecture', name: 'Target State Architecture', prompt: 'C4 context diagram showing target state architecture for a digital transformation program. Primary system: Unified Digital Platform. Connected to: Customer Mobile App, Partner Portal, Legacy ERP (being replaced), New Cloud ERP, Data Lake, AI/ML Platform, Identity Provider, External Payment Gateway, Logistics Partner API. Show users: Customer, Partner, Internal Staff.' },

  // === 3. Solution Architecture ===
  { id: 11, discipline: 'Solution Architecture', name: 'C4 Context Diagram', prompt: 'C4 context diagram for an online banking system. Users: Retail Customer, Business Customer, Bank Staff. Primary system: Online Banking Platform. Internal systems: Core Banking System, Fraud Detection, Notification Service. External systems: Payment Network (SWIFT), Credit Bureau, Regulatory Reporting, Identity Verification Provider.' },
  { id: 12, discipline: 'Solution Architecture', name: 'C4 Container Diagram', prompt: 'Application architecture diagram showing C4 container view for an online banking platform. Containers: Single Page App (React), Mobile App (React Native), API Gateway (Kong), Account Service (Java Spring), Payment Service (Go), Fraud Engine (Python ML), Notification Service (Node.js), PostgreSQL Database, Redis Cache, Kafka Message Bus.' },
  { id: 13, discipline: 'Solution Architecture', name: 'Integration Architecture', prompt: 'Integration architecture diagram showing enterprise integration for a retail company. Source systems: POS System, E-commerce Platform, ERP, CRM. Integration layer: API Gateway, ESB (MuleSoft), Event Bus (Kafka). Target systems: Data Warehouse, Loyalty Platform, Fulfillment System, Financial System. Show protocols: REST, SOAP, Event Stream, Batch File.' },
  { id: 14, discipline: 'Solution Architecture', name: 'Deployment Diagram', prompt: 'Network infrastructure architecture diagram showing deployment of a SaaS application across AWS. VPC with public subnet (ALB, NAT Gateway), private subnet (ECS Fargate containers, RDS PostgreSQL, ElastiCache Redis), separate VPC for management (bastion host, monitoring). CloudFront CDN, Route 53, S3 for static assets, CloudWatch for monitoring.' },
  { id: 15, discipline: 'Solution Architecture', name: 'Data Flow Diagram', prompt: 'Data lineage diagram showing data flow for a customer analytics platform. Sources: CRM, Web Analytics, Transaction DB, Social Media API. Processing: ETL Pipeline, Data Quality Engine, Feature Engineering. Storage: Raw Data Lake, Curated Data Warehouse. Consumption: BI Dashboards, ML Models, Customer 360 View, Marketing Automation.' },

  // === 4. Service Design ===
  { id: 16, discipline: 'Service Design', name: 'Customer Journey Map', prompt: 'Customer journey map for home renovation paint purchase showing phases: Research, Store Visit, Purchase, Application, Follow-up. Show customer actions, touchpoints, emotions (happy/neutral/frustrated) at each phase, pain points, and opportunities for improvement.' },
  { id: 17, discipline: 'Service Design', name: 'Service Blueprint', prompt: 'Service design blueprint for an IT helpdesk service showing customer actions (submit ticket, check status, receive resolution), frontstage (helpdesk portal, email notifications, chat support), backstage (ticket triage, escalation, knowledge base search), support processes (monitoring tools, CMDB, change management, SLA tracking).' },
  { id: 18, discipline: 'Service Design', name: 'Stakeholder Map', prompt: 'C4 context diagram showing stakeholder map for a digital transformation project. Central project node. Internal stakeholders: CEO, CTO, Business Unit Heads, Project Team, Change Management, Enterprise Architecture. External stakeholders: Technology Vendor, Implementation Partner, Regulatory Body, Customers, Industry Analysts. Show influence relationships.' },
  { id: 19, discipline: 'Service Design', name: 'Experience Map', prompt: 'Swim lane diagram showing cross-channel experience map for a banking customer opening an account. Lanes for Web, Mobile App, Branch, Call Centre. Steps: research products, compare options, start application, verify identity, fund account, receive cards, activate, first transaction. Show channel switching at each step.' },
  { id: 20, discipline: 'Service Design', name: 'Value Chain Diagram', prompt: 'Swim lane diagram showing value chain for a paint manufacturing company. Primary activity lanes: Inbound Logistics (raw materials, pigments, resins), Operations (mixing, tinting, quality testing), Outbound Logistics (packaging, warehousing, distribution), Marketing and Sales (brand, retail partnerships, colour consultation), After-Sales Service (technical support, colour matching, warranty).' },

  // === 5. Code Development ===
  { id: 21, discipline: 'Code Development', name: 'Class/Object Model', prompt: 'UML class diagram for a task management system domain model. Classes: User (id, name, email, role), Project (id, name, description, status), Task (id, title, description, priority, status, dueDate), Comment (id, text, createdAt), Tag (id, name, colour), Sprint (id, name, startDate, endDate). Show relationships: User owns Projects, Project has Tasks, Task has Comments, Task has Tags, Sprint contains Tasks.' },
  { id: 22, discipline: 'Code Development', name: 'API Sequence Diagram', prompt: 'UML sequence diagram showing API flow for creating a payment. Lifelines: Mobile App, API Gateway, Auth Service, Payment Service, Fraud Check, Payment Provider, Database. Flow: app sends POST /payments, gateway validates JWT with auth service, payment service calls fraud check, if approved calls payment provider, saves to database, returns confirmation.' },
  { id: 23, discipline: 'Code Development', name: 'State Machine Diagram', prompt: 'Swim lane diagram showing state machine for an Order entity. States: Draft, Submitted, Payment Pending, Paid, Processing, Shipped, Delivered, Cancelled, Refunded. Show transitions: submit order, payment received, payment failed, start processing, ship, deliver, cancel, request refund. Include decision points for payment and cancellation eligibility.' },
  { id: 24, discipline: 'Code Development', name: 'Dependency Graph', prompt: 'Application architecture diagram showing dependency graph for a Node.js monorepo. Modules: @app/web (React frontend), @app/api (Express backend), @app/auth (authentication library), @app/db (database layer), @app/shared (shared types and utils), @app/email (email service), @app/queue (job queue). Show which modules depend on which.' },
  { id: 25, discipline: 'Code Development', name: 'CI/CD Pipeline Diagram', prompt: 'Swim lane diagram showing CI/CD pipeline with lanes: Source (GitHub push, PR created), Build (npm install, TypeScript compile, Docker build), Test (unit tests, integration tests, E2E tests), Staging (deploy to staging, smoke tests, QA approval gate), Production (blue-green deploy, health check, monitoring, rollback trigger).' },

  // === 6. Business Analysis ===
  { id: 26, discipline: 'Business Analysis', name: 'Process Flow Diagram', prompt: 'Swim lane process flow diagram for purchase requisition approval. Lanes for Requestor, Line Manager, Finance, Procurement. Steps: submit request, manager review, check budget (decision: over/under threshold), finance approval if over threshold, procurement sourcing, PO creation, vendor notification. Show decision diamonds and document outputs.' },
  { id: 27, discipline: 'Business Analysis', name: 'Use Case Model', prompt: 'C4 context diagram showing use case model for a Learning Management System. Actors: Student, Instructor, Administrator, External Content Provider, HR System. Functions: enrol in course, complete assessment, view progress, create course content, manage users, import SCORM packages, generate compliance reports, sync employee data.' },
  { id: 28, discipline: 'Business Analysis', name: 'Context Diagram', prompt: 'C4 context diagram for a Warehouse Management System showing all external interfaces. Central system: WMS. External entities: ERP System (orders, inventory), Shipping Carriers (tracking, labels), Barcode Scanners (scan events), Supplier Portal (ASN, receipts), Reporting Dashboard (metrics), IoT Sensors (temperature, humidity), Workforce Management (shifts, assignments).' },
  { id: 29, discipline: 'Business Analysis', name: 'Entity Relationship Diagram', prompt: 'UML class diagram showing ERD for a university enrolment system. Entities: Student (studentId, name, email, gpa), Course (courseId, name, credits, department), Enrolment (grade, semester, year), Professor (profId, name, department, title), Department (deptId, name, faculty), Classroom (roomId, building, capacity). Show relationships with cardinality.' },
  { id: 30, discipline: 'Business Analysis', name: 'SWOT Analysis Diagram', prompt: 'Business capability map showing SWOT analysis for a paint company digital transformation. Strengths domain: strong brand recognition, extensive distribution network, colour expertise, loyal customer base. Weaknesses domain: legacy IT systems, siloed data, slow time to market. Opportunities domain: direct-to-consumer channel, AI colour matching, sustainability positioning. Threats domain: digital-native competitors, raw material price volatility, changing consumer expectations.' },

  // === 7. Data Architecture ===
  { id: 31, discipline: 'Data Architecture', name: 'Data Lineage Diagram', prompt: 'Data lineage diagram showing data flow for customer analytics. Sources: CRM (Salesforce), ERP (SAP), Web Analytics (GA4), Social Media API. ETL: Airflow orchestration, dbt transformations, data quality checks. Storage: Snowflake data warehouse with raw, staging, marts layers. Consumption: Power BI dashboards, Python ML notebooks, Customer 360 API.' },
  { id: 32, discipline: 'Data Architecture', name: 'Logical Data Model', prompt: 'UML class diagram showing logical data model for a retail domain. Entities: Customer (customerId PK, name, email, segment), Address (addressId PK, street, city, postcode, type), Order (orderId PK, orderDate, status, totalAmount), Product (productId PK, name, category, unitPrice), OrderLine (quantity, lineTotal), Inventory (warehouseId, quantity, reorderLevel). Show PK/FK relationships.' },
  { id: 33, discipline: 'Data Architecture', name: 'Data Flow Diagram (DFD)', prompt: 'Data lineage diagram showing DFD for payroll processing. Sources: HR System (employee data), Time Tracking (hours worked), Tax Authority (tax tables). Processes: Calculate Gross Pay, Apply Deductions, Calculate Tax, Generate Payslips. Data Stores: Employee Master, Payroll History, Tax Records. Outputs: Bank Payment File, Tax Filing, Payslip Distribution.' },
  { id: 34, discipline: 'Data Architecture', name: 'Master Data Model', prompt: 'UML class diagram showing master data model for an enterprise. Core entities: Customer (golden record: name, ABN, segment, tier), Product (SKU, name, category, brand, lifecycle), Supplier (name, country, rating, contract), Employee (name, department, role, location), Location (site, address, type, region). Show cross-domain relationships between all core entities.' },
  { id: 35, discipline: 'Data Architecture', name: 'Data Lake Architecture', prompt: 'Application architecture diagram showing data lake architecture with layers: Ingestion (Kafka, API connectors, file upload, CDC streams), Raw Zone (S3 raw bucket, schema registry), Curated Zone (Delta Lake, data quality, master data), Consumption Zone (Snowflake, Redshift), Analytics and BI (Power BI, Jupyter, ML platform), Governance (data catalogue, lineage, access control).' },

  // === 8. Infrastructure ===
  { id: 36, discipline: 'Infrastructure', name: 'Network Topology Diagram', prompt: 'Network infrastructure architecture diagram showing corporate network topology. Zones: Internet edge (firewall, WAF, DDoS protection), DMZ (web servers, reverse proxy, API gateway), Internal Network (application servers, database cluster, file servers), Management Network (monitoring, backup, AD controllers). Show firewalls between zones with allowed protocols.' },
  { id: 37, discipline: 'Infrastructure', name: 'Cloud Architecture Diagram', prompt: 'Network infrastructure architecture diagram showing AWS cloud architecture. VPC with 3 AZs, public subnets (ALB, NAT Gateway), private app subnets (ECS Fargate, Lambda), private data subnets (RDS Multi-AZ, ElastiCache). External: CloudFront CDN, Route 53, S3, SQS, SNS. Management: CloudWatch, CloudTrail, AWS Config.' },
  { id: 38, discipline: 'Infrastructure', name: 'Security Zone Diagram', prompt: 'Network infrastructure architecture diagram showing security zones for a financial services company. Zones: Internet (untrusted), DMZ (web application firewall, load balancer), Application Zone (app servers, API servers), Data Zone (databases, file storage), Restricted Zone (HSM, key management, PCI data). Firewalls between each zone with port/protocol rules.' },
  { id: 39, discipline: 'Infrastructure', name: 'Disaster Recovery Architecture', prompt: 'Application architecture diagram showing disaster recovery architecture. Primary Site (Sydney): web tier, app tier, database (active). DR Site (Melbourne): web tier standby, app tier standby, database replica. Show: synchronous DB replication, DNS failover (Route 53), shared object storage (S3 cross-region), monitoring and alerting, RPO and RTO labels.' },
  { id: 40, discipline: 'Infrastructure', name: 'Server Deployment Map', prompt: 'Network infrastructure architecture diagram showing server deployment map for a production environment. Physical hosts: Host-1 (VMware ESXi) running VMs: Web-VM1, Web-VM2, App-VM1. Host-2 running VMs: App-VM2, DB-Primary. Host-3 running VMs: DB-Replica, Monitoring, Backup. Show resource allocation and network connections between VMs.' },

  // === 9. Process & Workflow ===
  { id: 41, discipline: 'Process & Workflow', name: 'BPMN Process Diagram', prompt: 'Swim lane BPMN process diagram for incident management. Lanes for Service Desk, Level 2 Support, Change Management. Steps: log incident, classify severity (decision: P1/P2/P3), assign to queue, diagnose issue, apply workaround (decision: known fix?), escalate if needed, implement fix, verify resolution, close ticket. Show start and end events.' },
  { id: 42, discipline: 'Process & Workflow', name: 'Swim Lane Diagram', prompt: 'Swim lane cross-functional diagram for new product development. Lanes for Product Management, Engineering, Design, QA, Marketing. Steps: define requirements, create wireframes, design review, sprint planning, development, code review, QA testing (decision: pass/fail), UAT, go-to-market preparation, launch.' },
  { id: 43, discipline: 'Process & Workflow', name: 'Value Stream Map', prompt: 'Swim lane value stream map for software delivery pipeline. Lanes for Planning (2 day lead time), Development (5 day lead time), Testing (3 day lead time), Deployment (1 day lead time). Show process steps, wait times between stages, information flows, and bottleneck identification.' },
  { id: 44, discipline: 'Process & Workflow', name: 'Decision Flow Diagram', prompt: 'Swim lane decision flow diagram for customer complaint resolution. Lanes for Customer Service, Team Leader, Quality Manager. Decision points: Is complaint valid? Is it safety-related? Can it be resolved immediately? Does it need escalation? Show yes/no paths leading to outcomes: immediate resolution, investigation, escalation, compensation, closure.' },
  { id: 45, discipline: 'Process & Workflow', name: 'RACI Matrix', prompt: 'Business capability map showing RACI matrix for a software development project. Activities: Requirements Gathering, Architecture Design, Development, Testing, Deployment, Monitoring. Stakeholders: Product Owner (R/A), Tech Lead (R/A), Developers (R), QA Team (R), DevOps (R), Business Sponsor (I/C). Colour code R=blue, A=navy, C=teal, I=grey.' },
];

async function generateDiagram(diagram) {
  const startTime = Date.now();
  try {
    const res = await fetch(`${R2_URL}/miro`, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${R2_SECRET}`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        meeting,
        prompt: diagram.prompt,
        teamId: MIRO_TEAM_ID
      })
    });

    if (!res.ok) {
      const errText = await res.text();
      return { ...diagram, success: false, error: `HTTP ${res.status}: ${errText}`, duration: Date.now() - startTime };
    }

    const data = await res.json();
    return {
      ...diagram,
      success: true,
      boardId: data.boardId,
      viewLink: data.viewLink,
      title: data.title,
      nodeCount: data.nodeCount,
      edgeCount: data.edgeCount,
      nodeErrors: data.nodeErrors?.length || 0,
      edgeErrors: data.edgeErrors?.length || 0,
      duration: Date.now() - startTime
    };
  } catch (err) {
    return { ...diagram, success: false, error: err.message, duration: Date.now() - startTime };
  }
}

// Process in batches of 3 to avoid overwhelming the worker
async function processBatch(batch) {
  return Promise.all(batch.map(d => generateDiagram(d)));
}

async function main() {
  const results = [];
  const batchSize = 3;

  console.log(`Starting generation of ${diagrams.length} diagrams in batches of ${batchSize}...`);
  console.log('---');

  for (let i = 0; i < diagrams.length; i += batchSize) {
    const batch = diagrams.slice(i, i + batchSize);
    const batchNum = Math.floor(i / batchSize) + 1;
    const totalBatches = Math.ceil(diagrams.length / batchSize);

    console.log(`\nBatch ${batchNum}/${totalBatches}: Generating ${batch.map(d => `#${d.id} ${d.name}`).join(', ')}...`);

    const batchResults = await processBatch(batch);

    for (const r of batchResults) {
      if (r.success) {
        console.log(`  ✅ #${r.id} ${r.discipline} - ${r.name}: ${r.nodeCount} nodes, ${r.edgeCount} edges (${(r.duration/1000).toFixed(1)}s) → ${r.viewLink}`);
      } else {
        console.log(`  ❌ #${r.id} ${r.discipline} - ${r.name}: ${r.error} (${(r.duration/1000).toFixed(1)}s)`);
      }
      results.push(r);
    }
  }

  // Summary
  const succeeded = results.filter(r => r.success);
  const failed = results.filter(r => !r.success);

  console.log('\n\n========== SUMMARY ==========');
  console.log(`Total: ${results.length} | Success: ${succeeded.length} | Failed: ${failed.length}`);

  if (failed.length > 0) {
    console.log('\nFailed diagrams:');
    for (const f of failed) {
      console.log(`  #${f.id} ${f.discipline} - ${f.name}: ${f.error}`);
    }
  }

  console.log('\n\n========== RESULTS JSON ==========');
  console.log(JSON.stringify(results, null, 2));
}

main().catch(console.error);
