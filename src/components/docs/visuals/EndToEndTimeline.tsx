"use client";
import React, { useEffect, useState } from 'react'
import { motion } from 'framer-motion'
import { Key, ArrowUpRight, Scan, Zap, RefreshCw } from 'lucide-react'
const PHASES = [
    {
        id: '01',
        title: 'IDENTITY SETUP',
        sub: 'register .dust name on StealthNameRegistry',
        icon: Key,
    },
    {
        id: '02',
        title: 'PAYMENT SENT',
        sub: 'sender derives stealth address via ECDH',
        icon: ArrowUpRight,
    },
    {
        id: '03',
        title: 'PAYMENT DETECTED',
        sub: 'scanner matches announcement',
        icon: Scan,
    },
    {
        id: '04',
        title: 'GASLESS CLAIM',
        sub: 'ERC-4337 UserOp via DustPaymaster',
        icon: Zap,
    },
    {
        id: '05',
        title: 'POOL CONSOLIDATE',
        sub: 'ZK proof withdrawal breaks fan-in link',
        icon: RefreshCw,
    },
]
export function EndToEndTimeline() {
    const [activePhase, setActivePhase] = useState(0)
    const [isPaused, setIsPaused] = useState(false)
    useEffect(() => {
        if (isPaused) return
        const interval = setInterval(() => {
            setActivePhase((prev) => (prev + 1) % PHASES.length)
        }, 2000)
        return () => clearInterval(interval)
    }, [isPaused])
    return (
        <div className="w-full relative border border-dust-border bg-[rgba(255,255,255,0.01)] p-4 sm:p-8 flex flex-col">
            <div className="absolute top-6 left-6 text-[10px] text-dust-muted uppercase tracking-widest">
                HOW IT WORKS / LIFECYCLE
            </div>

            <div className="flex-1 flex flex-col justify-center items-center max-w-2xl mx-auto w-full">
                {PHASES.map((phase, index) => {
                    const isActive = index === activePhase
                    const isPast = index < activePhase
                    const Icon = phase.icon
                    return (
                        <div
                            key={phase.id}
                            className="flex w-full relative group cursor-pointer"
                            onClick={() => {
                                setActivePhase(index)
                                setIsPaused(true)
                            }}
                        >
                            {/* Connector Line */}
                            {index < PHASES.length - 1 && (
                                <div className="absolute left-[18px] top-[36px] bottom-[-16px] w-px bg-[rgba(255,255,255,0.08)]">
                                    {/* Animated Fill */}
                                    {(isActive || isPast) && (
                                        <motion.div
                                            initial={{
                                                height: '0%',
                                            }}
                                            animate={{
                                                height: isPast ? '100%' : '100%',
                                            }}
                                            transition={{
                                                duration: 2,
                                                ease: 'linear',
                                            }}
                                            className="w-full bg-dust-green"
                                        />
                                    )}
                                </div>
                            )}

                            {/* Number Box */}
                            <motion.div
                                animate={{
                                    borderColor: isActive ? '#00FF41' : 'rgba(0,255,65,0.2)',
                                    backgroundColor: isActive
                                        ? 'rgba(0,255,65,0.12)'
                                        : 'rgba(0,255,65,0.08)',
                                }}
                                className="w-9 h-9 flex-shrink-0 flex items-center justify-center border text-[12px] font-bold font-mono text-dust-green z-10"
                            >
                                {phase.id}
                            </motion.div>

                            {/* Content */}
                            <div className="flex-1 flex items-center justify-between ml-6 mb-8">
                                <div className="flex flex-col">
                                    <span
                                        className={`text-[13px] font-bold transition-colors duration-300 ${isActive ? 'text-white' : 'text-dust-muted'}`}
                                    >
                                        {phase.title}
                                    </span>
                                    <span className="text-[11px] text-dust-muted mt-0.5">
                                        {phase.sub}
                                    </span>
                                </div>

                                <div
                                    className={`p-2 rounded-full border transition-colors duration-300 ${isActive ? 'border-dust-green/30 bg-dust-green/5' : 'border-transparent'}`}
                                >
                                    <Icon
                                        className={`w-4 h-4 ${isActive ? 'text-dust-green' : 'text-dust-muted/30'}`}
                                    />
                                </div>
                            </div>
                        </div>
                    )
                })}
            </div>
        </div>
    )
}
