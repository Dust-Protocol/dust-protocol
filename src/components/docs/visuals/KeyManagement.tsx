"use client";
import React from 'react'
import { motion } from 'framer-motion'
import { PenTool, Lock, Eye, ArrowDown } from 'lucide-react'

function FlowArrow({ label }: { label: string }) {
    return (
        <div className="flex flex-col items-center py-2 gap-1">
            <div className="w-px h-5 bg-dust-green/30" />
            <div className="flex items-center gap-2">
                <ArrowDown className="w-3.5 h-3.5 text-dust-green/50" />
                <span className="text-[8px] text-dust-green/60 uppercase tracking-widest">{label}</span>
            </div>
            <div className="w-px h-5 bg-dust-green/30" />
        </div>
    )
}

export function KeyManagement() {
    return (
        <div className="w-full max-w-3xl border border-dust-border bg-[rgba(255,255,255,0.01)] p-6 flex flex-col font-mono">
            <div className="text-[10px] text-dust-muted uppercase tracking-[0.2em] mb-5">
                KEY MANAGEMENT / PBKDF2 DERIVATION
            </div>

            {/* STEP 1 — Two inputs */}
            <div className="flex items-center gap-2 mb-3">
                <span className="text-[9px] text-dust-green font-bold w-5 h-5 border border-dust-green/30 flex items-center justify-center">1</span>
                <span className="text-[9px] text-dust-muted uppercase tracking-wider">You provide two secrets</span>
            </div>
            <div className="grid grid-cols-2 gap-4">
                <div className="border border-dust-border bg-[rgba(255,255,255,0.02)] p-4 flex items-center gap-3">
                    <PenTool className="w-4 h-4 text-dust-muted flex-shrink-0" />
                    <div>
                        <div className="text-[11px] text-white font-semibold">Wallet Signature</div>
                        <div className="text-[9px] text-dust-muted mt-0.5">from your connected wallet</div>
                    </div>
                </div>
                <div className="border border-dust-border bg-[rgba(255,255,255,0.02)] p-4 flex items-center gap-3">
                    <span className="text-[14px] text-dust-muted tracking-[0.2em] flex-shrink-0">••••</span>
                    <div>
                        <div className="text-[11px] text-white font-semibold">PIN Code</div>
                        <div className="text-[9px] text-dust-muted mt-0.5">your secret 4-digit PIN</div>
                    </div>
                </div>
            </div>

            {/* Arrow: combined */}
            <FlowArrow label="combined into" />

            {/* STEP 2 — PBKDF2 processor */}
            <div className="flex items-center gap-2 mb-3">
                <span className="text-[9px] text-dust-green font-bold w-5 h-5 border border-dust-green/30 flex items-center justify-center">2</span>
                <span className="text-[9px] text-dust-muted uppercase tracking-wider">Key derivation runs</span>
            </div>
            <motion.div
                animate={{
                    borderColor: [
                        'rgba(255,255,255,0.08)',
                        'rgba(0,255,65,0.3)',
                        'rgba(255,255,255,0.08)',
                    ],
                }}
                transition={{ duration: 2.5, repeat: Infinity, ease: 'easeInOut' }}
                className="border border-dust-border bg-[rgba(255,255,255,0.02)] p-5 relative overflow-hidden"
            >
                <motion.div
                    animate={{ width: ['0%', '100%'] }}
                    transition={{ duration: 2.5, repeat: Infinity, ease: 'linear' }}
                    className="absolute top-0 left-0 h-[2px] bg-dust-green/50"
                />
                <div className="text-center">
                    <div className="text-[13px] font-bold text-white">PBKDF2-SHA512</div>
                    <div className="text-[9px] text-dust-muted mt-1">
                        100,000 iterations · produces 64 bytes
                    </div>
                </div>
            </motion.div>

            {/* Arrow: split */}
            <FlowArrow label="splits into" />

            {/* STEP 3 — Two output keys */}
            <div className="flex items-center gap-2 mb-3">
                <span className="text-[9px] text-dust-green font-bold w-5 h-5 border border-dust-green/30 flex items-center justify-center">3</span>
                <span className="text-[9px] text-dust-muted uppercase tracking-wider">Two keys are derived</span>
            </div>
            <div className="grid grid-cols-2 gap-4">
                <div className="border border-dust-green/40 bg-[rgba(0,255,65,0.03)] p-4 flex flex-col items-center text-center">
                    <Lock className="w-5 h-5 text-dust-green mb-2" />
                    <div className="text-[12px] font-bold text-white">Spend Key</div>
                    <div className="text-[9px] text-dust-green mt-1">Controls funds</div>
                    <div className="text-[8px] text-dust-muted mt-0.5">First 32 bytes</div>
                    <div className="mt-2 px-2 py-0.5 border border-red-500/20 bg-red-500/5 text-[7px] text-red-400 uppercase tracking-wider">
                        NEVER STORED
                    </div>
                </div>
                <div className="border border-dust-border bg-[rgba(255,255,255,0.02)] p-4 flex flex-col items-center text-center">
                    <Eye className="w-5 h-5 text-dust-muted mb-2" />
                    <div className="text-[12px] font-bold text-white">View Key</div>
                    <div className="text-[9px] text-dust-muted mt-1">Detects payments</div>
                    <div className="text-[8px] text-dust-muted mt-0.5">Last 32 bytes</div>
                    <div className="mt-2 px-2 py-0.5 border border-red-500/20 bg-red-500/5 text-[7px] text-red-400 uppercase tracking-wider">
                        NEVER STORED
                    </div>
                </div>
            </div>

            {/* Footer */}
            <div className="flex items-center justify-center gap-2 mt-5 pt-4 border-t border-dust-border">
                <motion.div
                    animate={{ opacity: [0.3, 1, 0.3] }}
                    transition={{ duration: 1.5, repeat: Infinity }}
                    className="w-1.5 h-1.5 bg-dust-amber rounded-sm"
                />
                <span className="text-[9px] text-dust-amber tracking-wider">
                    BOTH INPUTS REQUIRED — NEITHER ALONE IS SUFFICIENT
                </span>
            </div>
        </div>
    )
}
