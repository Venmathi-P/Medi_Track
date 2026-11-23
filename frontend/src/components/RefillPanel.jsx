import { Chip } from "./Chips";
import { Empty } from "./Feedback";
import { formatDate } from "../util";

const BAR_DAYS = 30;

function UrgencyChip({ r }) {
  if (r.urgency === "critical") return <Chip tone="red">Refill now</Chip>;
  if (r.urgency === "soon") return <Chip tone="amber">Refill soon</Chip>;
  return <Chip tone="green">Stocked</Chip>;
}

/** Predicted run-out per medicine, from its stock and how many doses/day are scheduled. */
export default function RefillPanel({ refills, limit }) {
  if (!refills) return null;
  if (refills.length === 0) {
    return (
      <Empty title="No forecast yet">
        Add a reminder for a medicine and MediTrack will predict when it runs out and when to reorder.
      </Empty>
    );
  }
  const items = limit ? refills.slice(0, limit) : refills;
  return (
    <>
      <ul className="plain">
        {items.map((r) => (
          <li key={r.medicine_id} className="refill">
            <span className="refill-main">
              <strong>{r.name}</strong> <span className="muted">{r.dosage}</span>
              <small className="muted block">
                {r.days_left === 0 ? "Not enough for a full day of doses" : `About ${r.days_left} day${r.days_left === 1 ? "" : "s"} left`}
                {" · "}runs out {formatDate(r.run_out_date, { day: "numeric", month: "short" })}
                {" · "}{r.quantity} in stock at {r.doses_per_day}/day
                {r.urgency !== "ok" && <> · order by <strong>{formatDate(r.refill_by, { day: "numeric", month: "short" })}</strong></>}
              </small>
              <span className="bar" aria-hidden="true">
                <i className={`bar-${r.urgency}`} style={{ width: `${Math.max(3, Math.min(100, Math.round((r.days_left / BAR_DAYS) * 100)))}%` }} />
              </span>
            </span>
            <span className="row-actions">
              {r.expires_before_runout && <Chip tone="amber">Expires first</Chip>}
              <UrgencyChip r={r} />
            </span>
          </li>
        ))}
      </ul>
      {limit && refills.length > limit && <p className="muted small">Showing {limit} of {refills.length}. The rest are on the Stock &amp; expiry page.</p>}
      <p className="muted small">Assumes one unit per dose. Medicines without a reminder cannot be predicted.</p>
    </>
  );
}
