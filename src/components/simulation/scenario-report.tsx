import { directions, type ScenarioResult } from "@/domain/model";
import { directionNames, formatDelta, formatScore } from "./presentation";

export type Narration =
  | { status: "ready"; content: { summary: string; strengths: string[]; risks: string[]; tradeoffs: string[] } }
  | { status: "unavailable"; reason: string };

export type ScenarioResponse = { result: ScenarioResult; narration: Narration };

export function ScenarioReport({ result, narration }: ScenarioResponse) {
  return (
    <section className="scenario-report" aria-labelledby="report-heading">
      <div className="section-heading"><div><div className="eyebrow compact">ИТОГ ЗАСЕДАНИЯ</div><h2 id="report-heading">Что изменилось в городе</h2></div></div>
      <div className="report-summary">
        <div className="score-card"><span className="panel-kicker">ASTANA QUALITY OF LIFE SCORE</span><strong>{formatScore(result.finalAqol)}<small> / 100</small></strong><p>Было {formatScore(result.baselineAqol)} <span className={result.finalAqol < result.baselineAqol ? "negative-effect" : "positive-effect"}>({formatDelta(result.finalAqol - result.baselineAqol)})</span></p></div>
        <div className="report-budget"><span>Распределено<strong>{result.spent} ед.</strong></span><span>Остаток<strong>{result.remaining} ед.</strong></span><p>AQoL учитывает средние показатели жителей и положение самого слабого района.</p></div>
      </div>
      <div className="table-scroll" role="region" aria-label="Изменения показателей районов" tabIndex={0}>
        <table className="impact-table"><caption>Показатели районов: было → стало. Шкала от 0 до 100.</caption><thead><tr><th scope="col">Район</th>{directions.map((direction) => <th scope="col" key={direction}>{directionNames[direction]}</th>)}<th scope="col">Качество среды</th></tr></thead><tbody>
          {result.districts.map((district) => <tr key={district.districtId}><th scope="row">{district.districtName}</th>{directions.map((direction) => <td key={direction}><span>{formatScore(district.baseline[direction])} → {formatScore(district.final[direction])}</span><small className={district.realizedDelta[direction] < 0 ? "negative-effect" : "positive-effect"}>{formatDelta(district.realizedDelta[direction])}</small></td>)}<td><strong>{formatScore(district.quality)}</strong></td></tr>)}
        </tbody></table>
      </div>
      {result.impacts.some((impact) => impact.kind === "interaction") && <p className="interaction-note">Совместный эффект: карманные парки и освещение в одном районе дополнительно повышают безопасность на 2 пункта до ограничения шкалой 100.</p>}
      <section className="narration-panel" aria-labelledby="narration-heading">
        <div className="narration-heading"><h3 id="narration-heading">AI-разбор решений</h3><span className="baseline-tag">{narration?.status === "ready" ? "ГОТОВ" : "НЕДОСТУПЕН"}</span></div>
        {narration?.status === "ready" ? <><p className="narration-summary">{narration.content.summary}</p><div className="narration-columns">{([['strengths', 'Сильные стороны'], ['risks', 'Риски'], ['tradeoffs', 'Компромиссы']] as const).map(([key, title]) => <div key={key}><h4>{title}</h4>{narration.content[key].length ? <ul>{narration.content[key].map((item, index) => <li key={index}>{item}</li>)}</ul> : <p>В объяснении не отмечены.</p>}</div>)}</div></> : <p>{narration?.reason || "AI-объяснение пока недоступно."} Численный результат рассчитан и доступен выше.</p>}
      </section>
      <p className="model-note">Это учебная модель на синтетических данных. Условные эффекты не являются прогнозом для реальной Астаны.</p>
    </section>
  );
}
