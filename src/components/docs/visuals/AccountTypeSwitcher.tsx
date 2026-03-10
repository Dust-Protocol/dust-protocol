"use client";
import React, { useState } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { Key, ArrowRight, FileCode, Database, Zap } from 'lucide-react'
const TABS = [
    {
        id: 'eoa',
        label: 'EOA',
    },
    {
        id: '4337',
        label: 'ERC-4337',
    },
    {
        id: 'create2',
        label: 'CREATE2',
    },
    {
        id: '7702',
        label: 'EIP-7702',
    },
]
export function AccountTypeSwitcher() {
    const [activeTab, setActiveTab] = useState('eoa')
    return (
        <div className="w-full relative border border-dust-border bg-[rgba(255,255,255,0.01)] p-4 sm:p-8 flex flex-col">
            <div className="absolute top-6 left-6 text-[10px] text-dust-muted uppercase tracking-widest">
                ACCOUNT TYPES / EIP-7702
            </div>

            {/* Tabs */}
            <div className="flex w-full mt-8 border-b border-dust-border">
                {TABS.map((tab) => (
                    <button
                        key={tab.id}
                        onClick={() => setActiveTab(tab.id)}
                        className={`
              flex-1 py-3 text-[11px] font-mono transition-all duration-200 border-b
              ${activeTab === tab.id ? 'border-dust-green text-dust-green bg-[rgba(0,255,65,0.08)]' : 'border-transparent text-dust-muted hover:text-white hover:bg-[rgba(255,255,255,0.02)]'}
            `}
                    >
                        {tab.label}
                    </button>
                ))}
            </div>

            {/* Content Panel */}
            <div className="flex-1 relative mt-8">
                <AnimatePresence mode="wait">
                    <motion.div
                        key={activeTab}
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
                            duration: 0.2,
                        }}
                        className="w-full h-full flex flex-col"
                    >
                        {/* Visualization Area */}
                        <div className="w-full h-[200px] border border-dust-border bg-[rgba(255,255,255,0.02)] flex items-center justify-center relative mb-6">
                            {activeTab === 'eoa' && (
                                <div className="flex items-center gap-4">
                                    <div className="p-4 border border-dust-border bg-dust-bg flex flex-col items-center">
                                        <Key className="w-6 h-6 text-dust-muted mb-2" />
                                        <span className="text-[10px]">Private Key</span>
                                    </div>
                                    <div className="flex flex-col items-center">
                                        <ArrowRight className="w-4 h-4 text-dust-muted" />
                                        <span className="text-[8px] text-dust-muted mt-1">
                                            sign txn
                                        </span>
                                    </div>
                                    <div className="p-4 border border-dust-green bg-dust-bg flex flex-col items-center">
                                        <Zap className="w-6 h-6 text-dust-green mb-2" />
                                        <span className="text-[10px]">Broadcast</span>
                                    </div>
                                </div>
                            )}

                            {activeTab === '4337' && (
                                <div className="flex items-center gap-2 flex-wrap justify-center">
                                    <div className="w-20 h-12 border border-dust-border flex items-center justify-center text-[9px] text-center">
                                        Stealth Key
                                    </div>
                                    <ArrowRight className="w-3 h-3 text-dust-muted" />
                                    <div className="w-20 h-12 border border-dust-border flex items-center justify-center text-[9px] text-center">
                                        EntryPoint
                                    </div>
                                    <ArrowRight className="w-3 h-3 text-dust-muted" />
                                    <div className="w-24 h-12 border border-dust-green bg-dust-green/10 flex items-center justify-center text-[9px] text-center text-dust-green">
                                        DustPaymaster
                                    </div>
                                    <ArrowRight className="w-3 h-3 text-dust-muted" />
                                    <div className="w-20 h-12 border border-dust-border flex items-center justify-center text-[9px] text-center">
                                        Account
                                    </div>

                                    {/* Animated Dot */}
                                    <motion.div
                                        className="absolute bottom-2 left-1/2 -translate-x-1/2 w-1.5 h-1.5 bg-dust-green rounded-full"
                                        animate={{
                                            x: [-100, 100],
                                            opacity: [0, 1, 0],
                                        }}
                                        transition={{
                                            duration: 2,
                                            repeat: Infinity,
                                        }}
                                    />
                                </div>
                            )}

                            {activeTab === 'create2' && (
                                <div className="flex flex-col items-center gap-4">
                                    <div className="flex gap-4">
                                        <div className="px-3 py-2 border border-dust-border text-[10px]">
                                            Salt
                                        </div>
                                        <div className="px-3 py-2 border border-dust-border text-[10px]">
                                            Bytecode
                                        </div>
                                    </div>
                                    <div className="w-px h-8 bg-dust-border" />
                                    <div className="px-4 py-2 border border-dust-green text-[10px] text-dust-green">
                                        Deterministic Address
                                    </div>
                                    <span className="text-[9px] text-dust-muted">
                                        Address exists before deployment
                                    </span>
                                </div>
                            )}

                            {activeTab === '7702' && (
                                <div className="flex items-center gap-4 sm:gap-12 relative">
                                    <div className="w-24 h-24 border border-dust-border flex flex-col items-center justify-center">
                                        <span className="text-[12px] font-bold">EOA</span>
                                    </div>

                                    <div className="w-32 h-24 border border-dashed border-dust-amber bg-dust-amber/5 flex flex-col items-center justify-center text-center p-2">
                                        <FileCode className="w-5 h-5 text-dust-amber mb-2" />
                                        <span className="text-[9px] text-dust-amber">
                                            Smart Contract Implementation
                                        </span>
                                    </div>

                                    {/* Curved Arrows */}
                                    <svg className="absolute inset-0 w-full h-full pointer-events-none overflow-visible">
                                        <path
                                            d="M 100 30 Q 140 10 180 30"
                                            fill="none"
                                            stroke="#FFB000"
                                            strokeWidth="1"
                                            strokeDasharray="4 4"
                                            markerEnd="url(#arrow)"
                                        />
                                        <path
                                            d="M 180 70 Q 140 90 100 70"
                                            fill="none"
                                            stroke="#FFB000"
                                            strokeWidth="1"
                                            strokeDasharray="4 4"
                                            markerEnd="url(#arrow)"
                                        />
                                        <defs>
                                            <marker
                                                id="arrow"
                                                markerWidth="10"
                                                markerHeight="10"
                                                refX="9"
                                                refY="3"
                                                orient="auto"
                                                markerUnits="strokeWidth"
                                            >
                                                <path d="M0,0 L0,6 L9,3 z" fill="#FFB000" />
                                            </marker>
                                        </defs>
                                    </svg>

                                    <div className="absolute top-0 left-1/2 -translate-x-1/2 -translate-y-1/2 bg-dust-bg px-2 text-[9px] text-dust-amber border border-dust-amber/20">
                                        EPHEMERAL
                                    </div>
                                </div>
                            )}
                        </div>

                        {/* Pills & Description */}
                        <div className="flex flex-col gap-4">
                            <div className="flex gap-2 flex-wrap">
                                {activeTab === 'eoa' && (
                                    <>
                                        <span className="px-2 py-1 bg-dust-green/10 text-dust-green text-[9px] border border-dust-green/20">
                                            UNIVERSAL COMPAT
                                        </span>
                                        <span className="px-2 py-1 bg-white/5 text-dust-muted text-[9px] border border-white/10">
                                            NEEDS GAS
                                        </span>
                                    </>
                                )}
                                {activeTab === '4337' && (
                                    <>
                                        <span className="px-2 py-1 bg-dust-green/10 text-dust-green text-[9px] border border-dust-green/20">
                                            GASLESS
                                        </span>
                                        <span className="px-2 py-1 bg-dust-green/10 text-dust-green text-[9px] border border-dust-green/20">
                                            ATOMIC DEPLOY
                                        </span>
                                        <span className="px-2 py-1 bg-dust-green/10 text-dust-green text-[9px] border border-dust-green/20">
                                            DEFAULT IN DUST
                                        </span>
                                    </>
                                )}
                                {activeTab === 'create2' && (
                                    <>
                                        <span className="px-2 py-1 bg-dust-green/10 text-dust-green text-[9px] border border-dust-green/20">
                                            DETERMINISTIC
                                        </span>
                                        <span className="px-2 py-1 bg-white/5 text-dust-muted text-[9px] border border-white/10">
                                            NEEDS SPONSOR
                                        </span>
                                    </>
                                )}
                                {activeTab === '7702' && (
                                    <>
                                        <span className="px-2 py-1 bg-dust-amber/10 text-dust-amber text-[9px] border border-dust-amber/20">
                                            EIP-7702
                                        </span>
                                        <span className="px-2 py-1 bg-dust-green/10 text-dust-green text-[9px] border border-dust-green/20">
                                            BATCH CLAIMS
                                        </span>
                                        <span className="px-2 py-1 bg-white/5 text-dust-muted text-[9px] border border-white/10">
                                            PECTRA ONLY
                                        </span>
                                    </>
                                )}
                            </div>

                            <p className="text-[11px] text-dust-muted leading-relaxed">
                                {activeTab === 'eoa' &&
                                    'Standard Ethereum accounts. Simple but limited. Requires ETH for gas on every transaction.'}
                                {activeTab === '4337' &&
                                    'Standard for Dust claims. UserOps sponsored by DustPaymaster — recipient pays zero gas.'}
                                {activeTab === 'create2' &&
                                    'Allows computing address before deployment. Critical for stealth accounts receiving funds before they exist.'}
                                {activeTab === '7702' &&
                                    'Future standard allowing EOAs to temporarily act as smart contracts during a transaction batch.'}
                            </p>
                        </div>
                    </motion.div>
                </AnimatePresence>
            </div>
        </div>
    )
}
