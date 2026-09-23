type BudgetMeterProps = {
  budget: number;
  spent: number;
};

export function BudgetMeter({ budget, spent }: BudgetMeterProps) {
  return (
    <aside className="budget-card" aria-label="Общий бюджет команды">
      <div className="budget-card-top"><span>БЮДЖЕТ СЕССИИ</span><span className="budget-lock">ЗАКРЕПЛЁН</span></div>
      <div className="budget-number">{budget}<span> ед.</span></div>
      <div className="budget-bar" role="meter" aria-label="Распределённый бюджет" aria-valuemin={0} aria-valuemax={budget} aria-valuenow={spent}>
        <span style={{ width: `${Math.min(100, spent / budget * 100)}%` }} />
      </div>
      <div className="budget-foot" aria-live="polite"><span>{spent} ед. распределено</span><strong>{budget - spent} ед. доступно</strong></div>
      <div className="budget-note">Одинаковый стартовый ресурс для каждой команды. Цены указаны в виртуальных единицах.</div>
    </aside>
  );
}
