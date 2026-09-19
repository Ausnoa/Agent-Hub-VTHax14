const steps = ["Describe", "Discover agents", "Review workflow"] as const;

// Progress through the Compose tab's three pages: /create → /discovery → /workflow.
export default function ComposeSteps({ current }: { current: 1 | 2 | 3 }) {
  return <ol className="compose-steps" aria-label="Composition progress">
    {steps.map((label, index) => {
      const step = index + 1;
      const state = step < current ? "done" : step === current ? "current" : "upcoming";
      return <li key={label} className={`compose-step ${state}`} aria-current={state === "current" ? "step" : undefined}>
        <span className="compose-step-number">{step < current ? "✓" : step}</span>{label}
      </li>;
    })}
  </ol>;
}
