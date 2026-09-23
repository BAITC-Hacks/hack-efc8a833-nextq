"use client";

import dynamic from "next/dynamic";
import { useRef, useState } from "react";
import { ArrowLeft, ArrowRight, BusFront, CircleHelp, HeartHandshake, Landmark, Leaf, ShieldCheck, Wallet } from "lucide-react";
import type { CaseDecision, CaseEvaluation, CaseRecommendation, CityCase } from "@/domain/city-case";
import { metricCodes } from "@/domain/city-case";
import { directions } from "@/domain/model";
import { metricDefinitions, districtQuality } from "@/data/astana-catalog";
import { directionNames, formatScore } from "@/components/simulation/presentation";
import { CaseReport, type Narration } from "./case-report";
import { exampleDecisions, makeSavedRun, planCost, planIssues, replaceDecision, type restoreSavedRun, type SavedRun } from "./lab-state";
import styles from "./city-lab.module.css";

const CityScene = dynamic(() => import("./city-scene").then((module) => module.CityScene), { ssr: false, loading: () => <p role="status">Загружаем 3D-город…</p> });
const icons = { transport: BusFront, green: Leaf, social: HeartHandshake, safety: ShieldCheck, services: Landmark };

export async function requestJson<T>(path: string, body?: unknown, signal?: AbortSignal): Promise<T> {
  const response = await fetch(path, { ...(body === undefined ? {} : { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(body) }), signal });
  const data = await response.json().catch(() => null);
  if (!response.ok) throw new Error(typeof data?.error === "string" ? data.error : typeof data?.narration?.reason === "string" ? data.narration.reason : `Запрос не выполнен (${response.status}). Попробуйте ещё раз.`);
  if (!data) throw new Error("Сервер вернул пустой ответ. Попробуйте ещё раз.");
  return data as T;
}

export function CaseWorkspace({ cityCase, token, restored, onBack, onSave }: { cityCase: CityCase; token?: string; restored?: ReturnType<typeof restoreSavedRun>; onBack: () => void; onSave: (run: SavedRun) => void }) {
  const [decisions, setDecisions] = useState<CaseDecision[]>(restored?.decisions ?? []);
  const [selectedDistrict, setSelectedDistrict] = useState(cityCase.city.districts[0].id);
  const [view, setView] = useState<"2d" | "3d">("2d");
  const [evaluation, setEvaluation] = useState<CaseEvaluation | null>(restored?.evaluation ?? null);
  const [narration, setNarration] = useState<Narration | null>(restored?.narration ?? null);
  const [pending, setPending] = useState(false);
  const [analyzing, setAnalyzing] = useState(false);
  const [error, setError] = useState("");
  const [notice, setNotice] = useState(restored ? `Сохранённый отчёт восстановлен и пересчитан локально по правилам astana-1.${cityCase.source === "ai" ? " Для AI-разбора и серверного пересчёта нужен действующий токен кейса." : ""}` : "");
  const revision = useRef(0);
  const cost = planCost(cityCase, decisions);
  const issues = planIssues(cityCase, decisions);
  const district = cityCase.city.districts.find((item) => item.id === selectedDistrict)!;

  function invalidate() {
    revision.current += 1;
    setEvaluation(null); setNarration(null); setError(""); setNotice(""); setPending(false); setAnalyzing(false);
  }
  function toggle(measureId: string) {
    invalidate();
    if (decisions.some((item) => item.measureId === measureId)) { setDecisions(decisions.filter((item) => item.measureId !== measureId)); return; }
    const measure = cityCase.city.measures.find((item) => item.id === measureId)!;
    setDecisions([...decisions, { measureId, ...(measure.scope === "district" ? { districtId: selectedDistrict } : {}) }]);
  }
  function target(measureId: string, districtId: string) {
    invalidate(); setSelectedDistrict(districtId);
    setDecisions(replaceDecision(decisions, measureId, { measureId, districtId }));
  }
  const payload = () => ({ caseId: cityCase.id, ...(token ? { caseToken: token } : {}), decisions });
  async function evaluate() {
    if (issues.length > 0) return;
    const current = ++revision.current;
    setPending(true); setError(""); setNotice(""); setEvaluation(null); setNarration(null);
    try {
      const data = await requestJson<{ evaluation: CaseEvaluation }>("/api/cases/evaluate", payload());
      if (revision.current === current) { setEvaluation(data.evaluation); setNotice("Расчёт готов. Отчёт находится ниже плана решений."); }
    } catch (cause) { if (revision.current === current) setError(cause instanceof Error ? cause.message : "Не удалось рассчитать сценарий."); }
    finally { if (revision.current === current) setPending(false); }
  }
  async function analyze() {
    const current = revision.current;
    setAnalyzing(true); setNarration(null);
    try {
      const data = await requestJson<{ narration: Narration }>("/api/cases/analyze", payload());
      if (revision.current === current) setNarration(data.narration);
    } catch (cause) { if (revision.current === current) setNarration({ status: "unavailable", reason: cause instanceof Error ? cause.message : "Сервис не ответил. Повторите позже." }); }
    finally { if (revision.current === current) setAnalyzing(false); }
  }
  function apply(recommendation: CaseRecommendation) {
    invalidate();
    setDecisions(replaceDecision(decisions, recommendation.replaceMeasureId, recommendation.decision));
    if (recommendation.decision.districtId) setSelectedDistrict(recommendation.decision.districtId);
    setNotice("Рекомендация добавлена в план. Рассчитайте сценарий, чтобы получить новый отчёт.");
  }
  return <>
    <div className={`${styles.workspaceHeader} ${styles.noPrint}`}><button className={styles.textButton} onClick={onBack}><ArrowLeft size={16} aria-hidden="true" /> Все кейсы</button><span className={styles.tag}>{cityCase.source === "ai" ? "AI-кейс" : cityCase.id === "astana" ? "Исходный датасет" : "Учебная вариация"} · {cityCase.version}</span></div>
    <section className={styles.workspaceIntro}><span className={styles.eyebrow}>ГОРОДСКАЯ ЛАБОРАТОРИЯ / КЕЙС</span><h1>{cityCase.title}</h1><p>{cityCase.summary}</p><div className={styles.briefing}>{cityCase.briefing.map((item, index) => <div key={item}><span>0{index + 1}</span><p>{item}</p></div>)}</div></section>
    <div className={styles.workspaceGrid}>
      <div className={styles.planning}>
        <section className={styles.panel} aria-labelledby="city-map-title"><div className={styles.sectionHeading}><div><span className={styles.eyebrow}>01 / ИСХОДНЫЙ ГОРОД</span><h2 id="city-map-title">Пять районов, разные задачи</h2></div><div className={`${styles.segmented} ${styles.noPrint}`} aria-label="Вид города"><button aria-pressed={view === "2d"} onClick={() => setView("2d")}>2D</button><button aria-pressed={view === "3d"} onClick={() => setView("3d")}>3D</button></div></div>
          {view === "3d" && <div className={styles.noPrint}><CityScene city={cityCase.city} result={evaluation?.result} selectedDistrictId={selectedDistrict} onDistrictSelect={setSelectedDistrict} /></div>}
          <div className={styles.cityMap}>{cityCase.city.districts.map((item, index) => <button key={item.id} aria-pressed={selectedDistrict === item.id} onClick={() => setSelectedDistrict(item.id)}><span className={styles.districtNumber}>0{index + 1}</span><strong>{item.name}</strong><span>{formatScore(item.populationShare * 100)}% населения</span><div className={styles.mapBar}><i style={{ width: `${districtQuality(item.indicators)}%` }} /></div><small>Качество D: {formatScore(districtQuality(item.indicators))}</small></button>)}</div>
          <div className={styles.districtDetail}><h3>{district.name}: исходные показатели</h3><div>{metricCodes.map((code) => <span key={code} title={metricDefinitions[code].description}>{code} · {metricDefinitions[code].name} <b data-critical={district.indicators[code] < 40}>{district.indicators[code]}</b></span>)}</div></div><p className={styles.note}>Выбранный район станет целью новых районных мер. Показатели ниже 40 — критические; каждый снижает общий Score на 1 пункт.</p>
        </section>
        <section className={`${styles.panel} ${styles.noPrint}`} aria-labelledby="decisions-title"><div className={styles.sectionHeading}><div><span className={styles.eyebrow}>02 / ВАШ ПЛАН</span><h2 id="decisions-title">Выберите пять мер</h2></div><button className={styles.secondaryButton} onClick={() => { invalidate(); setDecisions(exampleDecisions.map((item) => ({ ...item }))); setSelectedDistrict("nura"); setNotice("Загружен пример: 5 мер, бюджет 95. Нажмите «Рассчитать сценарий»."); }}>Загрузить пример</button></div><p className={styles.muted}>Ровно 5 уникальных мер, не больше 2 одного направления. Городские меры действуют во всех районах. Все эффекты масштабируются по лагу: (8 − лаг) / 8.</p><div className={styles.decisions}>{directions.map((direction, index) => { const Icon = icons[direction]; return <fieldset key={direction} className={styles.decision}><legend><span className={styles.directionIcon}><Icon size={18} aria-hidden="true" /></span><span>0{index + 1} · {directionNames[direction]}</span><small>{decisions.filter((item) => cityCase.city.measures.find((measure) => measure.id === item.measureId)?.direction === direction).length} / 2</small></legend><div className={styles.measureList}>{cityCase.city.measures.filter((item) => item.direction === direction).map((measure) => { const chosen = decisions.find((item) => item.measureId === measure.id); return <article key={measure.id} className={styles.measureCard} data-selected={Boolean(chosen)}><label className={styles.measureLabel}><input type="checkbox" checked={Boolean(chosen)} onChange={() => toggle(measure.id)} aria-label={`${measure.id}: ${measure.name}`} /><span><strong><small>{measure.id}</small> {measure.name}</strong><span>{measure.scope === "city" ? "Весь город" : "Один район"} · лаг {measure.lagQuarters} кв.</span></span><b>{measure.cost}<small> ед.</small></b></label><p>{measure.description}</p><div className={styles.effectTags}>{Object.entries(measure.effects).map(([key, value]) => <span key={key}>{key} {value! > 0 ? "+" : ""}{value}</span>)}<small>Полный эффект до учёта лага</small></div>{chosen && measure.scope === "district" && <label className={styles.targetLabel}>Целевой район<select aria-label={`Район для ${measure.id}`} value={chosen.districtId} onChange={(event) => target(measure.id, event.target.value)}>{cityCase.city.districts.map((item) => <option key={item.id} value={item.id}>{item.name}</option>)}</select></label>}</article>; })}</div></fieldset>; })}</div></section>
      </div>
      <aside className={`${styles.budgetAside} ${styles.noPrint}`} aria-label="Бюджет сценария"><div className={styles.budgetPanel}><div className={styles.sectionHeading}><span className={styles.eyebrow}>РЕСУРСЫ ГОРОДА</span><Wallet size={20} aria-hidden="true" /></div><h2>Каждое решение<br />имеет свою цену.</h2><div className={styles.budgetValue}><span>Общий бюджет</span><strong data-over={cost > cityCase.city.budget}>{cost}<small> / {cityCase.city.budget}</small></strong><meter min={0} max={cityCase.city.budget} value={Math.min(cost, cityCase.city.budget)} aria-label="Расход бюджета" /></div><div className={styles.budgetValue}><span>Горизонт реализации</span><strong>{cityCase.city.horizonQuarters}<small> кварталов</small></strong></div><p className={styles.budgetNote}>Условные единицы. Остаток бюджета не даёт бонусов к результату.</p><div className={styles.progress}><span>Выбрано мер</span><strong>{decisions.length} из 5</strong></div><button className={styles.primaryButton} disabled={issues.length > 0 || pending} onClick={evaluate}>{pending ? "Считаем сценарий…" : "Рассчитать сценарий"}<ArrowRight size={17} aria-hidden="true" /></button>{issues.length > 0 && <ul className={styles.planIssues} aria-live="polite">{issues.map((issue) => <li key={issue}>{issue}</li>)}</ul>}{decisions.length > 0 && <button className={styles.clearButton} onClick={() => { invalidate(); setDecisions([]); }}>Очистить план</button>}</div><details className={styles.assumptions}><summary><CircleHelp size={16} aria-hidden="true" /> Правила и ограничения</summary><ul>{cityCase.assumptions.map((item) => <li key={item}>{item}</li>)}<li>M1 + M3 несовместимы в любых районах.</li><li>M4 + M7 и M5 + M13 несовместимы в одном районе.</li><li>Score = 0,7 × среднее + 0,3 × слабейший район − число критических показателей.</li></ul></details></aside>
    </div>
    {error && <p className={styles.error} role="alert">{error}</p>}<p className={styles.status} role="status">{notice}</p>
    {evaluation && <CaseReport cityCase={cityCase} decisions={decisions} evaluation={evaluation} narration={narration} analyzing={analyzing} onAnalyze={analyze} onApply={apply} onSave={() => onSave(makeSavedRun(cityCase, decisions, evaluation, crypto.randomUUID(), new Date().toISOString(), token, narration))} />}
  </>;
}
