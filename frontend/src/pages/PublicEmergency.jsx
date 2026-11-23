import { useEffect, useState } from "react";
import { useParams } from "react-router-dom";
import { api } from "../api";
import { Spinner } from "../components/Feedback";

export default function PublicEmergency() {
  const { token } = useParams();
  const [card, setCard] = useState(null);
  const [error, setError] = useState("");

  useEffect(() => {
    api.publicEmergency(token).then(setCard).catch((e) => setError(e.message));
  }, [token]);

  if (error) {
    return (
      <div className="public"><div className="public-card">
        <div className="public-head"><span>Emergency medical information</span></div>
        <div className="public-body"><p>{error}</p></div>
      </div></div>
    );
  }
  if (!card) return <Spinner full />;

  const Row = ({ label, children }) => children ? (
    <div className="public-row"><dt>{label}</dt><dd>{children}</dd></div>
  ) : null;

  return (
    <div className="public">
      <main className="public-card">
        <div className="public-head">
          <span>Emergency medical information</span>
          <h1>{card.patient_name}</h1>
        </div>
        <dl className="public-body">
          <Row label="Blood group">{card.blood_group && <span className="blood">{card.blood_group}</span>}</Row>
          <Row label="Allergies">{card.allergies}</Row>
          <Row label="Medical conditions">{card.conditions}</Row>
          <Row label="Emergency contact">
            {(card.contact_name || card.contact_phone) && (
              <>
                {card.contact_name} {card.contact_phone && <a href={`tel:${card.contact_phone.replace(/[^0-9+]/g, "")}`}>{card.contact_phone}</a>}
              </>
            )}
          </Row>
          <Row label="Notes">{card.notes}</Row>
          <div className="public-row">
            <dt>Current medicines</dt>
            <dd>
              {card.medicines.length === 0 ? "None listed" : (
                <ul>{card.medicines.map((m, i) => <li key={i}><strong>{m.name}</strong> {m.dosage}, {m.frequency}</li>)}</ul>
              )}
            </dd>
          </div>
        </dl>
        <p className="public-foot">Entered by the card holder. Verify with a medical professional.</p>
      </main>
    </div>
  );
}
