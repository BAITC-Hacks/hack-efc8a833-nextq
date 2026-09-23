import {
  ArrowDownRight,
  ArrowUpRight,
  Building2,
  BusFront,
  Clock3,
  HeartPulse,
  MapPinned,
  ShieldCheck,
  Trees,
} from "lucide-react";

const directions = [
  { id: "01", name: "Транспорт", icon: BusFront, color: "mint", status: "Ожидает решения" },
  { id: "02", name: "Зелёные зоны", icon: Trees, color: "leaf", status: "Ожидает решения" },
  { id: "03", name: "Социальная среда", icon: HeartPulse, color: "rose", status: "Ожидает решения" },
  { id: "04", name: "Безопасность", icon: ShieldCheck, color: "amber", status: "Ожидает решения" },
  { id: "05", name: "Городские сервисы", icon: Building2, color: "blue", status: "Ожидает решения" },
];

const districts = [
  { name: "Оркен", score: 50, delta: 0 },
  { name: "Арна", score: 50, delta: 0 },
  { name: "Самал", score: 50, delta: 0 },
  { name: "Бастау", score: 50, delta: 0 },
  { name: "Керуен", score: 50, delta: 0 },
  { name: "Жибек", score: 50, delta: 0 },
];

export default function Home() {
  return (
    <main className="command-page">
      <header className="topbar">
        <a className="brand" href="#overview" aria-label="Аким на 5 часов, на главную">
          <span className="brand-mark"><MapPinned size={19} strokeWidth={1.8} /></span>
          <span className="brand-copy"><strong>ҚАЛА / CITY LAB</strong><small>СИМУЛЯТОР УПРАВЛЕНИЯ</small></span>
        </a>
        <div className="topbar-center"><span className="live-dot" /> УЧЕБНЫЙ СЦЕНАРИЙ <span className="topbar-separator">/</span> СЕССИЯ 001</div>
        <button className="language-button" type="button" aria-label="Язык интерфейса">RU <span>⌄</span></button>
      </header>

      <section className="briefing" id="overview">
        <div className="briefing-copy">
          <div className="eyebrow"><span>ASTANA / 2026</span><span className="eyebrow-line" /><span>УПРАВЛЕНЧЕСКИЙ БРИФИНГ № 05</span></div>
          <h1>Город — это<br /><em>сумма решений.</em></h1>
          <p>Пять направлений. Один общий бюджет. Выберите, каким станет город после вашего заседания.</p>
          <div className="briefing-meta"><span><Clock3 size={15} /> 5 ЭТАПОВ</span><span><MapPinned size={15} /> 6 РАЙОНОВ</span></div>
        </div>

        <aside className="budget-card" aria-label="Общий бюджет команды">
          <div className="budget-card-top"><span>БЮДЖЕТ СЕССИИ</span><span className="budget-lock">ЗАКРЕПЛЁН</span></div>
          <div className="budget-number">100<span> ед.</span></div>
          <div className="budget-bar" aria-label="Использовано 0 из 100"><span /></div>
          <div className="budget-foot"><span>0 ед. распределено</span><strong>100 ед. доступно</strong></div>
          <div className="budget-note">Одинаковый стартовый ресурс для каждой команды</div>
        </aside>
      </section>

      <section className="workspace" aria-label="План заседания">
        <div className="section-heading">
          <div><div className="eyebrow compact"><span>ПОВЕСТКА ЗАСЕДАНИЯ</span></div><h2>Пять решений</h2></div>
          <span className="progress-label">00 <i>/</i> 05 <small>ПРИНЯТО</small></span>
        </div>

        <div className="decision-layout">
          <div className="decision-list">
            {directions.map(({ id, name, icon: Icon, color, status }) => (
              <article className="decision-card" key={id}>
                <div className={`decision-icon ${color}`}><Icon size={20} strokeWidth={1.8} /></div>
                <div className="decision-main"><div className="decision-overline">НАПРАВЛЕНИЕ {id}</div><h3>{name}</h3><p>{status}</p></div>
                <div className="decision-empty"><span aria-hidden="true">—</span><small>не выбрано</small></div>
                <span className="card-chevron" aria-hidden="true">↗</span>
              </article>
            ))}
          </div>

          <aside className="district-panel">
            <div className="district-panel-head"><div><span className="panel-kicker">ГОРОДСКОЙ СРЕЗ</span><h3>Районы</h3></div><span className="baseline-tag">БАЗА</span></div>
            <div className="district-list">
              {districts.map((district, index) => (
                <div className="district-row" key={district.name}>
                  <span className="district-index">0{index + 1}</span><span className="district-name">{district.name}</span>
                  <div className="district-track"><span style={{ width: `${district.score}%` }} /></div>
                  <strong>{district.score}</strong>
                  <span className="district-delta">{district.delta > 0 ? <><ArrowUpRight size={13} /> +{district.delta}</> : <><ArrowDownRight size={13} /> —</>}</span>
                </div>
              ))}
            </div>
            <div className="district-panel-foot"><span>ИСХОДНЫЙ AQOL</span><strong>50.0 <small>/ 100</small></strong></div>
          </aside>
        </div>
      </section>

      <footer className="page-footer"><span>МОДЕЛЬ v1.0 <b>·</b> СИНТЕТИЧЕСКИЕ ДАННЫЕ</span><span>ГОРОДСКАЯ СРЕДА <b>·</b> ОБЩЕСТВЕННОЕ БЛАГО</span></footer>
    </main>
  );
}
