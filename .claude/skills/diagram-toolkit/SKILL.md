---
name: diagram-toolkit
description: Comprehensive reference of 45 canonical diagram types across 9 architecture and design disciplines. Use when generating Miro diagrams, selecting appropriate diagram types for a given discipline, or advising on which visualisation to use for architecture, design, analysis, or development work. Covers UML, Enterprise Architecture, Solution Architecture, Service Design, Code Development, Business Analysis, Data Architecture, Infrastructure, and Process & Workflow.
metadata:
  author: bashai
  version: "1.0"
compatibility: Requires Miro API access via R2 worker at r2.bashai.com/miro endpoint. Diagrams rendered as Miro boards.
---

# Diagram Toolkit

A comprehensive catalogue of 45 essential diagram types across 9 professional disciplines. Each diagram maps to a Miro worker rendering type for automated generation.

See [references/diagram-catalogue.md](references/diagram-catalogue.md) for full specifications per diagram.

## Disciplines & Diagram Summary

### 1. UML (Unified Modeling Language)
| # | Diagram | Miro Worker Type | Purpose |
|---|---------|-----------------|---------|
| 1 | Class Diagram | `uml-class-erd` | Model classes, attributes, methods, and relationships |
| 2 | Sequence Diagram | `uml-sequence` | Show object interactions over time |
| 3 | Activity Diagram | `swim-lane` | Model workflows with decisions and parallel paths |
| 4 | Use Case Diagram | `c4-context` | Map actors to system functions |
| 5 | Component Diagram | `app-architecture` | Show software component structure and dependencies |

### 2. Enterprise Architecture
| # | Diagram | Miro Worker Type | Purpose |
|---|---------|-----------------|---------|
| 6 | Business Capability Map | `capability-map` | Catalogue what the business does at each level |
| 7 | Application Portfolio Map | `app-architecture` | Inventory of applications by business domain |
| 8 | Technology Reference Model | `app-architecture` | Standard technology stack and platform layers |
| 9 | ArchiMate Layered View | `app-architecture` | Business → Application → Technology layers |
| 10 | Target State Architecture | `c4-context` | Future-state vision with key systems and flows |

### 3. Solution Architecture
| # | Diagram | Miro Worker Type | Purpose |
|---|---------|-----------------|---------|
| 11 | C4 Context Diagram | `c4-context` | High-level system context with actors and boundaries |
| 12 | C4 Container Diagram | `app-architecture` | Applications, data stores, and their interactions |
| 13 | Integration Architecture | `integration-arch` | Middleware, APIs, event buses between systems |
| 14 | Deployment Diagram | `network-infra` | Where software runs on infrastructure |
| 15 | Data Flow Diagram | `data-lineage` | How data moves through the solution |

### 4. Service Design
| # | Diagram | Miro Worker Type | Purpose |
|---|---------|-----------------|---------|
| 16 | Customer Journey Map | `service-design-cx` | End-to-end customer experience across touchpoints |
| 17 | Service Blueprint | `service-design-cx` | Frontstage/backstage service delivery layers |
| 18 | Stakeholder Map | `c4-context` | Who is involved and their relationships |
| 19 | Experience Map | `swim-lane` | Cross-channel user experience over time |
| 20 | Value Chain Diagram | `swim-lane` | Activities that create value end-to-end |

### 5. Code Development
| # | Diagram | Miro Worker Type | Purpose |
|---|---------|-----------------|---------|
| 21 | Class/Object Model | `uml-class-erd` | Domain model for code implementation |
| 22 | API Sequence Diagram | `uml-sequence` | Request/response flows between services |
| 23 | State Machine Diagram | `swim-lane` | Object states and transitions |
| 24 | Dependency Graph | `app-architecture` | Module/package dependency relationships |
| 25 | CI/CD Pipeline Diagram | `swim-lane` | Build, test, deploy workflow stages |

### 6. Business Analysis
| # | Diagram | Miro Worker Type | Purpose |
|---|---------|-----------------|---------|
| 26 | Process Flow Diagram | `swim-lane` | Step-by-step business process visualisation |
| 27 | Use Case Model | `c4-context` | Actors and their functional interactions |
| 28 | Context Diagram | `c4-context` | System boundaries and external interfaces |
| 29 | Entity Relationship Diagram | `uml-class-erd` | Data entities and their relationships |
| 30 | SWOT Analysis Diagram | `capability-map` | Strengths, Weaknesses, Opportunities, Threats grid |

### 7. Data Architecture
| # | Diagram | Miro Worker Type | Purpose |
|---|---------|-----------------|---------|
| 31 | Data Lineage Diagram | `data-lineage` | Source → Transform → Store → Consume flow |
| 32 | Entity Relationship Diagram | `uml-class-erd` | Logical data model with entities and keys |
| 33 | Data Flow Diagram (DFD) | `data-lineage` | How data moves between processes and stores |
| 34 | Master Data Model | `uml-class-erd` | Canonical data entities across the enterprise |
| 35 | Data Lake/Warehouse Architecture | `app-architecture` | Ingestion, storage, and consumption layers |

### 8. Infrastructure
| # | Diagram | Miro Worker Type | Purpose |
|---|---------|-----------------|---------|
| 36 | Network Topology Diagram | `network-infra` | Physical/logical network layout and connectivity |
| 37 | Cloud Architecture Diagram | `network-infra` | VPCs, subnets, load balancers, cloud services |
| 38 | Security Zone Diagram | `network-infra` | DMZ, firewalls, trust zones and access paths |
| 39 | Disaster Recovery Architecture | `app-architecture` | Primary/secondary sites, replication, failover |
| 40 | Server/VM Deployment Map | `network-infra` | Physical and virtual host placement |

### 9. Process & Workflow
| # | Diagram | Miro Worker Type | Purpose |
|---|---------|-----------------|---------|
| 41 | BPMN Process Diagram | `swim-lane` | Standardised business process model |
| 42 | Swim Lane / Cross-Functional | `swim-lane` | Process flow showing role responsibilities |
| 43 | Value Stream Map | `swim-lane` | End-to-end flow with waste identification |
| 44 | Decision Flow Diagram | `swim-lane` | Decision trees and branching logic |
| 45 | RACI Matrix | `capability-map` | Responsibility assignment across activities |

## Miro Worker Type Reference

The R2 worker at `r2.bashai.com/miro` detects diagram type from prompt keywords:

| Worker Type | Trigger Keywords |
|-------------|-----------------|
| `uml-sequence` | sequence, auth flow, login flow, oauth, api flow, message flow |
| `uml-class-erd` | class diagram, domain model, data model, erd, entity diagram |
| `swim-lane` | swim lane, cross-functional, lane diagram, process flow, BPMN |
| `c4-context` | c4, context diagram, system context, program architecture |
| `app-architecture` | application architecture, app arch, system landscape |
| `integration-arch` | integration arch, middleware, esb, mulesoft, api gateway |
| `network-infra` | network arch, infrastructure arch, vpc, dmz, network diagram |
| `capability-map` | capability map, capability model, business capability |
| `data-lineage` | data arch, data lineage, data flow, etl, data pipeline |
| `service-design-cx` | service design, customer journey, cx journey, touchpoint |
| `wireframe` | wireframe, ui mock, screen design, ux wireframe |

## Prompt Engineering Guidelines

When generating diagrams via the Miro feature:

1. **Include trigger keywords** — The worker uses regex to detect type. Always include the relevant keywords from the table above in your prompt.
2. **Be specific about entities** — Name the actual systems, roles, or data elements. Generic labels produce generic diagrams.
3. **Specify scope** — State how many entities/nodes to include (worker caps at 25 nodes, 20 edges).
4. **State the context** — e.g. "for a paint manufacturing company" to ground the AI in domain-specific content.
5. **Request layout direction** — e.g. "left to right" for lineage, "top to bottom" for sequences.

## Quality Checklist

When reviewing generated Miro boards:

- [ ] Text is readable (not truncated or overlapping)
- [ ] Nodes have sufficient spacing (min 100px gap)
- [ ] No overlapping elements
- [ ] Colour coding is consistent with the palette
- [ ] Connector labels are concise (max 5 words)
- [ ] Diagram type matches the canonical standard
- [ ] Node count is appropriate (not too sparse, not overcrowded)
- [ ] Layout direction is logical for the diagram type
