import { createContext, useContext, useEffect, useState, useCallback } from 'react'
import { supabase } from '@/lib/supabase'
import { useAuth } from '@/contexts/AuthContext'

export interface SubscriptionPlan {
  id: string
  name: string
  description: string | null
  price_monthly: number
  price_annual: number | null
  features: Record<string, any>
  is_active: boolean
  sort_order: number
}

interface SubscriptionContextValue {
  plan: SubscriptionPlan | null
  status: string
  loading: boolean
  hasFeature: (key: string) => boolean
  getLimit: (key: string) => number | null
  refresh: () => void
}

const SubscriptionContext = createContext<SubscriptionContextValue>({
  plan: null, status: 'active', loading: true,
  hasFeature: () => false, getLimit: () => null, refresh: () => {},
})

export function useSubscription() {
  return useContext(SubscriptionContext)
}

export function SubscriptionProvider({ children }: { children: React.ReactNode }) {
  const { user } = useAuth()
  const [plan,    setPlan]    = useState<SubscriptionPlan | null>(null)
  const [status,  setStatus]  = useState('active')
  const [loading, setLoading] = useState(true)

  const load = useCallback(async () => {
    if (!user) { setLoading(false); return }
    setLoading(true)
    try {
      const { data: profile } = await supabase
        .from('profiles')
        .select('subscription_plan_id, subscription_status, subscription_plans(*)')
        .eq('id', user.id)
        .single()

      if (profile?.subscription_plans) {
        setPlan(profile.subscription_plans as unknown as SubscriptionPlan)
        setStatus(profile.subscription_status ?? 'active')
      } else {
        // Fall back to free plan
        const { data: freePlan } = await supabase
          .from('subscription_plans')
          .select('*')
          .eq('name', 'Free')
          .single()
        setPlan(freePlan ?? null)
        setStatus('active')
      }
    } finally {
      setLoading(false)
    }
  }, [user])

  useEffect(() => { load() }, [load])

  function hasFeature(key: string): boolean {
    if (!plan) return false
    const val = plan.features[key]
    if (typeof val === 'boolean') return val
    if (typeof val === 'number') return val > 0
    return val != null
  }

  function getLimit(key: string): number | null {
    if (!plan) return null
    const val = plan.features[key]
    return typeof val === 'number' ? val : null
  }

  return (
    <SubscriptionContext.Provider value={{ plan, status, loading, hasFeature, getLimit, refresh: load }}>
      {children}
    </SubscriptionContext.Provider>
  )
}
