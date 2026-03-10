"use client";
import React, { useEffect, useState } from 'react'
import { motion } from 'framer-motion'

export function PaymentLinkCard() {
    const [payments, setPayments] = useState(14)

    useEffect(() => {
        const interval = setInterval(() => {
            setPayments((p) => p + 1)
        }, 6000)
        return () => clearInterval(interval)
    }, [])

    return (
        <div className="w-full border border-dust-border bg-[#06080F] rounded-sm overflow-hidden">
            {/* URL bar */}
            <div className="px-4 py-3 border-b border-dust-border flex items-center justify-between">
                <div className="flex items-center gap-2 font-mono text-[12px]">
                    <span className="text-dust-muted">dustprotocol.app</span>
                    <span className="text-dust-green">/pay/alice/freelance</span>
                </div>
                <div className="flex items-center gap-1.5 px-2 py-0.5 bg-[rgba(0,255,65,0.06)] border border-dust-green/20 rounded-full">
                    <motion.div
                        animate={{ opacity: [0.4, 1, 0.4] }}
                        transition={{ duration: 1.5, repeat: Infinity }}
                        className="w-1.5 h-1.5 rounded-full bg-dust-green"
                    />
                    <span className="text-[9px] text-dust-green font-bold tracking-wide">LIVE</span>
                </div>
            </div>

            {/* Stats grid */}
            <div className="grid grid-cols-3 divide-x divide-[rgba(255,255,255,0.05)]">
                {/* Payments */}
                <div className="p-4 text-center">
                    <span className="block text-[10px] text-dust-muted uppercase tracking-wider mb-1.5">
                        Payments
                    </span>
                    <motion.span
                        key={payments}
                        initial={{ color: '#00FF41' }}
                        animate={{ color: '#ffffff' }}
                        transition={{ duration: 0.8 }}
                        className="block text-lg font-bold font-mono"
                    >
                        {payments}
                    </motion.span>
                </div>

                {/* Volume */}
                <div className="p-4 text-center">
                    <span className="block text-[10px] text-dust-muted uppercase tracking-wider mb-1.5">
                        Volume
                    </span>
                    <span className="block text-lg font-bold font-mono text-white">
                        0.84 ETH
                    </span>
                </div>

                {/* Last Payment */}
                <div className="p-4 text-center">
                    <span className="block text-[10px] text-dust-muted uppercase tracking-wider mb-1.5">
                        Last Paid
                    </span>
                    <div className="flex items-center justify-center gap-1.5">
                        <div className="w-1.5 h-1.5 rounded-full bg-dust-green" />
                        <span className="text-sm font-mono text-white">Just now</span>
                    </div>
                </div>
            </div>
        </div>
    )
}
