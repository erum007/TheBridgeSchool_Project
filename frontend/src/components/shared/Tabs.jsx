import { useEffect, useMemo, useRef, useState } from 'react'

export default function Tabs({ tabs, defaultTab, activeTab: controlledActiveTab, onTabChange }) {
  const initialTab = defaultTab || tabs[0]?.id
  const [uncontrolledActiveTab, setUncontrolledActiveTab] = useState(initialTab)
  const activeTab = controlledActiveTab ?? uncontrolledActiveTab
  const selectTab = (tabId) => {
    if (controlledActiveTab === undefined) setUncontrolledActiveTab(tabId)
    onTabChange?.(tabId)
  }
  const buttonRefs = useRef({})
  const [indicator, setIndicator] = useState({ left: 0, width: 0 })

  useEffect(() => {
    const button = buttonRefs.current[activeTab]
    if (button) {
      setIndicator({ left: button.offsetLeft, width: button.offsetWidth })
    }
  }, [activeTab, tabs])

  const activeContent = useMemo(() => tabs.find((tab) => tab.id === activeTab)?.content, [activeTab, tabs])

  return (
    <div>
      <div className="relative mb-6 border-b border-[var(--border-default)]">
        <div className="flex gap-1">
          {tabs.map((tab) => (
            <button
              key={tab.id}
              ref={(element) => {
                if (element) {
                  buttonRefs.current[tab.id] = element
                }
              }}
              type="button"
              onClick={() => selectTab(tab.id)}
              className={`relative px-4 py-2.5 font-display text-sm font-medium transition-colors duration-150 ${activeTab === tab.id ? 'text-[var(--brand-navy)]' : 'text-[var(--text-muted)] hover:text-[var(--brand-navy)]'}`}
            >
              {tab.label}
            </button>
          ))}
        </div>
        <div
          className="absolute bottom-0 h-0.5 bg-[var(--brand-red)] transition-all duration-200"
          style={{ left: `${indicator.left}px`, width: `${indicator.width}px` }}
        />
      </div>
      <div>{activeContent}</div>
    </div>
  )
}
