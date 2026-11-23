import { isOverdue, isoDate } from "../util";

export const Chip = ({ tone = "neutral", children }) => <span className={`chip chip-${tone}`}>{children}</span>;

export function StockChip({ med }) {
  if (med.stock_status === "out") return <Chip tone="red">Out of stock</Chip>;
  if (med.stock_status === "low") return <Chip tone="amber">Low stock</Chip>;
  return <Chip tone="green">In stock</Chip>;
}

export function ExpiryChip({ med }) {
  if (med.expiry_status === "expired") return <Chip tone="red">Expired</Chip>;
  if (med.expiry_status === "near")
    return <Chip tone="amber">{med.days_to_expiry === 0 ? "Expires today" : `Expires in ${med.days_to_expiry} d`}</Chip>;
  return <Chip tone="green">Valid</Chip>;
}

export function DoseChip({ dose }) {
  if (dose.status === "Taken") return <Chip tone="green">Taken</Chip>;
  if (dose.status === "Skipped") return <Chip tone="blue">Skipped</Chip>;
  const past = dose.scheduled_date < isoDate();
  if (past) return <Chip tone="red">Missed</Chip>;
  return isOverdue(dose) ? <Chip tone="amber">Overdue</Chip> : <Chip tone="neutral">Pending</Chip>;
}
