'use client'

import React, { useState } from 'react'
import { motion } from 'framer-motion'
import { PrivacyFlow } from '@/components/docs/visuals/PrivacyFlow'
import { ECDHKeyDerivation } from '@/components/docs/visuals/ECDHKeyDerivation'
import { MerkleTreeMixer } from '@/components/docs/visuals/MerkleTreeMixer'
import { KeyManagement } from '@/components/docs/visuals/KeyManagement'
import { EndToEndTimeline } from '@/components/docs/visuals/EndToEndTimeline'
import { PaymentLinkCard } from '@/components/docs/visuals/PaymentLinkCard'
import { AccountTypeSwitcher } from '@/components/docs/visuals/AccountTypeSwitcher'

type ScreenId =
    | 'overview'
    | 'stealth'
    | 'pool'
    | 'keys'
    | 'lifecycle'
    | 'links'
    | 'accounts'

const NAV_ITEMS: {
    id: ScreenId
    label: string
}[] = [
        {
            id: 'overview',
            label: 'OVERVIEW',
        },
        {
            id: 'stealth',
            label: 'STEALTH',
        },
        {
            id: 'pool',
            label: 'PRIVACY POOL',
        },
        {
            id: 'keys',
            label: 'KEY MGMT',
        },
        {
            id: 'lifecycle',
            label: 'LIFECYCLE',
        },
        {
            id: 'links',
            label: 'PAY LINKS',
        },
        {
            id: 'accounts',
            label: 'ACCOUNTS',
        },
    ]

export default function DocsVisualsPage() {
    const [currentScreen, setCurrentScreen] = useState<ScreenId>('overview')

    const renderScreen = () => {
        switch (currentScreen) {
            case 'overview':
                return <PrivacyFlow />
            case 'stealth':
                return <ECDHKeyDerivation />
            case 'pool':
                return <MerkleTreeMixer />
            case 'keys':
                return <KeyManagement />
            case 'lifecycle':
                return <EndToEndTimeline />
            case 'links':
                return <PaymentLinkCard />
            case 'accounts':
                return <AccountTypeSwitcher />
            default:
                return <PrivacyFlow />
        }
    }

    return (
        <div className="flex h-screen w-full bg-dust-bg text-dust-text font-mono overflow-hidden selection:bg-dust-green selection:text-black">
            {/* Sidebar */}
            <nav className="w-[160px] flex-shrink-0 border-r border-dust-border flex flex-col bg-dust-bg z-20">
                <div className="p-6 pb-8">
                    <h1 className="text-[14px] font-bold text-dust-green tracking-tight">
                        DUST
                    </h1>
                    <p className="text-[9px] text-dust-muted mt-1 tracking-widest">
                        DOCS VISUALS
                    </p>
                </div>

                <ul className="flex flex-col w-full">
                    {NAV_ITEMS.map((item) => {
                        const isActive = currentScreen === item.id
                        return (
                            <li key={item.id}>
                                <button
                                    onClick={() => setCurrentScreen(item.id)}
                                    className={`
                    w-full text-left px-6 py-3 text-[11px] uppercase tracking-wider transition-all duration-150 border-l-2
                    ${isActive ? 'border-dust-green bg-[rgba(0,255,65,0.06)] text-dust-green' : 'border-transparent text-dust-muted hover:text-white hover:bg-[rgba(255,255,255,0.02)]'}
                  `}
                                >
                                    {item.label}
                                </button>
                            </li>
                        )
                    })}
                </ul>
            </nav>

            {/* Main Content */}
            <main className="flex-1 relative overflow-hidden flex flex-col">
                {/* Background Grid */}
                <div className="absolute inset-0 bg-grid-pattern opacity-10 pointer-events-none" />

                {/* Screen Container */}
                <div className="flex-1 flex items-center justify-center p-8 relative z-10">
                    <motion.div
                        key={currentScreen}
                        initial={{
                            opacity: 0,
                            y: 10,
                        }}
                        animate={{
                            opacity: 1,
                            y: 0,
                        }}
                        exit={{
                            opacity: 0,
                            y: -10,
                        }}
                        transition={{
                            duration: 0.25,
                            ease: 'easeOut',
                        }}
                        className="w-full h-full flex items-center justify-center"
                    >
                        {renderScreen()}
                    </motion.div>
                </div>
            </main>
        </div>
    )
}
