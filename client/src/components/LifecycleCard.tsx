export interface Lifecycle { applyBy?: string; feeLastDate?: string; examDate?: string; admitCard?: string; resultDate?: string; testDate?: string; venue?: string }
const STAGES: [keyof Lifecycle, string][] = [['applyBy', 'Apply by'], ['feeLastDate', 'Fee last date'], ['examDate', 'Exam / Test date'], ['admitCard', 'Admit card'], ['resultDate', 'Result']];
export default function LifecycleCard({ lifecycle, testDate }: { lifecycle: Lifecycle; testDate?: string }) {
  const data: Lifecycle = { ...lifecycle, ...(testDate ? { examDate: testDate } : {}) };
  const present = STAGES.filter(([k]) => data[k]);
  if (!present.length && !data.venue) return null;
  return (
    <div className="panel">
      <strong>Lifecycle</strong>
      <ol>{present.map(([k, label]) => <li key={k}>{label}: {data[k]}</li>)}</ol>
      {data.venue && <p className="small">Venue: {data.venue}</p>}
    </div>
  );
}
