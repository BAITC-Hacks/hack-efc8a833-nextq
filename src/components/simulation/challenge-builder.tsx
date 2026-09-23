"use client";

import Link from "next/link";
import { useReducer, useRef, useState } from "react";
import { ArrowLeft, ArrowRight, MapPinned, RotateCcw } from "lucide-react";
import type { EventCatalog, EventChallengeResult } from "@/domain/events";
import { directions, type CityDataset } from "@/domain/model";
import { BudgetMeter } from "./budget-meter";
import { InitiativePicker } from "./initiative-picker";
import { ChallengeReport } from "./challenge-report";
import { challengeInput, createChallengeState, draftSummary, transitionChallenge, type ChallengeAction } from "./challenge-state";
import { directionNames, formatDelta } from "./presentation";
import styles from "./challenge.module.css";

export function ChallengeBuilder({ city, catalog }: { city: CityDataset; catalog: EventCatalog }) {
  const [state, dispatch] = useReducer((current: ReturnType<typeof createChallengeState>, action: ChallengeAction) => transitionChallenge(current, action, city, catalog), catalog, createChallengeState);
  const [result, setResult] = useState<EventChallengeResult | null>(null);
  const [pending, setPending] = useState(false);
  const [error, setError] = useState("");
  const inFlight = useRef(false);
  const reportRef = useRef<HTMLDivElement>(null);
  const headingRef = useRef<HTMLHeadingElement>(null);
  const draft = state[state.stage];
  const summary = draftSummary(draft, city);
  const initialSummary = draftSummary(state.initial, city);
  const isResponse = state.stage === "response";

  function change(action: ChallengeAction) {
    if (inFlight.current) return;
    dispatch(action);
    setResult(null);
    setError("");
    if (action.type === "continue" || action.type === "back" || action.type === "reset") {
      requestAnimationFrame(() => headingRef.current?.focus());
    }
  }

  async function calculate() {
    const input = challengeInput(state, city, catalog);
    if (inFlight.current || !input) return;
    inFlight.current = true;
    setPending(true);
    setError("");
    setResult(null);
    try {
      const response = await fetch("/api/challenge", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(input),
        signal: AbortSignal.timeout(15000),
      });
      const body = await response.json();
      if (!response.ok) throw new Error(typeof body.error === "string" ? body.error : "Не удалось сравнить планы. Повторите расчёт.");
      const comparison = body.result as EventChallengeResult | undefined;
      if (!comparison?.event?.observedDeltas || ![comparison.initial, comparison.disrupted, comparison.response].every((plan) => plan && Number.isFinite(plan.finalAqol) && Array.isArray(plan.districts))) {
        throw new Error("Сервер вернул неполный результат. Повторите расчёт.");
      }
      setResult(comparison);
      requestAnimationFrame(() => reportRef.current?.focus());
    } catch (failure) {
      setError(failure instanceof Error && failure.name !== "TimeoutError" && failure.name !== "TypeError" ? failure.message : "Сервер не ответил. Проверьте соединение и повторите расчёт.");
    } finally {
      inFlight.current = false;
      setPending(false);
    }
  }

  return (
    <main className="command-page">
      <header className={styles.navigation}>
        <Link href="/" className="brand"><span className="brand-mark"><MapPinned size={19} aria-hidden="true" /></span><span className="brand-copy"><strong>ҚАЛА / QALA LAB</strong><small>ЛАБОРАТОРИЯ УСТОЙЧИВОСТИ</small></span></Link>
        <Link href="/" className={styles.backLink}><ArrowLeft size={16} aria-hidden="true" /> Обычный сценарий</Link>
      </header>
      <section className="briefing">
        <div className="briefing-copy">
          <div className="eyebrow">ГОРОД МЕНЯЕТСЯ / ПЛАН ТОЖЕ</div>
          <h1>Проверьте план<br /><em>на устойчивость.</em></h1>
          <p>Составьте исходный план, выберите городское событие и перераспределите бюджет. Сравните, сколько качества жизни удалось вернуть.</p>
          <p className={styles.explanation}>Каждый полный план получает {city.budget} единиц. Ответный план заменяет исходный: расходы двух планов не складываются.</p>
        </div>
        <BudgetMeter budget={city.budget} spent={summary.spent} />
      </section>
      <ol className={styles.steps} aria-label="Этапы лаборатории">
        <li aria-current={!isResponse ? "step" : undefined}>01 / Исходный план</li>
        <li aria-current={isResponse && !result ? "step" : undefined}>02 / Событие и ответ</li>
        <li aria-current={result ? "step" : undefined}>03 / Сравнение</li>
      </ol>
      <section className="workspace" aria-labelledby="challenge-plan-title">
        <div className="section-heading">
          <div><div className="eyebrow compact">{isResponse ? "ПЕРЕРАСПРЕДЕЛЕНИЕ" : "ДО СОБЫТИЯ"}</div><h2 id="challenge-plan-title" ref={headingRef} tabIndex={-1}>{isResponse ? "Ответный план" : "Исходные пять решений"}</h2></div>
          <span className="progress-label" aria-live="polite">0{summary.completed} <i>/</i> 05 <small>ПРИНЯТО</small></span>
        </div>
        {isResponse && <>
          <fieldset className={styles.events} disabled={pending}>
            <legend>Событие раунда</legend>
            <p>Ведущий выбирает одинаковое событие для всех команд. В учебном режиме попробуйте каждое.</p>
            <div className={styles.eventGrid}>{catalog.events.map((event) => <label className={styles.eventCard} key={event.id}>
              <input type="radio" name="city-event" value={event.id} checked={state.eventId === event.id} onChange={() => change({ type: "event", eventId: event.id })} />
              <span><strong>{event.name}</strong><span>{event.description}</span><small>{directions.filter((direction) => event.rawDeltas[direction] !== undefined).map((direction) => `${directionNames[direction]} ${formatDelta(event.rawDeltas[direction]!)}`).join(" · ")}</small></span>
            </label>)}</div>
          </fieldset>
          <div className={styles.planNote}><strong>Исходный план: {initialSummary.spent} из {city.budget} ед.</strong><p>Мы скопировали его решения. Измените мероприятия или районы либо сравните без изменений. Чтобы выбрать более дорогую инициативу, сначала освободите средства.</p></div>
          <details className={styles.originalPlan}><summary>Посмотреть исходные решения</summary><ul>{directions.map((direction) => <li key={direction}><strong>{directionNames[direction]}:</strong> {city.initiatives.find((item) => item.id === state.initial[direction].initiativeId)?.name} — {city.districts.find((district) => district.id === state.initial[direction].districtId)?.name}</li>)}</ul></details>
        </>}
        <div className="decision-layout">
          <div className="decision-list">{directions.map((direction, index) => <InitiativePicker key={direction} city={city} direction={direction} index={index} draft={draft[direction]} available={city.budget - summary.spent + (city.initiatives.find((item) => item.id === draft[direction].initiativeId)?.cost ?? 0)} disabled={pending} onChange={(decision) => change({ type: "decision", direction, decision })} />)}</div>
          <aside className="district-panel">
            <div className="district-panel-head"><div><span className="panel-kicker">ДО РЕШЕНИЙ И СОБЫТИЯ</span><h3>Районы города</h3></div><span className="baseline-tag">0–100</span></div>
            <p className="district-help">Раскройте район и найдите слабое направление. Чем выше показатель, тем лучше условия.</p>
            {city.districts.map((district) => <details className="district-detail" key={district.id}><summary><span>{district.name}<small>{district.population} тыс. жителей</small></span></summary><dl>{directions.map((direction) => <div key={direction}><dt>{directionNames[direction]}</dt><dd>{district.indicators[direction]}</dd></div>)}</dl></details>)}
            <div className="district-panel-foot"><span>ОСТАТОК {isResponse ? "ОТВЕТНОГО" : "ИСХОДНОГО"} ПЛАНА</span><strong>{city.budget - summary.spent} <small>/ {city.budget}</small></strong></div>
          </aside>
        </div>
        <div className="scenario-actions">
          <div><p id="challenge-hint">{summary.valid ? isResponse ? "Оба плана готовы. Сравните три состояния города." : "Пять решений приняты. Перейдите к событию и ответному плану." : `Выберите пять мероприятий и районов. Осталось: ${directions.length - summary.completed}.`}</p><p className="pending-message" role="status">{pending ? "Сравниваем планы и последствия события…" : ""}</p></div>
          <div className="action-buttons">
            <button type="button" className="reset-button" disabled={pending} onClick={() => change({ type: "reset" })}><RotateCcw size={15} aria-hidden="true" /> Сбросить всё</button>
            {isResponse ? <button type="button" className="calculate-button" disabled={pending || !summary.valid} aria-describedby="challenge-hint" onClick={calculate}>{pending ? "Идёт расчёт…" : "Сравнить планы"}<ArrowRight size={17} aria-hidden="true" /></button> : <button type="button" className="calculate-button" disabled={!summary.valid} aria-describedby="challenge-hint" onClick={() => change({ type: "continue" })}>К событию и ответу<ArrowRight size={17} aria-hidden="true" /></button>}
          </div>
        </div>
        {isResponse && <div className={styles.returnAction}><button type="button" className="reset-button" disabled={pending} onClick={() => change({ type: "back" })}><ArrowLeft size={15} aria-hidden="true" /> Изменить исходный план</button><p>При следующем переходе ответный план будет заново скопирован из исходного.</p></div>}
        {(error || state.error) && <p className="scenario-error" role="alert">{error || state.error}</p>}
      </section>
      <div ref={reportRef} tabIndex={-1} className="report-focus">{result && <ChallengeReport result={result} />}</div>
      <footer className="page-footer"><span>{city.datasetVersion} / {city.rulesVersion} / {catalog.eventPackVersion}</span><span>СИНТЕТИЧЕСКАЯ УЧЕБНАЯ МОДЕЛЬ</span></footer>
    </main>
  );
}
