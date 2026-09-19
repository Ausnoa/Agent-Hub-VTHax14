MVP PRD — ANS Agent Composer
 Working name: Agent Composer
 Hackathon category: Best Use of ANS — GoDaddy
 Build window: 48 hours
 Protocol scope: A2A only
1. Product Summary
One-sentence pitch
Describe what you want an agent to do, and Agent Composer discovers verified A2A agents through ANS, connects them into a workflow, and creates a reusable composite agent.
Core concept
Today, ANS gives agents a way to establish identity and become discoverable across the open web. A2A provides a standardized way for agents to communicate.
Agent Composer adds the missing composition layer.
ANS  → discover + verify
A2A  → communicate
Us   → plan + compose + orchestrate
A user should not need to know which agents exist, where their endpoints are, or how they should be connected.
They describe the desired outcome:
"Create an agent that researches a company and summarizes its investment risks."
Agent Composer determines the necessary capabilities, discovers compatible A2A agents through ANS, proposes a workflow, allows the user to review it, and creates a usable composite agent.

2. Problem
As an ecosystem of independently developed agents grows, users face three problems:
Discovery: How does an agent know what other agents exist?
Trust/identity: How does it establish that an endpoint corresponds to the agent it claims to be?
Composition: Once appropriate agents are discovered, how does a nontechnical user combine them into something useful?
ANS addresses the first two pieces. A2A standardizes communication.
Our MVP explores the third:
Can natural language become an interface for composing independently discoverable agents?

3. Product Goal
A user can go from:
"I want an agent that does X."
to:
User request
     ↓
Capability planning
     ↓
ANS discovery
     ↓
ANS identity / verification
     ↓
User review
     ↓
Workflow definition
     ↓
A2A orchestration
     ↓
Working composite agent
in a few minutes without manually configuring endpoints or integrations.
Hackathon success criterion
During the demo, we can show one complete, real workflow in which:
User enters a natural-language description.
LLM decomposes it into required capabilities.
Platform searches ANS for compatible A2A agents.
Platform surfaces ANS identity/verification information.
User reviews the selected agents.
Platform creates a workflow.
Multiple agents communicate through A2A.
User invokes the resulting composite agent.
A useful final output is produced.
Everything beyond this is secondary.

4. Non-Goals
This section is critical given the 48-hour constraint.
MVP will NOT support
MCP agents
arbitrary REST APIs
arbitrary communication protocols
every agent registered in ANS
arbitrary workflow graphs
autonomous infinite agent loops
production-grade agent ranking
complex authentication flows
billing
teams/accounts
marketplace functionality
arbitrary generated React code
drag-and-drop workflow editing
production-grade sandboxing
production deployment guarantees
Important limitation
A2A compatibility does not automatically mean semantic compatibility.
For the MVP, we guarantee orchestration only for a small number of known/tested A2A agent capabilities.
The architecture demonstrates how this could generalize later.

5. Target User
Primary persona
A user who understands what they want accomplished but does not know which agents/services are required to accomplish it.
They should be able to say:
"Build me an agent that researches a company and summarizes the risks."
They should not need to say:
"Call Agent X at endpoint Y, pass its output to Agent Z, map company_name to ticker, then invoke function Q."
The platform handles that abstraction.

6. Primary User Flow
Screen 1 — Describe Your Agent
Minimal landing/builder interface.
┌──────────────────────────────────────────────┐
│                                             │
│          What should your agent do?         │
│                                             │
│ ┌────────────────────────────────────────┐  │
│ │ Research a company, analyze relevant   │  │
│ │ information, and summarize its risks.  │  │
│ └────────────────────────────────────────┘  │
│                                             │
│ Optional agents                             │
│ [+ Add specific agent]                      │
│                                             │
│               [Build Agent]                 │
│                                             │
└──────────────────────────────────────────────┘
Input
Required:
description: string
Optional:
preferredAgents: Agent[]
Action
User clicks Build Agent.

7. Planning
The prompt is sent to an LLM planner.
The planner does not choose specific agents.
It determines the capabilities required to accomplish the goal.
Example input:
Build me an agent that researches a company
and summarizes its investment risks.
Example output:
{
  "name": "Company Research Agent",
  "description": "Researches companies and produces risk summaries.",
  "capabilities": [
    {
      "id": "company-research",
      "description": "Research information about a company"
    },
    {
      "id": "risk-analysis",
      "description": "Identify potential risks from research"
    },
    {
      "id": "summarization",
      "description": "Produce a concise final report"
    }
  ]
}
This becomes the workflow specification.

8. ANS Discovery
For each required capability, the backend searches ANS.
Only agents meeting the MVP's requirements are considered.
Filters
protocol = A2A
status = ACTIVE
Potentially also filter/rank using:
functions
tags
description
relevance
trust information
Conceptually:
"company research"
        │
        ▼
      ANS
        │
        ▼
Research Agent A
Research Agent B
Research Agent C
        │
        ▼
   rank candidates
        │
        ▼
Research Agent A
Critical requirement
Agent endpoints must come from ANS discovery rather than being hardcoded into the workflow.
We can maintain compatibility logic for the agents we support, but the discovery process itself should genuinely use ANS.

9. Agent Selection
For the MVP, use a simple ranking mechanism.
Potential ranking:
score =
    capability relevance
  + ANS trust signal
  + compatibility
Do not spend significant hackathon time creating a sophisticated ranking algorithm.
The purpose is simply:
Given capability X, select an appropriate compatible A2A agent discovered through ANS.

10. Verification / Review Screen
Before anything is created, show the user what the platform plans to use.
┌─────────────────────────────────────────────┐
│ Create "Company Research Agent"             │
│                                             │
│ Your agent will use:                        │
│                                             │
│ ① Research Agent                            │
│   Company research                          │
│   A2A                                       │
│   ANS identity ✓                            │
│                                             │
│             ↓                               │
│                                             │
│ ② Risk Analysis Agent                       │
│   Risk extraction                           │
│   A2A                                       │
│   ANS identity ✓                            │
│                                             │
│             ↓                               │
│                                             │
│ ③ Summary Agent                             │
│   Final report generation                   │
│   A2A                                       │
│   ANS identity ✓                            │
│                                             │
│ [Replace] [Remove] [+ Add]                  │
│                                             │
│              [Create Agent]                 │
└─────────────────────────────────────────────┘
Required MVP interactions
User can:
inspect selected agent
see its purpose
see that it came from ANS
see protocol
approve workflow
Nice-to-have
User can:
replace an agent
remove a step
manually select another ANS result
Don't sacrifice execution reliability to build editing.

11. Workflow Representation
Do not generate backend code for each new composite agent.
Generate a declarative workflow.
Example:
{
  "id": "company-research-agent",
  "name": "Company Research Agent",
  "inputSchema": {
    "company": "string"
  },
  "steps": [
    {
      "id": "research",
      "agentId": "ans-agent-id-123",
      "capability": "company-research"
    },
    {
      "id": "risk",
      "agentId": "ans-agent-id-456",
      "capability": "risk-analysis",
      "inputFrom": "research"
    },
    {
      "id": "summary",
      "agentId": "ans-agent-id-789",
      "capability": "summarization",
      "inputFrom": "risk"
    }
  ]
}
This JSON is stored in the database.

12. Orchestration Engine
One generic orchestrator executes all generated workflows.
Composite request
       │
       ▼
Load workflow JSON
       │
       ▼
Resolve Agent A
       │
       ▼
A2A request
       │
       ▼
Agent A result
       │
       ▼
Transform/pass result
       │
       ▼
A2A request → Agent B
       │
       ▼
Agent B result
       │
       ▼
A2A request → Agent C
       │
       ▼
Final result
MVP restriction
Support sequential workflows only.
Do not build:
         Agent B
        ↗         ↘
Agent A             Agent D
        ↘         ↗
          Agent C
Build:
Agent A
   ↓
Agent B
   ↓
Agent C
This dramatically simplifies execution, state management, and debugging.

13. Data Passing
This is one of the highest-risk technical areas.
Different agents may expect different data.
For the MVP, use a standardized internal state object:
{
  "originalInput": {},
  "context": {},
  "previousOutput": {},
  "results": {}
}
Each step receives the relevant state.
If transformations are necessary, use predefined adapters for the supported agents.
MVP principle
Do not attempt fully autonomous arbitrary schema translation.
For your known working agents:
Agent A output
     ↓
known adapter
     ↓
Agent B input
The future product could use schema reasoning and dynamic transformations.

14. Generated Composite Agent UI
Do not generate arbitrary React.
Generate UI configuration.
Example:
{
  "title": "Company Research Agent",
  "description": "Research and analyze a company.",
  "inputs": [
    {
      "name": "company",
      "type": "text",
      "label": "Company"
    }
  ],
  "submitLabel": "Analyze Company",
  "output": {
    "type": "report"
  }
}
A generic React renderer converts this into:
┌──────────────────────────────────────┐
│ Company Research Agent               │
│                                      │
│ Company                              │
│ [ NVIDIA                         ]   │
│                                      │
│         [Analyze Company]            │
│                                      │
│ ──────────────────────────────────── │
│                                      │
│ Research                             │
│ ...                                  │
│                                      │
│ Risks                                │
│ ...                                  │
│                                      │
│ Summary                              │
│ ...                                  │
└──────────────────────────────────────┘
This gives the appearance of generated applications without the instability of generated frontend code.

15. Execution Visibility
This would be a high-value hackathon feature because it makes ANS/A2A visible to judges.
While executing:
Building your report...

✓ Research Agent
  Discovered through ANS
  Completed in 1.4s

        ↓

● Risk Analysis Agent
  Sending via A2A...

        ↓

○ Summary Agent
  Waiting
Then:
✓ Research Agent
✓ Risk Analysis Agent
✓ Summary Agent

Completed
This visually demonstrates that the final application is actually a composition of multiple agents.

16. Composite Agent API
Every created agent gets one generic endpoint conceptually like:
POST /api/agents/{agentId}/invoke
Example:
{
  "company": "NVIDIA"
}
Backend:
agentId
   ↓
load workflow
   ↓
execute orchestrator
   ↓
A2A agents
   ↓
final response
This means you're not deploying a new server for every generated agent.
You're deploying one runtime capable of executing arbitrary stored workflows.

17. Publish Back to ANS — Stretch Goal
This is probably the most valuable stretch goal.
After creation:
┌────────────────────────────────────┐
│ Company Research Agent             │
│                                    │
│ Your agent is ready.               │
│                                    │
│ [Open Agent]                       │
│                                    │
│ Publish so other agents can        │
│ discover it?                       │
│                                    │
│        [Publish to ANS]            │
└────────────────────────────────────┘
The composite endpoint becomes an A2A endpoint.
Then register:
Name:
Company Research Agent

Protocol:
A2A

Endpoint:
ourplatform.com/api/agents/abc/a2a

Capabilities:
company-research
risk-analysis
summarization
Result:
Existing agents
      ↓
ANS discovery
      ↓
our builder
      ↓
Composite agent
      ↓
ANS registration
      ↓
discoverable composite
      ↓
future compositions
This closes the loop and is probably the best part of the overall product vision.

18. Failure Handling
The MVP needs graceful failures because live agent systems will fail.
No agent found
We couldn't find a compatible A2A agent
for:

"Audio transcription"

Try modifying the capability or selecting
another available agent.
Don't silently fake an ANS result.
Agent unavailable
Research Agent failed to respond.

[Retry]
Workflow failure
Show exactly which step failed:
✓ Research
✓ Analysis
✕ Summarization

Summary Agent did not respond.

[Retry step]

19. Proposed Architecture
                        FRONTEND
                            │
                            ▼
                    ┌──────────────┐
                    │ Next.js App  │
                    └──────┬───────┘
                           │
        ┌──────────────────┼──────────────────┐
        │                  │                  │
        ▼                  ▼                  ▼
    Builder UI        Review UI          Agent UI
        │
        ▼
──────────────────── BACKEND ─────────────────────
        │
        ▼
┌─────────────────┐
│  LLM Planner    │
└────────┬────────┘
         │
         ▼
 capabilities[]
         │
         ▼
┌─────────────────┐
│ ANS Client      │
└────────┬────────┘
         │
         ▼
   A2A candidates
         │
         ▼
┌─────────────────┐
│ Agent Selector  │
└────────┬────────┘
         │
         ▼
    workflow.json
         │
         ▼
┌─────────────────┐
│ Database        │
└────────┬────────┘
         │
         ▼
┌───────────────────────────┐
│      Orchestrator         │
│                           │
│ load workflow             │
│      ↓                    │
│ resolve agents            │
│      ↓                    │
│ execute sequential steps  │
└────────────┬──────────────┘
             │
             │ A2A
      ┌──────┼──────┐
      ▼      ▼      ▼
   Agent A Agent B Agent C

20. Required Backend Objects
Agent
interface Agent {
  ansId: string;
  name: string;
  description: string;
  protocol: "A2A";
  endpoint: string;
  capabilities: string[];
  status: string;
  trustMetadata?: object;
}
Capability
interface Capability {
  id: string;
  description: string;
}
WorkflowStep
interface WorkflowStep {
  id: string;
  capability: string;
  agent: Agent;
  inputFrom?: string;
}
CompositeAgent
interface CompositeAgent {
  id: string;
  name: string;
  description: string;
  originalPrompt: string;
  steps: WorkflowStep[];
  uiSchema: UISchema;
  publishedToANS: boolean;
}

21. API Surface
Keep your internal API tiny.
POST /api/plan
Natural language → capabilities

POST /api/discover
Capabilities → ANS agents

POST /api/agents
Approved workflow → composite agent

GET /api/agents/:id
Retrieve composite agent

POST /api/agents/:id/invoke
Execute composite workflow
Stretch:
POST /api/agents/:id/publish
Register composite agent with ANS

22. What Should Be Real vs. Simulated
This distinction matters enormously for your demo.
MUST be real
ANS discovery
Your application genuinely queries ANS.
ANS metadata
Display real information returned about discovered agents.
A2A communication
At least two independently running agents should genuinely communicate through A2A.
Workflow execution
Outputs actually flow through the composition.
Can be constrained
Agent selection/ranking.
Schema translation.
Available agent catalog.
Supported capabilities.
Generated UI components.
Do not fake
Don't show fake agents and imply ANS discovered them.
If the ANS ecosystem doesn't contain the agents you need, build/register your own A2A agents first, then genuinely discover them through ANS.
That still proves the architecture.

23. Recommended Demo
Don't use travel unless you actually find excellent travel agents.
Choose the use case based on whichever agents you can reliably get running.
A good demo structure would be:
"Build me an agent that researches a company, identifies important risks, and gives me an executive summary."
Then:
USER PROMPT
     ↓
LLM

"I need:
 Research
 Risk Analysis
 Summarization"

     ↓
ANS

discovers

Research Agent
Risk Agent
Summary Agent

     ↓

REVIEW

ANS identity ✓
A2A ✓

     ↓

CREATE

Company Analyst

     ↓

USER

"NVIDIA"

     ↓

Research Agent
     ↓
Risk Agent
     ↓
Summary Agent

     ↓

REPORT
Then, if publishing works:
"And now this composite agent itself becomes an agent on the open web."
Click:
Publish to ANS
Then search ANS and show your newly created agent.
That is your mic-drop moment.
