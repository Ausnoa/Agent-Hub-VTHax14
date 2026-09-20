import { FileText, ListChecks, ShieldAlert } from "lucide-react";
import type { Report } from "../../lib/contracts/index";

/** Presentation of an existing report; does not fetch or execute a workflow. */
export default function ReportPanel({ report }: { report?: Report }) {
  return <section className="report-window" aria-label="Workflow report">
    <div className="report-titlebar">
      <span className="window-dots" aria-hidden="true"><i /><i /><i /></span>
      <span>{report ? `${report.company} · BRIEFING` : "WORKFLOW OUTPUT"}</span>
      <FileText size={14} />
    </div>
    {report ? <div className="report-body">
      <div className="report-summary">
        <div className="section-kicker">EXECUTIVE SYNTHESIS {report.fixture && <span>FIXTURE OUTPUT</span>}</div>
        <h2>{report.company}</h2>
        <p>{report.summary}</p>
      </div>
      <div className="report-columns">
        <section><h3><ListChecks size={16} /> Observations</h3><ul>{report.facts.map((fact, index) => <li key={index}>{fact}</li>)}</ul>{!report.facts.length && <p className="hint">No observations provided.</p>}</section>
        <section><h3><ShieldAlert size={16} /> Risk signals</h3><ul>{report.risks.map((risk, index) => <li key={index}>{risk}</li>)}</ul>{!report.risks.length && <p className="hint">No signals matched this adapter.</p>}</section>
      </div>
    </div> : <div className="report-empty"><FileText size={32} /><h3>Your synthesis appears here</h3><p>Completed workflow output will be available alongside its execution trace.</p></div>}
  </section>;
}
