// 백엔드 API 호출 모음. 개발 중에는 vite.config.js의 proxy가 /api를 localhost:8000으로 보냅니다.
async function get(path) {
  const res = await fetch(`/api${path}`)
  if (!res.ok) throw new Error(`${path} 요청 실패: ${res.status}`)
  return res.json()
}

export const fetchHealth = () => get('/health')
export const fetchComponents = () => get('/components')
