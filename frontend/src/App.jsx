import { useEffect, useState } from 'react'
import { fetchComponents, fetchHealth } from './api/client.js'
import ComponentCard from './components/ComponentCard.jsx'

export default function App() {
  const [status, setStatus] = useState('확인 중')
  const [components, setComponents] = useState([])

  useEffect(() => {
    fetchHealth()
      .then(() => setStatus('연결됨'))
      .then(fetchComponents)
      .then(setComponents)
      .catch(() => setStatus('연결 안 됨 (백엔드 실행 확인)'))
  }, [])

  return (
    <main>
      <header>
        <h1>유압 시스템 4대 부품 이상진단</h1>
        <p className="muted">백엔드: {status}</p>
      </header>
      <section className="grid">
        {components.map((c) => (
          <ComponentCard key={c.key} component={c} />
        ))}
      </section>
    </main>
  )
}
