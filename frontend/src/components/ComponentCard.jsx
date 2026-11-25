// 부품 하나의 카드. 지금은 등급 정의만 보여 주고, 예측 API가 생기면 현재 상태를 표시합니다.
export default function ComponentCard({ component }) {
  return (
    <article className="card">
      <h2>{component.name}</h2>
      <p className="muted">라벨: {component.label_column}</p>
      <ul>
        {component.grades.map((g) => (
          <li key={g.value}>
            {g.value} {component.unit} · {g.meaning}
          </li>
        ))}
      </ul>
    </article>
  )
}
