import { IconCheck } from "../common/icons";

// currentStep: number of steps fully completed (0 = none done, steps.length = all done)
export default function ProcessingSteps({ steps, currentStep }) {
  return (
    <div className="steps-list">
      {steps.map((label, i) => {
        const done = i < currentStep;
        const active = i === currentStep;
        const isLast = i === steps.length - 1;
        return (
          <div className="step-item" key={label}>
            <div className="step-rail">
              <div className={`step-dot ${done ? "done" : ""} ${active ? "active" : ""}`}>
                {done && <IconCheck width={11} height={11} />}
              </div>
              {!isLast && <div className={`step-line ${done ? "done" : ""}`} />}
            </div>
            <div className={`step-label ${done ? "done" : ""} ${active ? "active" : ""}`}>
              {label}
            </div>
          </div>
        );
      })}
    </div>
  );
}
