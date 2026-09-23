"use client";

import Link from "next/link";
import { useEffect, useRef, useState } from "react";
import { ArrowRight, Building2, Check, ChevronRight, FlaskConical, Plus, Snowflake, Sparkles, Sun, TrainFront, Trash2, Users } from "lucide-react";
import type { CaseTheme, CityCase } from "@/domain/city-case";
import { formatDelta, formatScore } from "@/components/simulation/presentation";
import { CaseWorkspace, requestJson } from "./case-workspace";
import { compatibleRuns, parseSavedRuns, restoreSavedRun, savedRunLimit, storageByteLimit, storageKey, type SavedRun } from "./lab-state";
import styles from "./city-lab.module.css";

const themes = { baseline: { label: "АСТАНА · ИСХОДНЫЕ ДАННЫЕ", Icon: Building2 }, winter: { label: "ЗИМНЯЯ УСТОЙЧИВОСТЬ", Icon: Snowflake }, heat: { label: "ЖАРА И ЗЕЛЁНЫЙ ГОРОД", Icon: Sun }, growth: { label: "РОСТ И ДОСТУПНОСТЬ", Icon: Users }, mobility: { label: "ГОРОД В ДВИЖЕНИИ", Icon: TrainFront } };
type Catalog = { cases: CityCase[]; generation: { available: boolean; provider: string | null } };

export function CityLab() {
  const [catalog, setCatalog] = useState<Catalog | null>(null);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState("");
  const [retry, setRetry] = useState(0);
  const [active, setActive] = useState<{ cityCase: CityCase; token?: string; restored?: ReturnType<typeof restoreSavedRun>; runId?: string } | null>(null);
  const [brief, setBrief] = useState("");
  const [theme, setTheme] = useState<CaseTheme>("winter");
  const [generating, setGenerating] = useState(false);
  const [generationError, setGenerationError] = useState("");
  const [generationNotice, setGenerationNotice] = useState("");
  const [saved, setSaved] = useState<SavedRun[]>([]);
  const [saveNotice, setSaveNotice] = useState("");
  const [selectedRuns, setSelectedRuns] = useState<string[]>([]);
  const generationRequest = useRef<{ id: number; controller?: AbortController }>({ id: 0 });
  useEffect(() => {
    const controller = new AbortController();
    requestJson<Catalog>("/api/cases", undefined, controller.signal).then((data) => {
      setCatalog(data); setLoadError("");
    }).catch((cause) => {
      if (!controller.signal.aborted) setLoadError(cause instanceof Error ? cause.message : "Не удалось загрузить кейсы.");
    }).finally(() => { if (!controller.signal.aborted) setLoading(false); });
    Promise.resolve().then(() => {
      try { setSaved(parseSavedRuns(localStorage.getItem(storageKey))); }
      catch { setSaveNotice("Хранилище браузера недоступно. Для сохранения отчёта используйте экспорт JSON."); }
    });
    return () => controller.abort();
  }, [retry]);

  useEffect(() => () => {
    generationRequest.current.id += 1;
    generationRequest.current.controller?.abort();
  }, []);
  function cancelGeneration() {
    generationRequest.current.id += 1;
    generationRequest.current.controller?.abort();
    setGenerating(false);
    setGenerationError("");
    setGenerationNotice("");
  }
  function navigate(next: typeof active) {
    cancelGeneration();
    setActive(next);
    window.scrollTo({ top: 0, behavior: "smooth" });
  }
  function openSaved(run: SavedRun) {
    try {
      const restored = restoreSavedRun(run);
      navigate({ cityCase: restored.cityCase, token: restored.token, restored, runId: run.id });
      setSaveNotice("");
    } catch { setSaveNotice("Сохранение не прошло проверку. Удалите его и соберите новый план."); }
  }
  function persist(runs: SavedRun[]) {
    try {
      const raw = JSON.stringify(runs);
      if (new TextEncoder().encode(raw).byteLength > storageByteLimit) throw new Error("Storage limit exceeded");
      localStorage.setItem(storageKey, raw);
      setSaved(runs);
      return true;
    } catch { setSaveNotice("Не удалось сохранить данные в браузере. Используйте экспорт JSON."); return false; }
  }
  function saveRun(run: SavedRun) {
    const exists = saved.find((item) => compatibleRuns(item, run) && JSON.stringify([...item.decisions].sort((a, b) => a.measureId.localeCompare(b.measureId))) === JSON.stringify([...run.decisions].sort((a, b) => a.measureId.localeCompare(b.measureId))));
    if (exists) { setSaveNotice("Этот план уже сохранён. Измените решения, чтобы создать другой сценарий."); return; }
    if (persist([run, ...saved].slice(0, savedRunLimit))) setSaveNotice("Сценарий сохранён в этом браузере. Он доступен в разделе «Сохранённые сценарии» ниже.");
  }
  async function generate() {
    if (!brief.trim() || !catalog?.generation.available) return;
    cancelGeneration();
    const requestId = generationRequest.current.id;
    const controller = new AbortController();
    generationRequest.current.controller = controller;
    setGenerating(true); setGenerationError(""); setGenerationNotice("");
    try {
      const data = await requestJson<{ case: CityCase; token: string; provider: string; model: string }>("/api/cases/generate", { brief: brief.trim(), theme }, controller.signal);
      if (generationRequest.current.id !== requestId || controller.signal.aborted) return;
      setActive({ cityCase: data.case, token: data.token });
      setGenerationNotice(`Кейс создан: ${data.provider} · ${data.model}. Цены и правила заданы каталогом, а не AI.`);
      window.scrollTo({ top: 0, behavior: "smooth" });
    } catch (cause) { if (generationRequest.current.id === requestId && !controller.signal.aborted) setGenerationError(cause instanceof Error ? cause.message : "Не удалось создать кейс. Попробуйте позже."); }
    finally { if (generationRequest.current.id === requestId) setGenerating(false); }
  }
  const compared = selectedRuns.map((id) => saved.find((item) => item.id === id)).filter((item): item is SavedRun => Boolean(item));
  function toggleRun(run: SavedRun) {
    if (selectedRuns.includes(run.id)) { setSelectedRuns(selectedRuns.filter((id) => id !== run.id)); return; }
    if (compared[0] && !compatibleRuns(compared[0], run)) { setSaveNotice("Можно сравнивать только одинаковый кейс, версию модели и горизонт. Снимите предыдущий выбор."); return; }
    if (selectedRuns.length >= 3) { setSaveNotice("Для сравнения выберите не больше трёх сценариев."); return; }
    setSelectedRuns([...selectedRuns, run.id]); setSaveNotice("");
  }
  return <div className={styles.lab}>
    <a className={styles.skipLink} href="#lab-main">Перейти к содержанию</a>
    <header className={`${styles.header} ${styles.noPrint}`}><Link className={styles.brand} href="/"><span><Building2 size={21} aria-hidden="true" /></span><div><strong>CITY LAB</strong><small>Аким на 5 часов</small></div></Link><nav aria-label="Основная навигация"><button className={!active ? styles.navActive : undefined} onClick={() => navigate(null)}>Кейсы</button><Link href="/sandbox">Песочница</Link><Link href="/challenge">События <ArrowRight size={14} aria-hidden="true" /></Link></nav><span className={styles.headerLabel}><span /> Лаборатория городских решений</span></header>
    <main id="lab-main">
      {generationNotice && <p className={styles.status} role="status">{generationNotice}</p>}
      {active ? <CaseWorkspace key={`${active.cityCase.id}-${active.runId ?? "new"}`} cityCase={active.cityCase} token={active.token} restored={active.restored} onBack={() => navigate(null)} onSave={saveRun} /> : <>
        <section className={styles.hero}><div><span className={styles.eyebrow}>МЕНЯЙТЕ РЕШЕНИЯ. ИССЛЕДУЙТЕ ПОСЛЕДСТВИЯ.</span><h1>Город начинается<br />с вашего <em>решения.</em></h1><p>Пять направлений. Ограниченный бюджет. Один город.<br />Соберите план и посмотрите, как он меняет качество жизни.</p><a className={styles.primaryButton} href="#case-gallery">Выбрать кейс <ArrowRight size={17} aria-hidden="true" /></a><span className={styles.heroNote}>Датасет astana-1 · учебная модель</span></div><div className={styles.heroGraphic} aria-hidden="true"><div className={styles.cityGrid}><i /><i /><i /><i /><i /><i /><i /><i /><i /><i /><i /><i /></div><div className={styles.graphicLabel}><span>ПРОСТРАНСТВО ВОЗМОЖНОСТЕЙ</span><strong>5 районов<span> / </span>5 решений</strong></div></div></section>
        <div className={styles.principles}><div><span>01</span><p><strong>Выберите вызов</strong>Исходная Астана, учебные вариации или собственная задача.</p></div><div><span>02</span><p><strong>Распределите ресурсы</strong>100 единиц бюджета, 5 уникальных мер и 8 кварталов.</p></div><div><span>03</span><p><strong>Проверьте последствия</strong>Качество жизни, неравенство и компромиссы.</p></div></div>
        <section id="case-gallery" className={styles.gallery} aria-labelledby="gallery-title"><div className={styles.sectionHeading}><div><span className={styles.eyebrow}>ГОТОВЫЕ СЦЕНАРИИ</span><h2 id="gallery-title">С чего начнём?</h2></div><span className={styles.muted}>Один бюджет. Разные приоритеты.</span></div>{loading && <p className={styles.loading} role="status">Загружаем городские кейсы…</p>}{loadError && <div className={styles.error} role="alert"><p>{loadError}</p><button className={styles.secondaryButton} onClick={() => { setLoading(true); setRetry(retry + 1); }}>Повторить загрузку</button></div>}<div className={styles.caseGrid}>{catalog?.cases.map((cityCase, index) => { const { Icon, label } = themes[cityCase.theme]; return <article className={styles.caseCard} data-theme={cityCase.theme} key={cityCase.id}><div className={styles.caseVisual} aria-hidden="true"><span>КЕЙС 0{index + 1}</span><Icon size={66} strokeWidth={1} /><div className={styles.caseVisualLines}><i /><i /><i /><i /><i /></div></div><div className={styles.caseBody}><span className={styles.eyebrow}>{label}</span><h3>{cityCase.title}</h3><p>{cityCase.summary}</p><div className={styles.caseMeta}><span>5 районов</span><span>8 кварталов</span></div><button className={styles.caseOpen} onClick={() => { navigate({ cityCase }); setSaveNotice(""); }} aria-label={`Открыть кейс: ${cityCase.title}`}>Исследовать кейс <ArrowRight size={18} aria-hidden="true" /></button></div></article>; })}</div></section>
        <section className={styles.generator} aria-labelledby="generator-title"><div><span className={styles.eyebrow}><Sparkles size={15} aria-hidden="true" /> ВАША ГОРОДСКАЯ ЗАДАЧА</span><h2 id="generator-title">А что, если…</h2><p>Опишите городской вызов. AI создаст исходные условия, а фиксированная модель поможет проверить ваши решения.</p><p className={styles.note}>Генерируются только синтетические данные. Не вводите персональные или конфиденциальные сведения.</p>{catalog && !catalog.generation.available && <p className={styles.unavailable} role="status">AI-генерация сейчас недоступна: серверный провайдер не настроен. Выберите подготовленный кейс выше.</p>}</div><form onSubmit={(event) => { event.preventDefault(); void generate(); }}><label htmlFor="case-brief">Какую задачу должен решить город?</label><textarea id="case-brief" value={brief} onChange={(event) => setBrief(event.target.value)} maxLength={1600} minLength={20} required rows={4} placeholder="Например: новые кварталы растут быстрее транспорта, а пожилым жителям сложно добраться до социальных сервисов…" disabled={generating || !catalog?.generation.available} /><div className={styles.generatorBottom}><label>Тема<select value={theme} onChange={(event) => setTheme(event.target.value as CaseTheme)} disabled={generating || !catalog?.generation.available}>{Object.entries(themes).map(([key, value]) => <option value={key} key={key}>{value.label.toLocaleLowerCase("ru-RU")}</option>)}</select></label><button className={styles.primaryButton} disabled={generating || !catalog?.generation.available || brief.trim().length < 20}><Plus size={16} aria-hidden="true" />{generating ? "Создаём кейс…" : "Создать AI-кейс"}</button></div>{generating && <p role="status">Создаём и проверяем исходные условия. Это может занять некоторое время.</p>}{generationError && <p className={styles.error} role="alert">{generationError}</p>}</form></section>
      </>}
      <section className={`${styles.savedSection} ${styles.noPrint}`} aria-labelledby="saved-title"><div className={styles.sectionHeading}><div><span className={styles.eyebrow}>ВАША ИСТОРИЯ РЕШЕНИЙ</span><h2 id="saved-title">Сохранённые сценарии</h2></div><span className={styles.tag}>{saved.length} / {savedRunLimit}</span></div><p className={styles.muted}>Хранятся только в этом браузере. Сравните до трёх планов одного кейса и версии модели (горизонт всегда 8 кварталов). При заполнении списка самый старый сценарий удаляется.</p><p role="status" className={styles.status}>{saveNotice}</p>{saved.length === 0 ? <div className={styles.emptyState}><FlaskConical size={26} aria-hidden="true" /><p>Первый сценарий появится здесь после расчёта и сохранения.</p></div> : <div className={styles.savedList}>{saved.map((run) => <div key={run.id} className={styles.savedRow}><label><input type="checkbox" checked={selectedRuns.includes(run.id)} onChange={() => toggleRun(run)} aria-label={`Сравнить ${run.title}, 8 кварталов, ${formatScore(run.aqol)} Score`} /><span><strong>{run.title}</strong><small>8 кв. · {new Date(run.savedAt).toLocaleString("ru-RU")} · {run.caseVersion}</small></span></label><b>{formatScore(run.aqol)} <small>Score</small></b><button className={styles.secondaryButton} onClick={() => openSaved(run)} aria-label={`Открыть отчёт: ${run.title}`}>Открыть отчёт</button><button className={styles.iconButton} aria-label={`Удалить сценарий ${run.title}`} onClick={() => { if (persist(saved.filter((item) => item.id !== run.id))) { setSelectedRuns(selectedRuns.filter((id) => id !== run.id)); setSaveNotice("Сценарий удалён из браузера."); } }}><Trash2 size={16} aria-hidden="true" /></button></div>)}</div>}{compared.length > 1 && <div className={styles.comparison}><h3><Check size={18} aria-hidden="true" /> Сравнение совместимых сценариев</h3><div className={styles.tableScroll}><table className={styles.table}><caption>Одинаковый кейс и модель: {compared[0].title}, 8 кварталов</caption><thead><tr><th>Показатель</th>{compared.map((run, index) => <th key={run.id}>План {index + 1}</th>)}</tr></thead><tbody><tr><th>Score</th>{compared.map((run) => <td key={run.id}>{formatScore(run.aqol)}</td>)}</tr><tr><th>К первому плану</th>{compared.map((run) => <td key={run.id}>{formatDelta(run.aqol - compared[0].aqol)}</td>)}</tr><tr><th>Инвестиции</th>{compared.map((run) => <td key={run.id}>{run.spent}</td>)}</tr><tr><th>Критических показателей</th>{compared.map((run) => <td key={run.id}>{run.criticalCount}</td>)}</tr></tbody></table></div></div>}</section>
      <section className={styles.methodNote}><FlaskConical size={20} aria-hidden="true" /><div><strong>Лаборатория, а не прогноз.</strong><p>Основной кейс воспроизводит заданный датасет Астаны: 5 районов и 10 показателей. Вариации и AI-кейсы служат учебными сценариями. Независимая статистическая проверка данных не заявляется. Источники обосновывают темы, а не коэффициенты модели.</p><div><a href="https://www.worldbank.org/en/news/press-release/2023/09/27/cities-across-central-asia-can-unlock-full-economic-potential-by-implementing-low-carbon-development-strategies" target="_blank" rel="noreferrer">World Bank: устойчивость городов <ChevronRight size={13} aria-hidden="true" /></a><a href="https://www.oecd.org/en/data/tools/oecd-regional-well-being.html" target="_blank" rel="noreferrer">OECD: благополучие регионов <ChevronRight size={13} aria-hidden="true" /></a></div></div></section>
    </main><footer className={styles.footer}><span>CITY LAB / Аким на 5 часов</span><span>Хорошие решения начинаются с вопросов.</span></footer>
  </div>;
}
