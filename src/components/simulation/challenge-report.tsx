import type { EventChallengeResult } from "@/domain/events";
import { directions } from "@/domain/model";
import { directionNames, formatDelta, formatScore } from "./presentation";
import styles from "./challenge.module.css";

export function ChallengeReport({ result }: { result: EventChallengeResult }) {
  const stages = [
    { label: "До события", description: "Исходный план", plan: result.initial },
    { label: "После события", description: "Те же пять решений", plan: result.disrupted },
    { label: "После ответа", description: "Перераспределённый план", plan: result.response },
  ];
  const affected = result.initial.districts.find((district) => district.districtId === result.event.districtId);
  const disrupted = result.disrupted.districts.find((district) => district.districtId === result.event.districtId);
  const response = result.response.districts.find((district) => district.districtId === result.event.districtId);

  return (
    <section className={styles.report} aria-labelledby="challenge-result-title">
      <div className="eyebrow compact">РЕЗУЛЬТАТ ЛАБОРАТОРИИ</div>
      <h2 id="challenge-result-title">Три состояния города</h2>
      <p>{result.event.name}. {result.event.description}</p>
      <div className={styles.scoreGrid}>{stages.map(({ label, description, plan }) => <article className={styles.scoreCard} key={label} aria-label={label}>
        <h3>{label}</h3><p>{description}</p><strong className={styles.score}>{formatScore(plan.finalAqol)}<small> AQoL / 100</small></strong><p>Расход: {plan.spent} ед. · Остаток: {plan.remaining} ед.</p>
      </article>)}</div>
      <dl className={styles.deltas}>
        <div><dt>Влияние события</dt><dd>{formatDelta(result.eventScoreDelta)} AQoL</dd><small>После события − до события</small></div>
        <div><dt>Эффект ответа</dt><dd>{formatDelta(result.recoveryDelta)} AQoL</dd><small>После ответа − после события</small></div>
        <div><dt>К первоначальному плану</dt><dd>{formatDelta(result.responseDeltaFromInitial)} AQoL</dd><small>После ответа − до события</small></div>
      </dl>
      <div className={styles.planNote}>
        <strong>{result.recoveryDelta > 0 ? "Перераспределение улучшило результат после события." : result.recoveryDelta < 0 ? "Ответный план снизил AQoL относительно плана после события." : "Ответный план сохранил AQoL после события."}</strong>
        <p>{result.responseDeltaFromInitial < 0 ? `До исходного AQoL ещё ${formatScore(-result.responseDeltaFromInitial)} пункта.` : result.responseDeltaFromInitial > 0 ? `Исходный AQoL превышен на ${formatScore(result.responseDeltaFromInitial)} пункта.` : "Исходный AQoL восстановлен."} В ответном плане осталось {result.response.remaining} ед. бюджета. Неизрасходованные средства сами по себе не повышают показатели.</p>
      </div>
      {affected && disrupted && response && <div className={styles.districtEffects}>
        <h3>Район события: {affected.districtName}</h3>
        <p>Эффект события измеряется при одинаковых исходных решениях. В колонке «После ответа» меняются и решения, поэтому её разница не приписывается одному событию.</p>
        <div className={styles.tableScroll} tabIndex={0} role="region" aria-label="Показатели района события, таблицу можно прокручивать"><table>
          <caption>Показатели 0–100 и влияние события</caption>
          <thead><tr><th scope="col">Направление</th><th scope="col">До события</th><th scope="col">После события</th><th scope="col">После ответа</th><th scope="col">Эффект по каталогу</th><th scope="col">Наблюдаемый эффект события</th></tr></thead>
          <tbody>{directions.map((direction) => <tr key={direction}><th scope="row">{directionNames[direction]}</th><td>{formatScore(affected.final[direction])}</td><td>{formatScore(disrupted.final[direction])}</td><td>{formatScore(response.final[direction])}</td><td>{formatDelta(result.event.rawDeltas[direction] ?? 0)}</td><td>{formatDelta(result.event.observedDeltas[direction] ?? 0)}</td></tr>)}</tbody>
        </table></div>
        <p>Каталожные воздействия суммируются с решениями, затем значения ограничиваются диапазоном 0–100. Поэтому наблюдаемый эффект может отличаться от каталожного.</p>
      </div>}
      <details className={styles.originalPlan}><summary>Сравнить все районы</summary><div className={styles.tableScroll} tabIndex={0} role="region" aria-label="Сравнение качества районов, таблицу можно прокручивать"><table><caption>Средний показатель района по пяти направлениям</caption><thead><tr><th scope="col">Район</th><th scope="col">До события</th><th scope="col">После события</th><th scope="col">После ответа</th></tr></thead><tbody>{result.initial.districts.map((district) => <tr key={district.districtId}><th scope="row">{district.districtName}</th><td>{formatScore(district.quality)}</td><td>{formatScore(result.disrupted.districts.find((item) => item.districtId === district.districtId)?.quality ?? district.quality)}</td><td>{formatScore(result.response.districts.find((item) => item.districtId === district.districtId)?.quality ?? district.quality)}</td></tr>)}</tbody></table></div></details>
      <p className={styles.explanation}>Сравнивайте команды только при одинаковых данных, правилах, каталоге и событии: {result.datasetVersion} / {result.rulesVersion} / {result.eventPackVersion} / {result.event.id}. Это детерминированное сравнение учебной модели; AI-разбор доступен в обычном сценарии.</p>
    </section>
  );
}
