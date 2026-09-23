"use client";

import { useRef, useState } from "react";
import Link from "next/link";
import { ArrowRight, Clock3, MapPinned, RotateCcw } from "lucide-react";
import { directions, type CityDataset, type Direction } from "@/domain/model";
import { BudgetMeter } from "./budget-meter";
import { InitiativePicker, type DraftDecision } from "./initiative-picker";
import { directionNames, formatScore } from "./presentation";
import { ScenarioReport, type ScenarioResponse } from "./scenario-report";

function emptyDraft(): Record<Direction, DraftDecision> {
  return {
    transport: { districtId: "", initiativeId: "" },
    green: { districtId: "", initiativeId: "" },
    social: { districtId: "", initiativeId: "" },
    safety: { districtId: "", initiativeId: "" },
    services: { districtId: "", initiativeId: "" },
  };
}

export function ScenarioBuilder({ city }: { city: CityDataset }) {
  const [draft, setDraft] = useState(emptyDraft);
  const [report, setReport] = useState<ScenarioResponse | null>(null);
  const [pending, setPending] = useState(false);
  const [error, setError] = useState("");
  const requestInFlight = useRef(false);
  const reportElement = useRef<HTMLDivElement>(null);
  const costOf = (initiativeId: string) => city.initiatives.find((initiative) => initiative.id === initiativeId)?.cost ?? 0;
  const spent = directions.reduce((total, direction) => total + costOf(draft[direction].initiativeId), 0);
  const completed = directions.filter((direction) => draft[direction].districtId && draft[direction].initiativeId).length;

  function changeDecision(direction: Direction, next: DraftDecision) {
    if (spent - costOf(draft[direction].initiativeId) + costOf(next.initiativeId) > city.budget) {
      setError("Стоимость решения превышает остаток бюджета. Сначала выберите более доступное мероприятие в другом направлении.");
      return;
    }
    setDraft((current) => ({ ...current, [direction]: next }));
    setReport(null);
    setError("");
  }

  async function calculate() {
    if (requestInFlight.current || completed !== directions.length || spent > city.budget) return;
    requestInFlight.current = true;
    setPending(true);
    setError("");
    setReport(null);
    try {
      const response = await fetch("/api/scenario", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          datasetVersion: city.datasetVersion,
          rulesVersion: city.rulesVersion,
          decisions: directions.map((direction) => ({ direction, ...draft[direction] })),
        }),
        signal: AbortSignal.timeout(45000),
      });
      const body = await response.json();
      if (!response.ok) throw new Error(typeof body.error === "string" ? body.error : "Не удалось рассчитать сценарий.");
      if (!body.result || typeof body.result.finalAqol !== "number" || !Array.isArray(body.result.districts)) {
        throw new Error("Сервер вернул неполный результат. Повторите расчёт.");
      }
      setReport(body as ScenarioResponse);
      requestAnimationFrame(() => reportElement.current?.focus());
    } catch (failure) {
      setError(failure instanceof Error && failure.name !== "TimeoutError" && failure.name !== "TypeError" ? failure.message : "Сервер не ответил. Проверьте соединение и повторите расчёт.");
    } finally {
      requestInFlight.current = false;
      setPending(false);
    }
  }

  return (
    <main className="command-page">
      <header className="topbar">
        <a className="brand" href="#overview" aria-label="Аким на 5 часов, на главную"><span className="brand-mark"><MapPinned size={19} strokeWidth={1.8} aria-hidden="true" /></span><span className="brand-copy"><strong>ҚАЛА / QALA LAB</strong><small>СИМУЛЯТОР УПРАВЛЕНИЯ</small></span></a>
        <div className="topbar-center"><span className="live-dot" /> УЧЕБНЫЙ СЦЕНАРИЙ <span className="topbar-separator">/</span> СЕССИЯ 001</div>
        <span className="language-button" aria-label="Язык интерфейса: русский">RU</span>
      </header>
      <section className="briefing" id="overview">
        <div className="briefing-copy"><div className="eyebrow"><span>ASTANA / QALA LAB</span><span className="eyebrow-line" /><span>АКИМ НА 5 ЧАСОВ</span></div><h1>Город — это<br /><em>сумма решений.</em></h1><p>Пять направлений. Один общий бюджет. Выберите район и мероприятие для каждого направления, затем оцените последствия.</p><div className="briefing-meta"><span><Clock3 size={15} aria-hidden="true" /> 5 ЭТАПОВ</span><span><MapPinned size={15} aria-hidden="true" /> {city.districts.length} РАЙОНОВ</span></div></div>
        <BudgetMeter budget={city.budget} spent={spent} />
      </section>
      <nav className="challenge-entry" aria-label="Режим симуляции"><div><strong>Лаборатория устойчивости</strong><p>Городское событие, перераспределение бюджета и три состояния AQoL.</p></div><Link href="/challenge">Проверить план на устойчивость <ArrowRight size={17} aria-hidden="true" /></Link></nav>
      <section className="workspace" aria-label="План заседания">
        <div className="section-heading"><div><div className="eyebrow compact">ПОВЕСТКА ЗАСЕДАНИЯ</div><h2>Пять решений</h2></div><span className="progress-label" aria-live="polite">0{completed} <i>/</i> 05 <small>ПРИНЯТО</small></span></div>
        <div className="decision-layout">
          <div className="decision-list">{directions.map((direction, index) => <InitiativePicker city={city} direction={direction} index={index} draft={draft[direction]} available={city.budget - spent + costOf(draft[direction].initiativeId)} disabled={pending} onChange={(next) => changeDecision(direction, next)} key={direction} />)}</div>
          <aside className="district-panel">
            <div className="district-panel-head"><div><span className="panel-kicker">ИСХОДНЫЕ ДАННЫЕ</span><h3>Районы города</h3></div><span className="baseline-tag">0–100</span></div>
            <p className="district-help">Чем выше показатель, тем лучше условия для жителей. Раскройте район, чтобы найти его слабое направление.</p>
            {city.districts.map((district) => <details className="district-detail" key={district.id}><summary><span>{district.name}<small>{district.population} тыс. жителей</small></span><strong>{formatScore(directions.reduce((total, direction) => total + district.indicators[direction], 0) / directions.length)}</strong></summary><dl>{directions.map((direction) => <div key={direction}><dt>{directionNames[direction]}</dt><dd>{district.indicators[direction]}</dd></div>)}</dl></details>)}
            <div className="district-panel-foot"><span>ОСТАЛОСЬ БЮДЖЕТА</span><strong>{city.budget - spent} <small>/ {city.budget}</small></strong></div>
            <p className="district-help">Парки и освещение в одном районе дают дополнительный эффект безопасности.</p>
          </aside>
        </div>
        <div className="scenario-actions"><div><p id="calculate-hint">{completed === directions.length ? "Все пять решений приняты. Сценарий готов к расчёту." : `Выберите район и мероприятие во всех направлениях. Осталось: ${directions.length - completed}.`}</p><p className="pending-message" role="status">{pending ? "Рассчитываем показатели и запрашиваем AI-разбор…" : ""}</p></div><div className="action-buttons"><button className="reset-button" type="button" disabled={pending} onClick={() => { setDraft(emptyDraft()); setReport(null); setError(""); }}><RotateCcw size={15} aria-hidden="true" /> Сбросить</button><button className="calculate-button" type="button" disabled={pending || completed !== directions.length || spent > city.budget} aria-describedby="calculate-hint" onClick={calculate}>{pending ? "Идёт расчёт…" : "Рассчитать сценарий"}<ArrowRight size={17} aria-hidden="true" /></button></div></div>
        {error && <p className="scenario-error" role="alert">{error}</p>}
      </section>
      <div ref={reportElement} tabIndex={-1} className="report-focus">{report && <ScenarioReport {...report} />}</div>
      <footer className="page-footer"><span>МОДЕЛЬ {city.rulesVersion} <b>·</b> СИНТЕТИЧЕСКИЕ ДАННЫЕ</span><span>ГОРОДСКАЯ СРЕДА <b>·</b> ОБЩЕСТВЕННОЕ БЛАГО</span></footer>
    </main>
  );
}
