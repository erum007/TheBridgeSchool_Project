import { useEffect, useState } from 'react'

export function useApi(apiFn, deps = []) {
  const [data, setData] = useState(undefined)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(null)
  const [tick, setTick] = useState(0)

  useEffect(() => {
    let active = true

    async function run() {
      try {
        setLoading(true)
        setError(null)
        const result = await apiFn()
        if (active) {
          setData(result?.data ?? result)
        }
      } catch (nextError) {
        if (active) {
          setError(nextError)
        }
      } finally {
        if (active) {
          setLoading(false)
        }
      }
    }

    run()

    return () => {
      active = false
    }
  }, [...deps, tick])

  return {
    data,
    loading,
    error,
    refetch: () => setTick((current) => current + 1),
    setData,
  }
}
