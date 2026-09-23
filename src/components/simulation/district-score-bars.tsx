import { useId } from "react";
import { directions, type ScenarioResult } from "@/domain/model";
import { directionNames, formatDelta, formatScore } from "./presentation";
import styles from "./district-score-bars.module.css";

export function DistrictScoreBars({ result }: { result: ScenarioResult }) {
  const id = useId();

  return (
    <section className={styles.section} aria-labelledby={`${id}-heading`}>
      <h3 id={`${id}-heading`}>Изменения по районам</h3>
      <p className={styles.legend}>Шкала 0–100, больше — лучше. Верхняя полоса — было, нижняя — стало.</p>
      <div className={styles.grid}>
        {result.districts.map((district) => (
          <section
            className={styles.card}
            key={district.districtId}
            tabIndex={0}
            aria-labelledby={`${id}-${district.districtId}`}
          >
            <h4 id={`${id}-${district.districtId}`}>{district.districtName}</h4>
            <dl className={styles.indicators}>
              {directions.map((direction) => (
                <div className={styles.indicator} key={direction}>
                  <dt>{directionNames[direction]}</dt>
                  <dd>
                    <span className={styles.values}>
                      <span>Было {formatScore(district.baseline[direction])} → стало {formatScore(district.final[direction])}</span>
                      <span className={district.realizedDelta[direction] < 0 ? "negative-effect" : district.realizedDelta[direction] > 0 ? "positive-effect" : undefined}>
                        {district.realizedDelta[direction] === 0 ? "Без изменений" : `Изменение: ${formatDelta(district.realizedDelta[direction])}`}
                      </span>
                    </span>
                    <span className={styles.bars} aria-hidden="true">
                      <span className={styles.track}><span className={styles.baseline} style={{ width: `${district.baseline[direction]}%` }} /></span>
                      <span className={styles.track}><span className={styles.final} style={{ width: `${district.final[direction]}%` }} /></span>
                    </span>
                  </dd>
                </div>
              ))}
            </dl>
          </section>
        ))}
      </div>
    </section>
  );
}
