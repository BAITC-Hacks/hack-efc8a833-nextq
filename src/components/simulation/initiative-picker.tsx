import { Building2, BusFront, Check, HeartPulse, ShieldCheck, Trees } from "lucide-react";
import type { CityDataset, Direction } from "@/domain/model";
import { directionNames, formatDelta } from "./presentation";

export type DraftDecision = { districtId: string; initiativeId: string };

const directionStyles = {
  transport: { icon: BusFront, color: "mint" },
  green: { icon: Trees, color: "leaf" },
  social: { icon: HeartPulse, color: "rose" },
  safety: { icon: ShieldCheck, color: "amber" },
  services: { icon: Building2, color: "blue" },
};

type InitiativePickerProps = {
  city: CityDataset;
  direction: Direction;
  index: number;
  draft: DraftDecision;
  available: number;
  disabled: boolean;
  onChange: (draft: DraftDecision) => void;
};

export function InitiativePicker({ city, direction, index, draft, available, disabled, onChange }: InitiativePickerProps) {
  const { icon: Icon, color } = directionStyles[direction];
  const complete = Boolean(draft.districtId && draft.initiativeId);

  return (
    <fieldset className={`initiative-picker ${complete ? "is-complete" : ""}`} disabled={disabled}>
      <legend className="sr-only">{directionNames[direction]}</legend>
      <div className="picker-heading">
        <div className={`decision-icon ${color}`}><Icon size={20} strokeWidth={1.8} aria-hidden="true" /></div>
        <div className="decision-main"><div className="decision-overline">НАПРАВЛЕНИЕ 0{index + 1}</div><h3>{directionNames[direction]}</h3></div>
        <span className="picker-status">{complete ? <><Check size={14} aria-hidden="true" /> Принято</> : "Ожидает решения"}</span>
      </div>
      <label className="district-select-label" htmlFor={`district-${direction}`}>Район</label>
      <select id={`district-${direction}`} value={draft.districtId} onChange={(event) => onChange({ ...draft, districtId: event.target.value })}>
        <option value="" disabled>Выберите район</option>
        {city.districts.map((district) => <option value={district.id} key={district.id}>{district.name} · {district.population} тыс. жителей</option>)}
      </select>
      <div className="initiative-options">
        {city.initiatives.filter((initiative) => initiative.direction === direction).map((initiative) => {
          const unaffordable = initiative.cost > available;
          const effects = Object.entries(initiative.deltas) as [Direction, number][];
          return (
            <label className={`initiative-option ${draft.initiativeId === initiative.id ? "is-selected" : ""} ${unaffordable ? "is-unaffordable" : ""}`} key={initiative.id}>
              <input type="radio" name={`initiative-${direction}`} value={initiative.id} checked={draft.initiativeId === initiative.id} disabled={unaffordable} onChange={() => onChange({ ...draft, initiativeId: initiative.id })} />
              <span className="initiative-copy">
                <span className="initiative-title">{initiative.name}</span>
                <span className="initiative-description">{initiative.description}</span>
                <span className="initiative-effects">{effects.length ? effects.map(([indicator, delta]) => <span className={delta < 0 ? "negative-effect" : "positive-effect"} key={indicator}>{directionNames[indicator]} {formatDelta(delta)}</span>) : "Показатели без изменений"}</span>
                {unaffordable && <span className="budget-warning">Не хватает {initiative.cost - available} ед. бюджета</span>}
              </span>
              <strong className="initiative-price">{initiative.cost}<small> ед.</small></strong>
            </label>
          );
        })}
      </div>
    </fieldset>
  );
}
