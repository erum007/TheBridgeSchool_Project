import { useEffect, useMemo, useRef, useState } from 'react'

export default function Tabs({ tabs, defaultTab, activeTab: controlledActiveTab, onTabChange, className = '', wrapOnMobile = false }) {
  const visibleTabs = useMemo(() => tabs.filter((tab) => !tab.hidden), [tabs])
  const initialTab = defaultTab || visibleTabs[0]?.id
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
      const nextIndicator = { left: button.offsetLeft, width: button.offsetWidth }
      setIndicator((current) => current.left === nextIndicator.left && current.width === nextIndicator.width ? current : nextIndicator)
    }
  }, [activeTab, visibleTabs])

  const activeContent = useMemo(() => tabs.find((tab) => tab.id === activeTab)?.content, [activeTab, tabs])

  return (
    <div className={className}>
      <div className={`relative mb-6 border-b border-[var(--border-default)] ${wrapOnMobile ? '-mx-2 px-2 sm:mx-0 sm:px-0' : ''}`}>
        <div className={wrapOnMobile ? 'grid grid-cols-2 gap-1 sm:flex' : 'flex gap-1'}>
          {visibleTabs.map((tab) => (
            <button
              key={tab.id}
              ref={(element) => {
                if (element) {
                  buttonRefs.current[tab.id] = element
                }
              }}
              type="button"
              onClick={() => selectTab(tab.id)}
              className={`relative px-4 py-2.5 font-display text-sm font-medium transition-colors duration-150 ${wrapOnMobile ? `w-full text-center ${activeTab === tab.id ? 'border-b-2 border-[var(--brand-red)] sm:border-b-0' : 'border-b-2 border-transparent sm:border-b-0'}` : ''} ${activeTab === tab.id ? 'text-[var(--brand-navy)]' : 'text-[var(--text-muted)] hover:text-[var(--brand-navy)]'}`}
            >
              {tab.mobileLabel ? (
                <>
                  <span className="sm:hidden">{tab.mobileLabel}</span>
                  <span className="hidden sm:inline">{tab.label}</span>
                </>
              ) : tab.label}
            </button>
          ))}
        </div>
        <div
          className={`absolute bottom-0 h-0.5 bg-[var(--brand-red)] transition-all duration-200 ${wrapOnMobile ? 'hidden sm:block' : ''}`}
          style={{ left: `${indicator.left}px`, width: `${indicator.width}px` }}
        />
      </div>
      <div>{activeContent}</div>
    </div>
  )
}
