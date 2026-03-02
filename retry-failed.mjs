// Retry the 11 failed diagrams
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

const failedDiagrams = [
  { id: 7, discipline: 'Enterprise Architecture', name: 'Application Portfolio Map', prompt: 'Application architecture diagram showing application portfolio for a paint manufacturing company grouped by business domain: ERP (SAP S4HANA), CRM (Salesforce), E-commerce (Shopify Plus), Supply Chain (Blue Yonder), Manufacturing (Aveva MES), Quality (LIMS), Finance (SAP FI/CO), HR (SuccessFactors), Analytics (Power BI, Snowflake), Integration (MuleSoft).' },
  { id: 9, discipline: 'Enterprise Architecture', name: 'ArchiMate Layered View', prompt: 'Application architecture diagram showing ArchiMate layered view for a retail company. Business Layer: Customer Ordering process, Product Management, Inventory Management. Application Layer: Web Portal, Order Management System, Inventory System, CRM. Technology Layer: Cloud Hosting (AWS), Database Cluster, CDN, API Gateway. Show serving and realisation relationships between layers.' },
  { id: 10, discipline: 'Enterprise Architecture', name: 'Target State Architecture', prompt: 'C4 context diagram showing target state architecture for a digital transformation program. Primary system: Unified Digital Platform. Connected to: Customer Mobile App, Partner Portal, Legacy ERP (being replaced), New Cloud ERP, Data Lake, AI/ML Platform, Identity Provider, External Payment Gateway, Logistics Partner API. Show users: Customer, Partner, Internal Staff.' },
  { id: 12, discipline: 'Solution Architecture', name: 'C4 Container Diagram', prompt: 'Application architecture diagram showing C4 container view for an online banking platform. Containers: Single Page App (React), Mobile App (React Native), API Gateway (Kong), Account Service (Java Spring), Payment Service (Go), Fraud Engine (Python ML), Notification Service (Node.js), PostgreSQL Database, Redis Cache, Kafka Message Bus.' },
  { id: 13, discipline: 'Solution Architecture', name: 'Integration Architecture', prompt: 'Integration architecture diagram showing enterprise integration for a retail company. Source systems: POS System, E-commerce Platform, ERP, CRM. Integration layer: API Gateway, ESB (MuleSoft), Event Bus (Kafka). Target systems: Data Warehouse, Loyalty Platform, Fulfillment System, Financial System. Show protocols: REST, SOAP, Event Stream, Batch File.' },
  { id: 20, discipline: 'Service Design', name: 'Value Chain Diagram', prompt: 'Swim lane diagram showing value chain for a paint manufacturing company. Primary activity lanes: Inbound Logistics (raw materials, pigments, resins), Operations (mixing, tinting, quality testing), Outbound Logistics (packaging, warehousing, distribution), Marketing and Sales (brand, retail partnerships, colour consultation), After-Sales Service (technical support, colour matching, warranty).' },
  { id: 25, discipline: 'Code Development', name: 'CI/CD Pipeline Diagram', prompt: 'Swim lane diagram showing CI/CD pipeline with lanes: Source (GitHub push, PR created), Build (npm install, TypeScript compile, Docker build), Test (unit tests, integration tests, E2E tests), Staging (deploy to staging, smoke tests, QA approval gate), Production (blue-green deploy, health check, monitoring, rollback trigger).' },
  { id: 39, discipline: 'Infrastructure', name: 'Disaster Recovery Architecture', prompt: 'Application architecture diagram showing disaster recovery architecture. Primary Site (Sydney): web tier, app tier, database (active). DR Site (Melbourne): web tier standby, app tier standby, database replica. Show: synchronous DB replication, DNS failover (Route 53), shared object storage (S3 cross-region), monitoring and alerting, RPO and RTO labels.' },
  { id: 40, discipline: 'Infrastructure', name: 'Server Deployment Map', prompt: 'Network infrastructure architecture diagram showing server deployment map for a production environment. Physical hosts: Host-1 (VMware ESXi) running VMs: Web-VM1, Web-VM2, App-VM1. Host-2 running VMs: App-VM2, DB-Primary. Host-3 running VMs: DB-Replica, Monitoring, Backup. Show resource allocation and network connections between VMs.' },
  { id: 42, discipline: 'Process & Workflow', name: 'Swim Lane Diagram', prompt: 'Swim lane cross-functional diagram for new product development. Lanes for Product Management, Engineering, Design, QA, Marketing. Steps: define requirements, create wireframes, design review, sprint planning, development, code review, QA testing (decision: pass/fail), UAT, go-to-market preparation, launch.' },
  { id: 43, discipline: 'Process & Workflow', name: 'Value Stream Map', prompt: 'Swim lane value stream map for software delivery pipeline. Lanes for Planning (2 day lead time), Development (5 day lead time), Testing (3 day lead time), Deployment (1 day lead time). Show process steps, wait times between stages, information flows, and bottleneck identification.' },
];

async function generateDiagram(diagram, attempt) {
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
      return { ...diagram, attempt, success: false, error: `HTTP ${res.status}: ${errText}`, duration: Date.now() - startTime };
    }

    const data = await res.json();
    return {
      ...diagram,
      attempt,
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
    return { ...diagram, attempt, success: false, error: err.message, duration: Date.now() - startTime };
  }
}

async function main() {
  const allResults = [];
  let remaining = [...failedDiagrams];

  for (let attempt = 1; attempt <= 3 && remaining.length > 0; attempt++) {
    console.log(`\n=== RETRY ATTEMPT ${attempt}/3 — ${remaining.length} diagrams remaining ===\n`);

    // Add a delay between attempts to let the API settle
    if (attempt > 1) {
      console.log('Waiting 10 seconds before retry...');
      await new Promise(r => setTimeout(r, 10000));
    }

    const batchResults = [];
    // Process one at a time for retries to avoid rate limiting
    for (const d of remaining) {
      console.log(`  Generating #${d.id} ${d.discipline} - ${d.name}...`);
      const result = await generateDiagram(d, attempt);
      if (result.success) {
        console.log(`  ✅ #${result.id}: ${result.nodeCount} nodes, ${result.edgeCount} edges (${(result.duration/1000).toFixed(1)}s) → ${result.viewLink}`);
      } else {
        console.log(`  ❌ #${result.id}: ${result.error} (${(result.duration/1000).toFixed(1)}s)`);
      }
      batchResults.push(result);
      // Small delay between requests
      await new Promise(r => setTimeout(r, 2000));
    }

    const succeeded = batchResults.filter(r => r.success);
    const failed = batchResults.filter(r => !r.success);

    allResults.push(...succeeded);
    remaining = failed.map(r => failedDiagrams.find(d => d.id === r.id));

    console.log(`\nAttempt ${attempt} result: ${succeeded.length} succeeded, ${failed.length} still failing`);
  }

  // If still remaining, add them as failed
  if (remaining.length > 0) {
    for (const d of remaining) {
      allResults.push({ ...d, success: false, error: 'All 3 retry attempts failed' });
    }
  }

  console.log('\n\n========== RETRY RESULTS JSON ==========');
  console.log(JSON.stringify(allResults, null, 2));
}

main().catch(console.error);
